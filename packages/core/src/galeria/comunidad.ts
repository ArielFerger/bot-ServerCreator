import type { EntradaPlantilla } from "../schema";
import { preset } from "../presets";

const staff = ["admin", "mod"];

export const comunidad: EntradaPlantilla = {
  version: 1,
  meta: {
    nombre: "Comunidad General",
    descripcion: "Estructura equilibrada para una comunidad de cualquier tema: presentaciones, charla, intereses y un canal de sugerencias.",
    emoji: "🌐",
    etiquetas: ["comunidad", "general", "social"],
  },
  ajustes: {
    nivelVerificacion: "medio",
    filtroContenido: "todos",
    canalSistema: "bienvenidas",
    canalAfk: "afk",
  },
  roles: [
    { clave: "admin", nombre: "Admin", color: "#c0392b", separado: true, permisos: ["administrador"] },
    {
      clave: "mod",
      nombre: "Moderador",
      color: "#2980b9",
      separado: true,
      permisos: ["gestionar-mensajes", "expulsar-miembros", "moderar-miembros"],
    },
    { clave: "colaborador", nombre: "Colaborador", color: "#8e44ad", separado: true },
    { clave: "miembro", nombre: "Miembro", color: "#27ae60", permisos: ["crear-invitacion", "cambiar-apodo", "adjuntar-archivos", "insertar-enlaces", "anadir-reacciones", "usar-emojis-externos"] },
    { clave: "arte", nombre: "Arte", color: "#e84393", mencionable: true },
    { clave: "musica", nombre: "Música", color: "#00b894", mencionable: true },
    { clave: "tecnologia", nombre: "Tecnología", color: "#0984e3", mencionable: true },
    { clave: "eventos-ping", nombre: "Eventos", color: "#fdcb6e", mencionable: true },
  ],
  categorias: [
    {
      clave: "cat-info",
      nombre: "📌 INFORMACIÓN",
      canales: [
        {
          clave: "reglas",
          nombre: "reglas",
          permisos: preset("solo-lectura", staff),
          mensajes: [
            {
              fijar: true,
              embed: {
                titulo: "📜 Normas de convivencia",
                color: "#c0392b",
                descripcion: "Este es un espacio para todos. Estas normas existen para que siga siéndolo.",
                campos: [
                  { nombre: "Respeto ante todo", valor: "Sin insultos, acoso ni discriminación de ningún tipo." },
                  { nombre: "Sin spam ni publicidad", valor: "No promociones otros servidores ni productos sin permiso." },
                  { nombre: "Usá el canal adecuado", valor: "Cada tema tiene su sitio." },
                  { nombre: "Privacidad", valor: "No compartas datos personales, tuyos ni de otros." },
                ],
              },
            },
          ],
        },
        { clave: "anuncios", nombre: "anuncios", permisos: preset("solo-lectura", staff) },
        {
          clave: "elegi-tus-roles",
          nombre: "elegí-tus-roles",
          permisos: preset("solo-lectura", staff),
          panelRoles: {
            titulo: "🎭 Tus intereses",
            descripcion: "Elegí los temas que te interesan y accedé a sus canales.",
            roles: ["arte", "musica", "tecnologia", "eventos-ping"],
          },
        },
        { clave: "bienvenidas", nombre: "bienvenidas" },
      ],
    },
    {
      clave: "cat-charla",
      nombre: "💬 CHARLA",
      canales: [
        { clave: "general", nombre: "general", tema: "El canal principal" },
        { clave: "presentaciones", nombre: "presentaciones", tema: "Contanos quién sos" },
        { clave: "off-topic", nombre: "off-topic" },
        { clave: "memes", nombre: "memes" },
      ],
    },
    {
      clave: "cat-intereses",
      nombre: "🎨 INTERESES",
      canales: [
        { clave: "arte-chat", nombre: "arte", permisos: preset("privado", ["arte", ...staff]) },
        { clave: "musica-chat", nombre: "música", permisos: preset("privado", ["musica", ...staff]) },
        { clave: "tecnologia-chat", nombre: "tecnología", permisos: preset("privado", ["tecnologia", ...staff]) },
      ],
    },
    {
      clave: "cat-voz",
      nombre: "🔊 VOZ",
      canales: [
        { clave: "voz-general", nombre: "General", tipo: "voz" },
        { clave: "voz-musica", nombre: "Música", tipo: "voz" },
        { clave: "afk", nombre: "AFK", tipo: "voz" },
      ],
    },
    {
      clave: "cat-feedback",
      nombre: "📥 BUZÓN",
      canales: [
        { clave: "sugerencias", nombre: "sugerencias", tema: "Ideas para mejorar el servidor", modoLento: 60 },
        { clave: "reportes", nombre: "reportes", tema: "Avisá al staff de un problema", modoLento: 30 },
      ],
    },
    {
      clave: "cat-staff",
      nombre: "🛡️ STAFF",
      permisos: preset("solo-staff", staff),
      canales: [
        { clave: "staff-chat", nombre: "staff-chat" },
        { clave: "registro", nombre: "registro" },
      ],
    },
  ],
};
