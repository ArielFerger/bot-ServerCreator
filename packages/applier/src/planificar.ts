import { ChannelType } from "discord-api-types/v10";
import {
  CLAVE_EVERYONE,
  LIMITES,
  TIPOS_SOLO_COMUNIDAD,
  normalizarNombreCanal,
  todosLosCanales,
  type Canal,
  type Plantilla,
  type TipoCanal,
} from "@aribuilder/core";
import type { Accion, Diagnostico, EstadoServidor, Modo, Omision, Plan } from "./tipos";

/** Traducción de nuestros tipos de canal a los números de la API de Discord. */
export const TIPO_DISCORD: Record<TipoCanal, ChannelType> = {
  texto: ChannelType.GuildText,
  voz: ChannelType.GuildVoice,
  anuncios: ChannelType.GuildAnnouncement,
  foro: ChannelType.GuildForum,
  escenario: ChannelType.GuildStageVoice,
};

/** Cuántos emojis caben según el nivel de boost del servidor. */
const EMOJIS_POR_NIVEL = [50, 100, 150, 250];

function emojisPermitidos(nivelBoost: number): number {
  return EMOJIS_POR_NIVEL[Math.min(Math.max(nivelBoost, 0), 3)] ?? LIMITES.emojisNivel0;
}

/** Comparación de nombres tolerante: Discord no distingue mayúsculas aquí. */
function mismoNombre(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Convierte una plantilla y el estado actual del servidor en una lista ordenada
 * de acciones. Función pura: no toca la red, así que se puede testear entera y
 * sirve tal cual para la vista previa ("esto es lo que va a pasar").
 */
export function planificar(plantilla: Plantilla, estado: EstadoServidor, modo: Modo = "fusionar"): Plan {
  const acciones: Accion[] = [];
  const omisiones: Omision[] = [];
  const diagnosticos: Diagnostico[] = [];

  const esComunidad = estado.funciones.includes("COMMUNITY");

  comprobarPermisosDelBot(plantilla, estado, diagnosticos);

  // ── 0. Limpieza previa ──────────────────────────────────────────────────
  if (modo === "limpiar") {
    for (const canal of estado.canales) {
      acciones.push({ tipo: "borrar-canal", id: canal.id, nombre: canal.nombre });
    }
    for (const rol of estado.roles) {
      // El rol @everyone comparte ID con el servidor y los roles de bots son intocables.
      if (rol.id === estado.id || rol.gestionado) continue;
      if (rol.posicion >= estado.bot.posicionRolMasAlto) {
        omisiones.push({
          que: `Rol "${rol.nombre}"`,
          motivo: "está por encima del rol del bot en la jerarquía, el bot no puede borrarlo",
        });
        continue;
      }
      acciones.push({ tipo: "borrar-rol", id: rol.id, nombre: rol.nombre });
    }
  }

  /** En modo limpiar el servidor queda vacío, así que nada "ya existe". */
  const empiezaVacio = modo === "limpiar";
  const rolesExistentes = empiezaVacio ? [] : estado.roles;
  const canalesExistentes = empiezaVacio ? [] : estado.canales;
  const emojisExistentes = empiezaVacio ? [] : estado.emojis;

  // ── 1. Roles ────────────────────────────────────────────────────────────
  for (const rol of plantilla.roles) {
    if (rol.clave === CLAVE_EVERYONE) {
      // @everyone siempre existe; solo se pueden ajustar sus permisos base.
      acciones.push({ tipo: "actualizar-rol", clave: CLAVE_EVERYONE, id: estado.id, rol });
      continue;
    }

    const existente = rolesExistentes.find((r) => mismoNombre(r.nombre, rol.nombre));
    if (!existente) {
      acciones.push({ tipo: "crear-rol", clave: rol.clave, rol });
      continue;
    }

    if (existente.posicion >= estado.bot.posicionRolMasAlto) {
      // Se puede referenciar en overwrites aunque el bot no pueda editarlo.
      acciones.push({ tipo: "vincular-rol", clave: rol.clave, id: existente.id });
      omisiones.push({
        que: `Rol "${rol.nombre}"`,
        motivo: "ya existe y está por encima del rol del bot; se reutiliza sin modificarlo",
      });
      continue;
    }

    if (modo === "reemplazar") {
      acciones.push({ tipo: "actualizar-rol", clave: rol.clave, id: existente.id, rol });
    } else {
      acciones.push({ tipo: "vincular-rol", clave: rol.clave, id: existente.id });
      omisiones.push({ que: `Rol "${rol.nombre}"`, motivo: "ya existía, se reutiliza tal cual" });
    }
  }

  // ── 2. Categorías ───────────────────────────────────────────────────────
  let posicion = 0;
  const categoriasVinculadas = new Map<string, string>();

  for (const cat of plantilla.categorias) {
    const existente = canalesExistentes.find(
      (c) => c.tipo === ChannelType.GuildCategory && mismoNombre(c.nombre, cat.nombre),
    );
    if (existente) {
      acciones.push({ tipo: "vincular-categoria", clave: cat.clave, id: existente.id });
      categoriasVinculadas.set(cat.clave, existente.id);
      omisiones.push({ que: `Categoría "${cat.nombre}"`, motivo: "ya existía, se reutiliza" });
    } else {
      acciones.push({
        tipo: "crear-categoria",
        clave: cat.clave,
        nombre: cat.nombre,
        permisos: cat.permisos,
        posicion: posicion++,
      });
    }
  }

  // ── 3. Canales ──────────────────────────────────────────────────────────
  const planificarCanal = (canal: Canal, categoriaClave: string | null, pos: number) => {
    if (TIPOS_SOLO_COMUNIDAD.includes(canal.tipo) && !esComunidad) {
      omisiones.push({
        que: `Canal "${canal.nombre}"`,
        motivo: `los canales de tipo "${canal.tipo}" necesitan que el servidor tenga la Comunidad activada`,
      });
      return;
    }

    // Si la categoría se va a crear de cero, dentro no puede haber nada: un canal
    // con ese nombre en OTRA categoría es un canal distinto, no el nuestro.
    const categoriaVinculada = categoriaClave !== null ? categoriasVinculadas.get(categoriaClave) : null;
    const categoriaEsNueva = categoriaClave !== null && categoriaVinculada === undefined;
    const padreId = categoriaVinculada ?? null;

    const existente = categoriaEsNueva
      ? undefined
      : canalesExistentes.find(
          (c) =>
            c.tipo !== ChannelType.GuildCategory &&
            mismoNombre(c.nombre, canal.nombre) &&
            c.padreId === padreId,
        );

    if (existente && modo !== "reemplazar") {
      acciones.push({ tipo: "vincular-canal", clave: canal.clave, id: existente.id });
      omisiones.push({ que: `Canal "${canal.nombre}"`, motivo: "ya existía, se reutiliza" });
      return;
    }

    acciones.push({ tipo: "crear-canal", clave: canal.clave, canal, categoriaClave, posicion: pos });
  };

  plantilla.canalesSueltos.forEach((canal, i) => planificarCanal(canal, null, i));
  for (const cat of plantilla.categorias) {
    cat.canales.forEach((canal, i) => planificarCanal(canal, cat.clave, i));
  }

  comprobarTopeDeCanales(plantilla, estado, modo, diagnosticos);
  avisarSiDiscordVaARenombrar(plantilla, omisiones);

  // ── 4. Ajustes del servidor ─────────────────────────────────────────────
  // Van después de los canales porque referencian el canal de sistema y el de AFK.
  if (estado.bot.puedeGestionarServidor) {
    acciones.push({ tipo: "aplicar-ajustes", ajustes: plantilla.ajustes });
  } else {
    omisiones.push({
      que: "Ajustes del servidor",
      motivo: 'el bot no tiene el permiso "Gestionar servidor"',
    });
  }

  // ── 5. Contenido ────────────────────────────────────────────────────────
  const clavesCanalCreadas = new Set(
    acciones.filter((a) => a.tipo === "crear-canal" || a.tipo === "vincular-canal").map((a) => a.clave),
  );

  for (const { canal } of todosLosCanales(plantilla)) {
    if (!clavesCanalCreadas.has(canal.clave)) continue; // se omitió el canal, su contenido también

    canal.mensajes.forEach((mensaje, i) => {
      acciones.push({ tipo: "publicar-mensaje", canalClave: canal.clave, mensaje, indice: i });
    });
    if (canal.panelRoles) {
      // El botón enseña el nombre del rol, no su clave interna.
      const nombresDeRol = Object.fromEntries(
        canal.panelRoles.roles.map((clave) => [clave, plantilla.roles.find((r) => r.clave === clave)?.nombre ?? clave]),
      );
      acciones.push({ tipo: "publicar-panel", canalClave: canal.clave, panel: canal.panelRoles, nombresDeRol });
    }
  }

  // ── 6. Emojis ───────────────────────────────────────────────────────────
  const tope = emojisPermitidos(estado.nivelBoost);
  let hueco = tope - emojisExistentes.length;
  for (const emoji of plantilla.emojis) {
    if (!estado.bot.puedeGestionarExpresiones) {
      omisiones.push({ que: `Emoji "${emoji.nombre}"`, motivo: 'el bot no tiene el permiso "Gestionar emojis"' });
      continue;
    }
    if (emojisExistentes.some((e) => e.nombre === emoji.nombre)) {
      omisiones.push({ que: `Emoji "${emoji.nombre}"`, motivo: "ya existe en el servidor" });
      continue;
    }
    if (hueco <= 0) {
      omisiones.push({
        que: `Emoji "${emoji.nombre}"`,
        motivo: `el servidor solo admite ${tope} emojis con su nivel de boost actual`,
      });
      continue;
    }
    acciones.push({ tipo: "crear-emoji", nombre: emoji.nombre, url: emoji.url });
    hueco--;
  }

  return { modo, acciones, omisiones, diagnosticos, resumen: resumir(acciones) };
}

function comprobarPermisosDelBot(plantilla: Plantilla, estado: EstadoServidor, diagnosticos: Diagnostico[]) {
  const { bot } = estado;

  if (!bot.puedeGestionarCanales) {
    diagnosticos.push({
      nivel: "error",
      codigo: "sin-permiso-canales",
      mensaje: 'El bot no tiene el permiso "Gestionar canales" y no puede crear nada.',
      solucion: "Volvé a invitar al bot con el enlace de la app, que ya incluye los permisos necesarios.",
    });
  }

  if (plantilla.roles.length > 0 && !bot.puedeGestionarRoles) {
    diagnosticos.push({
      nivel: "error",
      codigo: "sin-permiso-roles",
      mensaje: 'El bot no tiene el permiso "Gestionar roles" y esta plantilla crea roles.',
      solucion: "Volvé a invitar al bot con el enlace de la app, que ya incluye los permisos necesarios.",
    });
  }

  // Discord no deja que un bot conceda permisos que él mismo no tiene.
  const pideAdmin = plantilla.roles.some((r) => r.permisos.includes("administrador"));
  if (pideAdmin && !bot.esAdministrador) {
    diagnosticos.push({
      nivel: "error",
      codigo: "no-puede-conceder-admin",
      mensaje:
        "La plantilla crea un rol con permiso de Administrador, pero el bot no es administrador y Discord no le deja conceder permisos que él no tiene.",
      solucion: "Dale al bot el permiso de Administrador, o quitá ese permiso del rol en el editor.",
    });
  }

  // Jerarquía. Lo que importa no es el número de la posición sino QUÉ HAY POR
  // ENCIMA: en un servidor recién creado, con @everyone y el rol del bot, la
  // posición 1 ya es la más alta que existe y todo funciona perfectamente.
  const rolesNuevos = plantilla.roles.filter((r) => r.clave !== CLAVE_EVERYONE).length;
  if (rolesNuevos === 0) return;

  if (bot.posicionRolMasAlto === 0) {
    // El bot no tiene ningún rol propio por encima de @everyone.
    diagnosticos.push({
      nivel: "error",
      codigo: "rol-del-bot-demasiado-bajo",
      mensaje: "El bot no tiene ningún rol propio por encima de @everyone, así que no puede crear ni gestionar roles.",
      solucion:
        "Volvé a invitar al bot con el enlace de la app, que le da su propio rol con los permisos necesarios.",
    });
    return;
  }

  const porEncima = estado.roles.filter((r) => r.id !== estado.id && r.posicion > bot.posicionRolMasAlto);
  if (porEncima.length > 0) {
    diagnosticos.push({
      nivel: "aviso",
      codigo: "jerarquia-justa",
      mensaje: `Hay ${porEncima.length} ${porEncima.length === 1 ? "rol" : "roles"} por encima del rol del bot (${porEncima
        .slice(0, 3)
        .map((r) => `"${r.nombre}"`)
        .join(", ")}${porEncima.length > 3 ? "…" : ""}). El bot no puede tocarlos, y los roles que cree quedarán por debajo.`,
      solucion:
        "Si querés que el orden quede como en la vista previa, arrastrá el rol del bot arriba de todo en Ajustes del servidor → Roles.",
    });
  }
}

function comprobarTopeDeCanales(
  plantilla: Plantilla,
  estado: EstadoServidor,
  modo: Modo,
  diagnosticos: Diagnostico[],
) {
  const existentes = modo === "limpiar" ? 0 : estado.canales.length;
  const nuevos =
    plantilla.categorias.length +
    plantilla.canalesSueltos.length +
    plantilla.categorias.reduce((n, c) => n + c.canales.length, 0);

  if (existentes + nuevos > LIMITES.canalesPorServidor) {
    diagnosticos.push({
      nivel: "error",
      codigo: "tope-de-canales",
      mensaje: `El servidor acabaría con ${existentes + nuevos} canales y Discord solo permite ${LIMITES.canalesPorServidor}.`,
      solucion: "Quitá canales de la plantilla o borrá canales del servidor antes de aplicar.",
    });
  }
}

/** Discord reescribe los nombres de canal de texto; avisamos para que la vista previa no mienta. */
function avisarSiDiscordVaARenombrar(plantilla: Plantilla, omisiones: Omision[]) {
  for (const { canal } of todosLosCanales(plantilla)) {
    if (canal.tipo === "voz" || canal.tipo === "escenario") continue;
    const normalizado = normalizarNombreCanal(canal.nombre);
    if (normalizado !== canal.nombre) {
      omisiones.push({
        que: `Canal "${canal.nombre}"`,
        motivo: `Discord lo va a renombrar a "${normalizado}" (los canales de texto no admiten mayúsculas ni espacios)`,
      });
    }
  }
}

function resumir(acciones: Accion[]): Plan["resumen"] {
  const contar = (tipo: Accion["tipo"]) => acciones.filter((a) => a.tipo === tipo).length;
  return {
    rolesACrear: contar("crear-rol"),
    categoriasACrear: contar("crear-categoria"),
    canalesACrear: contar("crear-canal"),
    mensajesAPublicar: contar("publicar-mensaje") + contar("publicar-panel"),
    emojisACrear: contar("crear-emoji"),
    aBorrar: contar("borrar-canal") + contar("borrar-rol"),
  };
}
