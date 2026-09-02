import { PermissionFlagsBits } from "discord.js";

/** Prefijo del `custom_id` de los botones que publica el motor. */
export const PREFIJO = "autorol:";

/**
 * Permisos que convierten un rol en peligroso de repartir con un botón.
 *
 * Un panel de auto-roles es de libre servicio: cualquiera del servidor puede
 * pulsarlo. Aunque la plantilla original solo ofreciera roles inocuos, alguien
 * puede darle permisos a ese rol más adelante y el botón se convertiría en una
 * escalada de privilegios. Por eso se comprueba en cada pulsación, no al crear.
 */
const PELIGROSOS = [
  PermissionFlagsBits.Administrator,
  PermissionFlagsBits.ManageGuild,
  PermissionFlagsBits.ManageRoles,
  PermissionFlagsBits.ManageChannels,
  PermissionFlagsBits.ManageWebhooks,
  PermissionFlagsBits.ManageGuildExpressions,
  PermissionFlagsBits.BanMembers,
  PermissionFlagsBits.KickMembers,
  PermissionFlagsBits.ModerateMembers,
  PermissionFlagsBits.ManageMessages,
  PermissionFlagsBits.MentionEveryone,
] as const;

export function esRolPeligroso(permisos: bigint): boolean {
  return PELIGROSOS.some((p) => (permisos & p) === p);
}

/** El id del rol que lleva un botón, o `null` si no es uno de los nuestros. */
export function rolDelBoton(customId: string): string | null {
  if (!customId.startsWith(PREFIJO)) return null;
  const id = customId.slice(PREFIJO.length);
  return /^\d{17,20}$/.test(id) ? id : null;
}

export interface ContextoAutorol {
  /** El mensaje pulsado está registrado como panel nuestro. */
  panelConocido: boolean;
  rolExiste: boolean;
  rolEsGestionado: boolean;
  permisosDelRol: bigint;
  posicionDelRol: number;
  posicionDelBot: number;
  botPuedeGestionarRoles: boolean;
  yaLoTiene: boolean;
}

export type Veredicto =
  | { accion: "dar" }
  | { accion: "quitar" }
  | { accion: "rechazar"; motivo: string };

/**
 * Decide qué hacer con una pulsación. Función pura: toda la lógica delicada
 * queda testeable sin levantar un bot ni hablar con Discord.
 */
export function decidir(ctx: ContextoAutorol): Veredicto {
  if (!ctx.panelConocido) {
    return { accion: "rechazar", motivo: "Este panel ya no está activo. Pedile al staff que lo vuelva a publicar." };
  }
  if (!ctx.rolExiste) {
    return { accion: "rechazar", motivo: "Ese rol ya no existe en el servidor." };
  }
  if (!ctx.botPuedeGestionarRoles) {
    return { accion: "rechazar", motivo: 'El bot perdió el permiso "Gestionar roles". Avisá al staff.' };
  }
  if (ctx.rolEsGestionado) {
    return { accion: "rechazar", motivo: "Ese rol lo gestiona una integración y no se puede asignar a mano." };
  }
  if (ctx.posicionDelRol >= ctx.posicionDelBot) {
    return {
      accion: "rechazar",
      motivo: "Ese rol está por encima del bot en la jerarquía. El staff tiene que subir el rol del bot.",
    };
  }
  if (esRolPeligroso(ctx.permisosDelRol)) {
    return {
      accion: "rechazar",
      motivo: "Ese rol da permisos de moderación, así que no se reparte con un botón. Avisá al staff.",
    };
  }
  return { accion: ctx.yaLoTiene ? "quitar" : "dar" };
}
