import { z } from "zod";
import { LIMITES } from "./limites";
import { NOMBRES_PERMISO } from "./permisos";
import { instalarMensajesEnEspanol } from "./errores";

// Los errores de validación acaban a la vista del usuario (en el editor, al
// subir un JSON, al aplicar), así que se traducen aquí y no en cada sitio que
// los muestra. Va en este módulo porque es el que importa todo el mundo,
// directa o transitivamente.
instalarMensajesEnEspanol();

/**
 * Esquema de plantilla, versión 1.
 *
 * Regla de oro: una plantilla NO contiene IDs de Discord, solo `clave`s
 * simbólicas. Eso es lo que la hace portable entre servidores. El motor de
 * aplicación construye un Map<clave, id> a medida que crea las cosas y resuelve
 * las referencias sobre la marcha.
 */

export const claveSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9-]{0,63}$/, "La clave solo admite minúsculas, números y guiones");

/** `everyone` está reservada: se resuelve al rol @everyone del servidor, nunca se crea. */
export const CLAVE_EVERYONE = "everyone";

const permisoSchema = z.enum(NOMBRES_PERMISO);

export const overwriteSchema = z
  .object({
    rol: claveSchema,
    permitir: z.array(permisoSchema).default([]),
    denegar: z.array(permisoSchema).default([]),
  })
  .refine(
    (o) => !o.permitir.some((p) => o.denegar.includes(p)),
    "Un permiso no puede estar permitido y denegado a la vez",
  );

export const rolSchema = z.object({
  clave: claveSchema,
  nombre: z.string().min(1).max(LIMITES.nombreRol),
  /** Hex sin alfa. Ausente = rol sin color (gris por defecto de Discord). */
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "El color debe ser hexadecimal, por ejemplo #e74c3c")
    .optional(),
  /** "Mostrar miembros por separado" en la interfaz de Discord. */
  separado: z.boolean().default(false),
  mencionable: z.boolean().default(false),
  permisos: z.array(permisoSchema).default([]),
});

export const embedSchema = z.object({
  titulo: z.string().max(LIMITES.tituloEmbed).optional(),
  descripcion: z.string().max(LIMITES.descripcionEmbed).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  campos: z
    .array(
      z.object({
        nombre: z.string().min(1).max(256),
        valor: z.string().min(1).max(1024),
        enLinea: z.boolean().default(false),
      }),
    )
    .max(LIMITES.camposEmbed)
    .default([]),
  pie: z.string().max(2048).optional(),
});

export const mensajeSchema = z
  .object({
    contenido: z.string().max(LIMITES.contenidoMensaje).optional(),
    embed: embedSchema.optional(),
    fijar: z.boolean().default(false),
  })
  .refine(
    (m) => Boolean(m.contenido?.trim()) || m.embed !== undefined,
    "Un mensaje necesita contenido o un embed",
  );

/** Panel de auto-roles: se publica como botones y lo atiende el bot de gateway. */
export const panelRolesSchema = z.object({
  titulo: z.string().min(1).max(LIMITES.tituloEmbed),
  descripcion: z.string().max(LIMITES.descripcionEmbed).optional(),
  roles: z.array(claveSchema).min(1).max(LIMITES.rolesPorPanel),
});

export const TIPOS_CANAL = ["texto", "voz", "anuncios", "foro", "escenario"] as const;
export type TipoCanal = (typeof TIPOS_CANAL)[number];

/** Tipos que Discord solo permite si el servidor tiene la Comunidad activada. */
export const TIPOS_SOLO_COMUNIDAD: readonly TipoCanal[] = ["anuncios", "foro", "escenario"];

export const canalSchema = z.object({
  clave: claveSchema,
  nombre: z.string().min(1).max(LIMITES.nombreCanal),
  tipo: z.enum(TIPOS_CANAL).default("texto"),
  tema: z.string().max(LIMITES.temaCanal).optional(),
  nsfw: z.boolean().default(false),
  /** Modo lento en segundos (solo canales de texto). */
  modoLento: z.number().int().min(0).max(21600).default(0),
  /** Solo canales de voz. */
  limiteUsuarios: z.number().int().min(0).max(99).optional(),
  permisos: z.array(overwriteSchema).default([]),
  mensajes: z.array(mensajeSchema).default([]),
  panelRoles: panelRolesSchema.optional(),
});

export const categoriaSchema = z.object({
  clave: claveSchema,
  nombre: z.string().min(1).max(LIMITES.nombreCategoria),
  permisos: z.array(overwriteSchema).default([]),
  canales: z.array(canalSchema).max(LIMITES.canalesPorCategoria).default([]),
});

export const ajustesSchema = z.object({
  nivelVerificacion: z.enum(["ninguno", "bajo", "medio", "alto", "muy-alto"]).default("bajo"),
  filtroContenido: z.enum(["desactivado", "sin-rol", "todos"]).default("todos"),
  notificacionesPorDefecto: z.enum(["todos-los-mensajes", "solo-menciones"]).default("solo-menciones"),
  /** Claves de canal, no IDs. */
  canalSistema: claveSchema.optional(),
  canalAfk: claveSchema.optional(),
  afkTimeout: z
    .number()
    .refine(
      (n) => (LIMITES.afkTimeouts as readonly number[]).includes(n),
      `El temporizador de AFK debe ser uno de: ${LIMITES.afkTimeouts.join(", ")} segundos`,
    )
    .default(300),
});

export const emojiSchema = z.object({
  nombre: z.string().regex(/^[a-zA-Z0-9_]{2,32}$/, "El nombre del emoji solo admite letras, números y guion bajo"),
  url: z.string().url(),
});

export const metaSchema = z.object({
  nombre: z.string().min(1).max(100),
  descripcion: z.string().max(500).default(""),
  emoji: z.string().max(8).optional(),
  etiquetas: z.array(z.string().max(30)).max(10).default([]),
});

const plantillaBase = z.object({
  version: z.literal(1),
  meta: metaSchema,
  ajustes: ajustesSchema.default({}),
  roles: z.array(rolSchema).max(LIMITES.rolesPorServidor).default([]),
  categorias: z.array(categoriaSchema).max(LIMITES.categoriasPorServidor).default([]),
  /** Canales fuera de toda categoría, arriba del todo en Discord. */
  canalesSueltos: z.array(canalSchema).default([]),
  emojis: z.array(emojiSchema).default([]),
});

/**
 * Validación cruzada: nada de lo anterior sirve si una referencia simbólica
 * apunta a algo que no existe. Estos errores son los que en la práctica
 * romperían la aplicación a mitad de camino.
 */
export const plantillaSchema = plantillaBase.superRefine((p, ctx) => {
  const error = (message: string, path: (string | number)[]) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path });

  // --- Roles: claves únicas, `everyone` no se declara como rol creable ---
  const clavesRol = new Set<string>([CLAVE_EVERYONE]);
  p.roles.forEach((rol, i) => {
    if (rol.clave === CLAVE_EVERYONE) {
      // Permitido: sirve para fijar los permisos base del servidor.
      return;
    }
    if (clavesRol.has(rol.clave)) error(`Clave de rol duplicada: "${rol.clave}"`, ["roles", i, "clave"]);
    clavesRol.add(rol.clave);
  });

  // --- Canales y categorías comparten espacio de nombres ---
  const clavesCanal = new Set<string>();
  const canalesPorClave = new Map<string, TipoCanal>();
  const clavesCategoria = new Set<string>();

  const revisarCanal = (canal: z.infer<typeof canalSchema>, path: (string | number)[]) => {
    if (clavesCanal.has(canal.clave)) error(`Clave de canal duplicada: "${canal.clave}"`, [...path, "clave"]);
    clavesCanal.add(canal.clave);
    canalesPorClave.set(canal.clave, canal.tipo);

    canal.permisos.forEach((ov, j) => {
      if (!clavesRol.has(ov.rol)) {
        error(`El canal "${canal.clave}" da permisos a un rol que no existe: "${ov.rol}"`, [...path, "permisos", j, "rol"]);
      }
    });

    canal.panelRoles?.roles.forEach((clave, j) => {
      if (!clavesRol.has(clave)) {
        error(`El panel de roles de "${canal.clave}" menciona un rol que no existe: "${clave}"`, [...path, "panelRoles", "roles", j]);
      }
      if (clave === CLAVE_EVERYONE) {
        error("El panel de roles no puede ofrecer @everyone", [...path, "panelRoles", "roles", j]);
      }
    });

    if (canal.panelRoles && canal.tipo !== "texto") {
      error("Un panel de roles solo puede ir en un canal de texto", [...path, "panelRoles"]);
    }
    if (canal.mensajes.length > 0 && canal.tipo !== "texto" && canal.tipo !== "anuncios") {
      error("Solo los canales de texto o de anuncios admiten mensajes iniciales", [...path, "mensajes"]);
    }
    if (canal.limiteUsuarios !== undefined && canal.tipo !== "voz" && canal.tipo !== "escenario") {
      error("El límite de usuarios solo aplica a canales de voz", [...path, "limiteUsuarios"]);
    }
  };

  p.categorias.forEach((cat, i) => {
    if (clavesCategoria.has(cat.clave)) error(`Clave de categoría duplicada: "${cat.clave}"`, ["categorias", i, "clave"]);
    clavesCategoria.add(cat.clave);
    cat.permisos.forEach((ov, j) => {
      if (!clavesRol.has(ov.rol)) {
        error(`La categoría "${cat.clave}" da permisos a un rol que no existe: "${ov.rol}"`, ["categorias", i, "permisos", j, "rol"]);
      }
    });
    cat.canales.forEach((canal, j) => revisarCanal(canal, ["categorias", i, "canales", j]));
  });

  p.canalesSueltos.forEach((canal, i) => revisarCanal(canal, ["canalesSueltos", i]));

  // Categorías y canales no pueden compartir clave: ambos se resuelven en el mismo Map.
  for (const clave of clavesCategoria) {
    if (clavesCanal.has(clave)) error(`"${clave}" se usa a la vez como categoría y como canal`, ["categorias"]);
  }

  // --- Tope global de canales ---
  const totalCanales = p.canalesSueltos.length + p.categorias.reduce((n, c) => n + c.canales.length, 0);
  if (totalCanales + p.categorias.length > LIMITES.canalesPorServidor) {
    error(
      `La plantilla supera el tope de ${LIMITES.canalesPorServidor} canales por servidor (las categorías cuentan)`,
      ["categorias"],
    );
  }

  // --- Ajustes que apuntan a canales ---
  if (p.ajustes.canalSistema !== undefined) {
    const tipo = canalesPorClave.get(p.ajustes.canalSistema);
    if (tipo === undefined) {
      error(`El canal de sistema "${p.ajustes.canalSistema}" no existe en la plantilla`, ["ajustes", "canalSistema"]);
    } else if (tipo !== "texto") {
      error("El canal de sistema tiene que ser un canal de texto", ["ajustes", "canalSistema"]);
    }
  }
  if (p.ajustes.canalAfk !== undefined) {
    const tipo = canalesPorClave.get(p.ajustes.canalAfk);
    if (tipo === undefined) {
      error(`El canal de AFK "${p.ajustes.canalAfk}" no existe en la plantilla`, ["ajustes", "canalAfk"]);
    } else if (tipo !== "voz") {
      error("El canal de AFK tiene que ser un canal de voz", ["ajustes", "canalAfk"]);
    }
  }

  // --- Emojis con nombre repetido ---
  const nombresEmoji = new Set<string>();
  p.emojis.forEach((e, i) => {
    if (nombresEmoji.has(e.nombre)) error(`Emoji duplicado: "${e.nombre}"`, ["emojis", i, "nombre"]);
    nombresEmoji.add(e.nombre);
  });
});

export type Plantilla = z.infer<typeof plantillaSchema>;
export type EntradaPlantilla = z.input<typeof plantillaSchema>;
export type Rol = z.infer<typeof rolSchema>;
export type Canal = z.infer<typeof canalSchema>;
export type Categoria = z.infer<typeof categoriaSchema>;
export type Overwrite = z.infer<typeof overwriteSchema>;
export type Ajustes = z.infer<typeof ajustesSchema>;
export type Mensaje = z.infer<typeof mensajeSchema>;
export type PanelRoles = z.infer<typeof panelRolesSchema>;

/** Devuelve los errores en español, agrupados por ruta, listos para la interfaz. */
export function validarPlantilla(datos: unknown):
  | { ok: true; plantilla: Plantilla }
  | { ok: false; errores: { ruta: string; mensaje: string }[] } {
  const resultado = plantillaSchema.safeParse(datos);
  if (resultado.success) return { ok: true, plantilla: resultado.data };
  return {
    ok: false,
    errores: resultado.error.issues.map((i) => ({
      ruta: i.path.join("."),
      mensaje: i.message,
    })),
  };
}

/** Recorre todos los canales de la plantilla, estén sueltos o en categoría. */
export function* todosLosCanales(p: Plantilla): Generator<{ canal: Canal; categoria: Categoria | null }> {
  for (const canal of p.canalesSueltos) yield { canal, categoria: null };
  for (const categoria of p.categorias) {
    for (const canal of categoria.canales) yield { canal, categoria };
  }
}
