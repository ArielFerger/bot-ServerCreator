import {
  Client,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Interaction,
} from "discord.js";
import { PrismaClient } from "@prisma/client";
import { decidir, rolDelBoton, type ContextoAutorol } from "./autorol";
import { atenderComandoPlantilla } from "./comandos";
import {
  asegurarApodoEn,
  asegurarNombreEnTodos,
  asegurarNombreGlobal,
  INTERVALO_REVISION_MS,
} from "./identidad";

const prisma = new PrismaClient();

/**
 * El bot de gateway.
 *
 * Solo hace lo que exige estar conectado: atender los botones de auto-rol y el
 * comando /plantilla. Aplicar plantillas es cosa de la web, que lo hace por REST
 * sin necesitar conexión permanente.
 */
const client = new Client({
  // Sin intents privilegiados: no leemos mensajes ni la lista de miembros.
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot conectado como ${c.user.tag} en ${c.guilds.cache.size} servidores.`);

  // El nombre se impone al arrancar y se repasa cada pocas horas: un admin
  // puede renombrar al bot en su servidor en cualquier momento.
  await asegurarNombreGlobal(c);
  await asegurarNombreEnTodos(c);
  const revision = setInterval(() => void asegurarNombreEnTodos(c), INTERVALO_REVISION_MS);
  // Que un temporizador no mantenga el proceso vivo al cerrar.
  revision.unref();
});

// Servidor nuevo: llegar ya llamándose AriBuilder, sin esperar a la revisión.
client.on(Events.GuildCreate, async (guild) => {
  console.log(`➕ Me añadieron a «${guild.name}» (${guild.id}).`);
  if (client.isReady()) await asegurarApodoEn(guild, client.user.username);
});

client.on(Events.InteractionCreate, async (interaccion: Interaction) => {
  try {
    if (interaccion.isButton()) await atenderBoton(interaccion);
    else if (interaccion.isChatInputCommand()) await atenderComandoPlantilla(interaccion);
  } catch (error) {
    console.error("Fallo atendiendo una interacción:", error);
    if (interaccion.isRepliable() && !interaccion.replied && !interaccion.deferred) {
      await interaccion
        .reply({ content: "Algo salió mal. Probá otra vez en un momento.", flags: MessageFlags.Ephemeral })
        .catch(() => undefined);
    }
  }
});

async function atenderBoton(interaccion: ButtonInteraction) {
  const rolId = rolDelBoton(interaccion.customId);
  if (rolId === null) return; // no es un botón nuestro

  if (!interaccion.inCachedGuild()) return;

  const panel = await prisma.autoRolePanel.findUnique({
    where: { messageId: interaccion.message.id },
    select: { roles: true },
  });

  const rol = interaccion.guild.roles.cache.get(rolId) ?? (await interaccion.guild.roles.fetch(rolId).catch(() => null));
  const yo = interaccion.guild.members.me;

  // El panel además tiene que ofrecer ESE rol: un botón viejo de otro panel no vale.
  const ofrecidos = panel ? (JSON.parse(panel.roles) as { id: string }[]).map((r) => r.id) : [];

  const ctx: ContextoAutorol = {
    panelConocido: panel !== null && ofrecidos.includes(rolId),
    rolExiste: rol !== null,
    rolEsGestionado: rol?.managed ?? false,
    permisosDelRol: rol?.permissions.bitfield ?? 0n,
    posicionDelRol: rol?.position ?? Number.MAX_SAFE_INTEGER,
    posicionDelBot: yo?.roles.highest.position ?? 0,
    botPuedeGestionarRoles: yo?.permissions.has(PermissionFlagsBits.ManageRoles) ?? false,
    yaLoTiene: interaccion.member.roles.cache.has(rolId),
  };

  const veredicto = decidir(ctx);

  if (veredicto.accion === "rechazar") {
    await interaccion.reply({ content: `⚠️ ${veredicto.motivo}`, flags: MessageFlags.Ephemeral });
    return;
  }

  try {
    if (veredicto.accion === "dar") {
      await interaccion.member.roles.add(rolId, "Panel de auto-roles");
      await interaccion.reply({ content: `✅ Te di el rol **${rol!.name}**.`, flags: MessageFlags.Ephemeral });
    } else {
      await interaccion.member.roles.remove(rolId, "Panel de auto-roles");
      await interaccion.reply({ content: `✅ Te quité el rol **${rol!.name}**.`, flags: MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error("No se pudo cambiar el rol:", error);
    await interaccion.reply({
      content: "⚠️ Discord no me dejó cambiarte el rol. Avisá al staff.",
      flags: MessageFlags.Ephemeral,
    });
  }
}

const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error("✖ Falta DISCORD_BOT_TOKEN. Copiá .env.example a .env y rellenalo.");
  process.exit(1);
}

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => {
    console.log("\nCerrando…");
    void client.destroy().then(() => prisma.$disconnect());
  });
}

await client.login(token);
