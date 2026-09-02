import { CLAVE_EVERYONE, type Overwrite, type TipoCanal } from "./schema";
import type { NombrePermiso } from "./permisos";

/**
 * La capa "sin bitfields".
 *
 * En el editor un canal no muestra 40 casillas, muestra dos preguntas:
 *   ¿quién puede VER este canal?  ¿quién puede ESCRIBIR en él?
 * Este módulo traduce esas dos respuestas a los `permissionOverwrites` que
 * espera Discord. El modo avanzado del editor escribe overwrites a mano y se
 * salta todo esto.
 */

export type Visibilidad = { tipo: "todos" } | { tipo: "roles"; roles: string[] };

export type Escritura =
  | { tipo: "todos" }
  | { tipo: "roles"; roles: string[] }
  | { tipo: "nadie" };

export interface Acceso {
  quienVe: Visibilidad;
  quienEscribe: Escritura;
}

/** En voz, "escribir" significa conectarse y hablar. */
const PERMISOS_VER: Record<"texto" | "voz", NombrePermiso[]> = {
  texto: ["ver-canales", "leer-historial"],
  voz: ["ver-canales"],
};

const PERMISOS_ESCRIBIR: Record<"texto" | "voz", NombrePermiso[]> = {
  texto: ["enviar-mensajes", "enviar-mensajes-en-hilos", "adjuntar-archivos", "insertar-enlaces"],
  voz: ["conectar", "hablar", "usar-actividad-voz"],
};

function familia(tipo: TipoCanal): "texto" | "voz" {
  return tipo === "voz" || tipo === "escenario" ? "voz" : "texto";
}

/** Acumulador que junta varios ajustes sobre el mismo rol en un único overwrite. */
class Constructor {
  private readonly porRol = new Map<string, { permitir: Set<NombrePermiso>; denegar: Set<NombrePermiso> }>();

  private entrada(rol: string) {
    let e = this.porRol.get(rol);
    if (!e) {
      e = { permitir: new Set(), denegar: new Set() };
      this.porRol.set(rol, e);
    }
    return e;
  }

  permitir(rol: string, permisos: readonly NombrePermiso[]) {
    const e = this.entrada(rol);
    for (const p of permisos) {
      e.denegar.delete(p);
      e.permitir.add(p);
    }
    return this;
  }

  denegar(rol: string, permisos: readonly NombrePermiso[]) {
    const e = this.entrada(rol);
    for (const p of permisos) {
      e.permitir.delete(p);
      e.denegar.add(p);
    }
    return this;
  }

  construir(): Overwrite[] {
    return [...this.porRol.entries()]
      .filter(([, e]) => e.permitir.size > 0 || e.denegar.size > 0)
      .map(([rol, e]) => ({
        rol,
        permitir: [...e.permitir],
        denegar: [...e.denegar],
      }));
  }
}

/**
 * Traduce las dos preguntas del editor a overwrites de Discord.
 *
 * Detalle importante: cuando la visibilidad se restringe a ciertos roles hay que
 * denegar `ver-canales` a @everyone *y* concedérselo explícitamente a cada rol,
 * porque un rol no hereda de @everyone lo que @everyone tiene denegado.
 */
export function construirPermisos(acceso: Acceso, tipo: TipoCanal = "texto"): Overwrite[] {
  const c = new Constructor();
  const f = familia(tipo);
  const ver = PERMISOS_VER[f];
  const escribir = PERMISOS_ESCRIBIR[f];

  if (acceso.quienVe.tipo === "roles") {
    c.denegar(CLAVE_EVERYONE, ver);
    for (const rol of acceso.quienVe.roles) c.permitir(rol, ver);
  }

  switch (acceso.quienEscribe.tipo) {
    case "nadie":
      c.denegar(CLAVE_EVERYONE, escribir);
      break;
    case "roles":
      c.denegar(CLAVE_EVERYONE, escribir);
      for (const rol of acceso.quienEscribe.roles) {
        // Quien escribe tiene que poder ver, aunque no se lo hayan dado arriba.
        if (acceso.quienVe.tipo === "roles") c.permitir(rol, ver);
        c.permitir(rol, escribir);
      }
      break;
    case "todos":
      break;
  }

  return c.construir();
}

export const PRESETS = {
  publico: {
    etiqueta: "Público",
    descripcion: "Todos pueden ver y escribir.",
    acceso: (): Acceso => ({ quienVe: { tipo: "todos" }, quienEscribe: { tipo: "todos" } }),
  },
  "solo-lectura": {
    etiqueta: "Solo lectura",
    descripcion: "Todos lo ven, solo el staff escribe. Para reglas y anuncios.",
    acceso: (staff: string[]): Acceso => ({
      quienVe: { tipo: "todos" },
      quienEscribe: staff.length > 0 ? { tipo: "roles", roles: staff } : { tipo: "nadie" },
    }),
  },
  "solo-staff": {
    etiqueta: "Solo staff",
    descripcion: "Invisible para el resto del servidor.",
    acceso: (staff: string[]): Acceso => ({
      quienVe: { tipo: "roles", roles: staff },
      quienEscribe: { tipo: "roles", roles: staff },
    }),
  },
  privado: {
    etiqueta: "Privado",
    descripcion: "Solo lo ven los roles que elijas.",
    acceso: (roles: string[]): Acceso => ({
      quienVe: { tipo: "roles", roles },
      quienEscribe: { tipo: "roles", roles },
    }),
  },
} as const;

export type NombrePreset = keyof typeof PRESETS;

/** Atajo: `preset("solo-lectura", ["mod"])` -> overwrites listos. */
export function preset(nombre: NombrePreset, roles: string[] = [], tipo: TipoCanal = "texto"): Overwrite[] {
  const def = PRESETS[nombre];
  const acceso = (def.acceso as (r: string[]) => Acceso)(roles);
  return construirPermisos(acceso, tipo);
}

/**
 * Lectura inversa: dados unos overwrites, ¿qué dirían las dos preguntas?
 * Lo usa el editor al abrir una plantilla importada o generada por IA, para no
 * tener que mandar al usuario directo al modo avanzado.
 */
export function leerAcceso(overwrites: readonly Overwrite[], tipo: TipoCanal = "texto"): Acceso {
  const f = familia(tipo);
  const verBase = PERMISOS_VER[f][0]!;
  const escribirBase = PERMISOS_ESCRIBIR[f][0]!;
  const everyone = overwrites.find((o) => o.rol === CLAVE_EVERYONE);

  const quienVe: Visibilidad = everyone?.denegar.includes(verBase)
    ? { tipo: "roles", roles: overwrites.filter((o) => o.rol !== CLAVE_EVERYONE && o.permitir.includes(verBase)).map((o) => o.rol) }
    : { tipo: "todos" };

  let quienEscribe: Escritura = { tipo: "todos" };
  if (everyone?.denegar.includes(escribirBase)) {
    const roles = overwrites
      .filter((o) => o.rol !== CLAVE_EVERYONE && o.permitir.includes(escribirBase))
      .map((o) => o.rol);
    quienEscribe = roles.length > 0 ? { tipo: "roles", roles } : { tipo: "nadie" };
  }

  return { quienVe, quienEscribe };
}

/** Frase para la vista previa: "Visible para todos · Escriben: Admin, Mod". */
export function describirAcceso(acceso: Acceso, nombrePorClave: (clave: string) => string): string {
  const ve =
    acceso.quienVe.tipo === "todos"
      ? "Visible para todos"
      : `Visible para ${acceso.quienVe.roles.map(nombrePorClave).join(", ") || "nadie"}`;
  const escribe =
    acceso.quienEscribe.tipo === "todos"
      ? "todos pueden escribir"
      : acceso.quienEscribe.tipo === "nadie"
        ? "nadie puede escribir"
        : `escriben ${acceso.quienEscribe.roles.map(nombrePorClave).join(", ")}`;
  return `${ve} · ${escribe}`;
}
