import { describe, expect, it } from "vitest";
import { MARCA } from "@aribuilder/core";
import { decidirApodo, necesitaRenombrarUsuario } from "./identidad";

const NOMBRE = MARCA.nombreBot;

describe("necesitaRenombrarUsuario", () => {
  it("no toca nada si ya se llama como debe", () => {
    expect(necesitaRenombrarUsuario(NOMBRE)).toBe(false);
  });

  it.each([["OtroBot"], [""], [null], [undefined]])("renombra cuando el usuario es %s", (nombre) => {
    expect(necesitaRenombrarUsuario(nombre)).toBe(true);
  });
});

describe("decidirApodo", () => {
  it("no hace nada si el usuario global ya es correcto y nadie puso apodo", () => {
    expect(decidirApodo(NOMBRE, null)).toEqual({ tipo: "nada" });
  });

  it("no hace nada si el apodo ya es el correcto", () => {
    expect(decidirApodo("OtroBot", NOMBRE)).toEqual({ tipo: "nada" });
  });

  it("quita el apodo que alguien le puso, porque el usuario global ya vale", () => {
    expect(decidirApodo(NOMBRE, "Constructor")).toEqual({ tipo: "quitar" });
  });

  it("pone el apodo cuando el usuario global no se pudo cambiar", () => {
    // Discord solo deja dos cambios de nombre por hora: el apodo es el plan B.
    expect(decidirApodo("MiBotViejo", null)).toEqual({ tipo: "poner", apodo: NOMBRE });
  });

  it("corrige un apodo distinto cuando el usuario global tampoco vale", () => {
    expect(decidirApodo("MiBotViejo", "Pepe")).toEqual({ tipo: "poner", apodo: NOMBRE });
  });
});
