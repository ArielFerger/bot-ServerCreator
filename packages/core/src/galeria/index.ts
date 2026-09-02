import { plantillaSchema, type Plantilla, type EntradaPlantilla } from "../schema";
import { gaming } from "./gaming";
import { comunidad } from "./comunidad";
import { estudio } from "./estudio";
import { streamer } from "./streamer";
import { trabajo } from "./trabajo";
import { soporte } from "./soporte";

/**
 * Plantillas listas para usar. Se escriben en TypeScript (no en JSON suelto)
 * para poder apoyarse en `preset()` y para que el compilador cace un rol mal
 * escrito al escribirlas, no al aplicarlas. La app las serializa a JSON cuando
 * el usuario las exporta.
 */
const CRUDAS = { gaming, comunidad, estudio, streamer, trabajo, soporte } as const satisfies Record<
  string,
  EntradaPlantilla
>;

export type ClaveGaleria = keyof typeof CRUDAS;

export const CLAVES_GALERIA = Object.keys(CRUDAS) as ClaveGaleria[];

/** Devuelve la plantilla ya validada y con los valores por defecto rellenos. */
export function plantillaDeGaleria(clave: ClaveGaleria): Plantilla {
  return plantillaSchema.parse(CRUDAS[clave]);
}

/** Listado para la pantalla de elección de plantilla. */
export function listarGaleria(): { clave: ClaveGaleria; plantilla: Plantilla }[] {
  return CLAVES_GALERIA.map((clave) => ({ clave, plantilla: plantillaDeGaleria(clave) }));
}

export { gaming, comunidad, estudio, streamer, trabajo, soporte };
