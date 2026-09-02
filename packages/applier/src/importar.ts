import type { REST } from "@discordjs/rest";
import {
  ChannelType,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildVerificationLevel,
  Routes,
  type APIGuild,
  type APIGuildChannel,
  type APIOverwrite,
} from "discord-api-types/v10";
import {
  CLAVE_EVERYONE,
  LIMITES,
  aNombres,
  claveUnica,
  plantillaSchema,
  type Ajustes,
  type Canal,
  type Categoria,
  type Overwrite,
  type Plantilla,
  type Rol,
  type TipoCanal,
} from "@aribuilder/core";

/** Los números de la API de vuelta a nuestros tipos. `null` = tipo que no soportamos. */
const TIPO_DESDE_DISCORD: Partial<Record<ChannelType, TipoCanal>> = {
  [ChannelType.GuildText]: "texto",
  [ChannelType.GuildVoice]: "voz",
  [ChannelType.GuildAnnouncement]: "anuncios",
  [ChannelType.GuildForum]: "foro",
  [ChannelType.GuildStageVoice]: "escenario",
};

const VERIFICACION: Record<number, Ajustes["nivelVerificacion"]> = {
  [GuildVerificationLevel.None]: "ninguno",
  [GuildVerificationLevel.Low]: "bajo",
  [GuildVerificationLevel.Medium]: "medio",
  [GuildVerificationLevel.High]: "alto",
  [GuildVerificationLevel.VeryHigh]: "muy-alto",
};

const FILTRO: Record<number, Ajustes["filtroContenido"]> = {
  [GuildExplicitContentFilter.Disabled]: "desactivado",
  [GuildExplicitContentFilter.MembersWithoutRoles]: "sin-rol",
  [GuildExplicitContentFilter.AllMembers]: "todos",
};

const NOTIFICACIONES: Record<number, Ajustes["notificacionesPorDefecto"]> = {
  [GuildDefaultMessageNotifications.AllMessages]: "todos-los-mensajes",
  [GuildDefaultMessageNotifications.OnlyMentions]: "solo-menciones",
};

export interface ResultadoImportacion {
  plantilla: Plantilla;
  /** Cosas del servidor que no caben en una plantilla, para poder decírselo al usuario. */
  omisiones: { que: string; motivo: string }[];
}

/**
 * Convierte un servidor existente en una plantilla reutilizable.
 *
 * Lo esencial es sustituir cada ID de Discord por una clave simbólica: es lo que
 * hace que la plantilla resultante sirva en cualquier otro servidor. Lo que no
 * se puede recrear (mensajes, miembros, integraciones) se omite con motivo.
 */
export function importarDesdeDatos(
  guild: APIGuild,
  canales: APIGuildChannel<ChannelType>[],
): ResultadoImportacion {
  const omisiones: ResultadoImportacion["omisiones"] = [];
  const usadas = new Set<string>([CLAVE_EVERYONE]);

  // ── Roles ─────────────────────────────────────────────────────────────
  // De mayor a menor jerarquía, que es como los piensa la gente.
  const rolesOrdenados = [...(guild.roles ?? [])].sort((a, b) => b.position - a.position);
  const claveDeRol = new Map<string, string>([[guild.id, CLAVE_EVERYONE]]);
  const roles: Rol[] = [];

  for (const rol of rolesOrdenados) {
    if (rol.id === guild.id) {
      // @everyone: no se crea, pero sus permisos base sí viajan con la plantilla.
      roles.push({
        clave: CLAVE_EVERYONE,
        nombre: "@everyone",
        separado: false,
        mencionable: false,
        permisos: aNombres(BigInt(rol.permissions)),
      });
      continue;
    }
    if (rol.managed) {
      omisiones.push({
        que: `Rol "${rol.name}"`,
        motivo: "lo gestiona un bot o una integración, así que no se puede recrear",
      });
      continue;
    }
    if (roles.length >= LIMITES.rolesPorServidor) {
      omisiones.push({ que: `Rol "${rol.name}"`, motivo: "se superó el tope de roles" });
      continue;
    }

    const clave = claveUnica(rol.name, usadas);
    usadas.add(clave);
    claveDeRol.set(rol.id, clave);
    roles.push({
      clave,
      nombre: rol.name,
      // El color 0 en Discord significa "sin color", no negro.
      color: rol.color === 0 ? undefined : `#${rol.color.toString(16).padStart(6, "0")}`,
      separado: rol.hoist ?? false,
      mencionable: rol.mentionable ?? false,
      permisos: aNombres(BigInt(rol.permissions)),
    });
  }

  // ── Overwrites ────────────────────────────────────────────────────────
  const traducirPermisos = (overwrites: APIOverwrite[] | undefined, donde: string): Overwrite[] => {
    const salida: Overwrite[] = [];
    for (const ov of overwrites ?? []) {
      // type 1 son overwrites sobre un miembro concreto: no viajan a otro servidor.
      if (ov.type !== 0) {
        omisiones.push({ que: `Permiso especial en ${donde}`, motivo: "estaba puesto sobre una persona concreta" });
        continue;
      }
      const rol = claveDeRol.get(ov.id);
      if (!rol) continue; // rol gestionado o borrado: se ignora en silencio
      const permitir = aNombres(BigInt(ov.allow));
      const denegar = aNombres(BigInt(ov.deny));
      if (permitir.length > 0 || denegar.length > 0) salida.push({ rol, permitir, denegar });
    }
    return salida;
  };

  // ── Canales ───────────────────────────────────────────────────────────
  const ordenados = [...canales].sort((a, b) => ("position" in a && "position" in b ? a.position - b.position : 0));
  const claveDeCanal = new Map<string, string>();

  const convertir = (canal: APIGuildChannel<ChannelType>): Canal | null => {
    const tipo = TIPO_DESDE_DISCORD[canal.type];
    if (!tipo) {
      omisiones.push({ que: `Canal "${canal.name}"`, motivo: "es de un tipo que la plantilla no admite (hilo, media…)" });
      return null;
    }

    const clave = claveUnica(canal.name ?? "canal", usadas);
    usadas.add(clave);
    claveDeCanal.set(canal.id, clave);

    const c = canal as unknown as {
      topic?: string | null;
      nsfw?: boolean;
      rate_limit_per_user?: number;
      user_limit?: number;
      permission_overwrites?: APIOverwrite[];
    };
    const esVoz = tipo === "voz" || tipo === "escenario";

    return {
      clave,
      nombre: canal.name ?? "canal",
      tipo,
      tema: c.topic?.slice(0, LIMITES.temaCanal) || undefined,
      nsfw: c.nsfw ?? false,
      modoLento: esVoz ? 0 : (c.rate_limit_per_user ?? 0),
      limiteUsuarios: esVoz ? c.user_limit || undefined : undefined,
      permisos: traducirPermisos(c.permission_overwrites, `"${canal.name}"`),
      // Los mensajes no se importan: pertenecen a la conversación, no a la estructura.
      mensajes: [],
    };
  };

  const categorias: Categoria[] = [];
  const porCategoria = new Map<string, Categoria>();

  for (const canal of ordenados) {
    if (canal.type !== ChannelType.GuildCategory) continue;
    const clave = claveUnica(canal.name ?? "categoria", usadas);
    usadas.add(clave);
    const cat: Categoria = {
      clave,
      nombre: canal.name ?? "categoría",
      permisos: traducirPermisos(
        (canal as unknown as { permission_overwrites?: APIOverwrite[] }).permission_overwrites,
        `la categoría "${canal.name}"`,
      ),
      canales: [],
    };
    categorias.push(cat);
    porCategoria.set(canal.id, cat);
  }

  const canalesSueltos: Canal[] = [];
  for (const canal of ordenados) {
    if (canal.type === ChannelType.GuildCategory) continue;
    const convertido = convertir(canal);
    if (!convertido) continue;

    const padreId = (canal as unknown as { parent_id?: string | null }).parent_id ?? null;
    const cat = padreId ? porCategoria.get(padreId) : undefined;
    if (cat) cat.canales.push(convertido);
    else canalesSueltos.push(convertido);
  }

  // ── Ajustes ───────────────────────────────────────────────────────────
  const claveSistema = guild.system_channel_id ? claveDeCanal.get(guild.system_channel_id) : undefined;
  const claveAfk = guild.afk_channel_id ? claveDeCanal.get(guild.afk_channel_id) : undefined;
  const afkTimeout = (LIMITES.afkTimeouts as readonly number[]).includes(guild.afk_timeout ?? 0)
    ? guild.afk_timeout
    : 300;

  // ── Emojis ────────────────────────────────────────────────────────────
  const emojis = (guild.emojis ?? []).flatMap((e) => {
    if (!e.id || !e.name) return [];
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(e.name)) {
      omisiones.push({ que: `Emoji "${e.name}"`, motivo: "su nombre no cumple lo que exige Discord al crearlo" });
      return [];
    }
    return [{ nombre: e.name, url: `https://cdn.discordapp.com/emojis/${e.id}.${e.animated ? "gif" : "png"}` }];
  });

  if ((guild.stickers ?? []).length > 0) {
    omisiones.push({ que: "Stickers", motivo: "no se pueden copiar entre servidores" });
  }

  const plantilla = plantillaSchema.parse({
    version: 1,
    meta: {
      nombre: guild.name,
      descripcion: `Importada del servidor «${guild.name}»`,
      emoji: "📥",
      etiquetas: ["importada"],
    },
    ajustes: {
      nivelVerificacion: VERIFICACION[guild.verification_level ?? 0] ?? "bajo",
      filtroContenido: FILTRO[guild.explicit_content_filter ?? 0] ?? "todos",
      notificacionesPorDefecto: NOTIFICACIONES[guild.default_message_notifications ?? 1] ?? "solo-menciones",
      canalSistema: claveSistema,
      canalAfk: claveAfk,
      afkTimeout,
    },
    roles,
    categorias,
    canalesSueltos,
    emojis,
  });

  return { plantilla, omisiones };
}

/** Lee el servidor y lo convierte en plantilla. */
export async function importarServidor(rest: REST, guildId: string): Promise<ResultadoImportacion> {
  const [guild, canales] = await Promise.all([
    rest.get(Routes.guild(guildId)) as Promise<APIGuild>,
    rest.get(Routes.guildChannels(guildId)) as Promise<APIGuildChannel<ChannelType>[]>,
  ]);
  return importarDesdeDatos(guild, canales);
}
