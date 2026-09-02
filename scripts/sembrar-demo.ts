/**
 * Crea un usuario de demostración con sesión iniciada, para poder trabajar en la
 * interfaz sin tener credenciales de Discord configuradas.
 *
 *   npm run demo
 *
 * Imprime una cookie que se pega en el navegador (o se usa con curl). Lo que
 * necesita Discord de verdad —listar servidores, aplicar plantillas— seguirá sin
 * funcionar; esto sirve para el editor, que es puro cliente.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { plantillaDeGaleria } from "@aribuilder/core/galeria";

const prisma = new PrismaClient();

async function main() {
  const usuario = await prisma.user.upsert({
    where: { email: "demo@aribuilder.local" },
    update: {},
    create: { email: "demo@aribuilder.local", name: "Usuario de demostración" },
  });

  // Una sesión limpia cada vez; las viejas se caducan solas.
  const sessionToken = randomUUID();
  await prisma.session.create({
    data: { sessionToken, userId: usuario.id, expires: new Date(Date.now() + 7 * 864e5) },
  });

  const yaTiene = await prisma.template.count({ where: { ownerId: usuario.id } });
  if (yaTiene === 0) {
    for (const clave of ["gaming", "estudio"] as const) {
      const p = plantillaDeGaleria(clave);
      await prisma.template.create({
        data: {
          ownerId: usuario.id,
          nombre: p.meta.nombre,
          descripcion: p.meta.descripcion,
          emoji: p.meta.emoji,
          json: JSON.stringify(p),
          origen: "galeria",
        },
      });
    }
  }

  const plantillas = await prisma.template.findMany({
    where: { ownerId: usuario.id },
    select: { id: true, nombre: true },
  });

  console.log("\n✅ Usuario de demostración listo.\n");
  console.log("   Cookie (pegala en las DevTools del navegador, pestaña Application → Cookies):");
  console.log(`     authjs.session-token = ${sessionToken}\n`);
  console.log("   Plantillas disponibles:");
  for (const p of plantillas) console.log(`     · http://localhost:3000/plantillas/${p.id}  —  ${p.nombre}`);
  console.log("");
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
