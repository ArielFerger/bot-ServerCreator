import type { EntradaPlantilla } from "../schema";
import { preset } from "../presets";

const staff = ["profesor", "ayudante"];

export const estudio: EntradaPlantilla = {
  version: 1,
  meta: {
    nombre: "Clase o Grupo de Estudio",
    descripcion: "Para una materia, un curso o un grupo que estudia junto: canales por asignatura, dudas, entregas y salas de estudio en voz.",
    emoji: "📚",
    etiquetas: ["estudio", "clase", "educación"],
  },
  ajustes: {
    nivelVerificacion: "medio",
    filtroContenido: "todos",
    canalSistema: "bienvenidas",
    notificacionesPorDefecto: "solo-menciones",
  },
  roles: [
    { clave: "profesor", nombre: "Profesor", color: "#8e44ad", separado: true, permisos: ["administrador"] },
    {
      clave: "ayudante",
      nombre: "Ayudante",
      color: "#2980b9",
      separado: true,
      permisos: ["gestionar-mensajes", "moderar-miembros", "gestionar-hilos"],
    },
    { clave: "alumno", nombre: "Alumno", color: "#27ae60", separado: true },
    { clave: "avisos-ping", nombre: "Avisos", color: "#e67e22", mencionable: true },
  ],
  categorias: [
    {
      clave: "cat-info",
      nombre: "📌 INFORMACIÓN",
      canales: [
        {
          clave: "normas",
          nombre: "normas",
          permisos: preset("solo-lectura", staff),
          mensajes: [
            {
              fijar: true,
              embed: {
                titulo: "📚 Cómo funciona este espacio",
                color: "#8e44ad",
                campos: [
                  { nombre: "Preguntá sin miedo", valor: "No hay preguntas tontas. Usá #dudas y sé concreto." },
                  { nombre: "Buscá antes", valor: "Puede que tu duda ya esté respondida. Usá el buscador." },
                  { nombre: "Nada de respuestas hechas", valor: "Pedir ayuda sí, pedir el trabajo resuelto no." },
                  { nombre: "Respeto", valor: "Todos estamos aprendiendo, a ritmos distintos." },
                ],
              },
            },
          ],
        },
        { clave: "anuncios", nombre: "anuncios", tema: "Fechas de examen, cambios de horario y avisos", permisos: preset("solo-lectura", staff) },
        { clave: "calendario", nombre: "calendario", tema: "Fechas importantes", permisos: preset("solo-lectura", staff) },
        {
          clave: "elegi-tus-roles",
          nombre: "elegí-tus-roles",
          permisos: preset("solo-lectura", staff),
          panelRoles: { titulo: "🔔 Notificaciones", descripcion: "Activá los avisos si querés que te mencionemos.", roles: ["avisos-ping"] },
        },
        { clave: "bienvenidas", nombre: "bienvenidas" },
      ],
    },
    {
      clave: "cat-clase",
      nombre: "🎓 CLASE",
      canales: [
        { clave: "general", nombre: "general" },
        { clave: "dudas", nombre: "dudas", tema: "Preguntá acá. Abrí un hilo por cada duda." },
        { clave: "material", nombre: "material", tema: "Apuntes, enlaces y recursos" },
        { clave: "entregas", nombre: "entregas", tema: "Subí acá tus trabajos" },
      ],
    },
    {
      clave: "cat-voz",
      nombre: "🔊 SALAS DE ESTUDIO",
      canales: [
        { clave: "voz-clase", nombre: "Clase en directo", tipo: "voz", permisos: preset("solo-lectura", staff, "voz") },
        { clave: "voz-estudio-1", nombre: "Estudio 1", tipo: "voz", limiteUsuarios: 6 },
        { clave: "voz-estudio-2", nombre: "Estudio 2", tipo: "voz", limiteUsuarios: 6 },
        { clave: "voz-silencio", nombre: "Estudio en silencio", tipo: "voz", tema: "Cámara y micro apagados, solo compañía" },
      ],
    },
    {
      clave: "cat-profes",
      nombre: "🔒 PROFESORADO",
      permisos: preset("solo-staff", staff),
      canales: [{ clave: "coordinacion", nombre: "coordinación" }],
    },
  ],
};
