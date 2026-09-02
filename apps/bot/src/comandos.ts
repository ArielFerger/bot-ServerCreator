import {
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { CLAVES_GALERIA, plantillaDeGaleria, type ClaveGaleria } from "@aribuilder/core/galeria";
import { aplicar, crearRest, leerEstado, planificar, planTieneErrores, type Modo } from "@aribuilder/applier";

/**
 * `/plantilla` — aplicar una plantilla de la galería sin salir de Discord.
 *
 * Es el atajo para quien ya sabe lo que quiere. El editor visual y las
 * plantillas propias siguen viviendo en la web.
 */
export const comandoPlantilla = new SlashCommandBuilder()
  .setName("plantilla")
  .setDescription("Construye la estructura del servidor a partir de una plantilla")
  .addStringOption((o) =>
    o
      .setName("cual")
      .setDescription("Qué plantilla aplicar")
      .setRequired(true)
      .addChoices(
        ...CLAVES_GALERIA.map((clave) => {
          const p = plantillaDeGaleria(clave);
          return { name: `${p.meta.emoji ?? ""} ${p.meta.nombre}`.trim(), value: clave };
        }),
      ),
  )
  .addBooleanOption((o) =>
    o.setName("solo-ver").setDescription("Enseñar qué pasaría sin aplicar nada (por defecto: sí)"),
  )
  // Solo quien puede gestionar el servidor debería poder reestructurarlo.
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .setDMPermission(false);

export async function atenderComandoPlantilla(interaccion: ChatInputCommandInteraction) {
  if (interaccion.commandName !== "plantilla") return;
  if (!interaccion.inCachedGuild()) {
    await interaccion.reply({ content: "Este comando solo funciona dentro de un servidor.", flags: MessageFlags.Ephemeral });
    return;
  }

  const clave = interaccion.options.getString("cual", true) as ClaveGaleria;
  // Por defecto no se aplica nada: hay que pedirlo explícitamente.
  const soloVer = interaccion.options.getBoolean("solo-ver") ?? true;

  await interaccion.deferReply({ flags: MessageFlags.Ephemeral });

  const rest = crearRest(process.env.DISCORD_BOT_TOKEN!);
  const plantilla = plantillaDeGaleria(clave);

  let estado;
  try {
    estado = await leerEstado(rest, interaccion.guildId);
  } catch {
    await interaccion.editReply("No pude leer el servidor. Comprobá que tengo los permisos con los que me invitaste.");
    return;
  }

  const plan = planificar(plantilla, estado, "fusionar" satisfies Modo);
  const r = plan.resumen;

  const resumen = [
    `**${plantilla.meta.emoji ?? ""} ${plantilla.meta.nombre}**`,
    "",
    "Se crearían:",
    `· ${r.rolesACrear} roles`,
    `· ${r.categoriasACrear} categorías`,
    `· ${r.canalesACrear} canales`,
    `· ${r.mensajesAPublicar} mensajes`,
  ];

  if (plan.omisiones.length > 0) {
    resumen.push("", `Se omitirían ${plan.omisiones.length} cosas (ya existen o no caben).`);
  }
  for (const d of plan.diagnosticos) {
    resumen.push("", `${d.nivel === "error" ? "✖" : "⚠"} ${d.mensaje}`);
    if (d.solucion) resumen.push(`→ ${d.solucion}`);
  }

  if (planTieneErrores(plan)) {
    await interaccion.editReply(resumen.join("\n"));
    return;
  }

  if (soloVer) {
    resumen.push("", "Para aplicarlo de verdad, repetí el comando con `solo-ver: False`.");
    await interaccion.editReply(resumen.join("\n"));
    return;
  }

  await interaccion.editReply(`${resumen.join("\n")}\n\nAplicando… esto puede tardar un par de minutos.`);

  let fallos = 0;
  let ultimo = 0;
  for await (const evento of aplicar(plan, rest, interaccion.guildId)) {
    if (evento.tipo === "fin") fallos = evento.fallos;
    // Discord limita las ediciones: se avisa cada 10 pasos, no en cada uno.
    if (evento.tipo === "paso" && evento.indice - ultimo >= 10) {
      ultimo = evento.indice;
      await interaccion
        .editReply(`Construyendo… ${evento.indice}/${evento.total}\n${evento.descripcion}`)
        .catch(() => undefined);
    }
  }

  await interaccion.editReply(
    fallos === 0
      ? "✅ Listo. Mirá la barra lateral: ya está todo creado."
      : `⚠️ Terminado con ${fallos} ${fallos === 1 ? "fallo" : "fallos"}. Revisá los permisos del bot y volvé a intentarlo.`,
  );
}
