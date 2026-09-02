import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, tokenDiscordDe } from "@/auth";
import { enlaceInvitacion, puedeGestionar, servidoresDelBot, type ServidorDelUsuario } from "@/lib/discord";
import { MARCA, validarPlantilla } from "@aribuilder/core";
import { listarGaleria } from "@aribuilder/core/galeria";
import { prisma } from "@/lib/prisma";
import { PanelServidor, type EntradaPlantilla } from "@/components/PanelServidor";
import { ImportarServidor } from "@/components/ImportarServidor";

export const dynamic = "force-dynamic";

export default async function ConfigurarServidor({ params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const sesion = await auth();
  if (!sesion?.user) redirect("/");

  const token = await tokenDiscordDe(sesion.user.id);
  if (!token) redirect("/servidores");

  const res = await fetch("https://discord.com/api/v10/users/@me/guilds", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const guilds = res.ok ? ((await res.json()) as ServidorDelUsuario[]) : [];
  const servidor = guilds.find((g) => g.id === guildId);

  if (!servidor || !puedeGestionar(servidor)) {
    return (
      <Mensaje titulo="No podemos configurar ese servidor">
        O no sos miembro, o no tenés el permiso «Gestionar servidor» en él.{" "}
        <Link href="/servidores" className="underline">
          Volver a la lista
        </Link>
        .
      </Mensaje>
    );
  }

  const conBot = await servidoresDelBot();
  if (!conBot.has(guildId)) {
    return (
      <Mensaje titulo={`Falta invitar a ${MARCA.nombreBot} a «${servidor.name}»`}>
        <p>
          {MARCA.nombreBot} es quien construye los canales y roles, así que tiene que estar dentro del servidor. El
          enlace ya lleva tu servidor elegido y los permisos justos.
        </p>
        <a
          href={enlaceInvitacion(guildId)}
          className="mt-4 inline-block rounded-lg bg-[--color-marca] px-5 py-2 text-sm font-medium transition hover:bg-[--color-marca-claro]"
        >
          Invitar a {MARCA.nombreBot} a «{servidor.name}»
        </a>
        <p className="mt-3 text-xs text-[--color-tenue]">
          Cuando termines, volvé a esta página y recargá.
        </p>
      </Mensaje>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <Link href="/servidores" className="text-xs text-[--color-tenue] hover:text-[--color-texto]">
          ← Mis servidores
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{servidor.name}</h1>
        <p className="mt-1 text-sm text-[--color-tenue]">
          Elegí una plantilla, mirá la vista previa y aplicala. Podés deshacerlo después.
        </p>
      </div>

      <PanelServidor
        guildId={guildId}
        nombreServidor={servidor.name}
        galeria={listarGaleria().map(({ clave, plantilla }) => ({ origen: "galeria" as const, clave, plantilla }))}
        propias={await plantillasPropias(sesion.user.id)}
      />

      <div className="mt-10 border-t border-[--color-borde] pt-8">
        <ImportarServidor guildId={guildId} nombre={servidor.name} />
      </div>
    </div>
  );
}

function Mensaje({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[--color-borde] bg-[--color-panel] p-8">
      <h1 className="text-xl font-semibold">{titulo}</h1>
      <div className="mt-2 text-sm text-[--color-tenue]">{children}</div>
    </div>
  );
}

/** Las plantillas del usuario, saltándose en silencio las que ya no validan. */
async function plantillasPropias(userId: string): Promise<EntradaPlantilla[]> {
  const guardadas = await prisma.template.findMany({
    where: { ownerId: userId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, json: true },
  });

  return guardadas.flatMap((g) => {
    const resultado = validarPlantilla(JSON.parse(g.json));
    return resultado.ok ? [{ origen: "propia" as const, clave: g.id, plantilla: resultado.plantilla }] : [];
  });
}
