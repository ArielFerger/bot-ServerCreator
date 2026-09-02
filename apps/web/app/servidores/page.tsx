import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, tokenDiscordDe } from "@/auth";
import { MARCA } from "@aribuilder/core";
import { enlaceInvitacion, iconoUrl, puedeGestionar, servidoresDelBot, type ServidorDelUsuario } from "@/lib/discord";

export const dynamic = "force-dynamic";

async function servidoresDelUsuario(token: string): Promise<ServidorDelUsuario[]> {
  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as ServidorDelUsuario[];
}

export default async function Servidores() {
  const sesion = await auth();
  if (!sesion?.user) redirect("/");

  const token = await tokenDiscordDe(sesion.user.id);
  if (!token) {
    return (
      <Aviso
        titulo="Tu sesión con Discord caducó"
        texto="Salí y volvé a entrar para que podamos ver tu lista de servidores."
      />
    );
  }

  const todos = await servidoresDelUsuario(token);
  const gestionables = todos.filter(puedeGestionar);
  const conBot = await servidoresDelBot();

  if (gestionables.length === 0) {
    return (
      <Aviso
        titulo="No encontramos servidores tuyos"
        texto="Solo aparecen los servidores donde sos dueño o tenés el permiso «Gestionar servidor». Creá uno vacío en Discord con el botón «+» y volvé a esta página."
      />
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Elegí un servidor</h1>
      <p className="mt-2 text-sm text-[--color-tenue]">
        Estos son los servidores donde podés configurar cosas. Si el tuyo no está, creá uno vacío en Discord y recargá.
      </p>

      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {gestionables.map((servidor) => {
          const dentro = conBot.has(servidor.id);
          const icono = iconoUrl(servidor);
          return (
            <li
              key={servidor.id}
              className="flex items-center gap-4 rounded-xl border border-[--color-borde] bg-[--color-panel] p-4"
            >
              {icono ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={icono} alt="" className="h-12 w-12 rounded-full" />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[--color-panel-alto] text-lg">
                  {servidor.name.slice(0, 2).toUpperCase()}
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{servidor.name}</p>
                <p className="text-xs text-[--color-tenue]">
                  {servidor.owner ? "Sos el dueño" : "Podés gestionarlo"}
                </p>
              </div>

              {dentro ? (
                <Link
                  href={`/servidores/${servidor.id}`}
                  className="shrink-0 rounded-lg bg-[--color-marca] px-4 py-2 text-sm font-medium transition hover:bg-[--color-marca-claro]"
                >
                  Configurar
                </Link>
              ) : (
                <a
                  href={enlaceInvitacion(servidor.id)}
                  className="shrink-0 rounded-lg border border-[--color-borde] px-4 py-2 text-sm font-medium transition hover:bg-[--color-panel-alto]"
                >
                  Invitar a {MARCA.nombreBot}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-[--color-borde] bg-[--color-panel] p-8">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <p className="mt-2 text-sm text-[--color-tenue]">{texto}</p>
    </div>
  );
}
