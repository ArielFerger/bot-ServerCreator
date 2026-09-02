"use client";

import { useState } from "react";
import type { Plantilla } from "@aribuilder/core";
import type { Modo, Plan } from "@aribuilder/applier";
import { leerEventos } from "@/lib/sse";
import { VistaPreviaServidor } from "./VistaPreviaServidor";
import { aplicarEvento, progresoInicial, ProgresoAplicacion, type EstadoProgreso } from "./ProgresoAplicacion";

export interface EntradaPlantilla {
  /** De dónde sale: cambia qué campo espera la API. */
  origen: "galeria" | "propia";
  clave: string;
  plantilla: Plantilla;
}

/** El identificador que entienden /api/plan y /api/aplicar. */
const referencia = (e: EntradaPlantilla) =>
  e.origen === "galeria" ? { plantillaGaleria: e.clave } : { plantillaId: e.clave };

const MODOS: { valor: Modo; etiqueta: string; explicacion: string }[] = [
  {
    valor: "fusionar",
    etiqueta: "Añadir lo que falte",
    explicacion: "No toca nada de lo que ya existe. Es la opción segura.",
  },
  {
    valor: "reemplazar",
    etiqueta: "Actualizar lo que coincida",
    explicacion: "Si ya hay un canal o rol con el mismo nombre, lo pone al día.",
  },
  {
    valor: "limpiar",
    etiqueta: "Vaciar el servidor primero",
    explicacion: "Borra todos los canales y roles actuales antes de construir. No se puede deshacer lo borrado.",
  },
];

export function PanelServidor({
  guildId,
  nombreServidor,
  galeria,
  propias,
}: {
  guildId: string;
  nombreServidor: string;
  galeria: EntradaPlantilla[];
  propias: EntradaPlantilla[];
}) {
  const [elegida, setElegida] = useState<EntradaPlantilla>(propias[0] ?? galeria[0]!);
  const [modo, setModo] = useState<Modo>("fusionar");
  const [progreso, setProgreso] = useState<EstadoProgreso>(progresoInicial);
  const [ejecucionId, setEjecucionId] = useState<string | null>(null);
  const [confirmandoLimpiar, setConfirmandoLimpiar] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [cargandoPlan, setCargandoPlan] = useState(false);

  const ocupado = progreso.activo;

  async function verVistaPrevia() {
    setCargandoPlan(true);
    setPlan(null);
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guildId, ...referencia(elegida), modo }),
      });
      const datos = await res.json();
      if (res.ok) setPlan(datos as Plan);
      else
        setProgreso((p) => ({
          ...p,
          mensajes: [...p.mensajes, { nivel: "error", texto: datos.error ?? "No se pudo calcular la vista previa." }],
        }));
    } finally {
      setCargandoPlan(false);
    }
  }

  async function correr(url: string, cuerpo: unknown) {
    setProgreso({ ...progresoInicial, activo: true });
    for await (const evento of leerEventos(url, cuerpo)) {
      if (evento.tipo === "ejecucion") setEjecucionId(evento.id);
      else setProgreso((p) => aplicarEvento(p, evento));
    }
  }

  const aplicarAhora = () => {
    if (modo === "limpiar" && !confirmandoLimpiar) {
      setConfirmandoLimpiar(true);
      return;
    }
    setConfirmandoLimpiar(false);
    setPlan(null);
    void correr("/api/aplicar", { guildId, ...referencia(elegida), modo });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-6">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[--color-tenue]">1 · Elegí una plantilla</h2>

          {propias.length > 0 && (
            <>
              <p className="mt-3 text-xs text-[--color-tenue]">Tuyas</p>
              <Tarjetas
                entradas={propias}
                elegida={elegida}
                ocupado={ocupado}
                onElegir={(e) => {
                  setElegida(e);
                  setPlan(null);
                }}
              />
              <p className="mt-4 text-xs text-[--color-tenue]">De la galería</p>
            </>
          )}

          <Tarjetas
            entradas={galeria}
            elegida={elegida}
            ocupado={ocupado}
            onElegir={(e) => {
              setElegida(e);
              setPlan(null);
            }}
          />

          <p className="mt-3 text-xs text-[--color-tenue]">
            ¿Querés una a medida?{" "}
            <a href="/plantillas" className="underline hover:text-[--color-texto]">
              Diseñá la tuya en el editor
            </a>
            .
          </p>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[--color-tenue]">
            2 · ¿Qué hacemos con lo que ya hay?
          </h2>
          <div className="mt-3 space-y-2">
            {MODOS.map((m) => (
              <label
                key={m.valor}
                className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${
                  modo === m.valor ? "border-[--color-marca] bg-[--color-panel-alto]" : "border-[--color-borde]"
                }`}
              >
                <input
                  type="radio"
                  name="modo"
                  className="mt-1"
                  checked={modo === m.valor}
                  disabled={ocupado}
                  onChange={() => {
                    setModo(m.valor);
                    setConfirmandoLimpiar(false);
                    setPlan(null);
                  }}
                />
                <span>
                  <span className="block text-sm font-medium">{m.etiqueta}</span>
                  <span className="block text-xs text-[--color-tenue]">{m.explicacion}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[--color-tenue]">3 · Aplicá</h2>

          {plan && <ResumenPlan plan={plan} />}

          {confirmandoLimpiar && (
            <p className="mt-3 rounded-lg border border-[--color-error] bg-[#2a1518] p-3 text-sm">
              Esto va a <strong>borrar todos los canales y roles</strong> de «{nombreServidor}». Los mensajes que haya
              dentro se pierden y eso no se puede deshacer. Volvé a pulsar «Aplicar» si estás seguro.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={verVistaPrevia}
              disabled={ocupado || cargandoPlan}
              className="rounded-lg border border-[--color-borde] px-4 py-2 text-sm font-medium transition hover:bg-[--color-panel-alto] disabled:opacity-50"
            >
              {cargandoPlan ? "Calculando…" : "Ver qué va a pasar"}
            </button>

            <button
              type="button"
              onClick={aplicarAhora}
              disabled={ocupado}
              className={`rounded-lg px-5 py-2 text-sm font-medium transition disabled:opacity-50 ${
                confirmandoLimpiar
                  ? "bg-[--color-error] hover:opacity-90"
                  : "bg-[--color-marca] hover:bg-[--color-marca-claro]"
              }`}
            >
              {confirmandoLimpiar ? "Sí, vaciar y construir" : "Aplicar"}
            </button>

            {progreso.terminado && ejecucionId && (
              <button
                type="button"
                onClick={() => void correr("/api/deshacer", { ejecucionId })}
                className="rounded-lg border border-[--color-borde] px-4 py-2 text-sm font-medium transition hover:bg-[--color-panel-alto]"
              >
                Deshacer
              </button>
            )}
          </div>
        </section>

        {(progreso.activo || progreso.terminado || progreso.mensajes.length > 0) && (
          <ProgresoAplicacion estado={progreso} />
        )}
      </div>

      <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-8rem)]">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[--color-tenue]">Vista previa</p>
        <VistaPreviaServidor plantilla={elegida.plantilla} />
      </aside>
    </div>
  );
}

function ResumenPlan({ plan }: { plan: Plan }) {
  const { resumen } = plan;
  const lineas = [
    [resumen.rolesACrear, "roles"],
    [resumen.categoriasACrear, "categorías"],
    [resumen.canalesACrear, "canales"],
    [resumen.mensajesAPublicar, "mensajes"],
    [resumen.emojisACrear, "emojis"],
  ] as const;

  return (
    <div className="mt-3 rounded-lg border border-[--color-borde] bg-[--color-panel] p-4 text-sm">
      <p className="font-medium">Se van a crear:</p>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[--color-tenue]">
        {lineas
          .filter(([n]) => n > 0)
          .map(([n, que]) => (
            <li key={que}>
              <strong className="text-[--color-texto]">{n}</strong> {que}
            </li>
          ))}
      </ul>

      {resumen.aBorrar > 0 && (
        <p className="mt-2 text-[--color-error]">Y se van a borrar {resumen.aBorrar} cosas que ya existen.</p>
      )}

      {plan.diagnosticos.map((d, i) => (
        <p key={i} className="mt-2" style={{ color: d.nivel === "error" ? "var(--color-error)" : "var(--color-aviso)" }}>
          {d.nivel === "error" ? "✖" : "⚠"} {d.mensaje}
          {d.solucion && <span className="block text-xs opacity-80">→ {d.solucion}</span>}
        </p>
      ))}

      {plan.omisiones.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-[--color-tenue]">
            {plan.omisiones.length} cosas se omiten (ya existían o no caben)
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-[--color-tenue]">
            {plan.omisiones.map((o, i) => (
              <li key={i}>
                · {o.que}: {o.motivo}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Tarjetas({
  entradas,
  elegida,
  ocupado,
  onElegir,
}: {
  entradas: EntradaPlantilla[];
  elegida: EntradaPlantilla;
  ocupado: boolean;
  onElegir: (e: EntradaPlantilla) => void;
}) {
  return (
    <div className="mt-2 grid gap-2 sm:grid-cols-2">
      {entradas.map((entrada) => {
        const activa = entrada.origen === elegida.origen && entrada.clave === elegida.clave;
        return (
          <button
            key={`${entrada.origen}:${entrada.clave}`}
            type="button"
            disabled={ocupado}
            onClick={() => onElegir(entrada)}
            className={`rounded-xl border p-4 text-left transition disabled:opacity-50 ${
              activa
                ? "border-[--color-marca] bg-[--color-panel-alto]"
                : "border-[--color-borde] bg-[--color-panel] hover:border-[--color-marca-claro]"
            }`}
          >
            <p className="font-medium">
              {entrada.plantilla.meta.emoji} {entrada.plantilla.meta.nombre}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-[--color-tenue]">
              {entrada.plantilla.meta.descripcion || "Sin descripción"}
            </p>
          </button>
        );
      })}
    </div>
  );
}
