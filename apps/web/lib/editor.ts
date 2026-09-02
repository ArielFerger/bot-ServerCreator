import {
  CLAVE_EVERYONE,
  claveNueva,
  plantillaSchema,
  type Ajustes,
  type Canal,
  type Categoria,
  type Plantilla,
  type Rol,
  type TipoCanal,
} from "@aribuilder/core";

export type Seleccion =
  | { tipo: "categoria"; clave: string }
  | { tipo: "canal"; clave: string }
  | { tipo: "rol"; clave: string }
  | { tipo: "ajustes" }
  | { tipo: "meta" };

export interface EstadoEditor {
  plantilla: Plantilla;
  seleccion: Seleccion | null;
  pasado: Plantilla[];
  futuro: Plantilla[];
  /** Si hay cambios sin guardar respecto a la última vez que se guardó. */
  sucio: boolean;
}

export type AccionEditor =
  | { tipo: "seleccionar"; seleccion: Seleccion | null }
  | { tipo: "anadir-categoria" }
  | { tipo: "anadir-canal"; categoriaClave: string | null; tipoCanal?: TipoCanal }
  | { tipo: "anadir-rol" }
  | { tipo: "editar-meta"; cambios: Partial<Plantilla["meta"]> }
  | { tipo: "editar-ajustes"; cambios: Partial<Ajustes> }
  | { tipo: "editar-categoria"; clave: string; cambios: Partial<Categoria> }
  | { tipo: "editar-canal"; clave: string; cambios: Partial<Canal> }
  | { tipo: "editar-rol"; clave: string; cambios: Partial<Rol> }
  | { tipo: "borrar-categoria"; clave: string }
  | { tipo: "borrar-canal"; clave: string }
  | { tipo: "borrar-rol"; clave: string }
  | { tipo: "mover-canal"; clave: string; destinoCategoria: string | null; indice: number }
  | { tipo: "mover-categoria"; clave: string; indice: number }
  | { tipo: "deshacer" }
  | { tipo: "rehacer" }
  | { tipo: "cargar"; plantilla: Plantilla }
  | { tipo: "marcar-guardado" };

const TOPE_HISTORIAL = 50;

export function estadoInicial(plantilla: Plantilla): EstadoEditor {
  return { plantilla, seleccion: null, pasado: [], futuro: [], sucio: false };
}

/** Aplica un cambio a la plantilla apilando el estado anterior en el historial. */
function conCambio(estado: EstadoEditor, plantilla: Plantilla, seleccion?: Seleccion | null): EstadoEditor {
  return {
    plantilla,
    seleccion: seleccion === undefined ? estado.seleccion : seleccion,
    pasado: [...estado.pasado, estado.plantilla].slice(-TOPE_HISTORIAL),
    futuro: [],
    sucio: true,
  };
}

const mapCanales = (p: Plantilla, fn: (c: Canal) => Canal): Plantilla => ({
  ...p,
  canalesSueltos: p.canalesSueltos.map(fn),
  categorias: p.categorias.map((cat) => ({ ...cat, canales: cat.canales.map(fn) })),
});

export function buscarCanal(p: Plantilla, clave: string): Canal | undefined {
  return p.canalesSueltos.find((c) => c.clave === clave) ?? p.categorias.flatMap((c) => c.canales).find((c) => c.clave === clave);
}

/** En qué categoría vive un canal (`null` si está suelto, `undefined` si no existe). */
export function categoriaDe(p: Plantilla, clave: string): string | null | undefined {
  if (p.canalesSueltos.some((c) => c.clave === clave)) return null;
  return p.categorias.find((cat) => cat.canales.some((c) => c.clave === clave))?.clave;
}

const CANAL_NUEVO = (clave: string, tipo: TipoCanal): Canal => ({
  clave,
  nombre: tipo === "voz" || tipo === "escenario" ? "Sala nueva" : "canal-nuevo",
  tipo,
  nsfw: false,
  modoLento: 0,
  permisos: [],
  mensajes: [],
});

/**
 * Al cambiar el tipo de un canal hay que soltar lo que ese tipo no admite.
 * Si no, la plantilla deja de validar y el usuario ve un error que no entiende:
 * él solo cambió un desplegable.
 */
function normalizarPorTipo(canal: Canal): Canal {
  const esVoz = canal.tipo === "voz" || canal.tipo === "escenario";
  const admiteMensajes = canal.tipo === "texto" || canal.tipo === "anuncios";
  return {
    ...canal,
    modoLento: esVoz ? 0 : canal.modoLento,
    limiteUsuarios: esVoz ? canal.limiteUsuarios : undefined,
    mensajes: admiteMensajes ? canal.mensajes : [],
    panelRoles: canal.tipo === "texto" ? canal.panelRoles : undefined,
  };
}

/**
 * Borrar un rol obliga a limpiar todo lo que lo mencionaba: overwrites y paneles.
 * Sin esto la plantilla queda con referencias colgando y falla la validación por
 * un motivo que no tiene nada que ver con lo que el usuario acaba de hacer.
 */
function olvidarRol(p: Plantilla, clave: string): Plantilla {
  const limpiarCanal = (c: Canal): Canal => ({
    ...c,
    permisos: c.permisos.filter((o) => o.rol !== clave),
    panelRoles: c.panelRoles
      ? (() => {
          const roles = c.panelRoles.roles.filter((r) => r !== clave);
          // Un panel sin roles no es válido: si se queda vacío, desaparece.
          return roles.length > 0 ? { ...c.panelRoles, roles } : undefined;
        })()
      : undefined,
  });

  return mapCanales(
    {
      ...p,
      roles: p.roles.filter((r) => r.clave !== clave),
      categorias: p.categorias.map((cat) => ({ ...cat, permisos: cat.permisos.filter((o) => o.rol !== clave) })),
    },
    limpiarCanal,
  );
}

/** Igual que arriba, pero para los ajustes que apuntan a un canal que ya no está. */
function olvidarCanalEnAjustes(p: Plantilla, clave: string): Plantilla {
  const ajustes = { ...p.ajustes };
  if (ajustes.canalSistema === clave) delete ajustes.canalSistema;
  if (ajustes.canalAfk === clave) delete ajustes.canalAfk;
  return { ...p, ajustes };
}

export function reducirEditor(estado: EstadoEditor, accion: AccionEditor): EstadoEditor {
  const p = estado.plantilla;

  switch (accion.tipo) {
    case "seleccionar":
      return { ...estado, seleccion: accion.seleccion };

    case "cargar":
      return { ...estadoInicial(accion.plantilla), pasado: [...estado.pasado, p].slice(-TOPE_HISTORIAL), sucio: true };

    case "marcar-guardado":
      return { ...estado, sucio: false };

    case "deshacer": {
      const anterior = estado.pasado.at(-1);
      if (!anterior) return estado;
      return {
        ...estado,
        plantilla: anterior,
        pasado: estado.pasado.slice(0, -1),
        futuro: [p, ...estado.futuro],
        sucio: true,
      };
    }

    case "rehacer": {
      const siguiente = estado.futuro[0];
      if (!siguiente) return estado;
      return {
        ...estado,
        plantilla: siguiente,
        pasado: [...estado.pasado, p],
        futuro: estado.futuro.slice(1),
        sucio: true,
      };
    }

    case "anadir-categoria": {
      const clave = claveNueva(p, "categoria");
      const categoria: Categoria = { clave, nombre: "CATEGORÍA NUEVA", permisos: [], canales: [] };
      return conCambio(estado, { ...p, categorias: [...p.categorias, categoria] }, { tipo: "categoria", clave });
    }

    case "anadir-canal": {
      const tipo = accion.tipoCanal ?? "texto";
      const clave = claveNueva(p, tipo === "voz" ? "sala" : "canal");
      const canal = CANAL_NUEVO(clave, tipo);

      if (accion.categoriaClave === null) {
        return conCambio(estado, { ...p, canalesSueltos: [...p.canalesSueltos, canal] }, { tipo: "canal", clave });
      }
      return conCambio(
        estado,
        {
          ...p,
          categorias: p.categorias.map((cat) =>
            cat.clave === accion.categoriaClave ? { ...cat, canales: [...cat.canales, canal] } : cat,
          ),
        },
        { tipo: "canal", clave },
      );
    }

    case "anadir-rol": {
      const clave = claveNueva(p, "rol");
      const rol: Rol = { clave, nombre: "Rol nuevo", separado: false, mencionable: false, permisos: [] };
      return conCambio(estado, { ...p, roles: [...p.roles, rol] }, { tipo: "rol", clave });
    }

    case "editar-meta":
      return conCambio(estado, { ...p, meta: { ...p.meta, ...accion.cambios } });

    case "editar-ajustes":
      return conCambio(estado, { ...p, ajustes: { ...p.ajustes, ...accion.cambios } });

    case "editar-categoria":
      return conCambio(estado, {
        ...p,
        categorias: p.categorias.map((cat) => (cat.clave === accion.clave ? { ...cat, ...accion.cambios } : cat)),
      });

    case "editar-canal":
      return conCambio(
        estado,
        mapCanales(p, (c) => (c.clave === accion.clave ? normalizarPorTipo({ ...c, ...accion.cambios }) : c)),
      );

    case "editar-rol": {
      // @everyone no se renombra ni se colorea: es un rol especial de Discord.
      const cambios = accion.clave === CLAVE_EVERYONE ? { permisos: accion.cambios.permisos } : accion.cambios;
      return conCambio(estado, {
        ...p,
        roles: p.roles.map((r) => (r.clave === accion.clave ? { ...r, ...cambios } : r)),
      });
    }

    case "borrar-categoria": {
      const categoria = p.categorias.find((c) => c.clave === accion.clave);
      if (!categoria) return estado;
      // Los canales de dentro no se pierden: pasan a estar sueltos.
      let siguiente: Plantilla = {
        ...p,
        categorias: p.categorias.filter((c) => c.clave !== accion.clave),
        canalesSueltos: [...p.canalesSueltos, ...categoria.canales],
      };
      siguiente = { ...siguiente };
      return conCambio(estado, siguiente, null);
    }

    case "borrar-canal": {
      const siguiente = olvidarCanalEnAjustes(
        {
          ...p,
          canalesSueltos: p.canalesSueltos.filter((c) => c.clave !== accion.clave),
          categorias: p.categorias.map((cat) => ({
            ...cat,
            canales: cat.canales.filter((c) => c.clave !== accion.clave),
          })),
        },
        accion.clave,
      );
      return conCambio(estado, siguiente, null);
    }

    case "borrar-rol":
      return conCambio(estado, olvidarRol(p, accion.clave), null);

    case "mover-canal": {
      const canal = buscarCanal(p, accion.clave);
      if (!canal) return estado;

      // Se saca de donde esté y se mete donde toque, en el índice pedido.
      const sinEl: Plantilla = {
        ...p,
        canalesSueltos: p.canalesSueltos.filter((c) => c.clave !== accion.clave),
        categorias: p.categorias.map((cat) => ({
          ...cat,
          canales: cat.canales.filter((c) => c.clave !== accion.clave),
        })),
      };

      const insertar = (lista: Canal[]) => {
        const copia = [...lista];
        copia.splice(Math.max(0, Math.min(accion.indice, copia.length)), 0, canal);
        return copia;
      };

      if (accion.destinoCategoria === null) {
        return conCambio(estado, { ...sinEl, canalesSueltos: insertar(sinEl.canalesSueltos) });
      }
      return conCambio(estado, {
        ...sinEl,
        categorias: sinEl.categorias.map((cat) =>
          cat.clave === accion.destinoCategoria ? { ...cat, canales: insertar(cat.canales) } : cat,
        ),
      });
    }

    case "mover-categoria": {
      const actual = p.categorias.findIndex((c) => c.clave === accion.clave);
      if (actual === -1) return estado;
      const copia = [...p.categorias];
      const [movida] = copia.splice(actual, 1);
      copia.splice(Math.max(0, Math.min(accion.indice, copia.length)), 0, movida!);
      return conCambio(estado, { ...p, categorias: copia });
    }
  }
}

/** Errores de validación agrupados por la ruta que los produce, para marcarlos en la interfaz. */
export function erroresDe(plantilla: Plantilla): { ruta: string; mensaje: string }[] {
  const r = plantillaSchema.safeParse(plantilla);
  if (r.success) return [];
  return r.error.issues.map((i) => ({ ruta: i.path.join("."), mensaje: i.message }));
}
