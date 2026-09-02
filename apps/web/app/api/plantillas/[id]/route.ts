import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validarPlantilla } from "@aribuilder/core";

export const runtime = "nodejs";

/** Solo el dueño puede tocar su plantilla. */
async function propia(id: string, userId: string) {
  return prisma.template.findFirst({ where: { id, ownerId: userId }, select: { id: true } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const { id } = await params;
  if (!(await propia(id, sesion.user.id))) {
    return NextResponse.json({ error: "No encontramos esa plantilla." }, { status: 404 });
  }

  const { plantilla } = (await request.json()) as { plantilla?: unknown };
  const resultado = validarPlantilla(plantilla);
  if (!resultado.ok) {
    return NextResponse.json(
      {
        error: "La plantilla tiene errores y no se puede guardar.",
        detalles: resultado.errores.slice(0, 5).map((e) => `${e.ruta || "(raíz)"}: ${e.mensaje}`),
      },
      { status: 400 },
    );
  }

  const p = resultado.plantilla;
  await prisma.template.update({
    where: { id },
    data: {
      nombre: p.meta.nombre,
      descripcion: p.meta.descripcion,
      emoji: p.meta.emoji ?? null,
      json: JSON.stringify(p),
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const { id } = await params;
  if (!(await propia(id, sesion.user.id))) {
    return NextResponse.json({ error: "No encontramos esa plantilla." }, { status: 404 });
  }

  await prisma.template.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
