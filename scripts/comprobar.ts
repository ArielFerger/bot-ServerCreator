/**
 * Comprueba que la configuración de Discord esté bien antes de perder tiempo.
 *
 *   npm run comprobar
 *
 * Diagnostica cada cosa por separado y dice qué arreglar.
 */
import { MARCA } from "@aribuilder/core";

const OK = "✓";
const MAL = "✖";
const AVISO = "⚠";

let problemas = 0;

function fallo(que: string, comoArreglarlo: string) {
  problemas++;
  console.log(`  ${MAL} ${que}`);
  console.log(`     → ${comoArreglarlo}`);
}

const bien = (que: string, detalle = "") => console.log(`  ${OK} ${que}${detalle ? `  ${detalle}` : ""}`);

/** Algo que conviene mirar pero que no impide arrancar. */
function aviso(que: string, comoArreglarlo: string) {
  console.log(`  ${AVISO} ${que}`);
  console.log(`     → ${comoArreglarlo}`);
}

const PORTAL = "https://discord.com/developers/applications";

async function main() {
  console.log("\nComprobando la configuración…\n");

  const token = process.env.DISCORD_BOT_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const authSecret = process.env.AUTH_SECRET;

  // ── Variables presentes ───────────────────────────────────────────────
  if (!authSecret) {
    fallo("Falta AUTH_SECRET", "Generalo con `npx auth secret` o `openssl rand -base64 32` y ponelo en .env");
  } else {
    bien("AUTH_SECRET");
  }

  if (!clientSecret) {
    fallo("Falta DISCORD_CLIENT_SECRET", `Pestaña OAuth2 en ${PORTAL}`);
  } else {
    bien("DISCORD_CLIENT_SECRET");
  }

  if (!clientId) fallo("Falta DISCORD_CLIENT_ID", `Pestaña OAuth2 en ${PORTAL}`);

  if (!process.env.DATABASE_URL) {
    fallo("Falta DATABASE_URL", "Para probar en local vale  DATABASE_URL=\"file:./dev.db\"");
  } else {
    bien("DATABASE_URL", `(${process.env.DATABASE_URL.startsWith("file:") ? "SQLite" : "Postgres"})`);
  }

  if (!token) {
    fallo("Falta DISCORD_BOT_TOKEN", `Pestaña Bot → Reset Token en ${PORTAL}`);
    return resumen();
  }

  // ── El token funciona ─────────────────────────────────────────────────
  const cabeceras = { Authorization: `Bot ${token}` };
  const yo = await fetch("https://discord.com/api/v10/users/@me", { headers: cabeceras });

  if (yo.status === 401) {
    fallo(
      "Discord rechaza el token del bot",
      `Está mal copiado o lo regeneraste. Sacá uno nuevo en la pestaña Bot de ${PORTAL}`,
    );
    return resumen();
  }
  if (!yo.ok) {
    fallo(`Discord respondió ${yo.status} al validar el token`, "Puede ser un problema temporal suyo; probá en un rato");
    return resumen();
  }

  const bot = (await yo.json()) as { id: string; username: string };
  bien("El token del bot funciona", `(es "${bot.username}")`);

  // El bot se renombra solo al arrancar; si no pudo, se ve aquí.
  if (bot.username !== MARCA.nombreBot) {
    aviso(
      `El bot se llama "${bot.username}" y no "${MARCA.nombreBot}"`,
      `Se renombra solo al arrancar, así que suele arreglarse con \`npm run dev\`. Si no, Discord está aplicando su ` +
        `límite de dos cambios de nombre por hora, o el nombre ya está ocupado: podés ponerlo a mano en ${PORTAL} → Bot.`,
    );
  } else {
    bien(`El bot se llama ${MARCA.nombreBot}`);
  }

  // ── El Client ID es el de esta misma aplicación ────────────────────────
  if (clientId && clientId !== bot.id) {
    fallo(
      "DISCORD_CLIENT_ID no es el de este bot",
      `El bot dice que su ID es ${bot.id}. Copiá ese, o revisá que el token y el Client ID sean de la misma aplicación.`,
    );
  } else if (clientId) {
    bien("DISCORD_CLIENT_ID coincide con el bot");
  }

  // ── Dónde está metido ─────────────────────────────────────────────────
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers: cabeceras });
  const servidores = res.ok ? ((await res.json()) as { id: string; name: string }[]) : [];

  if (servidores.length === 0) {
    console.log(`  · El bot todavía no está en ningún servidor.`);
    console.log(`     → Creá un servidor vacío en Discord y después invitalo desde la app.`);
  } else {
    // Discord devuelve 200 como mucho; aquí solo interesa el orden de magnitud.
    const tope = servidores.length >= 200 ? "200 o más" : String(servidores.length);
    bien(`El bot está en ${tope} ${servidores.length === 1 ? "servidor" : "servidores"}`);
    for (const s of servidores.slice(0, 10)) console.log(`       · ${s.name}  (${s.id})`);
    if (servidores.length > 10) console.log(`       … y ${servidores.length - 10} más`);
  }

  // ── Recordatorio del redirect, que no se puede comprobar desde fuera ──
  // La URL sale de AUTH_URL: en una instancia pública no es localhost, y
  // recordar la de localhost sería el consejo equivocado justo cuando importa.
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  console.log("");
  console.log("  Lo único que no puedo comprobar desde aquí:");
  console.log(`     En ${PORTAL} → tu app → OAuth2 → Redirects,`);
  console.log(`     tiene que estar exactamente:  ${base}/api/auth/callback/discord`);

  resumen();
}

function resumen() {
  console.log("");
  if (problemas === 0) {
    console.log("Todo listo. Arrancá con `npm run dev` y entrá en http://localhost:3000\n");
  } else {
    console.log(`Hay ${problemas} ${problemas === 1 ? "cosa" : "cosas"} que arreglar en .env\n`);
    process.exitCode = 1;
  }
}

main().catch((e: unknown) => {
  console.error("\nNo se pudo comprobar:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
