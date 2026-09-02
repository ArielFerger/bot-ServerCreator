/**
 * Acceso de demostración: entrar sin credenciales de Discord para poder trabajar
 * en el editor.
 *
 * Es una puerta trasera, así que está cerrada con dos cerrojos independientes.
 * Con que falle uno, no se abre.
 */

export const CORREO_DEMO = "demo@aribuilder.local";
export const NOMBRE_DEMO = "Usuario de demostración";

export interface MotivoBloqueo {
  permitido: false;
  motivo: string;
}

export type Veredicto = { permitido: true } | MotivoBloqueo;

/** Solo se consideran locales estos nombres de máquina. */
function esLocal(host: string | null): boolean {
  if (!host) return false;
  // El host llega como "localhost:3000" o "[::1]:3000".
  const sinPuerto = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "").toLowerCase();
  return sinPuerto === "localhost" || sinPuerto === "127.0.0.1" || sinPuerto === "::1";
}

/**
 * Los dos cerrojos:
 *   1. Nunca en producción. Las imágenes de Docker llevan NODE_ENV=production,
 *      así que ahí no existe ni aunque alguien lo intente.
 *   2. Solo desde la propia máquina. Cubre el caso de dejar `next dev`
 *      escuchando en una red o expuesto por un túnel.
 */
export function puedeUsarDemo(entorno: string | undefined, host: string | null): Veredicto {
  if (entorno === "production") {
    return { permitido: false, motivo: "El acceso de demostración no existe en producción." };
  }
  if (!esLocal(host)) {
    return {
      permitido: false,
      motivo: "El acceso de demostración solo funciona desde la propia máquina (localhost).",
    };
  }
  return { permitido: true };
}
