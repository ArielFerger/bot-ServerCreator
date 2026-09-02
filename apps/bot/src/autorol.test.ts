import { describe, expect, it } from "vitest";
import { PermissionFlagsBits } from "discord.js";
import { decidir, esRolPeligroso, rolDelBoton, PREFIJO, type ContextoAutorol } from "./autorol";

const base: ContextoAutorol = {
  panelConocido: true,
  rolExiste: true,
  rolEsGestionado: false,
  permisosDelRol: 0n,
  posicionDelRol: 3,
  posicionDelBot: 10,
  botPuedeGestionarRoles: true,
  yaLoTiene: false,
};

const ctx = (cambios: Partial<ContextoAutorol> = {}) => ({ ...base, ...cambios });

describe("rolDelBoton", () => {
  it("extrae el id de un botón nuestro", () => {
    expect(rolDelBoton(`${PREFIJO}123456789012345678`)).toBe("123456789012345678");
  });

  it.each([
    ["otro:123456789012345678", "botón de otra cosa"],
    [`${PREFIJO}`, "sin id"],
    [`${PREFIJO}abc`, "id que no es numérico"],
    [`${PREFIJO}12`, "id demasiado corto"],
    [`${PREFIJO}123456789012345678901234`, "id demasiado largo"],
  ])("ignora «%s» (%s)", (customId) => {
    expect(rolDelBoton(customId)).toBeNull();
  });
});

describe("esRolPeligroso", () => {
  it("detecta administrador", () => {
    expect(esRolPeligroso(PermissionFlagsBits.Administrator)).toBe(true);
  });

  it.each([
    ["gestionar roles", PermissionFlagsBits.ManageRoles],
    ["gestionar servidor", PermissionFlagsBits.ManageGuild],
    ["banear", PermissionFlagsBits.BanMembers],
    ["gestionar mensajes", PermissionFlagsBits.ManageMessages],
    ["mencionar a todos", PermissionFlagsBits.MentionEveryone],
  ])("detecta %s", (_nombre, bandera) => {
    expect(esRolPeligroso(bandera)).toBe(true);
  });

  it("un rol decorativo no es peligroso", () => {
    const inocuo =
      PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages | PermissionFlagsBits.AddReactions;
    expect(esRolPeligroso(inocuo)).toBe(false);
  });

  it("un rol sin permisos tampoco", () => {
    expect(esRolPeligroso(0n)).toBe(false);
  });

  it("lo detecta aunque venga mezclado con permisos inocuos", () => {
    expect(esRolPeligroso(PermissionFlagsBits.ViewChannel | PermissionFlagsBits.BanMembers)).toBe(true);
  });
});

describe("decidir", () => {
  it("da el rol si no lo tiene", () => {
    expect(decidir(ctx())).toEqual({ accion: "dar" });
  });

  it("lo quita si ya lo tiene", () => {
    expect(decidir(ctx({ yaLoTiene: true }))).toEqual({ accion: "quitar" });
  });

  it("rechaza un botón de un panel que ya no está registrado", () => {
    const v = decidir(ctx({ panelConocido: false }));
    expect(v.accion).toBe("rechazar");
    expect(v).toMatchObject({ motivo: expect.stringContaining("ya no está activo") });
  });

  it("rechaza un rol borrado", () => {
    expect(decidir(ctx({ rolExiste: false })).accion).toBe("rechazar");
  });

  it("rechaza si el bot perdió el permiso de gestionar roles", () => {
    const v = decidir(ctx({ botPuedeGestionarRoles: false }));
    expect(v).toMatchObject({ accion: "rechazar", motivo: expect.stringContaining("Gestionar roles") });
  });

  it("rechaza un rol de integración", () => {
    expect(decidir(ctx({ rolEsGestionado: true })).accion).toBe("rechazar");
  });

  it("rechaza un rol por encima del bot y explica cómo arreglarlo", () => {
    const v = decidir(ctx({ posicionDelRol: 10, posicionDelBot: 10 }));
    expect(v).toMatchObject({ accion: "rechazar", motivo: expect.stringContaining("jerarquía") });
  });

  describe("nunca reparte un rol con permisos de moderación", () => {
    it.each([
      ["administrador", PermissionFlagsBits.Administrator],
      ["gestionar roles", PermissionFlagsBits.ManageRoles],
      ["expulsar", PermissionFlagsBits.KickMembers],
      ["aislar", PermissionFlagsBits.ModerateMembers],
    ])("con %s", (_n, bandera) => {
      const v = decidir(ctx({ permisosDelRol: bandera }));
      expect(v).toMatchObject({ accion: "rechazar", motivo: expect.stringContaining("moderación") });
    });

    it("tampoco lo QUITA sin más: también se rechaza", () => {
      // Quitar sería inofensivo, pero rechazar en bloque mantiene la regla simple
      // y evita que el panel parezca funcionar a medias.
      const v = decidir(ctx({ permisosDelRol: PermissionFlagsBits.Administrator, yaLoTiene: true }));
      expect(v.accion).toBe("rechazar");
    });
  });

  it("el orden de las comprobaciones no filtra un rol peligroso por otra vía", () => {
    // Aunque todo lo demás esté bien, el permiso peligroso manda.
    const v = decidir(ctx({ permisosDelRol: PermissionFlagsBits.ManageGuild, posicionDelRol: 1, yaLoTiene: false }));
    expect(v.accion).toBe("rechazar");
  });

  it("todos los rechazos traen un motivo legible en español", () => {
    const casos: Partial<ContextoAutorol>[] = [
      { panelConocido: false },
      { rolExiste: false },
      { botPuedeGestionarRoles: false },
      { rolEsGestionado: true },
      { posicionDelRol: 99 },
      { permisosDelRol: PermissionFlagsBits.Administrator },
    ];
    for (const caso of casos) {
      const v = decidir(ctx(caso));
      expect(v.accion).toBe("rechazar");
      if (v.accion !== "rechazar") continue;
      expect(v.motivo.length).toBeGreaterThan(20);
      expect(v.motivo).not.toMatch(/\b(error|failed|undefined|null)\b/i);
    }
  });
});
