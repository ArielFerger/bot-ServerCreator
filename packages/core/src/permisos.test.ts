import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord-api-types/v10";
import { NOMBRES_PERMISO, PERMISOS, aBitfield, aNombres, esNombrePermiso, ETIQUETAS_PERMISO } from "./permisos";

describe("mapa de permisos", () => {
  it("cada nombre apunta a una bandera real de Discord", () => {
    const banderasValidas = new Set(Object.values(PermissionFlagsBits));
    for (const nombre of NOMBRES_PERMISO) {
      expect(banderasValidas.has(PERMISOS[nombre]), `${nombre} no es una bandera válida`).toBe(true);
    }
  });

  it("no repite banderas con dos nombres distintos", () => {
    const vistas = new Map<bigint, string>();
    for (const nombre of NOMBRES_PERMISO) {
      const previo = vistas.get(PERMISOS[nombre]);
      expect(previo, `"${nombre}" y "${previo}" apuntan a la misma bandera`).toBeUndefined();
      vistas.set(PERMISOS[nombre], nombre);
    }
  });

  it("tiene una etiqueta en español por cada permiso", () => {
    for (const nombre of NOMBRES_PERMISO) {
      expect(ETIQUETAS_PERMISO[nombre]).toBeTruthy();
    }
  });

  it("convierte a bitfield y vuelve sin perder nada", () => {
    const original = ["ver-canales", "enviar-mensajes", "gestionar-mensajes"] as const;
    const bits = aBitfield(original);
    expect(bits).toBe(
      PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.ManageMessages,
    );
    expect(aNombres(bits).sort()).toEqual([...original].sort());
  });

  it("una lista vacía es el bitfield cero", () => {
    expect(aBitfield([])).toBe(0n);
    expect(aNombres(0n)).toEqual([]);
  });

  it("reconoce nombres inválidos", () => {
    expect(esNombrePermiso("ver-canales")).toBe(true);
    expect(esNombrePermiso("VIEW_CHANNEL")).toBe(false);
    expect(esNombrePermiso("toString")).toBe(false);
  });
});
