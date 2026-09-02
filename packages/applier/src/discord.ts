import { REST } from "@discordjs/rest";
import {
  ChannelType,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildVerificationLevel,
  PermissionFlagsBits,
  Routes,
  type APIGuild,
  type APIGuildChannel,
  type APIGuildMember,
  type APIRole,
  type APIUser,
} from "discord-api-types/v10";
import { aBitfield, type Ajustes } from "@aribuilder/core";
import { ErrorAplicacion, type EstadoServidor } from "./tipos";

export function crearRest(token: string): REST {
  return new REST({ version: "10" }).setToken(token);
}

export const NIVEL_VERIFICACION: Record<Ajustes["nivelVerificacion"], GuildVerificationLevel> = {
  ninguno: GuildVerificationLevel.None,
  bajo: GuildVerificationLevel.Low,
  medio: GuildVerificationLevel.Medium,
  alto: GuildVerificationLevel.High,
  "muy-alto": GuildVerificationLevel.VeryHigh,
};

export const FILTRO_CONTENIDO: Record<Ajustes["filtroContenido"], GuildExplicitContentFilter> = {
  desactivado: GuildExplicitContentFilter.Disabled,
  "sin-rol": GuildExplicitContentFilter.MembersWithoutRoles,
  todos: GuildExplicitContentFilter.AllMembers,
};

export const NOTIFICACIONES: Record<Ajustes["notificacionesPorDefecto"], GuildDefaultMessageNotifications> = {
  "todos-los-mensajes": GuildDefaultMessageNotifications.AllMessages,
  "solo-menciones": GuildDefaultMessageNotifications.OnlyMentions,
};

/** Hex "#e74c3c" -> entero, que es lo que espera la API. */
export function colorAEntero(hex: string | undefined): number | undefined {
  return hex === undefined ? undefined : Number.parseInt(hex.slice(1), 16);
}

/**
 * Lee el estado del servidor: es lo que come el planificador. Se hace en una
 * sola tanda para no gastar rate limit antes de empezar de verdad.
 */
export async function leerEstado(rest: REST, guildId: string): Promise<EstadoServidor> {
  const [guild, canales, yo] = await Promise.all([
    rest.get(Routes.guild(guildId)) as Promise<APIGuild>,
    rest.get(Routes.guildChannels(guildId)) as Promise<APIGuildChannel<ChannelType>[]>,
    rest.get(Routes.user("@me")) as Promise<APIUser>,
  ]);

  const miembro = (await rest.get(Routes.guildMember(guildId, yo.id))) as APIGuildMember;
  const rolesDelBot = (guild.roles ?? []).filter((r) => miembro.roles.includes(r.id));
  const permisos = rolesDelBot.reduce((acc, r) => acc | BigInt(r.permissions), 0n);
  const tiene = (bandera: bigint) =>
    (permisos & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator ||
    (permisos & bandera) === bandera;

  return {
    id: guildId,
    nombre: guild.name,
    funciones: guild.features ?? [],
    nivelBoost: guild.premium_tier ?? 0,
    roles: (guild.roles ?? []).map((r: APIRole) => ({
      id: r.id,
      nombre: r.name,
      posicion: r.position,
      gestionado: r.managed ?? false,
    })),
    canales: canales.map((c) => ({
      id: c.id,
      nombre: c.name ?? "",
      tipo: c.type,
      padreId: "parent_id" in c ? ((c as { parent_id: string | null }).parent_id ?? null) : null,
    })),
    emojis: (guild.emojis ?? []).map((e) => ({ id: e.id ?? "", nombre: e.name ?? "" })),
    bot: {
      id: yo.id,
      posicionRolMasAlto: rolesDelBot.reduce((max, r) => Math.max(max, r.position), 0),
      esAdministrador: (permisos & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator,
      puedeGestionarRoles: tiene(PermissionFlagsBits.ManageRoles),
      puedeGestionarCanales: tiene(PermissionFlagsBits.ManageChannels),
      puedeGestionarServidor: tiene(PermissionFlagsBits.ManageGuild),
      puedeGestionarExpresiones: tiene(PermissionFlagsBits.ManageGuildExpressions),
    },
  };
}

/** Descarga un emoji y lo pasa a data URI, que es como los quiere Discord. */
export async function urlADataUri(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new ErrorAplicacion(`No se pudo descargar la imagen (${res.status})`);
  const tipo = res.headers.get("content-type") ?? "image/png";
  if (!/^image\/(png|jpeg|gif|webp)$/.test(tipo)) {
    throw new ErrorAplicacion(`El archivo no es una imagen admitida (${tipo})`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 256 * 1024) {
    throw new ErrorAplicacion("La imagen pesa más de 256 KB, que es el tope de Discord para emojis");
  }
  return `data:${tipo};base64,${buf.toString("base64")}`;
}

export function permisosARest(permitir: readonly string[], denegar: readonly string[]) {
  return {
    allow: aBitfield(permitir as never).toString(),
    deny: aBitfield(denegar as never).toString(),
  };
}

interface RespuestaDiscord {
  status?: number;
  code?: number;
  rawError?: { message?: string; code?: number };
  message?: string;
}

/**
 * Traduce el error crudo de Discord a algo que un usuario que no programa pueda
 * accionar. Los códigos vienen de la lista de errores JSON de la API.
 */
export function traducirError(error: unknown, contexto: string): ErrorAplicacion {
  const e = error as RespuestaDiscord;
  const codigo = e.code ?? e.rawError?.code;
  const estado = e.status;

  const conocidos: Record<number, { mensaje: string; solucion: string }> = {
    50013: {
      mensaje: "Discord rechazó la operación por falta de permisos.",
      solucion:
        "Comprobá que el rol del bot esté arriba de todo en Ajustes del servidor → Roles y que conserve los permisos con los que lo invitaste.",
    },
    50001: {
      mensaje: "El bot no tiene acceso a ese recurso.",
      solucion: "Volvé a invitar al bot al servidor desde el enlace de la app.",
    },
    30013: { mensaje: "El servidor llegó al tope de canales.", solucion: "Borrá canales antes de volver a aplicar." },
    30005: { mensaje: "El servidor llegó al tope de roles (250).", solucion: "Borrá roles que no uses." },
    30008: {
      mensaje: "El servidor llegó al tope de emojis.",
      solucion: "Borrá emojis que no uses o subí el nivel de boost.",
    },
    50035: {
      mensaje: "Discord rechazó los datos enviados por no cumplir su formato.",
      solucion: "Revisá nombres y textos demasiado largos en la plantilla.",
    },
    50028: {
      mensaje: "Alguno de los roles indicados no es válido.",
      solucion: "Puede que se haya borrado un rol mientras se aplicaba la plantilla. Volvé a intentarlo.",
    },
  };

  if (codigo !== undefined && conocidos[codigo]) {
    const { mensaje, solucion } = conocidos[codigo]!;
    return new ErrorAplicacion(`${contexto}: ${mensaje}`, solucion, error);
  }

  if (estado === 401 || estado === 403) {
    return new ErrorAplicacion(
      `${contexto}: Discord rechazó la petición (${estado}).`,
      "Comprobá que el token del bot sea correcto y que el bot siga en el servidor.",
      error,
    );
  }

  if (estado !== undefined && estado >= 500) {
    return new ErrorAplicacion(
      `${contexto}: Discord está teniendo problemas (${estado}).`,
      "No es culpa tuya. Esperá un momento y volvé a intentarlo.",
      error,
    );
  }

  const detalle = e.rawError?.message ?? e.message ?? "error desconocido";
  return new ErrorAplicacion(`${contexto}: ${detalle}`, undefined, error);
}
