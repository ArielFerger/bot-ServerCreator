import { describe, expect, it } from "vitest";
import { puedeUsarDemo } from "./demo";

describe("puerta de demostración", () => {
  it("se abre en desarrollo desde localhost", () => {
    expect(puedeUsarDemo("development", "localhost:3000")).toEqual({ permitido: true });
  });

  it.each([
    ["127.0.0.1:3000", "IP local"],
    ["localhost", "sin puerto"],
    ["LOCALHOST:3000", "en mayúsculas"],
    ["[::1]:3000", "IPv6"],
  ])("acepta «%s» (%s)", (host) => {
    expect(puedeUsarDemo("development", host).permitido).toBe(true);
  });

  describe("nunca se abre", () => {
    it("en producción, aunque sea desde localhost", () => {
      const v = puedeUsarDemo("production", "localhost:3000");
      expect(v.permitido).toBe(false);
      expect(v).toMatchObject({ motivo: expect.stringContaining("producción") });
    });

    it.each([
      ["forja.ejemplo.com", "un dominio real"],
      ["192.168.1.50:3000", "otra máquina de la red"],
      ["abc123.ngrok.io", "un túnel"],
      ["localhost.atacante.com", "un dominio que empieza por localhost"],
      ["notlocalhost", "un nombre parecido"],
    ])("desde «%s» (%s)", (host) => {
      expect(puedeUsarDemo("development", host).permitido).toBe(false);
    });

    it("sin cabecera host", () => {
      expect(puedeUsarDemo("development", null).permitido).toBe(false);
    });

    it("con el host vacío", () => {
      expect(puedeUsarDemo("development", "").permitido).toBe(false);
    });
  });

  it("los motivos van en español y explican qué pasa", () => {
    for (const v of [puedeUsarDemo("production", "localhost"), puedeUsarDemo("development", "ejemplo.com")]) {
      expect(v.permitido).toBe(false);
      if (v.permitido) continue;
      expect(v.motivo.length).toBeGreaterThan(20);
    }
  });
});
