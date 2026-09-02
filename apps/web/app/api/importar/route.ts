import { NextResponse } from "next/server";
import { auth, tokenDiscordDe } from "@/auth";
import { prisma } from "@/lib/prisma";
import { puedeGestionar, type ServidorDelUsuario } from "@/lib/discord";
import { crearRest, importarServidor } from "@aribuilder/applier";

export const runtime = "nodejs";

/**
 * Clona un servidor existente como plantilla reutilizable.
 * Requiere que el bot esté dentro (es quien lee la estructura) y que el usuario
 * tenga permiso de gestión sobre ese servidor.
 */
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const { guildId } = (await request.json()) as { guildId?: string };
  if (!guildId) return NextResponse.json({ error: "Falta el servidor." }, { status: 400 });

  const token = await tokenDiscordDe(sesion.user.id);
  if (!token) return NextResponse.json({ error: "Tu sesión con Discord caducó." }, { status: 401 });

  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const guilds = res.ok ? ((await res.json()) as ServidorDelUsuario[]) : [];
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild || !puedeGestionar(guild)) {
    return NextResponse.json({ error: "No tenés permiso sobre ese servidor." }, { status: 403 });
  }

  let resultado;
  try {
    resultado = await importarServidor(crearRest(process.env.DISCORD_BOT_TOKEN!), guildId);
  } catch {
    return NextResponse.json(
      { error: "No pudimos leer el servidor. ¿Sigue el bot dentro? Volvé a invitarlo desde la lista de servidores." },
      { status: 502 },
    );
  }

  const { plantilla, omisiones } = resultado;
  const creada = await prisma.template.create({
    data: {
      ownerId: sesion.user.id,
      nombre: plantilla.meta.nombre,
      descripcion: plantilla.meta.descripcion,
      emoji: plantilla.meta.emoji ?? null,
      json: JSON.stringify(plantilla),
      origen: "importada",
    },
    select: { id: true },
  });

  return NextResponse.json({ id: creada.id, omisiones }, { status: 201 });
}
