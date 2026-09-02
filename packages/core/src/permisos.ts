import { PermissionFlagsBits } from "discord-api-types/v10";

/**
 * Nombres de permisos en español -> bandera de Discord.
 *
 * Esta tabla es la única traducción autorizada: una plantilla nunca contiene
 * bitfields crudos, siempre estos nombres. Un nombre que no esté aquí es un
 * error de validación, no un permiso ignorado en silencio.
 */
export const PERMISOS = {
  // General
  "administrador": PermissionFlagsBits.Administrator,
  "ver-canales": PermissionFlagsBits.ViewChannel,
  "gestionar-canales": PermissionFlagsBits.ManageChannels,
  "gestionar-roles": PermissionFlagsBits.ManageRoles,
  "gestionar-expresiones": PermissionFlagsBits.ManageGuildExpressions,
  "crear-expresiones": PermissionFlagsBits.CreateGuildExpressions,
  "ver-registro-auditoria": PermissionFlagsBits.ViewAuditLog,
  "gestionar-webhooks": PermissionFlagsBits.ManageWebhooks,
  "gestionar-servidor": PermissionFlagsBits.ManageGuild,
  "ver-estadisticas": PermissionFlagsBits.ViewGuildInsights,

  // Miembros
  "crear-invitacion": PermissionFlagsBits.CreateInstantInvite,
  "cambiar-apodo": PermissionFlagsBits.ChangeNickname,
  "gestionar-apodos": PermissionFlagsBits.ManageNicknames,
  "expulsar-miembros": PermissionFlagsBits.KickMembers,
  "banear-miembros": PermissionFlagsBits.BanMembers,
  "moderar-miembros": PermissionFlagsBits.ModerateMembers,

  // Texto
  "enviar-mensajes": PermissionFlagsBits.SendMessages,
  "enviar-mensajes-en-hilos": PermissionFlagsBits.SendMessagesInThreads,
  "crear-hilos-publicos": PermissionFlagsBits.CreatePublicThreads,
  "crear-hilos-privados": PermissionFlagsBits.CreatePrivateThreads,
  "gestionar-hilos": PermissionFlagsBits.ManageThreads,
  "insertar-enlaces": PermissionFlagsBits.EmbedLinks,
  "adjuntar-archivos": PermissionFlagsBits.AttachFiles,
  "anadir-reacciones": PermissionFlagsBits.AddReactions,
  "usar-emojis-externos": PermissionFlagsBits.UseExternalEmojis,
  "usar-stickers-externos": PermissionFlagsBits.UseExternalStickers,
  "mencionar-everyone": PermissionFlagsBits.MentionEveryone,
  "gestionar-mensajes": PermissionFlagsBits.ManageMessages,
  "leer-historial": PermissionFlagsBits.ReadMessageHistory,
  "enviar-mensajes-tts": PermissionFlagsBits.SendTTSMessages,
  "enviar-mensajes-de-voz": PermissionFlagsBits.SendVoiceMessages,
  "crear-encuestas": PermissionFlagsBits.SendPolls,
  "usar-comandos": PermissionFlagsBits.UseApplicationCommands,
  "usar-apps-externas": PermissionFlagsBits.UseExternalApps,

  // Voz
  "conectar": PermissionFlagsBits.Connect,
  "hablar": PermissionFlagsBits.Speak,
  "transmitir": PermissionFlagsBits.Stream,
  "usar-actividades": PermissionFlagsBits.UseEmbeddedActivities,
  "usar-soundboard": PermissionFlagsBits.UseSoundboard,
  "usar-sonidos-externos": PermissionFlagsBits.UseExternalSounds,
  "usar-actividad-voz": PermissionFlagsBits.UseVAD,
  "voz-prioritaria": PermissionFlagsBits.PrioritySpeaker,
  "silenciar-miembros": PermissionFlagsBits.MuteMembers,
  "ensordecer-miembros": PermissionFlagsBits.DeafenMembers,
  "mover-miembros": PermissionFlagsBits.MoveMembers,

  // Escenarios y eventos
  "pedir-hablar": PermissionFlagsBits.RequestToSpeak,
  "crear-eventos": PermissionFlagsBits.CreateEvents,
  "gestionar-eventos": PermissionFlagsBits.ManageEvents,
} as const satisfies Record<string, bigint>;

export type NombrePermiso = keyof typeof PERMISOS;

export const NOMBRES_PERMISO = Object.keys(PERMISOS) as [NombrePermiso, ...NombrePermiso[]];

/** Etiquetas legibles para la interfaz (modo avanzado). */
export const ETIQUETAS_PERMISO: Record<NombrePermiso, string> = {
  "administrador": "Administrador",
  "ver-canales": "Ver canales",
  "gestionar-canales": "Gestionar canales",
  "gestionar-roles": "Gestionar roles",
  "gestionar-expresiones": "Gestionar emojis y stickers",
  "crear-expresiones": "Crear emojis y stickers",
  "ver-registro-auditoria": "Ver registro de auditoría",
  "gestionar-webhooks": "Gestionar webhooks",
  "gestionar-servidor": "Gestionar servidor",
  "ver-estadisticas": "Ver estadísticas del servidor",
  "crear-invitacion": "Crear invitación",
  "cambiar-apodo": "Cambiar su apodo",
  "gestionar-apodos": "Gestionar apodos",
  "expulsar-miembros": "Expulsar miembros",
  "banear-miembros": "Banear miembros",
  "moderar-miembros": "Aislar miembros (timeout)",
  "enviar-mensajes": "Enviar mensajes",
  "enviar-mensajes-en-hilos": "Enviar mensajes en hilos",
  "crear-hilos-publicos": "Crear hilos públicos",
  "crear-hilos-privados": "Crear hilos privados",
  "gestionar-hilos": "Gestionar hilos",
  "insertar-enlaces": "Insertar enlaces",
  "adjuntar-archivos": "Adjuntar archivos",
  "anadir-reacciones": "Añadir reacciones",
  "usar-emojis-externos": "Usar emojis externos",
  "usar-stickers-externos": "Usar stickers externos",
  "mencionar-everyone": "Mencionar @everyone y @here",
  "gestionar-mensajes": "Gestionar mensajes",
  "leer-historial": "Leer historial de mensajes",
  "enviar-mensajes-tts": "Enviar mensajes de texto a voz",
  "enviar-mensajes-de-voz": "Enviar mensajes de voz",
  "crear-encuestas": "Crear encuestas",
  "usar-comandos": "Usar comandos de aplicación",
  "usar-apps-externas": "Usar apps externas",
  "conectar": "Conectar a voz",
  "hablar": "Hablar",
  "transmitir": "Transmitir vídeo",
  "usar-actividades": "Usar actividades",
  "usar-soundboard": "Usar soundboard",
  "usar-sonidos-externos": "Usar sonidos externos",
  "usar-actividad-voz": "Usar actividad de voz",
  "voz-prioritaria": "Voz prioritaria",
  "silenciar-miembros": "Silenciar miembros",
  "ensordecer-miembros": "Ensordecer miembros",
  "mover-miembros": "Mover miembros",
  "pedir-hablar": "Pedir la palabra",
  "crear-eventos": "Crear eventos",
  "gestionar-eventos": "Gestionar eventos",
};

/** Convierte una lista de nombres en el bitfield que espera la API de Discord. */
export function aBitfield(nombres: readonly NombrePermiso[]): bigint {
  let bits = 0n;
  for (const nombre of nombres) bits |= PERMISOS[nombre];
  return bits;
}

/** Inverso de `aBitfield`: usado al importar un servidor existente. */
export function aNombres(bits: bigint): NombrePermiso[] {
  const nombres: NombrePermiso[] = [];
  for (const nombre of NOMBRES_PERMISO) {
    if ((bits & PERMISOS[nombre]) === PERMISOS[nombre]) nombres.push(nombre);
  }
  return nombres;
}

export function esNombrePermiso(valor: string): valor is NombrePermiso {
  return Object.hasOwn(PERMISOS, valor);
}
