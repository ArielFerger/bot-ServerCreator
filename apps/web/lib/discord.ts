import { PermissionFlagsBits } from "discord-api-types/v10";

/**
 * Servidor tal y como lo devuelve Discord en `GET /users/@me/guilds`.
 * Solo llega lo que el usuario nos deja ver con el scope `guilds`.
 */
export interface ServidorDelUsuario {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permissions: string;
}

export interface ServidorGestionable {
  id: string;
  nombre: string;
  iconoUrl: string | null;
  esDueno: boolean;
  /** Si nuestro bot ya está dentro. */
  botDentro: boolean;
}

/** Solo tiene sentido ofrecer servidores donde el usuario pueda configurar algo. */
export function puedeGestionar(servidor: ServidorDelUsuario): boolean {
  const permisos = BigInt(servidor.permissions);
  return (
    servidor.owner ||
    (permisos & PermissionFlagsBits.Administrator) === PermissionFlagsBits.Administrator ||
    (permisos & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild
  );
}

export function iconoUrl(servidor: ServidorDelUsuario): string | null {
  return servidor.icon ? `https://cdn.discordapp.com/icons/${servidor.id}/${servidor.icon}.png?size=128` : null;
}

/**
 * Enlace de invitación con el servidor ya preseleccionado. `disable_guild_select`
 * evita que alguien lo instale por error en otro servidor.
 *
 * Los permisos pedidos son los mínimos para que el motor funcione entero.
 */
export function enlaceInvitacion(guildId?: string): string {
  const permisos =
    PermissionFlagsBits.ManageChannels |
    PermissionFlagsBits.ManageRoles |
    PermissionFlagsBits.ManageGuild |
    PermissionFlagsBits.ManageGuildExpressions |
    PermissionFlagsBits.ManageMessages |
    PermissionFlagsBits.SendMessages |
    PermissionFlagsBits.ViewChannel |
    PermissionFlagsBits.EmbedLinks |
    // Para poder llamarse AriBuilder aunque alguien lo renombre en su servidor.
    PermissionFlagsBits.ChangeNickname;

  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    scope: "bot applications.commands",
    permissions: permisos.toString(),
  });
  if (guildId) {
    params.set("guild_id", guildId);
    params.set("disable_guild_select", "true");
  }
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

/**
 * Los servidores donde está el bot, para saber si hace falta invitarlo.
 *
 * Discord devuelve como mucho 200 por página, así que en una instancia pública
 * —donde el bot está en cientos de servidores— hay que paginar o la lista sale
 * incompleta y la web le pide a la gente que invite un bot que ya está dentro.
 *
 * Por encima de unos miles de servidores esto deja de ser razonable (serían
 * decenas de llamadas por carga de página) y tocaría guardar la pertenencia en
 * la base desde los eventos del bot. Hasta ahí, paginar basta y sobra.
 */
const POR_PAGINA = 200;
const MAX_PAGINAS = 50;

export async function servidoresDelBot(): Promise<Set<string>> {
  const ids = new Set<string>();
  let after: string | undefined;

  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const params = new URLSearchParams({ limit: String(POR_PAGINA) });
    if (after) params.set("after", after);

    const res = await fetch(`https://discord.com/api/v10/users/@me/guilds?${params}`, {
      headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      // El bot entra y sale de servidores: no cachear más de unos segundos.
      next: { revalidate: 10 },
    });
    // Ante un fallo a media paginación se devuelve lo que se pudo leer: como
    // mucho se ofrece invitar de más, nunca se oculta un servidor válido.
    if (!res.ok) break;

    const guilds = (await res.json()) as { id: string }[];
    for (const g of guilds) ids.add(g.id);

    if (guilds.length < POR_PAGINA) break;
    after = guilds[guilds.length - 1]!.id;
  }

  return ids;
}
