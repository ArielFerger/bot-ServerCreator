import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validarPlantilla, plantillaSchema, type Plantilla } from "@aribuilder/core";
import { plantillaDeGaleria, CLAVES_GALERIA, type ClaveGaleria } from "@aribuilder/core/galeria";

export const runtime = "nodejs";

/** Punto de partida de una plantilla en blanco. */
function plantillaVacia(nombre: string): Plantilla {
  return plantillaSchema.parse({
    version: 1,
    meta: { nombre, descripcion: "", emoji: "✨" },
    roles: [],
    categorias: [],
  });
}

/**
 * Crea una plantilla del usuario. Tres orígenes posibles:
 *   · `galeria`  — copia una de la galería para poder retocarla
 *   · `json`     — un archivo que el usuario sube o pega
 *   · nada       — plantilla en blanco
 */
export async function POST(request: Request) {
  const sesion = await auth();
  if (!sesion?.user) return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });

  const cuerpo = (await request.json().catch(() => ({}))) as {
    galeria?: string;
    json?: unknown;
    nombre?: string;
  };

  let plantilla: Plantilla;
  let origen = "editor";

  if (cuerpo.galeria) {
    if (!CLAVES_GALERIA.includes(cuerpo.galeria as ClaveGaleria)) {
      return NextResponse.json({ error: "Esa plantilla de la galería no existe." }, { status: 404 });
    }
    plantilla = plantillaDeGaleria(cuerpo.galeria as ClaveGaleria);
    origen = "galeria";
  } else if (cuerpo.json !== undefined) {
    const resultado = validarPlantilla(cuerpo.json);
    if (!resultado.ok) {
      return NextResponse.json(
        {
          error: "El archivo no es una plantilla válida.",
          detalles: resultado.errores.slice(0, 5).map((e) => `${e.ruta || "(raíz)"}: ${e.mensaje}`),
        },
        { status: 400 },
      );
    }
    plantilla = resultado.plantilla;
    origen = "importada";
  } else {
    plantilla = plantillaVacia(cuerpo.nombre?.trim() || "Mi plantilla");
  }

  const creada = await prisma.template.create({
    data: {
      ownerId: sesion.user.id,
      nombre: plantilla.meta.nombre,
      descripcion: plantilla.meta.descripcion,
      emoji: plantilla.meta.emoji ?? null,
      json: JSON.stringify(plantilla),
      origen,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: creada.id }, { status: 201 });
}
