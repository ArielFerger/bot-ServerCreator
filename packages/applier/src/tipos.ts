import type { Ajustes, Canal, Categoria, Mensaje, Overwrite, PanelRoles, Rol } from "@aribuilder/core";

/** Cómo tratar lo que ya existe en el servidor. */
export type Modo =
  /** Omite todo lo que ya exista con el mismo nombre. Es el defecto seguro. */
  | "fusionar"
  /** Actualiza lo que coincida por nombre y crea el resto. */
  | "reemplazar"
  /** Borra canales y roles existentes antes de construir. Pide confirmación escrita. */
  | "limpiar";

/** Retrato del servidor tal y como está antes de aplicar nada. */
export interface EstadoServidor {
  id: string;
  nombre: string;
  /** `guild.features`: contiene "COMMUNITY" si el servidor tiene la Comunidad activada. */
  funciones: string[];
  roles: RolExistente[];
  canales: CanalExistente[];
  emojis: { id: string; nombre: string }[];
  /** Nivel de boost: decide cuántos emojis caben. */
  nivelBoost: number;
  bot: {
    id: string;
    /** Posición del rol más alto del bot: no puede tocar nada por encima. */
    posicionRolMasAlto: number;
    esAdministrador: boolean;
    puedeGestionarRoles: boolean;
    puedeGestionarCanales: boolean;
    puedeGestionarServidor: boolean;
    puedeGestionarExpresiones: boolean;
  };
}

export interface RolExistente {
  id: string;
  nombre: string;
  posicion: number;
  /** Roles de bots e integraciones: no se pueden borrar ni editar. */
  gestionado: boolean;
}

export interface CanalExistente {
  id: string;
  nombre: string;
  /** Tipo numérico de la API de Discord. */
  tipo: number;
  padreId: string | null;
}

/** Una unidad de trabajo. El plan es una lista ordenada de estas. */
export type Accion =
  | { tipo: "borrar-canal"; id: string; nombre: string }
  | { tipo: "borrar-rol"; id: string; nombre: string }
  | { tipo: "crear-rol"; clave: string; rol: Rol }
  | { tipo: "actualizar-rol"; clave: string; id: string; rol: Rol }
  | { tipo: "vincular-rol"; clave: string; id: string }
  | { tipo: "crear-categoria"; clave: string; nombre: string; permisos: Overwrite[]; posicion: number }
  | { tipo: "vincular-categoria"; clave: string; id: string }
  | { tipo: "crear-canal"; clave: string; canal: Canal; categoriaClave: string | null; posicion: number }
  | { tipo: "vincular-canal"; clave: string; id: string }
  | { tipo: "aplicar-ajustes"; ajustes: Ajustes }
  | { tipo: "publicar-mensaje"; canalClave: string; mensaje: Mensaje; indice: number }
  | {
      tipo: "publicar-panel";
      canalClave: string;
      panel: PanelRoles;
      /** Nombre visible de cada rol: es lo que se lee en el botón. */
      nombresDeRol: Record<string, string>;
    }
  | { tipo: "crear-emoji"; nombre: string; url: string };

/** Algo que el plan decidió NO hacer, con el motivo en español. */
export interface Omision {
  que: string;
  motivo: string;
}

/** Problema detectado antes de tocar la red. */
export interface Diagnostico {
  nivel: "error" | "aviso";
  codigo: string;
  mensaje: string;
  /** Qué tiene que hacer el usuario para arreglarlo. */
  solucion?: string;
}

export interface Plan {
  modo: Modo;
  acciones: Accion[];
  omisiones: Omision[];
  diagnosticos: Diagnostico[];
  /** Resumen para la vista previa. */
  resumen: {
    rolesACrear: number;
    categoriasACrear: number;
    canalesACrear: number;
    mensajesAPublicar: number;
    emojisACrear: number;
    aBorrar: number;
  };
}

export function planTieneErrores(plan: Plan): boolean {
  return plan.diagnosticos.some((d) => d.nivel === "error");
}

/** IDs de todo lo que se creó, para poder deshacer con precisión. */
export interface Creados {
  roles: { id: string; clave: string }[];
  canales: { id: string; clave: string }[];
  emojis: { id: string; nombre: string }[];
  mensajes: { canalId: string; mensajeId: string }[];
  paneles: { canalId: string; mensajeId: string; roles: { id: string; nombre: string }[] }[];
}

export function creadosVacios(): Creados {
  return { roles: [], canales: [], emojis: [], mensajes: [], paneles: [] };
}

export type Evento =
  | { tipo: "inicio"; total: number }
  | { tipo: "paso"; indice: number; total: number; descripcion: string }
  | { tipo: "aviso"; mensaje: string }
  | { tipo: "error"; mensaje: string }
  | { tipo: "fin"; creados: Creados; fallos: number };

/** Error con mensaje ya redactado para un usuario que no programa. */
export class ErrorAplicacion extends Error {
  constructor(
    message: string,
    readonly solucion?: string,
    readonly causa?: unknown,
  ) {
    super(message);
    this.name = "ErrorAplicacion";
  }
}
