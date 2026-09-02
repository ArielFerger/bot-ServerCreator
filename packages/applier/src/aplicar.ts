import type { REST } from "@discordjs/rest";
import { ChannelType, Routes, type APIChannel, type APIEmoji, type APIMessage, type APIRole } from "discord-api-types/v10";
import { CLAVE_EVERYONE, LIMITES, MOTIVO_AUDITORIA, type Mensaje, type Overwrite, type PanelRoles } from "@aribuilder/core";
import {
  colorAEntero,
  FILTRO_CONTENIDO,
  NIVEL_VERIFICACION,
  NOTIFICACIONES,
  permisosARest,
  traducirError,
  urlADataUri,
} from "./discord";
import { TIPO_DISCORD } from "./planificar";
import {
  creadosVacios,
  planTieneErrores,
  type Accion,
  type Creados,
  type Evento,
  type Plan,
} from "./tipos";
import { ErrorAplicacion } from "./tipos";

/** El customId que lee el bot de gateway para dar o quitar el rol. */
export const PREFIJO_AUTOROL = "autorol:";

/**
 * Ejecuta un plan contra Discord, emitiendo el progreso paso a paso.
 *
 * Es un generador asíncrono a propósito: la web lo reenvía tal cual por SSE, de
 * modo que una aplicación de dos minutos se ve avanzar en vez de parecer colgada.
 *
 * Filosofía ante los fallos: un paso que falla NO aborta la aplicación entera
 * (mejor un servidor casi completo que uno a medias sin explicación), salvo que
 * el fallo deje sin sentido todo lo que viene después.
 */
export async function* aplicar(plan: Plan, rest: REST, guildId: string): AsyncGenerator<Evento, Creados> {
  if (planTieneErrores(plan)) {
    const d = plan.diagnosticos.find((x) => x.nivel === "error")!;
    throw new ErrorAplicacion(d.mensaje, d.solucion);
  }

  const creados = creadosVacios();
  /** clave simbólica -> ID real de Discord. Es el corazón del asunto. */
  const ids = new Map<string, string>([[CLAVE_EVERYONE, guildId]]);
  const total = plan.acciones.length;
  let fallos = 0;

  yield { tipo: "inicio", total };

  for (const [i, accion] of plan.acciones.entries()) {
    yield { tipo: "paso", indice: i + 1, total, descripcion: describir(accion) };
    try {
      yield* ejecutar(accion, { rest, guildId, ids, creados });
    } catch (error) {
      fallos++;
      const traducido = error instanceof ErrorAplicacion ? error : traducirError(error, describir(accion));
      yield {
        tipo: "error",
        mensaje: traducido.solucion ? `${traducido.message} ${traducido.solucion}` : traducido.message,
      };
    }
  }

  yield { tipo: "fin", creados, fallos };
  return creados;
}

interface Contexto {
  rest: REST;
  guildId: string;
  ids: Map<string, string>;
  creados: Creados;
}

async function* ejecutar(accion: Accion, ctx: Contexto): AsyncGenerator<Evento> {
  const { rest, guildId, ids, creados } = ctx;

  switch (accion.tipo) {
    case "borrar-canal":
      await rest.delete(Routes.channel(accion.id));
      return;

    case "borrar-rol":
      await rest.delete(Routes.guildRole(guildId, accion.id));
      return;

    case "vincular-rol":
    case "vincular-categoria":
    case "vincular-canal":
      ids.set(accion.clave, accion.id);
      return;

    case "crear-rol": {
      const rol = (await rest.post(Routes.guildRoles(guildId), {
        body: {
          name: accion.rol.nombre,
          permissions: bitfieldDe(accion.rol.permisos),
          color: colorAEntero(accion.rol.color),
          hoist: accion.rol.separado,
          mentionable: accion.rol.mencionable,
        },
        reason: MOTIVO_AUDITORIA,
      })) as APIRole;
      ids.set(accion.clave, rol.id);
      creados.roles.push({ id: rol.id, clave: accion.clave });
      return;
    }

    case "actualizar-rol": {
      // @everyone comparte ID con el servidor y solo admite cambiar permisos.
      const esEveryone = accion.id === guildId;
      await rest.patch(Routes.guildRole(guildId, accion.id), {
        body: esEveryone
          ? { permissions: bitfieldDe(accion.rol.permisos) }
          : {
              name: accion.rol.nombre,
              permissions: bitfieldDe(accion.rol.permisos),
              color: colorAEntero(accion.rol.color),
              hoist: accion.rol.separado,
              mentionable: accion.rol.mencionable,
            },
        reason: MOTIVO_AUDITORIA,
      });
      ids.set(accion.clave, accion.id);
      return;
    }

    case "crear-categoria": {
      const cat = (await rest.post(Routes.guildChannels(guildId), {
        body: {
          name: accion.nombre,
          type: ChannelType.GuildCategory,
          position: accion.posicion,
          permission_overwrites: overwritesARest(accion.permisos, ids),
        },
        reason: MOTIVO_AUDITORIA,
      })) as APIChannel;
      ids.set(accion.clave, cat.id);
      creados.canales.push({ id: cat.id, clave: accion.clave });
      return;
    }

    case "crear-canal": {
      const { canal } = accion;
      const padre = accion.categoriaClave ? ids.get(accion.categoriaClave) : undefined;
      const esVoz = canal.tipo === "voz" || canal.tipo === "escenario";

      const ch = (await rest.post(Routes.guildChannels(guildId), {
        body: {
          name: canal.nombre,
          type: TIPO_DISCORD[canal.tipo],
          parent_id: padre ?? null,
          position: accion.posicion,
          topic: canal.tema,
          nsfw: canal.nsfw,
          // Discord rechaza estos campos en el tipo de canal que no toca.
          rate_limit_per_user: esVoz ? undefined : canal.modoLento || undefined,
          user_limit: esVoz ? canal.limiteUsuarios : undefined,
          permission_overwrites: overwritesARest(canal.permisos, ids),
        },
        reason: MOTIVO_AUDITORIA,
      })) as APIChannel;

      ids.set(accion.clave, ch.id);
      creados.canales.push({ id: ch.id, clave: accion.clave });
      return;
    }

    case "aplicar-ajustes": {
      const a = accion.ajustes;
      const canalSistema = a.canalSistema ? ids.get(a.canalSistema) : undefined;
      const canalAfk = a.canalAfk ? ids.get(a.canalAfk) : undefined;
      await rest.patch(Routes.guild(guildId), {
        body: {
          verification_level: NIVEL_VERIFICACION[a.nivelVerificacion],
          explicit_content_filter: FILTRO_CONTENIDO[a.filtroContenido],
          default_message_notifications: NOTIFICACIONES[a.notificacionesPorDefecto],
          ...(canalSistema ? { system_channel_id: canalSistema } : {}),
          ...(canalAfk ? { afk_channel_id: canalAfk, afk_timeout: a.afkTimeout } : {}),
        },
        reason: MOTIVO_AUDITORIA,
      });
      return;
    }

    case "publicar-mensaje": {
      const canalId = ids.get(accion.canalClave);
      if (!canalId) throw new ErrorAplicacion(`No se encontró el canal "${accion.canalClave}"`);

      const msg = (await rest.post(Routes.channelMessages(canalId), {
        body: cuerpoMensaje(accion.mensaje),
      })) as APIMessage;
      creados.mensajes.push({ canalId, mensajeId: msg.id });

      if (accion.mensaje.fijar) {
        try {
          await rest.put(Routes.channelPin(canalId, msg.id));
        } catch (error) {
          // Fijar es secundario: el mensaje ya está publicado, no tiramos todo por esto.
          yield {
            tipo: "aviso",
            mensaje: `El mensaje se publicó pero no se pudo fijar (${traducirError(error, "fijar").message}).`,
          };
        }
      }
      return;
    }

    case "publicar-panel": {
      const canalId = ids.get(accion.canalClave);
      if (!canalId) throw new ErrorAplicacion(`No se encontró el canal "${accion.canalClave}"`);

      const roles = accion.panel.roles
        .map((clave) => ({ clave, nombre: accion.nombresDeRol[clave] ?? clave, id: ids.get(clave) }))
        .filter((r): r is { clave: string; nombre: string; id: string } => r.id !== undefined);

      if (roles.length === 0) {
        yield { tipo: "aviso", mensaje: `El panel de "${accion.canalClave}" se omitió: ninguno de sus roles existe.` };
        return;
      }

      const msg = (await rest.post(Routes.channelMessages(canalId), {
        body: cuerpoPanel(accion.panel, roles),
      })) as APIMessage;

      creados.mensajes.push({ canalId, mensajeId: msg.id });
      creados.paneles.push({
        canalId,
        mensajeId: msg.id,
        roles: roles.map((r) => ({ id: r.id, nombre: r.nombre })),
      });
      return;
    }

    case "crear-emoji": {
      const emoji = (await rest.post(Routes.guildEmojis(guildId), {
        body: { name: accion.nombre, image: await urlADataUri(accion.url) },
        reason: MOTIVO_AUDITORIA,
      })) as APIEmoji;
      if (emoji.id) creados.emojis.push({ id: emoji.id, nombre: accion.nombre });
      return;
    }
  }
}

function bitfieldDe(permisos: readonly string[]): string {
  // `aBitfield` ya valida contra la tabla; el esquema garantiza que son nombres válidos.
  return permisos.length === 0 ? "0" : permisosARest(permisos, []).allow;
}

function overwritesARest(overwrites: readonly Overwrite[], ids: Map<string, string>) {
  return overwrites
    .map((o) => {
      const id = ids.get(o.rol);
      if (!id) return null; // el rol se omitió; el canal se crea igual, sin ese overwrite
      return { id, type: 0 as const, ...permisosARest(o.permitir, o.denegar) };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null);
}

function cuerpoMensaje(mensaje: Mensaje) {
  return {
    content: mensaje.contenido,
    embeds: mensaje.embed
      ? [
          {
            title: mensaje.embed.titulo,
            description: mensaje.embed.descripcion,
            color: colorAEntero(mensaje.embed.color),
            fields: mensaje.embed.campos.map((c) => ({ name: c.nombre, value: c.valor, inline: c.enLinea })),
            footer: mensaje.embed.pie ? { text: mensaje.embed.pie } : undefined,
          },
        ]
      : undefined,
  };
}

/** Discord admite 5 botones por fila y 5 filas: de ahí el tope de 25 roles. */
function cuerpoPanel(panel: PanelRoles, roles: { nombre: string; id: string }[]) {
  const filas: unknown[] = [];
  for (let i = 0; i < roles.length && i < LIMITES.rolesPorPanel; i += 5) {
    filas.push({
      type: 1,
      components: roles.slice(i, i + 5).map((r) => ({
        type: 2,
        style: 2,
        label: r.nombre.slice(0, 80),
        custom_id: `${PREFIJO_AUTOROL}${r.id}`,
      })),
    });
  }
  return {
    embeds: [{ title: panel.titulo, description: panel.descripcion, color: 0x5865f2 }],
    components: filas,
  };
}

/** Texto de progreso que ve el usuario. */
export function describir(accion: Accion): string {
  switch (accion.tipo) {
    case "borrar-canal": return `Borrando el canal "${accion.nombre}"`;
    case "borrar-rol": return `Borrando el rol "${accion.nombre}"`;
    case "crear-rol": return `Creando el rol "${accion.rol.nombre}"`;
    case "actualizar-rol": return `Actualizando el rol "${accion.rol.nombre}"`;
    case "vincular-rol": return `Reutilizando un rol que ya existía`;
    case "crear-categoria": return `Creando la categoría "${accion.nombre}"`;
    case "vincular-categoria": return `Reutilizando una categoría que ya existía`;
    case "crear-canal": return `Creando el canal "${accion.canal.nombre}"`;
    case "vincular-canal": return `Reutilizando un canal que ya existía`;
    case "aplicar-ajustes": return "Aplicando los ajustes del servidor";
    case "publicar-mensaje": return `Publicando un mensaje en "${accion.canalClave}"`;
    case "publicar-panel": return `Publicando el panel de roles de "${accion.canalClave}"`;
    case "crear-emoji": return `Subiendo el emoji "${accion.nombre}"`;
  }
}

/**
 * Deshace una aplicación borrando exactamente lo que creó y nada más.
 * Es la red de seguridad que hace que alguien sin conocimientos se anime a
 * apretar "Aplicar".
 */
export async function* deshacer(creados: Creados, rest: REST, guildId: string): AsyncGenerator<Evento> {
  const pasos = creados.canales.length + creados.roles.length + creados.emojis.length;
  let i = 0;
  let fallos = 0;
  yield { tipo: "inicio", total: pasos };

  const borrar = async function* (descripcion: string, fn: () => Promise<unknown>): AsyncGenerator<Evento> {
    yield { tipo: "paso", indice: ++i, total: pasos, descripcion };
    try {
      await fn();
    } catch (error) {
      // Un 404 aquí es buena noticia: ya no está.
      const status = (error as { status?: number }).status;
      if (status !== 404) {
        fallos++;
        yield { tipo: "error", mensaje: traducirError(error, descripcion).message };
      }
    }
  };

  // Los canales primero: borrar una categoría no borra lo que hay dentro.
  for (const canal of creados.canales) {
    yield* borrar(`Borrando el canal "${canal.clave}"`, () => rest.delete(Routes.channel(canal.id)));
  }
  for (const rol of creados.roles) {
    yield* borrar(`Borrando el rol "${rol.clave}"`, () => rest.delete(Routes.guildRole(guildId, rol.id)));
  }
  for (const emoji of creados.emojis) {
    yield* borrar(`Borrando el emoji "${emoji.nombre}"`, () => rest.delete(Routes.guildEmoji(guildId, emoji.id)));
  }

  yield { tipo: "fin", creados: creadosVacios(), fallos };
}
