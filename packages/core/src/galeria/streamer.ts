import type { EntradaPlantilla } from "../schema";
import { preset } from "../presets";

const staff = ["admin", "mod"];

export const streamer: EntradaPlantilla = {
  version: 1,
  meta: {
    nombre: "Streamer o Creador",
    descripcion: "Para la comunidad de un canal: avisos de directo, zona de suscriptores, clips y peticiones.",
    emoji: "🎬",
    etiquetas: ["streamer", "twitch", "youtube", "creador"],
  },
  ajustes: {
    nivelVerificacion: "medio",
    filtroContenido: "todos",
    canalSistema: "bienvenidas",
    canalAfk: "afk",
  },
  roles: [
    { clave: "admin", nombre: "Creador", color: "#9146ff", separado: true, permisos: ["administrador"] },
    {
      clave: "mod",
      nombre: "Moderador",
      color: "#00b894",
      separado: true,
      permisos: ["gestionar-mensajes", "expulsar-miembros", "moderar-miembros", "silenciar-miembros"],
    },
    { clave: "sub", nombre: "Suscriptor", color: "#f1c40f", separado: true },
    { clave: "vip", nombre: "VIP", color: "#e84393", separado: true },
    { clave: "espectador", nombre: "Espectador", color: "#95a5a6", permisos: ["crear-invitacion", "cambiar-apodo", "adjuntar-archivos", "insertar-enlaces", "anadir-reacciones", "usar-emojis-externos"] },
    { clave: "directo-ping", nombre: "Aviso de directo", color: "#e74c3c", mencionable: true },
    { clave: "video-ping", nombre: "Aviso de vídeo", color: "#e67e22", mencionable: true },
  ],
  categorias: [
    {
      clave: "cat-info",
      nombre: "📢 EMPEZÁ AQUÍ",
      canales: [
        {
          clave: "reglas",
          nombre: "reglas",
          permisos: preset("solo-lectura", staff),
          mensajes: [
            {
              fijar: true,
              embed: {
                titulo: "📜 Reglas de la comunidad",
                color: "#9146ff",
                campos: [
                  { nombre: "Respeto", valor: "Sin insultos, acoso ni discriminación." },
                  { nombre: "Sin autopromoción", valor: "No publiques tu canal salvo en #autopromo." },
                  { nombre: "Sin spoilers", valor: "Usá spoiler tags si hablás de algo reciente." },
                  { nombre: "Sin drama", valor: "Los problemas se hablan por privado con un mod." },
                ],
              },
            },
          ],
        },
        { clave: "anuncios", nombre: "anuncios", permisos: preset("solo-lectura", staff) },
        { clave: "directos", nombre: "avisos-de-directo", tema: "Aviso automático cuando empieza el directo", permisos: preset("solo-lectura", staff) },
        {
          clave: "elegi-tus-roles",
          nombre: "elegí-tus-roles",
          permisos: preset("solo-lectura", staff),
          panelRoles: {
            titulo: "🔔 ¿Qué avisos querés?",
            descripcion: "Solo te mencionamos por lo que elijas acá.",
            roles: ["directo-ping", "video-ping"],
          },
        },
        { clave: "bienvenidas", nombre: "bienvenidas" },
      ],
    },
    {
      clave: "cat-comunidad",
      nombre: "💬 COMUNIDAD",
      canales: [
        { clave: "general", nombre: "general" },
        { clave: "clips", nombre: "clips", tema: "Los mejores momentos del directo" },
        { clave: "memes", nombre: "memes" },
        { clave: "peticiones", nombre: "peticiones", tema: "¿Qué querés ver en el próximo directo?", modoLento: 120 },
        { clave: "autopromo", nombre: "autopromo", tema: "Un mensaje por semana y por persona", modoLento: 600 },
      ],
    },
    {
      clave: "cat-subs",
      nombre: "⭐ ZONA SUSCRIPTORES",
      permisos: preset("privado", ["sub", "vip", ...staff]),
      canales: [
        { clave: "subs-chat", nombre: "sub-chat" },
        { clave: "detras", nombre: "detrás-de-cámaras" },
        { clave: "voz-subs", nombre: "Sala de subs", tipo: "voz" },
      ],
    },
    {
      clave: "cat-voz",
      nombre: "🔊 VOZ",
      canales: [
        { clave: "voz-general", nombre: "General", tipo: "voz" },
        { clave: "voz-juegos", nombre: "Jugar con el creador", tipo: "voz", limiteUsuarios: 10 },
        { clave: "afk", nombre: "AFK", tipo: "voz" },
      ],
    },
    {
      clave: "cat-staff",
      nombre: "🛡️ STAFF",
      permisos: preset("solo-staff", staff),
      canales: [{ clave: "staff-chat", nombre: "staff-chat" }, { clave: "registro", nombre: "registro" }],
    },
  ],
};
