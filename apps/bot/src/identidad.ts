import { MARCA } from "@aribuilder/core";
import type { Client, Guild } from "discord.js";

/**
 * El bot se llama AriBuilder, y punto.
 *
 * Hay dos nombres distintos en Discord y hacen falta los dos:
 *
 * - El **usuario global**, el que aparece en el perfil. Se pone una vez, pero
 *   Discord solo deja cambiarlo dos veces por hora, así que puede fallar.
 * - El **apodo por servidor**, que cualquier administrador puede cambiar desde
 *   los ajustes de su servidor. Si no lo vigilamos, el bot se llama AriBuilder
 *   en todos lados menos justo donde alguien lo renombró.
 *
 * Por eso se comprueba al arrancar, al entrar en un servidor nuevo y cada pocas
 * horas, en vez de una sola vez al principio.
 */

/** Cada cuánto se vuelve a comprobar el nombre en los servidores ya conocidos. */
export const INTERVALO_REVISION_MS = 6 * 60 * 60 * 1000;

export type AccionApodo =
  /** Ya se ve como AriBuilder: no tocar nada. */
  | { tipo: "nada" }
  /** El usuario global ya es correcto; sobra el apodo que alguien le puso. */
  | { tipo: "quitar" }
  /** El usuario global no es correcto: el apodo es lo que salva el nombre. */
  | { tipo: "poner"; apodo: string };

/**
 * Qué hacer con el apodo del bot en un servidor. Función pura: lo que se ve en
 * Discord es el apodo si lo hay, y si no el nombre de usuario.
 */
export function decidirApodo(nombreGlobal: string, apodo: string | null): AccionApodo {
  const visible = apodo ?? nombreGlobal;
  if (visible === MARCA.nombreBot) return { tipo: "nada" };
  if (nombreGlobal === MARCA.nombreBot) return { tipo: "quitar" };
  return { tipo: "poner", apodo: MARCA.nombreBot };
}

/** Si el nombre de usuario global del bot hace falta cambiarlo. */
export function necesitaRenombrarUsuario(nombreGlobal: string | undefined | null): boolean {
  return (nombreGlobal ?? "") !== MARCA.nombreBot;
}

/**
 * Pone el nombre de usuario global. No es fatal que falle: Discord limita este
 * cambio a dos por hora y puede rechazarlo si el nombre ya está cogido. El
 * apodo por servidor cubre ese caso, así que solo se avisa.
 */
export async function asegurarNombreGlobal(client: Client<true>): Promise<void> {
  if (!necesitaRenombrarUsuario(client.user.username)) return;
  try {
    await client.user.setUsername(MARCA.nombreBot);
    console.log(`✅ Nombre de usuario cambiado a ${MARCA.nombreBot}.`);
  } catch (error) {
    console.warn(
      `⚠ No pude ponerle al bot el nombre «${MARCA.nombreBot}» (ahora es «${client.user.username}»). ` +
        "Discord solo deja dos cambios por hora y no admite nombres ya ocupados. " +
        "Podés ponerlo a mano en https://discord.com/developers/applications → Bot → Username. " +
        "Mientras tanto se usa el apodo en cada servidor.",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Deja el bot llamándose AriBuilder en un servidor concreto. */
export async function asegurarApodoEn(guild: Guild, nombreGlobal: string): Promise<void> {
  const yo = guild.members.me;
  if (!yo) return;

  const accion = decidirApodo(nombreGlobal, yo.nickname);
  if (accion.tipo === "nada") return;

  try {
    await yo.setNickname(accion.tipo === "quitar" ? null : accion.apodo, `El bot se llama ${MARCA.nombreBot}`);
  } catch {
    // Sin permiso de «Cambiar apodo» no se puede, y no es motivo para romper
    // nada: el bot sigue funcionando, solo se ve con otro nombre en ese sitio.
    console.warn(`⚠ No pude fijar el nombre en «${guild.name}»: me falta el permiso de cambiar apodo.`);
  }
}

/** Repasa todos los servidores donde está el bot. */
export async function asegurarNombreEnTodos(client: Client<true>): Promise<void> {
  const nombreGlobal = client.user.username;
  for (const guild of client.guilds.cache.values()) {
    await asegurarApodoEn(guild, nombreGlobal);
  }
}
