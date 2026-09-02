import { describe, expect, it, vi } from "vitest";
import type { REST } from "@discordjs/rest";
import { ChannelType } from "discord-api-types/v10";
import { plantillaSchema, type EntradaPlantilla } from "@aribuilder/core";
import { plantillaDeGaleria } from "@aribuilder/core/galeria";
import { aplicar, deshacer, PREFIJO_AUTOROL } from "./aplicar";
import { planificar } from "./planificar";
import { ErrorAplicacion, type Creados, type EstadoServidor, type Evento } from "./tipos";

const GUILD_ID = "100000000000000000";

function estadoVacio(): EstadoServidor {
  return {
    id: GUILD_ID,
    nombre: "Prueba",
    funciones: [],
    roles: [],
    canales: [],
    emojis: [],
    nivelBoost: 0,
    bot: {
      id: "bot",
      posicionRolMasAlto: 30,
      esAdministrador: true,
      puedeGestionarRoles: true,
      puedeGestionarCanales: true,
      puedeGestionarServidor: true,
      puedeGestionarExpresiones: true,
    },
  };
}

interface Llamada {
  metodo: "post" | "patch" | "delete" | "put";
  ruta: string;
  body?: any;
}

/** REST de mentira: registra lo que se le pide y devuelve IDs incrementales. */
function restFalso(opciones: { fallarEn?: (ruta: string, body: any) => unknown } = {}) {
  const llamadas: Llamada[] = [];
  let n = 0;
  const responder = (metodo: Llamada["metodo"]) => async (ruta: string, opts?: { body?: any }) => {
    const body = opts?.body;
    llamadas.push({ metodo, ruta, body });
    const fallo = opciones.fallarEn?.(ruta, body);
    if (fallo) throw fallo;
    return { id: `id${++n}`, name: body?.name };
  };
  const rest = {
    post: vi.fn(responder("post")),
    patch: vi.fn(responder("patch")),
    delete: vi.fn(responder("delete")),
    put: vi.fn(responder("put")),
  } as unknown as REST;
  return { rest, llamadas };
}

async function correr(plan: ReturnType<typeof planificar>, rest: REST) {
  const eventos: Evento[] = [];
  const it = aplicar(plan, rest, GUILD_ID);
  let res = await it.next();
  while (!res.done) {
    eventos.push(res.value);
    res = await it.next();
  }
  return { eventos, creados: res.value };
}

const plantilla = (e: Partial<EntradaPlantilla> = {}) =>
  plantillaSchema.parse({ version: 1, meta: { nombre: "T" }, ...e });

describe("aplicar", () => {
  it("se niega a empezar si el plan tiene errores", async () => {
    const plan = planificar(
      plantilla({ roles: [{ clave: "mod", nombre: "Mod" }] }),
      // Sin rol propio por encima de @everyone: el plan no puede ni empezar.
      { ...estadoVacio(), bot: { ...estadoVacio().bot, posicionRolMasAlto: 0 } },
    );
    const { rest, llamadas } = restFalso();
    await expect(correr(plan, rest)).rejects.toThrow(ErrorAplicacion);
    expect(llamadas).toHaveLength(0); // no toca la red
  });

  it("resuelve las claves simbólicas a los IDs reales en los overwrites", async () => {
    const p = plantilla({
      roles: [{ clave: "mod", nombre: "Mod" }],
      canalesSueltos: [
        { clave: "staff", nombre: "staff", permisos: [{ rol: "mod", permitir: ["ver-canales"] }] },
      ],
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);

    const rol = llamadas.find((l) => l.ruta.endsWith("/roles"))!;
    const canal = llamadas.find((l) => l.body?.name === "staff")!;
    expect(canal.body.permission_overwrites[0].id).toBe("id1");
    expect(rol.ruta).toContain("/roles");
    // El overwrite lleva el bitfield, no el nombre en español.
    expect(canal.body.permission_overwrites[0].allow).toMatch(/^\d+$/);
  });

  it("@everyone usa el ID del servidor sin haberlo creado", async () => {
    const p = plantilla({
      canalesSueltos: [{ clave: "c", nombre: "c", permisos: [{ rol: "everyone", denegar: ["enviar-mensajes"] }] }],
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);
    const canal = llamadas.find((l) => l.body?.name === "c")!;
    expect(canal.body.permission_overwrites[0].id).toBe(GUILD_ID);
  });

  it("mete el canal dentro de la categoría recién creada", async () => {
    const p = plantilla({
      categorias: [{ clave: "cat", nombre: "CAT", canales: [{ clave: "ch", nombre: "ch" }] }],
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);
    const cat = llamadas.find((l) => l.body?.type === ChannelType.GuildCategory)!;
    const canal = llamadas.find((l) => l.body?.name === "ch")!;
    expect(canal.body.parent_id).toBe("id1");
    expect(cat.body.name).toBe("CAT");
  });

  it("no manda modo lento a un canal de voz ni límite de usuarios a uno de texto", async () => {
    const p = plantilla({
      canalesSueltos: [
        { clave: "v", nombre: "Voz", tipo: "voz", limiteUsuarios: 5 },
        { clave: "t", nombre: "texto", modoLento: 10 },
      ],
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);
    const voz = llamadas.find((l) => l.body?.name === "Voz")!;
    const texto = llamadas.find((l) => l.body?.name === "texto")!;
    expect(voz.body.rate_limit_per_user).toBeUndefined();
    expect(voz.body.user_limit).toBe(5);
    expect(texto.body.user_limit).toBeUndefined();
    expect(texto.body.rate_limit_per_user).toBe(10);
  });

  it("aplica los ajustes después de crear los canales que referencia", async () => {
    const p = plantilla({
      canalesSueltos: [
        { clave: "general", nombre: "general" },
        { clave: "afk", nombre: "AFK", tipo: "voz" },
      ],
      ajustes: { canalSistema: "general", canalAfk: "afk", afkTimeout: 900 },
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);
    const ajustes = llamadas.find((l) => l.metodo === "patch" && l.ruta === `/guilds/${GUILD_ID}`)!;
    expect(ajustes.body.system_channel_id).toBe("id1");
    expect(ajustes.body.afk_channel_id).toBe("id2");
    expect(ajustes.body.afk_timeout).toBe(900);
  });

  it("publica y fija el mensaje de reglas", async () => {
    const p = plantilla({
      canalesSueltos: [{ clave: "reglas", nombre: "reglas", mensajes: [{ contenido: "Sé amable", fijar: true }] }],
    });
    const { rest, llamadas } = restFalso();
    const { creados } = await correr(planificar(p, estadoVacio()), rest);
    expect(llamadas.some((l) => l.ruta === "/channels/id1/messages")).toBe(true);
    expect(llamadas.some((l) => l.metodo === "put" && l.ruta.includes("/pins/"))).toBe(true);
    expect(creados.mensajes).toHaveLength(1);
  });

  it("si no puede fijar el mensaje avisa pero no falla", async () => {
    const p = plantilla({
      canalesSueltos: [{ clave: "reglas", nombre: "reglas", mensajes: [{ contenido: "x", fijar: true }] }],
    });
    const { rest } = restFalso({ fallarEn: (ruta) => (ruta.includes("/pins/") ? { status: 403, code: 50013 } : null) });
    const { eventos } = await correr(planificar(p, estadoVacio()), rest);
    expect(eventos.some((e) => e.tipo === "aviso" && e.mensaje.includes("no se pudo fijar"))).toBe(true);
    expect(eventos.filter((e) => e.tipo === "error")).toHaveLength(0);
  });

  it("el botón enseña el nombre del rol, no su clave interna", async () => {
    const p = plantilla({
      roles: [{ clave: "anuncios-ping", nombre: "Avisos de directo" }],
      canalesSueltos: [
        { clave: "roles", nombre: "roles", panelRoles: { titulo: "Elegí", roles: ["anuncios-ping"] } },
      ],
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);
    const panel = llamadas.find((l) => l.body?.components)!;
    expect(panel.body.components[0].components[0].label).toBe("Avisos de directo");
  });

  it("recorta una etiqueta de botón más larga de lo que admite Discord", async () => {
    const p = plantilla({
      roles: [{ clave: "largo", nombre: "R".repeat(100) }],
      canalesSueltos: [{ clave: "roles", nombre: "roles", panelRoles: { titulo: "x", roles: ["largo"] } }],
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);
    const panel = llamadas.find((l) => l.body?.components)!;
    expect(panel.body.components[0].components[0].label).toHaveLength(80);
  });

  it("construye el panel de roles con botones que el bot sabrá leer", async () => {
    const p = plantilla({
      roles: [{ clave: "gamer", nombre: "Gamer" }],
      canalesSueltos: [
        { clave: "roles", nombre: "roles", panelRoles: { titulo: "Elegí", roles: ["gamer"] } },
      ],
    });
    const { rest, llamadas } = restFalso();
    const { creados } = await correr(planificar(p, estadoVacio()), rest);
    const panel = llamadas.find((l) => l.body?.components)!;
    const boton = panel.body.components[0].components[0];
    expect(boton.custom_id).toBe(`${PREFIJO_AUTOROL}id1`);
    expect(creados.paneles).toHaveLength(1);
    expect(creados.paneles[0]!.roles[0]).toEqual({ id: "id1", nombre: "Gamer" });
  });

  it("reparte los botones en filas de cinco", async () => {
    const roles = Array.from({ length: 7 }, (_, i) => ({ clave: `r${i}`, nombre: `Rol ${i}` }));
    const p = plantilla({
      roles,
      canalesSueltos: [
        { clave: "roles", nombre: "roles", panelRoles: { titulo: "Elegí", roles: roles.map((r) => r.clave) } },
      ],
    });
    const { rest, llamadas } = restFalso();
    await correr(planificar(p, estadoVacio()), rest);
    const panel = llamadas.find((l) => l.body?.components)!;
    expect(panel.body.components).toHaveLength(2);
    expect(panel.body.components[0].components).toHaveLength(5);
    expect(panel.body.components[1].components).toHaveLength(2);
  });

  it("un paso que falla no aborta el resto y se cuenta como fallo", async () => {
    const p = plantilla({
      canalesSueltos: [
        { clave: "a", nombre: "a" },
        { clave: "b", nombre: "b" },
        { clave: "c", nombre: "c" },
      ],
    });
    const { rest } = restFalso({
      fallarEn: (_ruta, body) => (body?.name === "b" ? { status: 403, code: 50013 } : null),
    });
    const { eventos, creados } = await correr(planificar(p, estadoVacio()), rest);
    const fin = eventos.find((e) => e.tipo === "fin")!;
    expect(fin).toMatchObject({ fallos: 1 });
    expect(creados.canales.map((c) => c.clave)).toEqual(["a", "c"]);
  });

  it("traduce el error de permisos a algo accionable en español", async () => {
    const p = plantilla({ canalesSueltos: [{ clave: "a", nombre: "a" }] });
    const { rest } = restFalso({ fallarEn: () => ({ status: 403, code: 50013 }) });
    const { eventos } = await correr(planificar(p, estadoVacio()), rest);
    const error = eventos.find((e) => e.tipo === "error")!;
    expect(error.mensaje).toContain("falta de permisos");
    expect(error.mensaje).toContain("Ajustes del servidor → Roles");
  });

  it("emite un paso por acción y termina con el total cuadrado", async () => {
    const plan = planificar(plantillaDeGaleria("gaming"), estadoVacio());
    const { rest } = restFalso();
    const { eventos } = await correr(plan, rest);
    const pasos = eventos.filter((e) => e.tipo === "paso");
    expect(pasos).toHaveLength(plan.acciones.length);
    expect(eventos[0]).toMatchObject({ tipo: "inicio", total: plan.acciones.length });
    expect(pasos.at(-1)).toMatchObject({ indice: plan.acciones.length });
  });

  it("aplica la plantilla gaming entera sin un solo fallo", async () => {
    const plan = planificar(plantillaDeGaleria("gaming"), estadoVacio());
    const { rest } = restFalso();
    const { eventos, creados } = await correr(plan, rest);
    expect(eventos.filter((e) => e.tipo === "error")).toEqual([]);
    expect(creados.roles.length).toBe(plan.resumen.rolesACrear);
    expect(creados.canales.length).toBe(plan.resumen.categoriasACrear + plan.resumen.canalesACrear);
  });
});

describe("deshacer", () => {
  const creados: Creados = {
    roles: [{ id: "r1", clave: "mod" }],
    canales: [
      { id: "c1", clave: "cat" },
      { id: "c2", clave: "charla" },
    ],
    emojis: [{ id: "e1", nombre: "pog" }],
    mensajes: [],
    paneles: [],
  };

  async function correrDeshacer(rest: REST) {
    const eventos: Evento[] = [];
    for await (const e of deshacer(creados, rest, GUILD_ID)) eventos.push(e);
    return eventos;
  }

  it("borra exactamente lo creado y nada más", async () => {
    const { rest, llamadas } = restFalso();
    await correrDeshacer(rest);
    const borradas = llamadas.filter((l) => l.metodo === "delete").map((l) => l.ruta);
    expect(borradas).toEqual([
      "/channels/c1",
      "/channels/c2",
      `/guilds/${GUILD_ID}/roles/r1`,
      `/guilds/${GUILD_ID}/emojis/e1`,
    ]);
  });

  it("borra los canales antes que los roles, porque los overwrites dependen de ellos", async () => {
    const { rest, llamadas } = restFalso();
    await correrDeshacer(rest);
    const rutas = llamadas.map((l) => l.ruta);
    expect(rutas.indexOf("/channels/c2")).toBeLessThan(rutas.indexOf(`/guilds/${GUILD_ID}/roles/r1`));
  });

  it("un 404 no cuenta como fallo: ya no estaba", async () => {
    const { rest } = restFalso({ fallarEn: (ruta) => (ruta === "/channels/c1" ? { status: 404 } : null) });
    const eventos = await correrDeshacer(rest);
    expect(eventos.find((e) => e.tipo === "fin")).toMatchObject({ fallos: 0 });
    expect(eventos.filter((e) => e.tipo === "error")).toEqual([]);
  });

  it("un fallo real sí se reporta y no corta el resto", async () => {
    const { rest, llamadas } = restFalso({
      fallarEn: (ruta) => (ruta === "/channels/c1" ? { status: 403, code: 50013 } : null),
    });
    const eventos = await correrDeshacer(rest);
    expect(eventos.find((e) => e.tipo === "fin")).toMatchObject({ fallos: 1 });
    expect(llamadas.filter((l) => l.metodo === "delete")).toHaveLength(4);
  });
});
