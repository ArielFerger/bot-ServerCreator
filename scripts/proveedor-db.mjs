/**
 * Ajusta el bloque `datasource` del esquema de Prisma según el entorno.
 *
 * Prisma exige que el provider sea una cadena literal en el esquema: no acepta
 * `env("...")`. Y las dos bases que nos interesan son legítimas:
 *
 * - **SQLite** en local, para que clonar el repo y arrancar no pida instalar nada.
 * - **Postgres** en la instancia pública, donde el sistema de archivos del
 *   contenedor es efímero y la web y el bot corren en procesos separados.
 *
 * Mantener dos esquemas casi idénticos se desincroniza el primer día, así que
 * hay uno solo y esta línea se reescribe antes de `prisma generate` y de
 * `prisma db push`. Es idempotente: si ya está bien, no toca el archivo.
 *
 * Lo mismo con `directUrl`, que hace falta con los pooler de transacciones
 * (Supabase en modo transacción, puerto 6543; PgBouncer en general). Por ahí
 * las conexiones se reciclan entre sentencias, que es lo que quiere una función
 * serverless pero lo que rompe a `prisma db push`: las migraciones necesitan una
 * sesión estable. Se añade solo si hay DIRECT_URL en el entorno, porque
 * referenciar una variable que no existe hace fallar a Prisma.
 *
 *   npm run db:proveedor
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ESQUEMA = join(dirname(fileURLToPath(import.meta.url)), "..", "prisma", "schema.prisma");

/** El proveedor que le corresponde a una URL de conexión. */
export function proveedorDe(url) {
  if (!url) return null;
  if (/^postgres(ql)?:\/\//i.test(url)) return "postgresql";
  if (/^file:/i.test(url) || url.endsWith(".db")) return "sqlite";
  return null;
}

const url = process.env.DATABASE_URL;
const proveedor = proveedorDe(url);

if (!proveedor) {
  // Sin URL reconocible no se adivina: se deja el esquema como está para no
  // romper un `prisma generate` que iba a funcionar igual.
  if (url) console.warn(`⚠ No reconozco la DATABASE_URL: dejo el esquema como está.`);
  process.exit(0);
}

/** SQLite no tiene pooler: `directUrl` ahí solo sería ruido. */
const conDirecta = proveedor === "postgresql" && Boolean(process.env.DIRECT_URL);

const antes = readFileSync(ESQUEMA, "utf8");
const despues = antes.replace(/datasource\s+db\s*\{[^}]*\}/s, () => {
  const lineas = [
    "datasource db {",
    `  provider  = "${proveedor}"`,
    '  url       = env("DATABASE_URL")',
    ...(conDirecta ? ['  directUrl = env("DIRECT_URL")'] : []),
    "}",
  ];
  return lineas.join("\n");
});

if (antes === despues) {
  console.log(`· El esquema ya usa ${proveedor}${conDirecta ? " con conexión directa" : ""}.`);
} else {
  writeFileSync(ESQUEMA, despues);
  console.log(`✅ Esquema ajustado a ${proveedor}${conDirecta ? " con conexión directa" : ""}.`);
}
