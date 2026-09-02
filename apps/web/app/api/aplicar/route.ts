import { NextResponse } from "next/server";
import { auth, tokenDiscordDe } from "@/auth";
import { prisma } from "@/lib/prisma";
import { puedeGestionar, type ServidorDelUsuario } from "@/lib/discord";
import { validarPlantilla, type Plantilla } from "@aribuilder/core";
import { plantillaDeGaleria, CLAVES_GALERIA, type ClaveGaleria } from "@aribuilder/core/galeria";
import {
  aplicar,
  crearRest,
  leerEstado,
  planificar,
  planTieneErrores,
  type Evento,
  type Modo,
} from "@aribuilder/applier";

export const runtime = "nodejs";
/** Aplicar una plantilla grande puede pasar del minuto por los rate limits. */
export const maxDuration = 300;

const MODOS: Modo[] = ["fusionar", "reemplazar", "limpiar"];

interface Cuerpo {
  guildId?: string;
  plantillaGaleria?: string;
  plantillaId?: string;
  modo?: string;
}

/**
 * Comprueba que quien pide aplicar tenga de verdad permiso sobre ese servidor.
 * No basta con que esté logueado: preguntamos a Discord por SU lista, no por la
 * nuestra, para que nadie pueda aplicar plantillas en servidores ajenos.
 */
async function autorizado(userId: string, guildId: string): Promise<boolean> {
  const token = await tokenDiscordDe(userId);
  if (!token) return false;
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return false;
  const guilds = (await res.json()) as ServidorDelUsuario[];
  const guild = guilds.find((g) => g.id === guildId);
  return guild !== undefined && puedeGestionar(guild);
}

async function resolverPlantilla(cuerpo: Cuerpo, userId: string): Promise<Plantilla | null> {
  if (cuerpo.plantillaGaleria) {
    if (!CLAVES_GALERIA.includes(cuerpo.plantillaGaleria as ClaveGaleria)) return null;
    return plantillaDeGaleria(cuerpo.plantillaGaleria as ClaveGaleria);
  }
  if (cuerpo.plantillaId) {
    const guardada = await prisma.template.findFirst({
      where: { id: cuerpo.plantillaId, OR: [{ ownerId: userId }, { esPublica: true }] },
    });
    if (!guardada) return null;
    const resultado = validarPlantilla(JSON.parse(guardada.json));
    return resultado.ok ? resultado.plantilla : null;
  }
  return null;
}

export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const cuerpo = (await request.json()) as Cuerpo;
  const guildId = cuerpo.guildId;
  if (!guildId) return NextResponse.json({ error: "Falta el servidor." }, { status: 400 });

  if (!(await autorizado(sesion.user.id, guildId))) {
    return NextResponse.json({ error: "No tenés permiso para configurar ese servidor." }, { status: 403 });
  }

  const modo = (cuerpo.modo ?? "fusionar") as Modo;
  if (!MODOS.includes(modo)) return NextResponse.json({ error: "Modo desconocido." }, { status: 400 });

  const plantilla = await resolverPlantilla(cuerpo, sesion.user.id);
  if (!plantilla) return NextResponse.json({ error: "No encontramos esa plantilla." }, { status: 404 });

  const rest = crearRest(process.env.DISCORD_BOT_TOKEN!);

  let estado;
  try {
    estado = await leerEstado(rest, guildId);
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer el servidor. ¿Sigue el bot dentro? Volvé a invitarlo desde la lista de servidores." },
      { status: 502 },
    );
  }

  const plan = planificar(plantilla, estado, modo);
  if (planTieneErrores(plan)) {
    const d = plan.diagnosticos.find((x) => x.nivel === "error")!;
    return NextResponse.json({ error: d.mensaje, solucion: d.solucion }, { status: 409 });
  }

  const ejecucion = await prisma.applyRun.create({
    data: {
      userId: sesion.user.id,
      templateId: cuerpo.plantillaId ?? null,
      guildId,
      guildName: estado.nombre,
      modo,
      estado: "aplicando",
    },
  });

  // El progreso se transmite por SSE: una aplicación de dos minutos tiene que
  // verse avanzar, no parecer colgada.
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (evento: Evento | { tipo: "ejecucion"; id: string }) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`));

      const log: Evento[] = [];
      enviar({ tipo: "ejecucion", id: ejecucion.id });

      try {
        for await (const evento of aplicar(plan, rest, guildId)) {
          if (evento.tipo !== "paso") log.push(evento);
          enviar(evento);

          if (evento.tipo === "fin") {
            await prisma.applyRun.update({
              where: { id: ejecucion.id },
              data: {
                estado: evento.fallos > 0 ? "con-fallos" : "completado",
                fallos: evento.fallos,
                creados: JSON.stringify(evento.creados),
                log: JSON.stringify(log),
              },
            });

            // Los paneles de auto-rol quedan registrados para que el bot de
            // gateway sepa que un botón que le llega salió de verdad de aquí.
            if (evento.creados.paneles.length > 0) {
              await prisma.autoRolePanel.createMany({
                data: evento.creados.paneles.map((panel) => ({
                  guildId,
                  channelId: panel.canalId,
                  messageId: panel.mensajeId,
                  roles: JSON.stringify(panel.roles),
                })),
              });
            }
          }
        }
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : "Error inesperado";
        enviar({ tipo: "error", mensaje });
        await prisma.applyRun.update({
          where: { id: ejecucion.id },
          data: { estado: "error", log: JSON.stringify([...log, { tipo: "error", mensaje }]) },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Sin esto algunos proxys retienen el stream hasta el final.
      "X-Accel-Buffering": "no",
    },
  });
}
