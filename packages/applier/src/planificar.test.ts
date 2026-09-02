import { describe, expect, it } from "vitest";
import { ChannelType } from "discord-api-types/v10";
import { plantillaSchema, type EntradaPlantilla } from "@aribuilder/core";
import { plantillaDeGaleria, CLAVES_GALERIA } from "@aribuilder/core/galeria";
import { planificar, TIPO_DISCORD } from "./planificar";
import { planTieneErrores, type Accion, type EstadoServidor, type Plan } from "./tipos";

const GUILD_ID = "100000000000000000";

function estado(cambios: Partial<EstadoServidor> = {}): EstadoServidor {
  return {
    id: GUILD_ID,
    nombre: "Servidor de prueba",
    funciones: [],
    roles: [],
    canales: [],
    emojis: [],
    nivelBoost: 0,
    bot: {
      id: "200000000000000000",
      posicionRolMasAlto: 10,
      esAdministrador: true,
      puedeGestionarRoles: true,
      puedeGestionarCanales: true,
      puedeGestionarServidor: true,
      puedeGestionarExpresiones: true,
    },
    ...cambios,
  };
}

const plantilla = (entrada: Partial<EntradaPlantilla> = {}) =>
  plantillaSchema.parse({ version: 1, meta: { nombre: "T" }, ...entrada });

const acciones = (plan: Plan, tipo: Accion["tipo"]) => plan.acciones.filter((a) => a.tipo === tipo);
const codigos = (plan: Plan) => plan.diagnosticos.map((d) => d.codigo);
const motivos = (plan: Plan) => plan.omisiones.map((o) => `${o.que}: ${o.motivo}`).join(" | ");

describe("orden de las acciones", () => {
  const p = plantilla({
    roles: [{ clave: "mod", nombre: "Mod" }],
    categorias: [
      { clave: "cat", nombre: "CAT", canales: [{ clave: "reglas", nombre: "reglas", mensajes: [{ contenido: "hola" }] }] },
    ],
    emojis: [{ nombre: "pog", url: "https://ejemplo.com/pog.png" }],
  });

  it("crea roles antes que categorías, canales antes que ajustes y contenido al final", () => {
    const plan = planificar(p, estado());
    const orden = plan.acciones.map((a) => a.tipo);
    const indice = (t: Accion["tipo"]) => orden.indexOf(t);

    expect(indice("crear-rol")).toBeLessThan(indice("crear-categoria"));
    expect(indice("crear-categoria")).toBeLessThan(indice("crear-canal"));
    expect(indice("crear-canal")).toBeLessThan(indice("aplicar-ajustes"));
    expect(indice("aplicar-ajustes")).toBeLessThan(indice("publicar-mensaje"));
    expect(indice("publicar-mensaje")).toBeLessThan(indice("crear-emoji"));
  });

  it("el resumen cuadra con las acciones", () => {
    const plan = planificar(p, estado());
    expect(plan.resumen).toMatchObject({
      rolesACrear: 1,
      categoriasACrear: 1,
      canalesACrear: 1,
      mensajesAPublicar: 1,
      emojisACrear: 1,
      aBorrar: 0,
    });
  });
});

describe("@everyone", () => {
  it("se actualiza, nunca se crea, y usa el ID del servidor", () => {
    const plan = planificar(
      plantilla({ roles: [{ clave: "everyone", nombre: "@everyone", permisos: ["ver-canales"] }] }),
      estado(),
    );
    expect(acciones(plan, "crear-rol")).toHaveLength(0);
    const upd = acciones(plan, "actualizar-rol")[0];
    expect(upd).toMatchObject({ clave: "everyone", id: GUILD_ID });
  });
});

describe("modo fusionar (defecto seguro)", () => {
  const base = plantilla({
    roles: [{ clave: "mod", nombre: "Mod" }],
    categorias: [{ clave: "cat", nombre: "GENERAL", canales: [{ clave: "charla", nombre: "charla" }] }],
  });

  it("reutiliza un rol que ya existe en vez de duplicarlo", () => {
    const plan = planificar(base, estado({ roles: [{ id: "r1", nombre: "Mod", posicion: 2, gestionado: false }] }));
    expect(acciones(plan, "crear-rol")).toHaveLength(0);
    expect(acciones(plan, "vincular-rol")[0]).toMatchObject({ clave: "mod", id: "r1" });
    expect(motivos(plan)).toContain("se reutiliza");
  });

  it("compara nombres sin distinguir mayúsculas", () => {
    const plan = planificar(base, estado({ roles: [{ id: "r1", nombre: "  mod ", posicion: 2, gestionado: false }] }));
    expect(acciones(plan, "crear-rol")).toHaveLength(0);
  });

  it("reutiliza una categoría existente y crea sus canales dentro", () => {
    const plan = planificar(
      base,
      estado({ canales: [{ id: "c1", nombre: "GENERAL", tipo: ChannelType.GuildCategory, padreId: null }] }),
    );
    expect(acciones(plan, "crear-categoria")).toHaveLength(0);
    expect(acciones(plan, "vincular-categoria")[0]).toMatchObject({ clave: "cat", id: "c1" });
    expect(acciones(plan, "crear-canal")).toHaveLength(1);
  });

  it("no confunde un canal del mismo nombre en otra categoría", () => {
    const plan = planificar(
      base,
      estado({
        canales: [
          { id: "c1", nombre: "GENERAL", tipo: ChannelType.GuildCategory, padreId: null },
          { id: "c2", nombre: "charla", tipo: ChannelType.GuildText, padreId: "otra" },
        ],
      }),
    );
    expect(acciones(plan, "crear-canal")).toHaveLength(1);
  });

  it("crea el canal dentro de una categoría nueva aunque exista uno igual en otra parte", () => {
    // Regresión: antes se vinculaba al canal ajeno y la categoría nueva quedaba vacía.
    const plan = planificar(
      base,
      estado({ canales: [{ id: "c9", nombre: "charla", tipo: ChannelType.GuildText, padreId: "otra-cat" }] }),
    );
    expect(acciones(plan, "crear-categoria")).toHaveLength(1);
    expect(acciones(plan, "crear-canal")).toHaveLength(1);
    expect(acciones(plan, "vincular-canal")).toHaveLength(0);
  });

  it("sí reutiliza un canal suelto que ya está suelto", () => {
    const p = plantilla({ canalesSueltos: [{ clave: "reglas", nombre: "reglas" }] });
    const plan = planificar(
      p,
      estado({ canales: [{ id: "c1", nombre: "reglas", tipo: ChannelType.GuildText, padreId: null }] }),
    );
    expect(acciones(plan, "vincular-canal")[0]).toMatchObject({ clave: "reglas", id: "c1" });
  });

  it("no borra nada", () => {
    const plan = planificar(base, estado({ roles: [{ id: "r9", nombre: "Viejo", posicion: 3, gestionado: false }] }));
    expect(plan.resumen.aBorrar).toBe(0);
  });
});

describe("modo reemplazar", () => {
  it("actualiza el rol existente en lugar de dejarlo como estaba", () => {
    const plan = planificar(
      plantilla({ roles: [{ clave: "mod", nombre: "Mod", color: "#ff0000" }] }),
      estado({ roles: [{ id: "r1", nombre: "Mod", posicion: 2, gestionado: false }] }),
      "reemplazar",
    );
    expect(acciones(plan, "actualizar-rol")[0]).toMatchObject({ id: "r1", clave: "mod" });
    expect(acciones(plan, "vincular-rol")).toHaveLength(0);
  });
});

describe("modo limpiar", () => {
  const p = plantilla({ roles: [{ clave: "mod", nombre: "Mod" }] });
  const est = estado({
    canales: [{ id: "c1", nombre: "viejo", tipo: ChannelType.GuildText, padreId: null }],
    roles: [
      { id: "r1", nombre: "Mod", posicion: 2, gestionado: false },
      { id: GUILD_ID, nombre: "@everyone", posicion: 0, gestionado: false },
      { id: "rbot", nombre: "Forja", posicion: 9, gestionado: true },
      { id: "ralto", nombre: "Dueño", posicion: 20, gestionado: false },
    ],
  });

  it("borra canales y roles antes de crear nada", () => {
    const plan = planificar(p, est, "limpiar");
    const orden = plan.acciones.map((a) => a.tipo);
    expect(orden.indexOf("borrar-canal")).toBeLessThan(orden.indexOf("crear-rol"));
    expect(orden.indexOf("borrar-rol")).toBeLessThan(orden.indexOf("crear-rol"));
  });

  it("nunca borra @everyone ni los roles gestionados por integraciones", () => {
    const plan = planificar(p, est, "limpiar");
    const borrados = acciones(plan, "borrar-rol").map((a) => (a.tipo === "borrar-rol" ? a.id : ""));
    expect(borrados).toContain("r1");
    expect(borrados).not.toContain(GUILD_ID);
    expect(borrados).not.toContain("rbot");
  });

  it("no intenta borrar roles por encima del bot y lo explica", () => {
    const plan = planificar(p, est, "limpiar");
    const borrados = acciones(plan, "borrar-rol").map((a) => (a.tipo === "borrar-rol" ? a.id : ""));
    expect(borrados).not.toContain("ralto");
    expect(motivos(plan)).toContain("por encima del rol del bot");
  });

  it("recrea todo porque el servidor queda vacío", () => {
    const plan = planificar(p, est, "limpiar");
    expect(acciones(plan, "crear-rol")).toHaveLength(1);
    expect(acciones(plan, "vincular-rol")).toHaveLength(0);
  });
});

describe("jerarquía de roles", () => {
  it("un servidor recién creado, con el bot arriba, no da ningún aviso", () => {
    // Solo hay @everyone (0) y el rol del bot (1): la posición 1 YA es la más
    // alta. Regresión: antes se comparaba con un número absoluto y esto fallaba.
    const plan = planificar(
      plantilla({ roles: [{ clave: "mod", nombre: "Mod" }] }),
      estado({
        roles: [
          { id: GUILD_ID, nombre: "@everyone", posicion: 0, gestionado: false },
          { id: "rbot", nombre: "Forja", posicion: 1, gestionado: true },
        ],
        bot: { ...estado().bot, posicionRolMasAlto: 1 },
      }),
    );
    expect(plan.diagnosticos).toEqual([]);
  });

  it("da error si el bot no tiene ningún rol propio por encima de @everyone", () => {
    const plan = planificar(
      plantilla({ roles: [{ clave: "mod", nombre: "Mod" }] }),
      estado({ bot: { ...estado().bot, posicionRolMasAlto: 0 } }),
    );
    expect(planTieneErrores(plan)).toBe(true);
    const d = plan.diagnosticos.find((x) => x.codigo === "rol-del-bot-demasiado-bajo");
    expect(d?.solucion).toContain("Volvé a invitar al bot");
  });

  it("avisa, sin bloquear, si hay roles por encima del bot y los nombra", () => {
    const plan = planificar(
      plantilla({ roles: [{ clave: "mod", nombre: "Mod" }] }),
      estado({
        roles: [
          { id: GUILD_ID, nombre: "@everyone", posicion: 0, gestionado: false },
          { id: "rbot", nombre: "Forja", posicion: 2, gestionado: true },
          { id: "r1", nombre: "Dueño", posicion: 9, gestionado: false },
          { id: "r2", nombre: "Jefazo", posicion: 8, gestionado: false },
        ],
        bot: { ...estado().bot, posicionRolMasAlto: 2 },
      }),
    );
    const d = plan.diagnosticos.find((x) => x.codigo === "jerarquia-justa");
    expect(d?.nivel).toBe("aviso");
    expect(d?.mensaje).toContain("Dueño");
    expect(d?.mensaje).toContain("2 roles");
    expect(planTieneErrores(plan)).toBe(false);
  });

  it("no dice nada de jerarquía si la plantilla no crea roles", () => {
    const plan = planificar(
      plantilla({ canalesSueltos: [{ clave: "c", nombre: "c" }] }),
      estado({ bot: { ...estado().bot, posicionRolMasAlto: 0 } }),
    );
    expect(codigos(plan)).not.toContain("rol-del-bot-demasiado-bajo");
    expect(codigos(plan)).not.toContain("jerarquia-justa");
  });

  it("reutiliza sin tocar un rol que está por encima del bot", () => {
    const plan = planificar(
      plantilla({ roles: [{ clave: "jefe", nombre: "Jefe" }] }),
      estado({ roles: [{ id: "r1", nombre: "Jefe", posicion: 50, gestionado: false }] }),
    );
    expect(acciones(plan, "vincular-rol")[0]).toMatchObject({ id: "r1" });
    expect(acciones(plan, "actualizar-rol")).toHaveLength(0);
  });
});

describe("permisos del bot", () => {
  it("bloquea si no puede gestionar canales", () => {
    const plan = planificar(plantilla(), estado({ bot: { ...estado().bot, puedeGestionarCanales: false } }));
    expect(codigos(plan)).toContain("sin-permiso-canales");
  });

  it("bloquea si la plantilla concede Administrador y el bot no lo es", () => {
    const plan = planificar(
      plantilla({ roles: [{ clave: "admin", nombre: "Admin", permisos: ["administrador"] }] }),
      estado({ bot: { ...estado().bot, esAdministrador: false } }),
    );
    const d = plan.diagnosticos.find((x) => x.codigo === "no-puede-conceder-admin");
    expect(d?.nivel).toBe("error");
  });

  it("omite los ajustes si no puede gestionar el servidor, sin fallar", () => {
    const plan = planificar(plantilla(), estado({ bot: { ...estado().bot, puedeGestionarServidor: false } }));
    expect(acciones(plan, "aplicar-ajustes")).toHaveLength(0);
    expect(planTieneErrores(plan)).toBe(false);
    expect(motivos(plan)).toContain("Gestionar servidor");
  });
});

describe("funciones de Comunidad", () => {
  const conForo = plantilla({
    canalesSueltos: [
      { clave: "foro", nombre: "foro", tipo: "foro" },
      { clave: "charla", nombre: "charla" },
    ],
  });

  it("omite los canales que exigen Comunidad y sigue con el resto", () => {
    const plan = planificar(conForo, estado());
    expect(acciones(plan, "crear-canal")).toHaveLength(1);
    expect(motivos(plan)).toContain("Comunidad activada");
    expect(planTieneErrores(plan)).toBe(false);
  });

  it("los crea si el servidor sí tiene Comunidad", () => {
    const plan = planificar(conForo, estado({ funciones: ["COMMUNITY"] }));
    expect(acciones(plan, "crear-canal")).toHaveLength(2);
  });

  it("no publica el contenido de un canal que se omitió", () => {
    const p = plantilla({
      canalesSueltos: [{ clave: "an", nombre: "an", tipo: "anuncios", mensajes: [{ contenido: "hola" }] }],
    });
    const plan = planificar(p, estado());
    expect(acciones(plan, "publicar-mensaje")).toHaveLength(0);
  });
});

describe("emojis", () => {
  const conEmojis = plantilla({
    emojis: [
      { nombre: "uno", url: "https://ejemplo.com/1.png" },
      { nombre: "dos", url: "https://ejemplo.com/2.png" },
    ],
  });

  it("respeta el tope según el nivel de boost", () => {
    const llenos = Array.from({ length: 49 }, (_, i) => ({ id: `e${i}`, nombre: `e${i}` }));
    const plan = planificar(conEmojis, estado({ emojis: llenos }));
    expect(acciones(plan, "crear-emoji")).toHaveLength(1);
    expect(motivos(plan)).toContain("solo admite 50 emojis");
  });

  it("con boost nivel 2 caben más", () => {
    const llenos = Array.from({ length: 49 }, (_, i) => ({ id: `e${i}`, nombre: `e${i}` }));
    const plan = planificar(conEmojis, estado({ emojis: llenos, nivelBoost: 2 }));
    expect(acciones(plan, "crear-emoji")).toHaveLength(2);
  });

  it("omite un emoji cuyo nombre ya existe", () => {
    const plan = planificar(conEmojis, estado({ emojis: [{ id: "e", nombre: "uno" }] }));
    expect(acciones(plan, "crear-emoji")).toHaveLength(1);
  });
});

describe("topes y renombrados", () => {
  it("da error si el servidor se pasaría de 500 canales", () => {
    const canales = Array.from({ length: 498 }, (_, i) => ({
      id: `c${i}`,
      nombre: `c${i}`,
      tipo: ChannelType.GuildText,
      padreId: null,
    }));
    const p = plantilla({
      canalesSueltos: [
        { clave: "a", nombre: "a" },
        { clave: "b", nombre: "b" },
        { clave: "c", nombre: "c" },
      ],
    });
    expect(codigos(planificar(p, estado({ canales })))).toContain("tope-de-canales");
  });

  it("avisa de que Discord va a renombrar un canal de texto con mayúsculas", () => {
    const plan = planificar(plantilla({ canalesSueltos: [{ clave: "x", nombre: "Canal Nuevo" }] }), estado());
    expect(motivos(plan)).toContain('renombrar a "canal-nuevo"');
  });

  it("no avisa por los nombres de canales de voz, que sí admiten mayúsculas", () => {
    const plan = planificar(
      plantilla({ canalesSueltos: [{ clave: "v", nombre: "Sala Uno", tipo: "voz" }] }),
      estado(),
    );
    expect(motivos(plan)).not.toContain("renombrar");
  });
});

describe("la galería entera se planifica limpia en un servidor vacío", () => {
  it.each(CLAVES_GALERIA)("«%s» no produce ningún error", (clave) => {
    const plan = planificar(plantillaDeGaleria(clave), estado());
    expect(plan.diagnosticos.filter((d) => d.nivel === "error")).toEqual([]);
    expect(plan.resumen.canalesACrear).toBeGreaterThan(0);
    expect(plan.resumen.rolesACrear).toBeGreaterThan(0);
  });

  it("«gaming» aplicada dos veces seguidas no duplica nada", () => {
    const p = plantillaDeGaleria("gaming");
    const primero = planificar(p, estado());

    // Simulamos el servidor resultante de la primera pasada.
    let idc = 0;
    const idPorCategoria = new Map<string, string>();
    const canales: EstadoServidor["canales"] = [];
    for (const a of primero.acciones) {
      if (a.tipo === "crear-categoria") {
        const id = `cat${idc++}`;
        idPorCategoria.set(a.clave, id);
        canales.push({ id, nombre: a.nombre, tipo: ChannelType.GuildCategory, padreId: null });
      } else if (a.tipo === "crear-canal") {
        canales.push({
          id: `ch${idc++}`,
          nombre: a.canal.nombre,
          tipo: TIPO_DISCORD[a.canal.tipo],
          padreId: a.categoriaClave ? (idPorCategoria.get(a.categoriaClave) ?? null) : null,
        });
      }
    }
    const roles = primero.acciones.flatMap((a): EstadoServidor["roles"] =>
      a.tipo === "crear-rol" ? [{ id: `r${idc++}`, nombre: a.rol.nombre, posicion: 2, gestionado: false }] : [],
    );

    const segundo = planificar(p, estado({ canales, roles }));
    expect(segundo.resumen.rolesACrear).toBe(0);
    expect(segundo.resumen.canalesACrear).toBe(0);
    expect(segundo.resumen.categoriasACrear).toBe(0);
  });
});
