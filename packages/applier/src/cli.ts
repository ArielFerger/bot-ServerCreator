/**
 * Prueba del motor contra un servidor real, sin necesidad de la web.
 *
 *   npm run aplicar -- --guild <id> --plantilla gaming [--modo fusionar] [--seco]
 *
 * Necesita DISCORD_BOT_TOKEN en el entorno (o en .env).
 */
import { readFileSync } from "node:fs";
import { plantillaSchema, validarPlantilla, type Plantilla } from "@aribuilder/core";
import { CLAVES_GALERIA, plantillaDeGaleria, type ClaveGaleria } from "@aribuilder/core/galeria";
import { aplicar } from "./aplicar";
import { crearRest, leerEstado } from "./discord";
import { planificar } from "./planificar";
import { ErrorAplicacion, planTieneErrores, type EstadoServidor, type Modo, type Plan } from "./tipos";

const MODOS: Modo[] = ["fusionar", "reemplazar", "limpiar"];

function argumento(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const bandera = (nombre: string) => process.argv.includes(`--${nombre}`);

function salir(mensaje: string): never {
  console.error(`\n✖ ${mensaje}\n`);
  process.exit(1);
}

function cargarPlantilla(): Plantilla {
  const archivo = argumento("archivo");
  if (archivo) {
    const resultado = validarPlantilla(JSON.parse(readFileSync(archivo, "utf8")));
    if (!resultado.ok) {
      console.error(`\n✖ La plantilla de ${archivo} no es válida:\n`);
      for (const e of resultado.errores) console.error(`   · ${e.ruta || "(raíz)"}: ${e.mensaje}`);
      process.exit(1);
    }
    return resultado.plantilla;
  }

  const clave = argumento("plantilla");
  if (!clave) salir(`Indicá --plantilla <${CLAVES_GALERIA.join("|")}> o --archivo <ruta.json>`);
  if (!CLAVES_GALERIA.includes(clave as ClaveGaleria)) {
    salir(`Plantilla desconocida "${clave}". Disponibles: ${CLAVES_GALERIA.join(", ")}`);
  }
  return plantillaDeGaleria(clave as ClaveGaleria);
}

function mostrarPlan(plan: Plan, plantilla: Plantilla) {
  const { resumen } = plan;
  console.log(`\n📋 Plantilla: ${plantilla.meta.emoji ?? ""} ${plantilla.meta.nombre}`);
  console.log(`   Modo: ${plan.modo}\n`);
  console.log("   Se van a crear:");
  console.log(`     · ${resumen.rolesACrear} roles`);
  console.log(`     · ${resumen.categoriasACrear} categorías`);
  console.log(`     · ${resumen.canalesACrear} canales`);
  console.log(`     · ${resumen.mensajesAPublicar} mensajes`);
  console.log(`     · ${resumen.emojisACrear} emojis`);
  if (resumen.aBorrar > 0) console.log(`   ⚠️  Se van a BORRAR ${resumen.aBorrar} cosas que ya existen`);

  if (plan.omisiones.length > 0) {
    console.log(`\n   Se omiten ${plan.omisiones.length} cosas:`);
    for (const o of plan.omisiones.slice(0, 15)) console.log(`     · ${o.que}: ${o.motivo}`);
    if (plan.omisiones.length > 15) console.log(`     … y ${plan.omisiones.length - 15} más`);
  }

  for (const d of plan.diagnosticos) {
    console.log(`\n   ${d.nivel === "error" ? "✖" : "⚠"}  ${d.mensaje}`);
    if (d.solucion) console.log(`      → ${d.solucion}`);
  }
}

/** Servidor vacío ideal: sirve para inspeccionar una plantilla sin tocar Discord. */
function servidorImaginario(): EstadoServidor {
  return {
    id: "000000000000000000",
    nombre: "(servidor vacío imaginario)",
    funciones: [],
    roles: [],
    canales: [],
    emojis: [],
    nivelBoost: 0,
    bot: {
      id: "0",
      posicionRolMasAlto: 100,
      esAdministrador: true,
      puedeGestionarRoles: true,
      puedeGestionarCanales: true,
      puedeGestionarServidor: true,
      puedeGestionarExpresiones: true,
    },
  };
}

async function main() {
  // Vista previa sin red: no hace falta ni token ni servidor.
  if (bandera("vista-previa")) {
    const plantilla = cargarPlantilla();
    mostrarPlan(planificar(plantilla, servidorImaginario(), "fusionar"), plantilla);
    console.log("\n(--vista-previa: sobre un servidor vacío imaginario, no se tocó Discord)\n");
    return;
  }

  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) salir("Falta DISCORD_BOT_TOKEN. Copiá .env.example a .env y rellenalo.");

  const guildId = argumento("guild");
  if (!guildId) salir("Falta --guild <id del servidor>. Activá el modo desarrollador en Discord para copiarlo.");

  const modo = (argumento("modo") ?? "fusionar") as Modo;
  if (!MODOS.includes(modo)) salir(`Modo desconocido "${modo}". Opciones: ${MODOS.join(", ")}`);

  const plantilla = cargarPlantilla();
  const rest = crearRest(token);

  console.log("Leyendo el estado del servidor…");
  const estado = await leerEstado(rest, guildId);
  console.log(`Servidor: ${estado.nombre} (${estado.canales.length} canales, ${estado.roles.length} roles)`);

  const plan = planificar(plantilla, estado, modo);
  mostrarPlan(plan, plantilla);

  if (planTieneErrores(plan)) salir("El plan tiene errores que hay que resolver antes de aplicar.");

  if (bandera("seco")) {
    console.log("\n(--seco: no se aplicó nada)\n");
    return;
  }

  if (modo === "limpiar" && !bandera("si-borrar-todo")) {
    salir('El modo "limpiar" borra canales y roles. Añadí --si-borrar-todo para confirmar.');
  }

  console.log("\nAplicando…\n");
  let fallos = 0;
  for await (const evento of aplicar(plan, rest, guildId)) {
    switch (evento.tipo) {
      case "paso":
        console.log(`  [${String(evento.indice).padStart(3)}/${evento.total}] ${evento.descripcion}`);
        break;
      case "aviso":
        console.log(`  ⚠  ${evento.mensaje}`);
        break;
      case "error":
        console.log(`  ✖  ${evento.mensaje}`);
        break;
      case "fin":
        fallos = evento.fallos;
        break;
    }
  }

  console.log(
    fallos === 0
      ? "\n✅ Listo, sin errores.\n"
      : `\n⚠️  Terminado con ${fallos} ${fallos === 1 ? "fallo" : "fallos"}. Mirá los mensajes de arriba.\n`,
  );
}

main().catch((error: unknown) => {
  if (error instanceof ErrorAplicacion) {
    console.error(`\n✖ ${error.message}`);
    if (error.solucion) console.error(`  → ${error.solucion}\n`);
    process.exit(1);
  }
  throw error;
});
