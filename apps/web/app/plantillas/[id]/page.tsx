import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { validarPlantilla } from "@aribuilder/core";
import { EditorPlantilla } from "@/components/editor/EditorPlantilla";

export const dynamic = "force-dynamic";

export default async function EditarPlantilla({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sesion = await auth();
  if (!sesion?.user) redirect("/");

  const guardada = await prisma.template.findFirst({
    where: { id, ownerId: sesion.user.id },
  });
  if (!guardada) notFound();

  const resultado = validarPlantilla(JSON.parse(guardada.json));
  if (!resultado.ok) {
    return (
      <div className="rounded-xl border border-[--color-error] bg-[--color-panel] p-8">
        <h1 className="text-xl font-semibold">Esta plantilla está corrupta</h1>
        <p className="mt-2 text-sm text-[--color-tenue]">
          Se guardó con un formato que ya no entendemos. Estos son los problemas:
        </p>
        <ul className="mt-3 space-y-1 text-xs text-[--color-error]">
          {resultado.errores.slice(0, 10).map((e, i) => (
            <li key={i}>
              · {e.ruta || "(raíz)"}: {e.mensaje}
            </li>
          ))}
        </ul>
        <Link href="/plantillas" className="mt-4 inline-block text-sm underline">
          Volver a mis plantillas
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/plantillas" className="text-xs text-[--color-tenue] hover:text-[--color-texto]">
        ← Mis plantillas
      </Link>
      <div className="mt-3">
        <EditorPlantilla plantillaId={id} inicial={resultado.plantilla} />
      </div>
    </div>
  );
}
