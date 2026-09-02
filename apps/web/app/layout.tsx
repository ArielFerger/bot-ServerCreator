import type { Metadata } from "next";
import Link from "next/link";
import { MARCA } from "@aribuilder/core";
import { auth, signOut } from "@/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: MARCA.nombreApp,
  description: "Diseñá tu servidor de Discord y construilo con un clic. Sin programar.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const sesion = await auth();

  return (
    <html lang="es">
      <body className="min-h-screen">
        <header className="border-b border-[--color-borde] bg-[--color-panel]">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="text-xl">{MARCA.emoji}</span>
              <span>{MARCA.nombreApp}</span>
            </Link>

            {sesion?.user && (
              <div className="flex items-center gap-4 text-sm">
                <Link href="/servidores" className="text-[--color-tenue] hover:text-[--color-texto]">
                  Mis servidores
                </Link>
                <Link href="/plantillas" className="text-[--color-tenue] hover:text-[--color-texto]">
                  Mis plantillas
                </Link>
                <span className="text-[--color-tenue]">{sesion.user.name}</span>
                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/" });
                  }}
                >
                  <button className="text-[--color-tenue] hover:text-[--color-texto]" type="submit">
                    Salir
                  </button>
                </form>
              </div>
            )}
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>

        <footer className="mx-auto max-w-6xl px-6 pb-10 text-xs text-[--color-tenue]">
          {MARCA.nombreApp} no está afiliado a Discord ni cuenta con su respaldo.
        </footer>
      </body>
    </html>
  );
}
