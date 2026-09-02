import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listarGaleria } from "@aribuilder/core/galeria";
import { CrearPlantilla } from "@/components/editor/CrearPlantilla";
import { BorrarPlantilla } from "@/components/editor/BorrarPlantilla";

export const dynamic = "force-dynamic";

const ETIQUETA_ORIGEN: Record<string, string> = {
  galeria: "copiada de la galería",
  importada: "importada",
  ia: "generada con IA",
  editor: "creada a mano",
};

export default async function MisPlantillas() {
  const sesion = await auth();
  if (!sesion?.user) redirect("/");

  const plantillas = await prisma.template.findMany({
    where: { ownerId: sesion.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true, nombre: true, descripcion: true, emoji: true, origen: true, updatedAt: true },
  });

  const galeria = listarGaleria().map(({ clave, plantilla }) => ({
    clave,
    nombre: plantilla.meta.nombre,
    emoji: plantilla.meta.emoji,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Mis plantillas</h1>
        <p className="mt-2 text-sm text-[--color-tenue]">
          Diseñá la estructura de un servidor arrastrando canales. Después la aplicás a cualquier servidor tuyo.
        </p>
      </div>

      <CrearPlantilla galeria={galeria} />

      {plantillas.length > 0 && (
        <ul className="space-y-2">
          {plantillas.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-4 rounded-xl border border-[--color-borde] bg-[--color-panel] p-4"
            >
              <span className="text-2xl">{p.emoji ?? "✨"}</span>
              <div className="min-w-0 flex-1">
                <Link href={`/plantillas/${p.id}`} className="font-medium hover:underline">
                  {p.nombre}
                </Link>
                <p className="truncate text-xs text-[--color-tenue]">
                  {p.descripcion || ETIQUETA_ORIGEN[p.origen] || "sin descripción"}
                </p>
              </div>
              <BorrarPlantilla id={p.id} nombre={p.nombre} />
              <Link
                href={`/plantillas/${p.id}`}
                className="rounded-lg border border-[--color-borde] px-3 py-1.5 text-xs transition hover:bg-[--color-panel-alto]"
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
