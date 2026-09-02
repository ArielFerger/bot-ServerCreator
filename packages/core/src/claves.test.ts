import { describe, expect, it } from "vitest";
import { aClave, claveNueva, claveUnica, clavesUsadas } from "./claves";
import { plantillaSchema } from "./schema";
import { plantillaDeGaleria } from "./galeria";

describe("aClave", () => {
  it.each([
    ["📢 BIENVENIDA", "bienvenida"],
    ["Sala de estudio 1", "sala-de-estudio-1"],
    ["diseño", "diseno"],
    ["elegí-tus-roles", "elegi-tus-roles"],
    ["  espacios   raros  ", "espacios-raros"],
    ["---", "elemento"],
    ["🎮🎮🎮", "elemento"],
    ["", "elemento"],
  ])("«%s» -> «%s»", (entrada, esperado) => {
    expect(aClave(entrada)).toBe(esperado);
  });

  it("siempre produce una clave que el esquema acepta", () => {
    const entradas = ["📢 BIENVENIDA", "Ñoño & Cía.", "123", "a".repeat(200), "—", "Ñ"];
    for (const entrada of entradas) {
      expect(aClave(entrada)).toMatch(/^[a-z0-9][a-z0-9-]{0,63}$/);
    }
  });
});

describe("claveUnica", () => {
  it("devuelve la base si está libre", () => {
    expect(claveUnica("General", new Set())).toBe("general");
  });

  it("añade sufijos hasta encontrar hueco", () => {
    const usadas = new Set(["general", "general-2", "general-3"]);
    expect(claveUnica("General", usadas)).toBe("general-4");
  });

  it("nunca devuelve una clave ya usada, por muchas colisiones que haya", () => {
    const usadas = new Set(Array.from({ length: 50 }, (_, i) => (i === 0 ? "x" : `x-${i + 1}`)));
    const nueva = claveUnica("x", usadas);
    expect(usadas.has(nueva)).toBe(false);
  });
});

describe("clavesUsadas", () => {
  it("recoge roles, categorías y canales, más @everyone", () => {
    const p = plantillaSchema.parse({
      version: 1,
      meta: { nombre: "T" },
      roles: [{ clave: "mod", nombre: "Mod" }],
      categorias: [{ clave: "cat", nombre: "C", canales: [{ clave: "ch", nombre: "ch" }] }],
      canalesSueltos: [{ clave: "suelto", nombre: "suelto" }],
    });
    expect(clavesUsadas(p)).toEqual(new Set(["everyone", "mod", "cat", "ch", "suelto"]));
  });

  it("una clave nueva sobre una plantilla real no choca con nada", () => {
    const p = plantillaDeGaleria("gaming");
    const nueva = claveNueva(p, "General");
    expect(clavesUsadas(p).has(nueva)).toBe(false);
  });
});
