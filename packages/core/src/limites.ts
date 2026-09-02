/**
 * Topes reales de la API de Discord. Se validan antes de tocar la red: es mucho
 * mejor decirle al usuario "te pasaste de 50 canales en esta categoría" en el
 * editor que dejarlo a mitad de una aplicación fallida.
 */
export const LIMITES = {
  canalesPorServidor: 500,
  canalesPorCategoria: 50,
  categoriasPorServidor: 50,
  rolesPorServidor: 250,
  emojisNivel0: 50,

  nombreCanal: 100,
  nombreCategoria: 100,
  nombreRol: 100,
  nombreEmoji: 32,
  temaCanal: 1024,

  contenidoMensaje: 2000,
  tituloEmbed: 256,
  descripcionEmbed: 4096,
  camposEmbed: 25,

  /** Discord solo acepta estos valores para el temporizador de AFK (segundos). */
  afkTimeouts: [60, 300, 900, 1800, 3600],
  /** Botones por fila y filas por mensaje: 5 x 5 = 25 roles por panel. */
  rolesPorPanel: 25,
} as const;

/** Los nombres de canal de texto los normaliza Discord; lo hacemos nosotros para que la vista previa no mienta. */
export function normalizarNombreCanal(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, LIMITES.nombreCanal);
}
