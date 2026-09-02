import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { crearRest, deshacer, type Creados, type Evento } from "@aribuilder/applier";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Borra exactamente lo que creó una ejecución concreta, ni un canal más.
 * Es la red de seguridad que hace que alguien se anime a apretar «Aplicar».
 */
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const { ejecucionId } = (await request.json()) as { ejecucionId?: string };
  if (!ejecucionId) return NextResponse.json({ error: "Falta la ejecución." }, { status: 400 });

  // Solo se puede deshacer lo propio: el dueño de la ejecución.
  const ejecucion = await prisma.applyRun.findFirst({
    where: { id: ejecucionId, userId: sesion.user.id },
  });
  if (!ejecucion) return NextResponse.json({ error: "No encontramos esa aplicación." }, { status: 404 });
  if (ejecucion.estado === "deshecho") {
    return NextResponse.json({ error: "Esa aplicación ya se deshizo." }, { status: 409 });
  }

  const creados = JSON.parse(ejecucion.creados) as Creados;
  const rest = crearRest(process.env.DISCORD_BOT_TOKEN!);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enviar = (evento: Evento) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evento)}\n\n`));
      try {
        for await (const evento of deshacer(creados, rest, ejecucion.guildId)) {
          enviar(evento);
          if (evento.tipo === "fin") {
            // Los mensajes de panel se van con sus canales; sus filas también.
            const mensajes = (creados.paneles ?? []).map((p) => p.mensajeId);
            if (mensajes.length > 0) {
              await prisma.autoRolePanel.deleteMany({ where: { messageId: { in: mensajes } } });
            }
            await prisma.applyRun.update({
              where: { id: ejecucion.id },
              data: { estado: "deshecho", creados: "{}" },
            });
          }
        }
      } catch (error) {
        enviar({ tipo: "error", mensaje: error instanceof Error ? error.message : "Error inesperado" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
