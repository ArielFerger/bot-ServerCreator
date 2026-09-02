import { NextResponse } from "next/server";
import { auth, tokenDiscordDe } from "@/auth";
import { puedeGestionar, type ServidorDelUsuario } from "@/lib/discord";
import { validarPlantilla, type Plantilla } from "@aribuilder/core";
import { plantillaDeGaleria, CLAVES_GALERIA, type ClaveGaleria } from "@aribuilder/core/galeria";
import { crearRest, leerEstado, planificar, type Modo } from "@aribuilder/applier";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Vista previa: el mismo plan que se ejecutaría, pero sin ejecutarlo.
 * Al ser `planificar` una función pura, «ver qué va a pasar» y «hacerlo» no
 * pueden divergir.
 */
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const { guildId, plantillaGaleria, plantillaId, modo } = (await request.json()) as {
    guildId?: string;
    plantillaGaleria?: string;
    plantillaId?: string;
    modo?: Modo;
  };

  if (!guildId) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });

  let plantilla: Plantilla;
  if (plantillaGaleria) {
    if (!CLAVES_GALERIA.includes(plantillaGaleria as ClaveGaleria)) {
      return NextResponse.json({ error: "Plantilla desconocida." }, { status: 404 });
    }
    plantilla = plantillaDeGaleria(plantillaGaleria as ClaveGaleria);
  } else if (plantillaId) {
    const guardada = await prisma.template.findFirst({
      where: { id: plantillaId, OR: [{ ownerId: sesion.user.id }, { esPublica: true }] },
    });
    const resultado = guardada ? validarPlantilla(JSON.parse(guardada.json)) : null;
    if (!resultado?.ok) return NextResponse.json({ error: "No encontramos esa plantilla." }, { status: 404 });
    plantilla = resultado.plantilla;
  } else {
    return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  }

  const token = await tokenDiscordDe(sesion.user.id);
  if (!token) return NextResponse.json({ error: "Tu sesión con Discord caducó." }, { status: 401 });

  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const guilds = res.ok ? ((await res.json()) as ServidorDelUsuario[]) : [];
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild || !puedeGestionar(guild)) {
    return NextResponse.json({ error: "No tenés permiso para configurar ese servidor." }, { status: 403 });
  }

  try {
    const estado = await leerEstado(crearRest(process.env.DISCORD_BOT_TOKEN!), guildId);
    const plan = planificar(plantilla, estado, modo ?? "fusionar");
    // Las acciones no le sirven de nada al navegador y abultan mucho.
    const { acciones: _, ...resto } = plan;
    return NextResponse.json(resto);
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer el servidor. ¿Sigue el bot dentro?" },
      { status: 502 },
    );
  }
}
