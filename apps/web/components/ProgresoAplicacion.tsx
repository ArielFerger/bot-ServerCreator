"use client";

import type { Evento } from "@aribuilder/applier";

export interface EstadoProgreso {
  activo: boolean;
  indice: number;
  total: number;
  descripcion: string;
  mensajes: { nivel: "aviso" | "error"; texto: string }[];
  terminado: boolean;
  fallos: number;
}

export const progresoInicial: EstadoProgreso = {
  activo: false,
  indice: 0,
  total: 0,
  descripcion: "",
  mensajes: [],
  terminado: false,
  fallos: 0,
};

/** Reduce un evento del stream al estado que pinta la barra. */
export function aplicarEvento(estado: EstadoProgreso, evento: Evento): EstadoProgreso {
  switch (evento.tipo) {
    case "inicio":
      return { ...progresoInicial, activo: true, total: evento.total };
    case "paso":
      return { ...estado, indice: evento.indice, total: evento.total, descripcion: evento.descripcion };
    case "aviso":
      return { ...estado, mensajes: [...estado.mensajes, { nivel: "aviso", texto: evento.mensaje }] };
    case "error":
      return {
        ...estado,
        activo: false,
        mensajes: [...estado.mensajes, { nivel: "error", texto: evento.mensaje }],
      };
    case "fin":
      return { ...estado, activo: false, terminado: true, fallos: evento.fallos, indice: estado.total };
  }
}

export function ProgresoAplicacion({ estado }: { estado: EstadoProgreso }) {
  const porcentaje = estado.total === 0 ? 0 : Math.round((estado.indice / estado.total) * 100);

  return (
    <div className="rounded-xl border border-[--color-borde] bg-[--color-panel] p-5">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">
          {estado.activo
            ? "Construyendo tu servidor…"
            : estado.terminado
              ? estado.fallos === 0
                ? "✅ Listo"
                : `⚠️ Terminado con ${estado.fallos} ${estado.fallos === 1 ? "fallo" : "fallos"}`
              : "Detenido"}
        </p>
        <span className="text-xs text-[--color-tenue]">
          {estado.indice}/{estado.total}
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[--color-panel-alto]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${porcentaje}%`,
            background: estado.fallos > 0 ? "var(--color-aviso)" : "var(--color-marca)",
          }}
        />
      </div>

      {estado.descripcion && (
        <p className="mt-3 truncate text-xs text-[--color-tenue]">{estado.descripcion}</p>
      )}

      {estado.mensajes.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-[--color-borde] pt-3">
          {estado.mensajes.map((m, i) => (
            <li
              key={i}
              className="text-xs"
              style={{ color: m.nivel === "error" ? "var(--color-error)" : "var(--color-aviso)" }}
            >
              {m.nivel === "error" ? "✖" : "⚠"} {m.texto}
            </li>
          ))}
        </ul>
      )}

      {estado.activo && (
        <p className="mt-3 text-xs text-[--color-tenue]">
          Discord limita la velocidad a la que se pueden crear canales, así que esto puede tardar un par de minutos.
          No cierres la pestaña.
        </p>
      )}
    </div>
  );
}
