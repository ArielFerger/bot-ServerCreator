"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Clonar el servidor actual como plantilla. Enseña lo que no se pudo traer
 * antes de llevar al editor: es información que el usuario necesita para no
 * llevarse una sorpresa al aplicarla en otro sitio.
 */
export function ImportarServidor({ guildId, nombre }: { guildId: string; nombre: string }) {
  const router = useRouter();
  const [estado, setEstado] = useState<"listo" | "importando" | "hecho">("listo");
  const [omisiones, setOmisiones] = useState<{ que: string; motivo: string }[]>([]);
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function importar() {
    setEstado("importando");
    setError(null);
    try {
      const res = await fetch("/api/importar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo importar.");
        setEstado("listo");
        return;
      }
      setId(datos.id);
      setOmisiones(datos.omisiones ?? []);
      setEstado("hecho");
      router.refresh();
    } catch {
      setError("No se pudo importar: falló la conexión.");
      setEstado("listo");
    }
  }

  if (estado === "hecho" && id) {
    return (
      <div className="rounded-xl border border-[--color-exito] bg-[--color-panel] p-5">
        <p className="text-sm font-medium">✅ Servidor guardado como plantilla</p>
        <p className="mt-1 text-xs text-[--color-tenue]">
          Ya podés editarla y aplicarla en otro servidor.
        </p>

        {omisiones.length > 0 && (
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-[--color-aviso]">
              {omisiones.length} {omisiones.length === 1 ? "cosa no se pudo traer" : "cosas no se pudieron traer"}
            </summary>
            <ul className="mt-2 space-y-1 text-xs text-[--color-tenue]">
              {omisiones.map((o, i) => (
                <li key={i}>
                  · {o.que}: {o.motivo}
                </li>
              ))}
            </ul>
          </details>
        )}

        <a
          href={`/plantillas/${id}`}
          className="mt-4 inline-block rounded-lg bg-[--color-marca] px-4 py-2 text-sm font-medium transition hover:bg-[--color-marca-claro]"
        >
          Abrir en el editor
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[--color-borde] bg-[--color-panel] p-5">
      <p className="text-sm font-medium">Clonar este servidor</p>
      <p className="mt-1 text-xs text-[--color-tenue]">
        Guarda la estructura de «{nombre}» (canales, roles y permisos) como plantilla para reutilizarla en otro
        servidor. Los mensajes y los miembros no se copian.
      </p>
      <button
        type="button"
        onClick={importar}
        disabled={estado === "importando"}
        className="mt-3 rounded-lg border border-[--color-borde] px-4 py-2 text-sm transition hover:bg-[--color-panel-alto] disabled:opacity-50"
      >
        {estado === "importando" ? "Leyendo el servidor…" : "Guardar como plantilla"}
      </button>
      {error && <p className="mt-3 text-xs text-[--color-error]">{error}</p>}
    </div>
  );
}
