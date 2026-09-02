import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CORREO_DEMO, NOMBRE_DEMO, puedeUsarDemo } from "@/lib/demo";
import { plantillaDeGaleria, CLAVES_GALERIA } from "@aribuilder/core/galeria";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Entrar como usuario de demostración sin pasar por Discord.
 *
 * Sirve para trabajar en el editor antes de tener las credenciales. Los cerrojos
 * están en `puedeUsarDemo`, con sus propios tests: en producción esta ruta
 * responde 404 como si no existiera.
 */
export async function GET(request: Request) {
  const veredicto = puedeUsarDemo(process.env.NODE_ENV, request.headers.get("host"));
  if (!veredicto.permitido) {
    // 404 y no 403: fuera de desarrollo esta ruta no debería ni insinuar que existe.
    return new NextResponse(veredicto.motivo, { status: 404 });
  }

  const usuario = await prisma.user.upsert({
    where: { email: CORREO_DEMO },
    update: {},
    create: { email: CORREO_DEMO, name: NOMBRE_DEMO },
  });

  // La primera vez se cargan unas plantillas para tener algo que abrir.
  if ((await prisma.template.count({ where: { ownerId: usuario.id } })) === 0) {
    for (const clave of CLAVES_GALERIA) {
      const p = plantillaDeGaleria(clave);
      await prisma.template.create({
        data: {
          ownerId: usuario.id,
          nombre: p.meta.nombre,
          descripcion: p.meta.descripcion,
          emoji: p.meta.emoji ?? null,
          json: JSON.stringify(p),
          origen: "galeria",
        },
      });
    }
  }

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + 7 * 864e5);
  await prisma.session.create({ data: { sessionToken, userId: usuario.id, expires } });

  const respuesta = NextResponse.redirect(new URL("/plantillas", request.url));
  respuesta.cookies.set("authjs.session-token", sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return respuesta;
}
