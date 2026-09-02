import { CLAVE_EVERYONE, todosLosCanales, type Plantilla } from "./schema";

/**
 * Generación de claves simbólicas para el editor.
 *
 * Las claves son el pegamento de toda la plantilla: los overwrites y los ajustes
 * apuntan a ellas. Si el editor genera una clave repetida, la validación falla y
 * el usuario ve un error que no ha causado él. De ahí que esto viva en `core`,
 * con tests, y no suelto en un componente.
 */

/** "📢 BIENVENIDA" -> "bienvenida". Nunca devuelve cadena vacía. */
export function aClave(texto: string): string {
  const base = texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes: "diseño" -> "diseno"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "elemento";
}

/** Añade un sufijo numérico hasta que la clave no choque con ninguna existente. */
export function claveUnica(deseada: string, usadas: ReadonlySet<string>): string {
  const base = aClave(deseada);
  if (!usadas.has(base)) return base;
  for (let n = 2; ; n++) {
    const intento = `${base}-${n}`;
    if (!usadas.has(intento)) return intento;
  }
}

/** Todas las claves ocupadas en una plantilla: roles, categorías y canales. */
export function clavesUsadas(plantilla: Plantilla): Set<string> {
  const usadas = new Set<string>([CLAVE_EVERYONE]);
  for (const rol of plantilla.roles) usadas.add(rol.clave);
  for (const cat of plantilla.categorias) usadas.add(cat.clave);
  for (const { canal } of todosLosCanales(plantilla)) usadas.add(canal.clave);
  return usadas;
}

/** Atajo para el editor: clave libre a partir de un nombre visible. */
export function claveNueva(plantilla: Plantilla, nombre: string): string {
  return claveUnica(nombre, clavesUsadas(plantilla));
}
