/**
 * El nombre del proyecto, en un solo sitio.
 *
 * El bot se llama **AriBuilder** en todas partes: en Discord (usuario y apodo
 * en cada servidor, ver `apps/bot/src/identidad.ts`), en la web y en el motivo
 * que queda escrito en el registro de auditoría del servidor.
 */
export const MARCA = {
  /** Nombre del bot en Discord. El bot lo impone al arrancar y al entrar a un servidor. */
  nombreBot: "AriBuilder",
  /** Nombre del producto en la web. */
  nombreApp: "AriBuilder",
  emoji: "🔨",
  lema: "Tu servidor de Discord, montado en un minuto.",
} as const;

/**
 * Lo que ve el dueño del servidor en el registro de auditoría junto a cada cosa
 * creada. Que diga quién lo hizo evita el susto de ver treinta canales nuevos
 * sin explicación.
 */
export const MOTIVO_AUDITORIA = `Plantilla aplicada con ${MARCA.nombreApp}`;
