/**
 * Ajusta el `provider` del esquema de Prisma según la DATABASE_URL.
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

const antes = readFileSync(ESQUEMA, "utf8");
const despues = antes.replace(/(datasource\s+db\s*\{[^}]*?provider\s*=\s*)"[^"]*"/s, `$1"${proveedor}"`);

if (antes === despues) {
  console.log(`· El esquema ya usa ${proveedor}.`);
} else {
  writeFileSync(ESQUEMA, despues);
  console.log(`✅ Esquema ajustado a ${proveedor}.`);
}
