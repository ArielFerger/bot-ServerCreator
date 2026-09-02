import type { EntradaPlantilla } from "../schema";
import { preset } from "../presets";

const direccion = ["direccion"];
const todosLosEquipos = ["direccion", "producto", "desarrollo", "diseno"];

export const trabajo: EntradaPlantilla = {
  version: 1,
  meta: {
    nombre: "Equipo de Trabajo",
    descripcion: "Para un equipo pequeño o un proyecto: un canal por área, reuniones en voz y un tablón de decisiones.",
    emoji: "💼",
    etiquetas: ["trabajo", "equipo", "proyecto", "empresa"],
  },
  ajustes: {
    nivelVerificacion: "alto",
    filtroContenido: "todos",
    canalSistema: "general",
    notificacionesPorDefecto: "solo-menciones",
  },
  roles: [
    { clave: "direccion", nombre: "Dirección", color: "#2c3e50", separado: true, permisos: ["administrador"] },
    {
      clave: "producto",
      nombre: "Producto",
      color: "#e67e22",
      separado: true,
      permisos: ["gestionar-mensajes", "gestionar-hilos"],
      mencionable: true,
    },
    { clave: "desarrollo", nombre: "Desarrollo", color: "#3498db", separado: true, mencionable: true },
    { clave: "diseno", nombre: "Diseño", color: "#9b59b6", separado: true, mencionable: true },
    { clave: "invitado", nombre: "Invitado externo", color: "#95a5a6" },
  ],
  categorias: [
    {
      clave: "cat-general",
      nombre: "🏢 GENERAL",
      canales: [
        { clave: "general", nombre: "general", tema: "Canal principal del equipo" },
        {
          clave: "anuncios",
          nombre: "anuncios",
          permisos: preset("solo-lectura", direccion),
          mensajes: [
            {
              fijar: true,
              embed: {
                titulo: "👋 Cómo trabajamos aquí",
                color: "#2c3e50",
                campos: [
                  { nombre: "Async por defecto", valor: "Escribí en el canal del área. No hace falta respuesta inmediata." },
                  { nombre: "Un hilo por tema", valor: "Mantiene los canales legibles y el historial buscable." },
                  { nombre: "Las decisiones se anotan", valor: "Lo que se decide en una llamada va a #decisiones." },
                  { nombre: "Horarios", valor: "Respetá el horario del otro. Si es urgente, mencionalo explícitamente." },
                ],
              },
            },
          ],
        },
        { clave: "decisiones", nombre: "decisiones", tema: "Registro de decisiones tomadas y por qué", permisos: preset("solo-lectura", ["direccion", "producto"]) },
        { clave: "random", nombre: "random", tema: "Lo que no es trabajo" },
      ],
    },
    {
      clave: "cat-areas",
      nombre: "🧩 ÁREAS",
      canales: [
        { clave: "producto-chat", nombre: "producto", permisos: preset("privado", ["producto", "direccion"]) },
        { clave: "desarrollo-chat", nombre: "desarrollo", permisos: preset("privado", ["desarrollo", "direccion"]) },
        { clave: "diseno-chat", nombre: "diseño", permisos: preset("privado", ["diseno", "direccion"]) },
        { clave: "revisiones", nombre: "revisiones", tema: "Pedidos de revisión entre áreas", permisos: preset("privado", todosLosEquipos) },
      ],
    },
    {
      clave: "cat-voz",
      nombre: "🔊 REUNIONES",
      canales: [
        { clave: "voz-daily", nombre: "Daily", tipo: "voz", limiteUsuarios: 15 },
        { clave: "voz-reunion-1", nombre: "Reunión 1", tipo: "voz" },
        { clave: "voz-reunion-2", nombre: "Reunión 2", tipo: "voz" },
        { clave: "voz-foco", nombre: "Sala de foco", tipo: "voz", tema: "Trabajar acompañado, en silencio" },
      ],
    },
    {
      clave: "cat-externos",
      nombre: "🤝 EXTERNOS",
      permisos: preset("privado", ["invitado", ...todosLosEquipos]),
      canales: [{ clave: "clientes", nombre: "clientes-y-proveedores" }],
    },
  ],
};
