import { describe, expect, it } from "vitest";
import { plantillaSchema, validarPlantilla, type EntradaPlantilla, type Plantilla } from "@aribuilder/core";
import { plantillaDeGaleria } from "@aribuilder/core/galeria";
import {
  buscarCanal,
  categoriaDe,
  estadoInicial,
  erroresDe,
  reducirEditor,
  type AccionEditor,
  type EstadoEditor,
} from "./editor";

const plantilla = (e: Partial<EntradaPlantilla> = {}): Plantilla =>
  plantillaSchema.parse({ version: 1, meta: { nombre: "T" }, ...e });

/** Encadena acciones sobre un estado inicial. */
function correr(inicial: Plantilla, ...acciones: AccionEditor[]): EstadoEditor {
  return acciones.reduce(reducirEditor, estadoInicial(inicial));
}

const valida = (p: Plantilla) => expect(validarPlantilla(p).ok, JSON.stringify(erroresDe(p))).toBe(true);

describe("añadir", () => {
  it("crea una categoría, la selecciona y deja la plantilla válida", () => {
    const e = correr(plantilla(), { tipo: "anadir-categoria" });
    expect(e.plantilla.categorias).toHaveLength(1);
    expect(e.seleccion).toEqual({ tipo: "categoria", clave: e.plantilla.categorias[0]!.clave });
    valida(e.plantilla);
  });

  it("nunca repite una clave por muchos elementos que se añadan", () => {
    let e = correr(plantilla());
    for (let i = 0; i < 12; i++) {
      e = reducirEditor(e, { tipo: "anadir-canal", categoriaClave: null });
      e = reducirEditor(e, { tipo: "anadir-rol" });
    }
    const claves = [...e.plantilla.canalesSueltos.map((c) => c.clave), ...e.plantilla.roles.map((r) => r.clave)];
    expect(new Set(claves).size).toBe(claves.length);
    valida(e.plantilla);
  });

  it("mete el canal dentro de la categoría pedida", () => {
    let e = correr(plantilla(), { tipo: "anadir-categoria" });
    const cat = e.plantilla.categorias[0]!.clave;
    e = reducirEditor(e, { tipo: "anadir-canal", categoriaClave: cat });
    expect(e.plantilla.categorias[0]!.canales).toHaveLength(1);
    expect(e.plantilla.canalesSueltos).toHaveLength(0);
  });

  it("un canal de voz nace con nombre de voz", () => {
    const e = correr(plantilla(), { tipo: "anadir-canal", categoriaClave: null, tipoCanal: "voz" });
    expect(e.plantilla.canalesSueltos[0]).toMatchObject({ tipo: "voz", nombre: "Sala nueva" });
  });
});

describe("borrar un rol limpia lo que lo mencionaba", () => {
  const base = plantilla({
    roles: [
      { clave: "mod", nombre: "Mod" },
      { clave: "otro", nombre: "Otro" },
    ],
    categorias: [
      {
        clave: "cat",
        nombre: "CAT",
        permisos: [{ rol: "mod", denegar: ["ver-canales"] }],
        canales: [
          {
            clave: "ch",
            nombre: "ch",
            permisos: [
              { rol: "mod", permitir: ["ver-canales"] },
              { rol: "otro", permitir: ["ver-canales"] },
            ],
            panelRoles: { titulo: "Elegí", roles: ["mod", "otro"] },
          },
        ],
      },
    ],
  });

  it("quita sus overwrites de canales y categorías", () => {
    const e = correr(base, { tipo: "borrar-rol", clave: "mod" });
    const canal = buscarCanal(e.plantilla, "ch")!;
    expect(canal.permisos.map((o) => o.rol)).toEqual(["otro"]);
    expect(e.plantilla.categorias[0]!.permisos).toEqual([]);
    valida(e.plantilla);
  });

  it("lo saca de los paneles de roles", () => {
    const e = correr(base, { tipo: "borrar-rol", clave: "mod" });
    expect(buscarCanal(e.plantilla, "ch")!.panelRoles!.roles).toEqual(["otro"]);
    valida(e.plantilla);
  });

  it("si el panel se queda sin roles, el panel desaparece entero", () => {
    // Un panel con la lista vacía no valida contra el esquema.
    const e = correr(base, { tipo: "borrar-rol", clave: "mod" }, { tipo: "borrar-rol", clave: "otro" });
    expect(buscarCanal(e.plantilla, "ch")!.panelRoles).toBeUndefined();
    valida(e.plantilla);
  });

  it("borrar todos los roles de una plantilla de la galería la deja válida", () => {
    let e = estadoInicial(plantillaDeGaleria("gaming"));
    for (const rol of [...e.plantilla.roles]) {
      e = reducirEditor(e, { tipo: "borrar-rol", clave: rol.clave });
    }
    expect(e.plantilla.roles).toEqual([]);
    valida(e.plantilla);
  });
});

describe("borrar un canal", () => {
  const base = plantilla({
    canalesSueltos: [
      { clave: "general", nombre: "general" },
      { clave: "afk", nombre: "AFK", tipo: "voz" },
    ],
    ajustes: { canalSistema: "general", canalAfk: "afk" },
  });

  it("limpia los ajustes que lo referenciaban", () => {
    const e = correr(base, { tipo: "borrar-canal", clave: "general" });
    expect(e.plantilla.ajustes.canalSistema).toBeUndefined();
    expect(e.plantilla.ajustes.canalAfk).toBe("afk");
    valida(e.plantilla);
  });

  it("borrar el canal de AFK limpia también su referencia", () => {
    const e = correr(base, { tipo: "borrar-canal", clave: "afk" });
    expect(e.plantilla.ajustes.canalAfk).toBeUndefined();
    valida(e.plantilla);
  });

  it("deselecciona, porque lo seleccionado ya no existe", () => {
    const e = correr(base, { tipo: "seleccionar", seleccion: { tipo: "canal", clave: "general" } }, { tipo: "borrar-canal", clave: "general" });
    expect(e.seleccion).toBeNull();
  });
});

describe("borrar una categoría", () => {
  it("no se lleva por delante los canales: pasan a estar sueltos", () => {
    const base = plantilla({
      categorias: [{ clave: "cat", nombre: "CAT", canales: [{ clave: "ch", nombre: "ch" }] }],
    });
    const e = correr(base, { tipo: "borrar-categoria", clave: "cat" });
    expect(e.plantilla.categorias).toHaveLength(0);
    expect(e.plantilla.canalesSueltos.map((c) => c.clave)).toEqual(["ch"]);
    valida(e.plantilla);
  });
});

describe("cambiar el tipo de canal", () => {
  const base = plantilla({
    roles: [{ clave: "mod", nombre: "Mod" }],
    canalesSueltos: [
      {
        clave: "ch",
        nombre: "ch",
        tipo: "texto",
        modoLento: 30,
        mensajes: [{ contenido: "hola" }],
        panelRoles: { titulo: "x", roles: ["mod"] },
      },
    ],
  });

  it("de texto a voz suelta mensajes, panel y modo lento", () => {
    const e = correr(base, { tipo: "editar-canal", clave: "ch", cambios: { tipo: "voz" } });
    const canal = buscarCanal(e.plantilla, "ch")!;
    expect(canal.mensajes).toEqual([]);
    expect(canal.panelRoles).toBeUndefined();
    expect(canal.modoLento).toBe(0);
    valida(e.plantilla);
  });

  it("de texto a foro conserva nada que el foro no admita", () => {
    const e = correr(base, { tipo: "editar-canal", clave: "ch", cambios: { tipo: "foro" } });
    expect(buscarCanal(e.plantilla, "ch")!.panelRoles).toBeUndefined();
    valida(e.plantilla);
  });

  it("de voz a texto descarta el límite de usuarios", () => {
    const p = plantilla({ canalesSueltos: [{ clave: "v", nombre: "V", tipo: "voz", limiteUsuarios: 5 }] });
    const e = correr(p, { tipo: "editar-canal", clave: "v", cambios: { tipo: "texto" } });
    expect(buscarCanal(e.plantilla, "v")!.limiteUsuarios).toBeUndefined();
    valida(e.plantilla);
  });
});

describe("mover", () => {
  const base = plantilla({
    canalesSueltos: [{ clave: "suelto", nombre: "suelto" }],
    categorias: [
      { clave: "a", nombre: "A", canales: [{ clave: "a1", nombre: "a1" }, { clave: "a2", nombre: "a2" }] },
      { clave: "b", nombre: "B", canales: [] },
    ],
  });

  it("mueve un canal de una categoría a otra", () => {
    const e = correr(base, { tipo: "mover-canal", clave: "a1", destinoCategoria: "b", indice: 0 });
    expect(categoriaDe(e.plantilla, "a1")).toBe("b");
    expect(e.plantilla.categorias[0]!.canales.map((c) => c.clave)).toEqual(["a2"]);
    valida(e.plantilla);
  });

  it("reordena dentro de la misma categoría", () => {
    const e = correr(base, { tipo: "mover-canal", clave: "a2", destinoCategoria: "a", indice: 0 });
    expect(e.plantilla.categorias[0]!.canales.map((c) => c.clave)).toEqual(["a2", "a1"]);
  });

  it("saca un canal a la zona suelta", () => {
    const e = correr(base, { tipo: "mover-canal", clave: "a1", destinoCategoria: null, indice: 0 });
    expect(categoriaDe(e.plantilla, "a1")).toBeNull();
    expect(e.plantilla.canalesSueltos.map((c) => c.clave)).toEqual(["a1", "suelto"]);
  });

  it("un índice fuera de rango no rompe nada, se recorta", () => {
    const e = correr(base, { tipo: "mover-canal", clave: "suelto", destinoCategoria: "b", indice: 99 });
    expect(e.plantilla.categorias[1]!.canales.map((c) => c.clave)).toEqual(["suelto"]);
    valida(e.plantilla);
  });

  it("nunca duplica ni pierde un canal al moverlo", () => {
    const contar = (p: Plantilla) => p.canalesSueltos.length + p.categorias.reduce((n, c) => n + c.canales.length, 0);
    let e = estadoInicial(base);
    const antes = contar(e.plantilla);
    for (const destino of ["b", null, "a", "b"] as const) {
      e = reducirEditor(e, { tipo: "mover-canal", clave: "a1", destinoCategoria: destino, indice: 0 });
      expect(contar(e.plantilla)).toBe(antes);
    }
  });

  it("reordena categorías", () => {
    const e = correr(base, { tipo: "mover-categoria", clave: "b", indice: 0 });
    expect(e.plantilla.categorias.map((c) => c.clave)).toEqual(["b", "a"]);
  });
});

describe("@everyone", () => {
  it("no se puede renombrar, solo cambiar sus permisos", () => {
    const base = plantilla({ roles: [{ clave: "everyone", nombre: "@everyone" }] });
    const e = correr(base, {
      tipo: "editar-rol",
      clave: "everyone",
      cambios: { nombre: "Pepito", color: "#ff0000", permisos: ["ver-canales"] },
    });
    expect(e.plantilla.roles[0]!.nombre).toBe("@everyone");
    expect(e.plantilla.roles[0]!.color).toBeUndefined();
    expect(e.plantilla.roles[0]!.permisos).toEqual(["ver-canales"]);
  });
});

describe("historial", () => {
  it("deshace y rehace un cambio", () => {
    let e = correr(plantilla(), { tipo: "anadir-categoria" });
    expect(e.plantilla.categorias).toHaveLength(1);

    e = reducirEditor(e, { tipo: "deshacer" });
    expect(e.plantilla.categorias).toHaveLength(0);

    e = reducirEditor(e, { tipo: "rehacer" });
    expect(e.plantilla.categorias).toHaveLength(1);
  });

  it("un cambio nuevo descarta el futuro", () => {
    let e = correr(plantilla(), { tipo: "anadir-categoria" }, { tipo: "deshacer" });
    expect(e.futuro).toHaveLength(1);
    e = reducirEditor(e, { tipo: "anadir-rol" });
    expect(e.futuro).toHaveLength(0);
  });

  it("deshacer sin historial no hace nada", () => {
    const e = correr(plantilla(), { tipo: "deshacer" }, { tipo: "rehacer" });
    expect(e.plantilla.categorias).toHaveLength(0);
  });

  it("el historial no crece sin límite", () => {
    let e = estadoInicial(plantilla());
    for (let i = 0; i < 80; i++) e = reducirEditor(e, { tipo: "anadir-rol" });
    expect(e.pasado.length).toBeLessThanOrEqual(50);
  });

  it("seleccionar no ensucia ni entra en el historial", () => {
    const e = correr(plantilla(), { tipo: "seleccionar", seleccion: { tipo: "ajustes" } });
    expect(e.sucio).toBe(false);
    expect(e.pasado).toHaveLength(0);
  });

  it("marcar-guardado limpia el indicador de cambios", () => {
    const e = correr(plantilla(), { tipo: "anadir-rol" }, { tipo: "marcar-guardado" });
    expect(e.sucio).toBe(false);
  });
});

describe("la plantilla se mantiene válida haciendo de todo", () => {
  it("una sesión de edición larga sobre «comunidad» nunca la invalida", () => {
    let e = estadoInicial(plantillaDeGaleria("comunidad"));
    const acciones: AccionEditor[] = [
      { tipo: "anadir-categoria" },
      { tipo: "anadir-rol" },
      { tipo: "anadir-canal", categoriaClave: null, tipoCanal: "voz" },
      { tipo: "borrar-rol", clave: "mod" },
      { tipo: "borrar-categoria", clave: "cat-charla" },
      { tipo: "mover-canal", clave: "general", destinoCategoria: "cat-voz", indice: 0 },
      { tipo: "editar-canal", clave: "general", cambios: { tipo: "voz" } },
      { tipo: "borrar-canal", clave: "bienvenidas" },
      { tipo: "deshacer" },
      { tipo: "rehacer" },
    ];
    for (const accion of acciones) {
      e = reducirEditor(e, accion);
      valida(e.plantilla);
    }
  });
});
