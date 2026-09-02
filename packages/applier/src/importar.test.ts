import { describe, expect, it } from "vitest";
import {
  ChannelType,
  GuildDefaultMessageNotifications,
  GuildExplicitContentFilter,
  GuildVerificationLevel,
  PermissionFlagsBits,
  type APIGuild,
  type APIGuildChannel,
} from "discord-api-types/v10";
import { CLAVE_EVERYONE, aBitfield, todosLosCanales, validarPlantilla, type Plantilla } from "@aribuilder/core";
import { plantillaDeGaleria, CLAVES_GALERIA, type ClaveGaleria } from "@aribuilder/core/galeria";
import { importarDesdeDatos } from "./importar";
import { planificar, TIPO_DISCORD } from "./planificar";
import type { EstadoServidor } from "./tipos";

const GUILD_ID = "100000000000000000";

/**
 * Simula el servidor que resultaría de aplicar una plantilla: convierte el plan
 * en los objetos que devolvería la API de Discord. Es lo que permite probar el
 * viaje de ida y vuelta sin tocar la red.
 */
function servidorResultante(plantilla: Plantilla): { guild: APIGuild; canales: APIGuildChannel<ChannelType>[] } {
  const estado: EstadoServidor = {
    id: GUILD_ID,
    nombre: "Servidor",
    funciones: ["COMMUNITY"],
    roles: [],
    canales: [],
    emojis: [],
    nivelBoost: 3,
    bot: {
      id: "bot",
      posicionRolMasAlto: 500,
      esAdministrador: true,
      puedeGestionarRoles: true,
      puedeGestionarCanales: true,
      puedeGestionarServidor: true,
      puedeGestionarExpresiones: true,
    },
  };
  const plan = planificar(plantilla, estado, "fusionar");

  const ids = new Map<string, string>([[CLAVE_EVERYONE, GUILD_ID]]);
  let n = 0;
  const siguiente = () => `${++n}`.padStart(18, "9");

  // Los roles primero, para que los overwrites puedan referenciarlos.
  const roles: APIGuild["roles"] = [
    {
      id: GUILD_ID,
      name: "@everyone",
      position: 0,
      permissions: aBitfield(plantilla.roles.find((r) => r.clave === CLAVE_EVERYONE)?.permisos ?? []).toString(),
      color: 0,
      hoist: false,
      mentionable: false,
      managed: false,
    } as APIGuild["roles"][number],
  ];

  const aCrear = plan.acciones.filter((a) => a.tipo === "crear-rol");
  aCrear.forEach((accion, i) => {
    if (accion.tipo !== "crear-rol") return;
    const id = siguiente();
    ids.set(accion.clave, id);
    roles.push({
      id,
      name: accion.rol.nombre,
      // Discord numera de abajo a arriba: el primero de la plantilla es el más alto.
      position: aCrear.length - i,
      permissions: aBitfield(accion.rol.permisos).toString(),
      color: accion.rol.color ? Number.parseInt(accion.rol.color.slice(1), 16) : 0,
      hoist: accion.rol.separado,
      mentionable: accion.rol.mencionable,
      managed: false,
    } as APIGuild["roles"][number]);
  });

  const canales: APIGuildChannel<ChannelType>[] = [];
  let posicion = 0;

  for (const accion of plan.acciones) {
    if (accion.tipo === "crear-categoria") {
      const id = siguiente();
      ids.set(accion.clave, id);
      canales.push({
        id,
        name: accion.nombre,
        type: ChannelType.GuildCategory,
        position: posicion++,
        parent_id: null,
        permission_overwrites: accion.permisos.map((o) => ({
          id: ids.get(o.rol)!,
          type: 0,
          allow: aBitfield(o.permitir).toString(),
          deny: aBitfield(o.denegar).toString(),
        })),
      } as unknown as APIGuildChannel<ChannelType>);
    } else if (accion.tipo === "crear-canal") {
      const id = siguiente();
      ids.set(accion.clave, id);
      const c = accion.canal;
      const esVoz = c.tipo === "voz" || c.tipo === "escenario";
      canales.push({
        id,
        name: c.nombre,
        type: TIPO_DISCORD[c.tipo],
        position: posicion++,
        parent_id: accion.categoriaClave ? (ids.get(accion.categoriaClave) ?? null) : null,
        topic: c.tema ?? null,
        nsfw: c.nsfw,
        rate_limit_per_user: esVoz ? undefined : c.modoLento,
        user_limit: esVoz ? c.limiteUsuarios : undefined,
        permission_overwrites: c.permisos.map((o) => ({
          id: ids.get(o.rol)!,
          type: 0,
          allow: aBitfield(o.permitir).toString(),
          deny: aBitfield(o.denegar).toString(),
        })),
      } as unknown as APIGuildChannel<ChannelType>);
    }
  }

  const a = plantilla.ajustes;
  const guild = {
    id: GUILD_ID,
    name: plantilla.meta.nombre,
    roles,
    emojis: [],
    stickers: [],
    features: ["COMMUNITY"],
    premium_tier: 3,
    verification_level: { ninguno: 0, bajo: 1, medio: 2, alto: 3, "muy-alto": 4 }[a.nivelVerificacion],
    explicit_content_filter: { desactivado: 0, "sin-rol": 1, todos: 2 }[a.filtroContenido],
    default_message_notifications: { "todos-los-mensajes": 0, "solo-menciones": 1 }[a.notificacionesPorDefecto],
    system_channel_id: a.canalSistema ? (ids.get(a.canalSistema) ?? null) : null,
    afk_channel_id: a.canalAfk ? (ids.get(a.canalAfk) ?? null) : null,
    afk_timeout: a.afkTimeout,
  } as unknown as APIGuild;

  return { guild, canales };
}

const guildMinimo = (extra: Partial<APIGuild> = {}): APIGuild =>
  ({
    id: GUILD_ID,
    name: "Servidor",
    roles: [{ id: GUILD_ID, name: "@everyone", position: 0, permissions: "0", color: 0, managed: false }],
    emojis: [],
    stickers: [],
    features: [],
    premium_tier: 0,
    verification_level: GuildVerificationLevel.Low,
    explicit_content_filter: GuildExplicitContentFilter.AllMembers,
    default_message_notifications: GuildDefaultMessageNotifications.OnlyMentions,
    afk_timeout: 300,
    ...extra,
  }) as unknown as APIGuild;

describe("ida y vuelta: aplicar y volver a importar", () => {
  it.each(CLAVES_GALERIA)("«%s» sobrevive al viaje completo", (clave) => {
    const original = plantillaDeGaleria(clave as ClaveGaleria);
    const { guild, canales } = servidorResultante(original);
    const { plantilla: vuelta } = importarDesdeDatos(guild, canales);

    expect(validarPlantilla(vuelta).ok).toBe(true);

    // La estructura visible tiene que coincidir.
    expect(vuelta.categorias.map((c) => c.nombre)).toEqual(original.categorias.map((c) => c.nombre));
    for (const [i, cat] of original.categorias.entries()) {
      expect(vuelta.categorias[i]!.canales.map((c) => c.nombre)).toEqual(cat.canales.map((c) => c.nombre));
    }
    expect(vuelta.canalesSueltos.map((c) => c.nombre)).toEqual(original.canalesSueltos.map((c) => c.nombre));
  });

  it("«gaming»: los roles vuelven con su nombre, color y jerarquía", () => {
    const original = plantillaDeGaleria("gaming");
    const { guild, canales } = servidorResultante(original);
    const { plantilla: vuelta } = importarDesdeDatos(guild, canales);

    const sinEveryone = (p: Plantilla) => p.roles.filter((r) => r.clave !== CLAVE_EVERYONE);
    expect(sinEveryone(vuelta).map((r) => r.nombre)).toEqual(sinEveryone(original).map((r) => r.nombre));
    expect(sinEveryone(vuelta).map((r) => r.color)).toEqual(sinEveryone(original).map((r) => r.color));
    expect(sinEveryone(vuelta).map((r) => r.separado)).toEqual(sinEveryone(original).map((r) => r.separado));
  });

  it("«gaming»: los permisos por canal se conservan", () => {
    const original = plantillaDeGaleria("gaming");
    const { guild, canales } = servidorResultante(original);
    const { plantilla: vuelta } = importarDesdeDatos(guild, canales);

    // Se comparan por nombre de rol, porque las claves se regeneran al importar.
    const nombreDeRol = (p: Plantilla, clave: string) =>
      clave === CLAVE_EVERYONE ? "@everyone" : (p.roles.find((r) => r.clave === clave)?.nombre ?? clave);

    const huella = (p: Plantilla) =>
      [...todosLosCanales(p)].map(({ canal }) => ({
        canal: canal.nombre,
        permisos: canal.permisos
          .map((o) => `${nombreDeRol(p, o.rol)}|+${[...o.permitir].sort()}|-${[...o.denegar].sort()}`)
          .sort(),
      }));

    expect(huella(vuelta)).toEqual(huella(original));
  });

  it("«gaming»: los ajustes que apuntan a canales se remapean bien", () => {
    const original = plantillaDeGaleria("gaming");
    const { guild, canales } = servidorResultante(original);
    const { plantilla: vuelta } = importarDesdeDatos(guild, canales);

    const nombreDeCanal = (p: Plantilla, clave?: string) =>
      clave ? [...todosLosCanales(p)].find(({ canal }) => canal.clave === clave)?.canal.nombre : undefined;

    expect(nombreDeCanal(vuelta, vuelta.ajustes.canalSistema)).toBe(nombreDeCanal(original, original.ajustes.canalSistema));
    expect(nombreDeCanal(vuelta, vuelta.ajustes.canalAfk)).toBe(nombreDeCanal(original, original.ajustes.canalAfk));
    expect(vuelta.ajustes.nivelVerificacion).toBe(original.ajustes.nivelVerificacion);
    expect(vuelta.ajustes.afkTimeout).toBe(original.ajustes.afkTimeout);
  });

  it("lo importado se puede volver a aplicar sin errores", () => {
    const { guild, canales } = servidorResultante(plantillaDeGaleria("comunidad"));
    const { plantilla } = importarDesdeDatos(guild, canales);
    const plan = planificar(plantilla, {
      id: "otro",
      nombre: "Otro servidor",
      funciones: ["COMMUNITY"],
      roles: [],
      canales: [],
      emojis: [],
      nivelBoost: 0,
      bot: {
        id: "b",
        posicionRolMasAlto: 500,
        esAdministrador: true,
        puedeGestionarRoles: true,
        puedeGestionarCanales: true,
        puedeGestionarServidor: true,
        puedeGestionarExpresiones: true,
      },
    });
    expect(plan.diagnosticos.filter((d) => d.nivel === "error")).toEqual([]);
    expect(plan.resumen.canalesACrear).toBeGreaterThan(0);
  });
});

describe("qué se omite al importar", () => {
  it("los roles de bots e integraciones, que no se pueden recrear", () => {
    const guild = guildMinimo({
      roles: [
        ...guildMinimo().roles,
        { id: "r1", name: "MEE6", position: 5, permissions: "0", color: 0, managed: true },
        { id: "r2", name: "Mod", position: 3, permissions: "0", color: 0, managed: false },
      ] as APIGuild["roles"],
    });
    const { plantilla, omisiones } = importarDesdeDatos(guild, []);
    expect(plantilla.roles.map((r) => r.nombre)).toEqual(["Mod", "@everyone"]);
    expect(omisiones.some((o) => o.que.includes("MEE6"))).toBe(true);
  });

  it("los permisos puestos sobre una persona concreta", () => {
    const canales = [
      {
        id: "c1",
        name: "privado",
        type: ChannelType.GuildText,
        position: 0,
        parent_id: null,
        permission_overwrites: [{ id: "usuario123", type: 1, allow: "1024", deny: "0" }],
      },
    ] as unknown as APIGuildChannel<ChannelType>[];
    const { plantilla, omisiones } = importarDesdeDatos(guildMinimo(), canales);
    expect(plantilla.canalesSueltos[0]!.permisos).toEqual([]);
    expect(omisiones.some((o) => o.motivo.includes("persona concreta"))).toBe(true);
  });

  it("los tipos de canal que la plantilla no admite", () => {
    const canales = [
      { id: "c1", name: "hilo", type: ChannelType.PublicThread, position: 0, parent_id: null },
    ] as unknown as APIGuildChannel<ChannelType>[];
    const { plantilla, omisiones } = importarDesdeDatos(guildMinimo(), canales);
    expect(plantilla.canalesSueltos).toEqual([]);
    expect(omisiones.some((o) => o.motivo.includes("tipo que la plantilla no admite"))).toBe(true);
  });

  it("los emojis con nombre que Discord no aceptaría al crearlos", () => {
    const guild = guildMinimo({
      emojis: [
        { id: "e1", name: "pog_1", animated: false },
        { id: "e2", name: "no vale", animated: false },
        { id: "e3", name: "acentuadó", animated: false },
      ],
    } as Partial<APIGuild>);
    const { plantilla, omisiones } = importarDesdeDatos(guild, []);

    expect(plantilla.emojis.map((e) => e.nombre)).toEqual(["pog_1"]);
    expect(plantilla.emojis[0]!.url).toBe("https://cdn.discordapp.com/emojis/e1.png");
    for (const malo of ["no vale", "acentuadó"]) {
      expect(omisiones.some((o) => o.que.includes(malo))).toBe(true);
    }
  });

  it("los emojis animados se importan como .gif", () => {
    const guild = guildMinimo({ emojis: [{ id: "e9", name: "baile", animated: true }] } as Partial<APIGuild>);
    const { plantilla } = importarDesdeDatos(guild, []);
    expect(plantilla.emojis[0]!.url).toBe("https://cdn.discordapp.com/emojis/e9.gif");
  });
});

describe("detalles de la traducción", () => {
  it("el color 0 de Discord significa «sin color», no negro", () => {
    const guild = guildMinimo({
      roles: [
        ...guildMinimo().roles,
        { id: "r1", name: "Gris", position: 2, permissions: "0", color: 0, managed: false },
        { id: "r2", name: "Rojo", position: 1, permissions: "0", color: 0xe74c3c, managed: false },
      ] as APIGuild["roles"],
    });
    const { plantilla } = importarDesdeDatos(guild, []);
    expect(plantilla.roles.find((r) => r.nombre === "Gris")!.color).toBeUndefined();
    expect(plantilla.roles.find((r) => r.nombre === "Rojo")!.color).toBe("#e74c3c");
  });

  it("@everyone conserva sus permisos base y su clave reservada", () => {
    const guild = guildMinimo({
      roles: [
        {
          id: GUILD_ID,
          name: "@everyone",
          position: 0,
          permissions: (PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages).toString(),
          color: 0,
          managed: false,
        },
      ] as APIGuild["roles"],
    });
    const { plantilla } = importarDesdeDatos(guild, []);
    const everyone = plantilla.roles.find((r) => r.clave === CLAVE_EVERYONE)!;
    expect(everyone.permisos.sort()).toEqual(["enviar-mensajes", "ver-canales"]);
  });

  it("dos canales con el mismo nombre reciben claves distintas", () => {
    const canales = [
      { id: "cat1", name: "A", type: ChannelType.GuildCategory, position: 0, parent_id: null },
      { id: "cat2", name: "B", type: ChannelType.GuildCategory, position: 1, parent_id: null },
      { id: "c1", name: "general", type: ChannelType.GuildText, position: 2, parent_id: "cat1" },
      { id: "c2", name: "general", type: ChannelType.GuildText, position: 3, parent_id: "cat2" },
    ] as unknown as APIGuildChannel<ChannelType>[];
    const { plantilla } = importarDesdeDatos(guildMinimo(), canales);
    const claves = plantilla.categorias.flatMap((c) => c.canales.map((ch) => ch.clave));
    expect(new Set(claves).size).toBe(2);
    expect(validarPlantilla(plantilla).ok).toBe(true);
  });

  it("un temporizador de AFK fuera de la lista permitida se normaliza", () => {
    // Los tipos de Discord solo admiten los cinco valores válidos, pero la API
    // real podría devolver otra cosa; el cast documenta que es un caso defensivo.
    const guild = guildMinimo({ afk_timeout: 77 } as unknown as Partial<APIGuild>);
    const { plantilla } = importarDesdeDatos(guild, []);
    expect(plantilla.ajustes.afkTimeout).toBe(300);
  });

  it("un servidor completamente vacío produce una plantilla válida", () => {
    const { plantilla } = importarDesdeDatos(guildMinimo(), []);
    expect(validarPlantilla(plantilla).ok).toBe(true);
    expect(plantilla.meta.etiquetas).toContain("importada");
  });
});
