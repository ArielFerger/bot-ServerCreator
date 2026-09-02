import { describe, expect, it } from "vitest";
import { plantillaSchema, validarPlantilla, todosLosCanales, type EntradaPlantilla } from "./schema";

const base: EntradaPlantilla = {
  version: 1,
  meta: { nombre: "Prueba" },
  roles: [{ clave: "mod", nombre: "Mod" }],
  categorias: [
    {
      clave: "general",
      nombre: "GENERAL",
      canales: [
        { clave: "charla", nombre: "charla" },
        { clave: "sala", nombre: "Sala", tipo: "voz" },
      ],
    },
  ],
};

const conPlantilla = (cambios: Partial<EntradaPlantilla>) => validarPlantilla({ ...base, ...cambios });

/** Comprueba que exista un error cuyo mensaje contenga `fragmento`. */
function esperarError(resultado: ReturnType<typeof validarPlantilla>, fragmento: string) {
  expect(resultado.ok).toBe(false);
  if (resultado.ok) return;
  const mensajes = resultado.errores.map((e) => e.mensaje).join(" | ");
  expect(mensajes, `errores obtenidos: ${mensajes}`).toContain(fragmento);
}

describe("plantilla válida", () => {
  it("acepta la plantilla mínima y rellena los valores por defecto", () => {
    const r = validarPlantilla(base);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plantilla.ajustes.nivelVerificacion).toBe("bajo");
    expect(r.plantilla.ajustes.afkTimeout).toBe(300);
    expect(r.plantilla.roles[0]!.separado).toBe(false);
    expect(r.plantilla.emojis).toEqual([]);
    expect(r.plantilla.categorias[0]!.canales[0]!.tipo).toBe("texto");
  });

  it("recorre canales sueltos y en categoría", () => {
    const r = plantillaSchema.parse({ ...base, canalesSueltos: [{ clave: "reglas", nombre: "reglas" }] });
    const claves = [...todosLosCanales(r)].map(({ canal }) => canal.clave);
    expect(claves).toEqual(["reglas", "charla", "sala"]);
  });

  it("permite declarar @everyone para fijar los permisos base", () => {
    const r = conPlantilla({
      roles: [{ clave: "everyone", nombre: "@everyone", permisos: ["ver-canales"] }],
    });
    expect(r.ok).toBe(true);
  });
});

describe("referencias simbólicas", () => {
  it("rechaza un overwrite que apunta a un rol inexistente", () => {
    esperarError(
      conPlantilla({
        categorias: [
          {
            clave: "general",
            nombre: "GENERAL",
            canales: [{ clave: "charla", nombre: "charla", permisos: [{ rol: "fantasma", denegar: ["ver-canales"] }] }],
          },
        ],
      }),
      'un rol que no existe: "fantasma"',
    );
  });

  it("acepta overwrites sobre @everyone sin declararlo como rol", () => {
    const r = conPlantilla({
      categorias: [
        {
          clave: "general",
          nombre: "GENERAL",
          canales: [{ clave: "charla", nombre: "charla", permisos: [{ rol: "everyone", denegar: ["enviar-mensajes"] }] }],
        },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("rechaza un canal de sistema que no existe", () => {
    esperarError(conPlantilla({ ajustes: { canalSistema: "inexistente" } }), "no existe en la plantilla");
  });

  it("exige que el canal de AFK sea de voz", () => {
    esperarError(conPlantilla({ ajustes: { canalAfk: "charla" } }), "canal de AFK tiene que ser un canal de voz");
  });

  it("acepta un canal de AFK de voz", () => {
    expect(conPlantilla({ ajustes: { canalAfk: "sala" } }).ok).toBe(true);
  });

  it("rechaza un panel con un rol inexistente", () => {
    esperarError(
      conPlantilla({
        canalesSueltos: [
          { clave: "roles", nombre: "roles", panelRoles: { titulo: "Elegí", roles: ["fantasma"] } },
        ],
      }),
      "menciona un rol que no existe",
    );
  });

  it("no deja ofrecer @everyone en un panel de roles", () => {
    esperarError(
      conPlantilla({
        canalesSueltos: [
          { clave: "roles", nombre: "roles", panelRoles: { titulo: "Elegí", roles: ["everyone"] } },
        ],
      }),
      "no puede ofrecer @everyone",
    );
  });
});

describe("claves duplicadas", () => {
  it("detecta dos roles con la misma clave", () => {
    esperarError(
      conPlantilla({ roles: [{ clave: "mod", nombre: "Mod" }, { clave: "mod", nombre: "Otro" }] }),
      "Clave de rol duplicada",
    );
  });

  it("detecta dos canales con la misma clave en categorías distintas", () => {
    esperarError(
      conPlantilla({
        categorias: [
          { clave: "a", nombre: "A", canales: [{ clave: "charla", nombre: "charla" }] },
          { clave: "b", nombre: "B", canales: [{ clave: "charla", nombre: "charla-2" }] },
        ],
      }),
      "Clave de canal duplicada",
    );
  });

  it("detecta una clave usada a la vez como categoría y como canal", () => {
    esperarError(
      conPlantilla({
        categorias: [{ clave: "charla", nombre: "CHARLA", canales: [{ clave: "charla", nombre: "charla" }] }],
      }),
      "como categoría y como canal",
    );
  });
});

describe("reglas de tipo de canal", () => {
  it("no admite mensajes iniciales en un canal de voz", () => {
    esperarError(
      conPlantilla({
        canalesSueltos: [{ clave: "sala2", nombre: "Sala 2", tipo: "voz", mensajes: [{ contenido: "hola" }] }],
      }),
      "canales de texto o de anuncios admiten mensajes",
    );
  });

  it("no admite panel de roles en un foro", () => {
    esperarError(
      conPlantilla({
        canalesSueltos: [
          { clave: "foro", nombre: "foro", tipo: "foro", panelRoles: { titulo: "x", roles: ["mod"] } },
        ],
      }),
      "solo puede ir en un canal de texto",
    );
  });

  it("no admite límite de usuarios en un canal de texto", () => {
    esperarError(
      conPlantilla({ canalesSueltos: [{ clave: "t", nombre: "t", limiteUsuarios: 5 }] }),
      "límite de usuarios solo aplica a canales de voz",
    );
  });
});

describe("validaciones de forma", () => {
  it("rechaza claves con mayúsculas o espacios", () => {
    esperarError(conPlantilla({ roles: [{ clave: "Mod Jefe", nombre: "Mod" }] }), "minúsculas");
  });

  it("rechaza un color que no sea hexadecimal", () => {
    esperarError(conPlantilla({ roles: [{ clave: "mod", nombre: "Mod", color: "rojo" }] }), "hexadecimal");
  });

  it("rechaza un permiso inventado", () => {
    const r = conPlantilla({ roles: [{ clave: "mod", nombre: "Mod", permisos: ["borrar-todo" as never] }] });
    expect(r.ok).toBe(false);
  });

  it("rechaza un mensaje sin contenido ni embed", () => {
    esperarError(
      conPlantilla({ canalesSueltos: [{ clave: "c", nombre: "c", mensajes: [{ fijar: true }] }] }),
      "necesita contenido o un embed",
    );
  });

  it("rechaza permitir y denegar el mismo permiso", () => {
    esperarError(
      conPlantilla({
        canalesSueltos: [
          { clave: "c", nombre: "c", permisos: [{ rol: "mod", permitir: ["ver-canales"], denegar: ["ver-canales"] }] },
        ],
      }),
      "no puede estar permitido y denegado",
    );
  });

  it("rechaza un temporizador de AFK que Discord no acepta", () => {
    esperarError(conPlantilla({ ajustes: { afkTimeout: 120 } }), "temporizador de AFK");
  });

  it("rechaza una versión de plantilla desconocida", () => {
    expect(validarPlantilla({ ...base, version: 2 }).ok).toBe(false);
  });

  it("devuelve la ruta del error para que el editor sepa dónde marcarlo", () => {
    const r = conPlantilla({ roles: [{ clave: "mod", nombre: "" }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]!.ruta).toBe("roles.0.nombre");
  });
});

describe("mensajes en español", () => {
  it("traduce un campo que falta", () => {
    const r = validarPlantilla({ version: 1, meta: {} });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores.find((e) => e.ruta === "meta.nombre")?.mensaje).toBe("Falta este campo");
  });

  it("traduce una versión de plantilla incorrecta", () => {
    const r = validarPlantilla({ ...base, version: 9 });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]!.mensaje).toBe("El valor tiene que ser 1");
  });

  it("traduce un valor de enumeración inválido, listando las opciones", () => {
    const r = conPlantilla({ canalesSueltos: [{ clave: "c", nombre: "c", tipo: "inventado" as never }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]!.mensaje).toContain("no es un valor válido");
    expect(r.errores[0]!.mensaje).toContain("texto");
  });

  it("traduce un texto demasiado largo", () => {
    const r = conPlantilla({ roles: [{ clave: "mod", nombre: "x".repeat(200) }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]!.mensaje).toBe("Máximo 100 caracteres");
  });

  it("traduce un texto vacío", () => {
    const r = conPlantilla({ roles: [{ clave: "mod", nombre: "" }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]!.mensaje).toBe("No puede estar vacío");
  });

  it("traduce una URL mal formada", () => {
    const r = conPlantilla({ emojis: [{ nombre: "pog", url: "no-es-una-url" }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errores[0]!.mensaje).toContain("dirección web válida");
  });

  it("no hay ningún mensaje en inglés en los errores de una plantilla muy rota", () => {
    const r = validarPlantilla({
      version: 3,
      meta: { nombre: "" },
      roles: [{ clave: "MAL", nombre: "x".repeat(300), color: "rojo" }],
      canalesSueltos: [{ clave: "c", nombre: "c", tipo: "raro", permisos: [{ rol: "fantasma" }] }],
      emojis: [{ nombre: "a", url: "nope" }],
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const sospechosos = r.errores.filter((e) =>
      /\b(Required|Invalid|Expected|String|Number|must|should)\b/.test(e.mensaje),
    );
    expect(sospechosos.map((e) => `${e.ruta}: ${e.mensaje}`)).toEqual([]);
  });
});
