"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BorrarPlantilla({ id, nombre }: { id: string; nombre: string }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [borrando, setBorrando] = useState(false);

  async function borrar() {
    setBorrando(true);
    await fetch(`/api/plantillas/${id}`, { method: "DELETE" });
    router.refresh();
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="text-xs text-[--color-tenue] transition hover:text-[--color-error]"
      >
        Borrar
      </button>
    );
  }

  return (
    <span className="flex items-center gap-2 text-xs">
      <span className="text-[--color-tenue]">¿Borrar «{nombre}»?</span>
      <button type="button" disabled={borrando} onClick={borrar} className="text-[--color-error] hover:underline">
        Sí
      </button>
      <button type="button" onClick={() => setConfirmando(false)} className="text-[--color-tenue] hover:underline">
        No
      </button>
    </span>
  );
}
