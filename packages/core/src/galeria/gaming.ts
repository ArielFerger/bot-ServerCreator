import type { EntradaPlantilla } from "../schema";
import { preset } from "../presets";

const staff = ["admin", "mod"];

export const gaming: EntradaPlantilla = {
  version: 1,
  meta: {
    nombre: "Comunidad Gaming",
    descripcion: "Para un clan o grupo de amigos que juegan juntos: salas de voz, canales por juego y roles que cada uno elige solo.",
    emoji: "🎮",
    etiquetas: ["gaming", "clan", "amigos"],
  },
  ajustes: {
    nivelVerificacion: "medio",
    filtroContenido: "todos",
    canalSistema: "bienvenidas",
    canalAfk: "afk",
    afkTimeout: 300,
  },
  roles: [
    { clave: "admin", nombre: "Admin", color: "#e74c3c", separado: true, permisos: ["administrador"] },
    {
      clave: "mod",
      nombre: "Moderador",
      color: "#3498db",
      separado: true,
      permisos: ["gestionar-mensajes", "expulsar-miembros", "moderar-miembros", "mover-miembros", "silenciar-miembros"],
    },
    { clave: "veterano", nombre: "Veterano", color: "#f1c40f", separado: true },
    { clave: "miembro", nombre: "Miembro", color: "#2ecc71", permisos: ["crear-invitacion", "cambiar-apodo", "adjuntar-archivos", "insertar-enlaces", "anadir-reacciones", "usar-emojis-externos"] },
    { clave: "competitivo", nombre: "Competitivo", color: "#9b59b6", mencionable: true },
    { clave: "casual", nombre: "Casual", color: "#1abc9c", mencionable: true },
    { clave: "anuncios-ping", nombre: "Avisos", color: "#e67e22", mencionable: true },
  ],
  categorias: [
    {
      clave: "cat-bienvenida",
      nombre: "📢 BIENVENIDA",
      canales: [
        {
          clave: "reglas",
          nombre: "reglas",
          tema: "Leé esto antes de participar",
          permisos: preset("solo-lectura", staff),
          mensajes: [
            {
              fijar: true,
              embed: {
                titulo: "📜 Reglas del servidor",
                color: "#e74c3c",
                descripcion: "Al participar aceptás estas reglas. El staff puede aplicar sanciones sin aviso previo.",
                campos: [
                  { nombre: "1. Respeto", valor: "Nada de insultos, acoso ni discriminación." },
                  { nombre: "2. Sin spam", valor: "Ni flood, ni publicidad, ni enlaces de invitación a otros servidores." },
                  { nombre: "3. Canal correcto", valor: "Cada cosa en su canal. Los off-topic van a #general." },
                  { nombre: "4. Sin contenido NSFW", valor: "Este servidor es para todo público." },
                  { nombre: "5. Hacé caso al staff", valor: "Si tenés una queja, abrí un ticket en vez de discutir en público." },
                ],
                pie: "Gracias por mantener esto agradable para todos",
              },
            },
          ],
        },
        {
          clave: "anuncios",
          nombre: "anuncios",
          tema: "Novedades del servidor y del clan",
          permisos: preset("solo-lectura", staff),
        },
        {
          clave: "elegi-tus-roles",
          nombre: "elegí-tus-roles",
          tema: "Tocá un botón para darte un rol",
          permisos: preset("solo-lectura", staff),
          panelRoles: {
            titulo: "🎭 Elegí tus roles",
            descripcion: "Tocá un botón para añadirte o quitarte el rol. Podés cambiarlos cuando quieras.",
            roles: ["competitivo", "casual", "anuncios-ping"],
          },
        },
        { clave: "bienvenidas", nombre: "bienvenidas", tema: "Saludamos a la gente nueva" },
      ],
    },
    {
      clave: "cat-general",
      nombre: "💬 GENERAL",
      canales: [
        { clave: "general", nombre: "general", tema: "Charla de todo un poco" },
        { clave: "memes", nombre: "memes", tema: "Solo memes, por favor" },
        { clave: "clips", nombre: "clips-y-capturas", tema: "Tus mejores jugadas" },
        { clave: "bots", nombre: "comandos-bots", tema: "Usá los comandos de bots acá para no ensuciar #general", modoLento: 3 },
      ],
    },
    {
      clave: "cat-juegos",
      nombre: "🎮 JUEGOS",
      canales: [
        { clave: "buscar-equipo", nombre: "buscar-equipo", tema: "¿Falta gente? Pedí acá" },
        { clave: "competitivo-chat", nombre: "competitivo", tema: "Para los que van en serio", permisos: preset("privado", ["competitivo", ...staff]) },
        { clave: "estrategias", nombre: "estrategias-y-guías" },
      ],
    },
    {
      clave: "cat-voz",
      nombre: "🔊 VOZ",
      canales: [
        { clave: "voz-general", nombre: "General", tipo: "voz" },
        { clave: "voz-1", nombre: "Sala 1", tipo: "voz", limiteUsuarios: 5 },
        { clave: "voz-2", nombre: "Sala 2", tipo: "voz", limiteUsuarios: 5 },
        { clave: "voz-privada", nombre: "Staff", tipo: "voz", permisos: preset("solo-staff", staff, "voz") },
        { clave: "afk", nombre: "AFK", tipo: "voz" },
      ],
    },
    {
      clave: "cat-staff",
      nombre: "🛡️ STAFF",
      permisos: preset("solo-staff", staff),
      canales: [
        { clave: "staff-chat", nombre: "staff-chat" },
        { clave: "registro", nombre: "registro", tema: "Historial de sanciones y decisiones" },
      ],
    },
  ],
};
