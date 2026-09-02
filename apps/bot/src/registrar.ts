/**
 * Registra los comandos de barra en Discord.
 *
 *   npm run registrar -w @aribuilder/bot            (global, tarda hasta una hora)
 *   npm run registrar -w @aribuilder/bot -- <guild> (en un servidor, al instante)
 */
import { REST, Routes } from "discord.js";
import { comandoPlantilla } from "./comandos";

const token = process.env.DISCORD_BOT_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;

if (!token || !clientId) {
  console.error("✖ Faltan DISCORD_BOT_TOKEN y DISCORD_CLIENT_ID en el entorno.");
  process.exit(1);
}

const guildId = process.argv[2];
const rest = new REST({ version: "10" }).setToken(token);
const cuerpo = [comandoPlantilla.toJSON()];

await rest.put(
  guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId),
  { body: cuerpo },
);

console.log(
  guildId
    ? `✅ Comandos registrados en el servidor ${guildId}. Disponibles al instante.`
    : "✅ Comandos registrados globalmente. Discord puede tardar hasta una hora en propagarlos.",
);
