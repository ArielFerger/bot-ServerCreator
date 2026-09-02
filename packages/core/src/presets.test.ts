import { describe, expect, it } from "vitest";
import { CLAVE_EVERYONE } from "./schema";
import { construirPermisos, leerAcceso, preset, describirAcceso, type Acceso } from "./presets";

const overwriteDe = (ovs: ReturnType<typeof construirPermisos>, rol: string) => ovs.find((o) => o.rol === rol);

describe("construirPermisos", () => {
  it("un canal público no genera ningún overwrite", () => {
    expect(construirPermisos({ quienVe: { tipo: "todos" }, quienEscribe: { tipo: "todos" } })).toEqual([]);
  });

  it("solo lectura deniega enviar a @everyone y se lo permite al staff", () => {
    const ovs = preset("solo-lectura", ["mod"]);
    expect(overwriteDe(ovs, CLAVE_EVERYONE)?.denegar).toContain("enviar-mensajes");
    expect(overwriteDe(ovs, CLAVE_EVERYONE)?.denegar).not.toContain("ver-canales");
    expect(overwriteDe(ovs, "mod")?.permitir).toContain("enviar-mensajes");
  });

  it("solo lectura sin staff deja el canal mudo para todos", () => {
    const ovs = preset("solo-lectura", []);
    expect(overwriteDe(ovs, CLAVE_EVERYONE)?.denegar).toContain("enviar-mensajes");
    expect(ovs).toHaveLength(1);
  });

  it("un canal restringido concede ver-canales explícitamente a cada rol", () => {
    // Sin esto el canal quedaría invisible incluso para el staff: un rol no
    // hereda de @everyone aquello que @everyone tiene denegado.
    const ovs = preset("solo-staff", ["admin", "mod"]);
    expect(overwriteDe(ovs, CLAVE_EVERYONE)?.denegar).toContain("ver-canales");
    for (const rol of ["admin", "mod"]) {
      expect(overwriteDe(ovs, rol)?.permitir).toContain("ver-canales");
      expect(overwriteDe(ovs, rol)?.permitir).toContain("enviar-mensajes");
    }
  });

  it("quien escribe siempre puede ver, aunque no esté en la lista de visibilidad", () => {
    const ovs = construirPermisos({
      quienVe: { tipo: "roles", roles: ["miembro"] },
      quienEscribe: { tipo: "roles", roles: ["mod"] },
    });
    expect(overwriteDe(ovs, "mod")?.permitir).toContain("ver-canales");
  });

  it("nunca permite y deniega el mismo permiso al mismo rol", () => {
    const ovs = construirPermisos({
      quienVe: { tipo: "roles", roles: ["mod"] },
      quienEscribe: { tipo: "roles", roles: ["mod"] },
    });
    for (const ov of ovs) {
      expect(ov.permitir.filter((p) => ov.denegar.includes(p))).toEqual([]);
    }
  });

  it("en voz traduce escribir a conectar y hablar", () => {
    const ovs = construirPermisos(
      { quienVe: { tipo: "todos" }, quienEscribe: { tipo: "roles", roles: ["vip"] } },
      "voz",
    );
    expect(overwriteDe(ovs, CLAVE_EVERYONE)?.denegar).toContain("conectar");
    expect(overwriteDe(ovs, "vip")?.permitir).toEqual(expect.arrayContaining(["conectar", "hablar"]));
    expect(overwriteDe(ovs, CLAVE_EVERYONE)?.denegar).not.toContain("enviar-mensajes");
  });
});

describe("leerAcceso", () => {
  const casos: { nombre: string; acceso: Acceso }[] = [
    { nombre: "público", acceso: { quienVe: { tipo: "todos" }, quienEscribe: { tipo: "todos" } } },
    { nombre: "solo lectura", acceso: { quienVe: { tipo: "todos" }, quienEscribe: { tipo: "nadie" } } },
    {
      nombre: "staff",
      acceso: { quienVe: { tipo: "roles", roles: ["mod"] }, quienEscribe: { tipo: "roles", roles: ["mod"] } },
    },
    {
      nombre: "lectura pública con staff que escribe",
      acceso: { quienVe: { tipo: "todos" }, quienEscribe: { tipo: "roles", roles: ["admin"] } },
    },
  ];

  for (const { nombre, acceso } of casos) {
    it(`ida y vuelta: ${nombre}`, () => {
      expect(leerAcceso(construirPermisos(acceso))).toEqual(acceso);
    });
  }
});

describe("describirAcceso", () => {
  it("produce una frase legible", () => {
    const frase = describirAcceso(
      { quienVe: { tipo: "todos" }, quienEscribe: { tipo: "roles", roles: ["admin"] } },
      (c) => (c === "admin" ? "Admin" : c),
    );
    expect(frase).toBe("Visible para todos · escriben Admin");
  });
});
