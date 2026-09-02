"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Tres formas de empezar una plantilla. Se separa en cliente porque las tres
 * acaban en la misma llamada y en la misma redirección al editor.
 */
export function CrearPlantilla({ galeria }: { galeria: { clave: string; nombre: string; emoji?: string }[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const archivoRef = useRef<HTMLInputElement>(null);

  async function crear(cuerpo: unknown) {
    setCreando(true);
    setError(null);
    try {
      const res = await fetch("/api/plantillas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      });
      const datos = await res.json();
      if (res.ok) router.push(`/plantillas/${datos.id}`);
      else setError([datos.error, ...(datos.detalles ?? [])].join(" "));
    } catch {
      setError("No se pudo crear: falló la conexión.");
    } finally {
      setCreando(false);
    }
  }

  async function subirArchivo(archivo: File) {
    try {
      const json = JSON.parse(await archivo.text());
      await crear({ json });
    } catch {
      setError("Ese archivo no contiene JSON válido.");
    }
  }

  return (
    <div className="rounded-xl border border-[--color-borde] bg-[--color-panel] p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-[--color-tenue]">Crear una plantilla</h2>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={creando}
          onClick={() => void crear({})}
          className="rounded-lg bg-[--color-marca] px-4 py-2 text-sm font-medium transition hover:bg-[--color-marca-claro] disabled:opacity-50"
        >
          Empezar en blanco
        </button>

        <button
          type="button"
          disabled={creando}
          onClick={() => archivoRef.current?.click()}
          className="rounded-lg border border-[--color-borde] px-4 py-2 text-sm transition hover:bg-[--color-panel-alto] disabled:opacity-50"
        >
          Subir un JSON
        </button>
        <input
          ref={archivoRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            if (archivo) void subirArchivo(archivo);
            e.target.value = "";
          }}
        />
      </div>

      <p className="mt-5 text-xs text-[--color-tenue]">O partí de una de la galería y retocala:</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {galeria.map((g) => (
          <button
            key={g.clave}
            type="button"
            disabled={creando}
            onClick={() => void crear({ galeria: g.clave })}
            className="rounded-lg border border-[--color-borde] px-3 py-1.5 text-xs transition hover:border-[--color-marca] disabled:opacity-50"
          >
            {g.emoji} {g.nombre}
          </button>
        ))}
      </div>

      {error && <p className="mt-4 text-xs text-[--color-error]">{error}</p>}
    </div>
  );
}
