import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MARCA } from "@aribuilder/core";
import { auth, signIn } from "@/auth";
import { enlaceInvitacion } from "@/lib/discord";
import { puedeUsarDemo } from "@/lib/demo";

const PASOS = [
  {
    numero: "1",
    titulo: "Creá un servidor vacío en Discord",
    texto: "El botón «+» de la izquierda en Discord. Discord no deja que un bot cree servidores por vos, así que este paso lo hacés tú. Tarda diez segundos.",
  },
  {
    numero: "2",
    titulo: `Invitá a ${MARCA.nombreBot}`,
    texto: `Te damos un enlace con tu servidor ya elegido y los permisos justos. Un clic y listo. No hace falta que crees ningún bot ni que toques nada de programación: ${MARCA.nombreBot} ya está funcionando, solo tenés que dejarlo entrar.`,
  },
  {
    numero: "3",
    titulo: "Elegí una plantilla y aplicala",
    texto: `Mirás antes lo que va a pasar, apretás «Aplicar» y ${MARCA.nombreBot} construye categorías, canales, roles y permisos. Si no te gusta, «Deshacer» lo quita todo.`,
  },
];

export default async function Inicio() {
  const sesion = await auth();
  if (sesion?.user) redirect("/servidores");

  // Sin credenciales de Discord no se puede iniciar sesión, así que en local se
  // ofrece la puerta de demostración para poder ver el editor igualmente.
  const faltanCredenciales = !process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET;
  const hayDemo = puedeUsarDemo(process.env.NODE_ENV, (await headers()).get("host")).permitido;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-4xl font-bold tracking-tight">
        Tu servidor de Discord, montado en un minuto
      </h1>
      <p className="mt-4 text-lg text-[--color-tenue]">
        Elegí una plantilla o diseñá la tuya arrastrando canales. Nosotros nos ocupamos de los permisos,
        que es la parte que nadie entiende.
      </p>

      <form
        className="mt-8"
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/servidores" });
        }}
      >
        <button
          type="submit"
          className="rounded-lg bg-[--color-marca] px-6 py-3 font-medium transition hover:bg-[--color-marca-claro]"
        >
          Entrar con Discord
        </button>
      </form>
      <p className="mt-3 text-xs text-[--color-tenue]">
        Solo pedimos ver tu nombre y la lista de tus servidores. No podemos escribir nada en tu nombre.
      </p>

      {/* Sin Client ID el enlace de invitación saldría roto: mejor no ofrecerlo. */}
      {!faltanCredenciales && (
        <p className="mt-6 text-sm text-[--color-tenue]">
          ¿Preferís añadirlo a tu servidor primero?{" "}
          <a
            className="underline underline-offset-4 hover:text-[--color-texto]"
            href={enlaceInvitacion()}
            target="_blank"
            rel="noreferrer"
          >
            Invitar a {MARCA.nombreBot} a un servidor
          </a>
          .
        </p>
      )}

      {hayDemo && (
        <div className="mt-6 rounded-xl border border-dashed border-[--color-borde] bg-[--color-panel] p-4">
          <p className="text-sm font-medium">
            {faltanCredenciales ? "Todavía no configuraste Discord" : "Modo desarrollo"}
          </p>
          <p className="mt-1 text-xs text-[--color-tenue]">
            {faltanCredenciales
              ? "Podés entrar igualmente para probar el editor visual. Para listar tus servidores y aplicar plantillas sí hacen falta las credenciales (mirá el README)."
              : "Atajo para entrar sin pasar por Discord. Solo aparece en local."}
          </p>
          <a
            href="/api/demo"
            className="mt-3 inline-block rounded-lg border border-[--color-borde] px-4 py-2 text-sm transition hover:bg-[--color-panel-alto]"
          >
            Entrar en modo demostración
          </a>
        </div>
      )}

      <ol className="mt-14 space-y-6">
        {PASOS.map((paso) => (
          <li key={paso.numero} className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[--color-panel-alto] text-sm font-semibold">
              {paso.numero}
            </span>
            <div>
              <h2 className="font-medium">{paso.titulo}</h2>
              <p className="mt-1 text-sm text-[--color-tenue]">{paso.texto}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
