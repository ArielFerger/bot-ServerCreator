import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";

/**
 * `identify` para saber quién es y `guilds` para poder listar sus servidores.
 * No pedimos `guilds.join` ni nada que permita actuar en su nombre: todo lo que
 * toca el servidor lo hace el bot con su propio token.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Discord({
      // Hay que pasarlas explícitamente: por convención Auth.js buscaría
      // AUTH_DISCORD_ID / AUTH_DISCORD_SECRET, y aquí se llaman como las nombra
      // el portal de Discord, que es lo que el usuario tiene delante al copiarlas.
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify guilds" } },
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  pages: { signIn: "/" },
});

/** El access token de Discord del usuario, para pedirle su lista de servidores. */
export async function tokenDiscordDe(userId: string): Promise<string | null> {
  const cuenta = await prisma.account.findFirst({
    where: { userId, provider: "discord" },
    select: { access_token: true, expires_at: true },
  });
  if (!cuenta?.access_token) return null;
  if (cuenta.expires_at && cuenta.expires_at * 1000 < Date.now()) return null;
  return cuenta.access_token;
}
