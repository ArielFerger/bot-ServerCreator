import type { EntradaPlantilla } from "../schema";
import { preset } from "../presets";

const staff = ["admin", "agente"];

export const soporte: EntradaPlantilla = {
  version: 1,
  meta: {
    nombre: "Soporte y Atención",
    descripcion: "Para dar soporte a usuarios de un producto o servicio: preguntas frecuentes, canal de ayuda, estado del servicio y zona interna del equipo.",
    emoji: "🛟",
    etiquetas: ["soporte", "ayuda", "producto", "tickets"],
  },
  ajustes: {
    nivelVerificacion: "medio",
    filtroContenido: "todos",
    canalSistema: "bienvenidas",
    notificacionesPorDefecto: "solo-menciones",
  },
  roles: [
    { clave: "admin", nombre: "Admin", color: "#2c3e50", separado: true, permisos: ["administrador"] },
    {
      clave: "agente",
      nombre: "Soporte",
      color: "#00b894",
      separado: true,
      permisos: ["gestionar-mensajes", "gestionar-hilos", "moderar-miembros"],
      mencionable: true,
    },
    { clave: "beta", nombre: "Beta tester", color: "#6c5ce7", separado: true },
    { clave: "usuario", nombre: "Usuario", color: "#0984e3", permisos: ["crear-invitacion", "cambiar-apodo", "adjuntar-archivos", "insertar-enlaces", "anadir-reacciones", "usar-emojis-externos"] },
    { clave: "estado-ping", nombre: "Avisos de estado", color: "#d63031", mencionable: true },
  ],
  categorias: [
    {
      clave: "cat-info",
      nombre: "ℹ️ INFORMACIÓN",
      canales: [
        {
          clave: "empezar",
          nombre: "empezá-aquí",
          permisos: preset("solo-lectura", staff),
          mensajes: [
            {
              fijar: true,
              embed: {
                titulo: "🛟 Cómo pedir ayuda",
                color: "#00b894",
                descripcion: "Seguí estos pasos y te respondemos mucho más rápido.",
                campos: [
                  { nombre: "1. Mirá las preguntas frecuentes", valor: "Muchas dudas ya están resueltas en #preguntas-frecuentes." },
                  { nombre: "2. Comprobá el estado", valor: "Si algo no funciona, mirá #estado-del-servicio antes de escribir." },
                  { nombre: "3. Abrí un hilo en #ayuda", valor: "Contá qué esperabas, qué pasó y qué versión usás." },
                  { nombre: "4. Paciencia", valor: "Respondemos en horario laboral. No menciones al equipo repetidamente." },
                ],
              },
            },
          ],
        },
        { clave: "preguntas-frecuentes", nombre: "preguntas-frecuentes", permisos: preset("solo-lectura", staff) },
        { clave: "estado-del-servicio", nombre: "estado-del-servicio", tema: "Incidencias y mantenimientos", permisos: preset("solo-lectura", staff) },
        { clave: "novedades", nombre: "novedades", tema: "Cambios y versiones nuevas", permisos: preset("solo-lectura", staff) },
        {
          clave: "elegi-tus-roles",
          nombre: "elegí-tus-roles",
          permisos: preset("solo-lectura", staff),
          panelRoles: {
            titulo: "🔔 Avisos",
            descripcion: "Activá los avisos de incidencias si querés enterarte al momento.",
            roles: ["estado-ping"],
          },
        },
        { clave: "bienvenidas", nombre: "bienvenidas" },
      ],
    },
    {
      clave: "cat-ayuda",
      nombre: "🆘 AYUDA",
      canales: [
        { clave: "ayuda", nombre: "ayuda", tema: "Abrí un hilo con tu problema", modoLento: 15 },
        { clave: "errores", nombre: "reportar-errores", tema: "Un hilo por error, con pasos para reproducirlo", modoLento: 30 },
        { clave: "sugerencias", nombre: "sugerencias", modoLento: 60 },
      ],
    },
    {
      clave: "cat-comunidad",
      nombre: "💬 COMUNIDAD",
      canales: [
        { clave: "general", nombre: "general" },
        { clave: "trucos", nombre: "trucos-y-usos", tema: "Compartí cómo lo usás vos" },
      ],
    },
    {
      clave: "cat-beta",
      nombre: "🧪 BETA",
      permisos: preset("privado", ["beta", ...staff]),
      canales: [
        { clave: "beta-chat", nombre: "beta-chat" },
        { clave: "beta-errores", nombre: "beta-errores" },
      ],
    },
    {
      clave: "cat-interno",
      nombre: "🔒 EQUIPO",
      permisos: preset("solo-staff", staff),
      canales: [
        { clave: "interno", nombre: "interno" },
        { clave: "escalados", nombre: "escalados", tema: "Casos que hay que pasar a desarrollo" },
        { clave: "voz-equipo", nombre: "Equipo", tipo: "voz", permisos: preset("solo-staff", staff, "voz") },
      ],
    },
  ],
};
