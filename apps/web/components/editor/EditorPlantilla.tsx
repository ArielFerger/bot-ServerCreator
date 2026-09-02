"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CLAVE_EVERYONE, type Plantilla } from "@aribuilder/core";
import { erroresDe, estadoInicial, reducirEditor, type AccionEditor } from "@/lib/editor";
import { VistaPreviaServidor } from "../VistaPreviaServidor";
import { ArbolEstructura } from "./ArbolEstructura";
import { PanelPropiedades } from "./PanelPropiedades";

type Pestana = "estructura" | "roles";

export function EditorPlantilla({
  plantillaId,
  inicial,
}: {
  plantillaId: string;
  inicial: Plantilla;
}) {
  const router = useRouter();
  const [estado, despachar] = useReducer(reducirEditor, inicial, estadoInicial);
  const [pestana, setPestana] = useState<Pestana>("estructura");
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const errores = erroresDe(estado.plantilla);
  const sucioRef = useRef(estado.sucio);
  sucioRef.current = estado.sucio;

  const guardar = useCallback(async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const res = await fetch(`/api/plantillas/${plantillaId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantilla: estado.plantilla }),
      });
      const datos = await res.json();
      if (res.ok) {
        despachar({ tipo: "marcar-guardado" });
        setMensaje("Guardado");
        router.refresh();
      } else {
        setMensaje(datos.error ?? "No se pudo guardar.");
      }
    } catch {
      setMensaje("No se pudo guardar: falló la conexión.");
    } finally {
      setGuardando(false);
    }
  }, [estado.plantilla, plantillaId, router]);

  // Atajos: Ctrl+S guarda, Ctrl+Z deshace, Ctrl+Shift+Z rehace.
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tecla = e.key.toLowerCase();
      if (tecla === "s") {
        e.preventDefault();
        void guardar();
      } else if (tecla === "z") {
        // Dentro de un campo de texto, Ctrl+Z es del campo, no del editor.
        const activo = document.activeElement?.tagName;
        if (activo === "INPUT" || activo === "TEXTAREA") return;
        e.preventDefault();
        despachar({ tipo: e.shiftKey ? "rehacer" : "deshacer" });
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [guardar]);

  // Avisar antes de cerrar la pestaña con cambios sin guardar.
  useEffect(() => {
    const alSalir = (e: BeforeUnloadEvent) => {
      if (sucioRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", alSalir);
    return () => window.removeEventListener("beforeunload", alSalir);
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 3000);
    return () => clearTimeout(t);
  }, [mensaje]);

  const accion = (a: AccionEditor) => despachar(a);

  return (
    <div className="space-y-4">
      <BarraSuperior
        plantilla={estado.plantilla}
        sucio={estado.sucio}
        guardando={guardando}
        mensaje={mensaje}
        puedeDeshacer={estado.pasado.length > 0}
        puedeRehacer={estado.futuro.length > 0}
        errores={errores.length}
        onGuardar={guardar}
        onDespachar={accion}
      />

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <section className="rounded-xl border border-[--color-borde] bg-[--color-panel] p-3">
          <div className="mb-3 flex gap-1 rounded-lg bg-[--color-fondo] p-1">
            {(["estructura", "roles"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPestana(p)}
                className={`flex-1 rounded px-3 py-1.5 text-xs font-medium capitalize transition ${
                  pestana === p ? "bg-[--color-panel-alto]" : "text-[--color-tenue] hover:text-[--color-texto]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          {pestana === "estructura" ? (
            <ArbolEstructura plantilla={estado.plantilla} seleccion={estado.seleccion} despachar={accion} />
          ) : (
            <ListaRoles plantilla={estado.plantilla} seleccion={estado.seleccion} despachar={accion} />
          )}
        </section>

        <section className="min-w-0">
          <PanelPropiedades plantilla={estado.plantilla} seleccion={estado.seleccion} despachar={accion} />

          {errores.length > 0 && (
            <div className="mt-4 rounded-xl border border-[--color-error] bg-[--color-error]/10 p-4">
              <p className="text-sm font-medium text-[--color-error]">
                Hay {errores.length} {errores.length === 1 ? "problema" : "problemas"} que arreglar antes de aplicar:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[--color-error]">
                {errores.slice(0, 8).map((e, i) => (
                  <li key={i}>· {e.mensaje}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-4 lg:h-[calc(100vh-10rem)]">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[--color-tenue]">
            Así se va a ver en Discord
          </p>
          <VistaPreviaServidor plantilla={estado.plantilla} />
        </aside>
      </div>
    </div>
  );
}

function BarraSuperior({
  plantilla,
  sucio,
  guardando,
  mensaje,
  puedeDeshacer,
  puedeRehacer,
  errores,
  onGuardar,
  onDespachar,
}: {
  plantilla: Plantilla;
  sucio: boolean;
  guardando: boolean;
  mensaje: string | null;
  puedeDeshacer: boolean;
  puedeRehacer: boolean;
  errores: number;
  onGuardar: () => void;
  onDespachar: (a: AccionEditor) => void;
}) {
  function descargar() {
    const blob = new Blob([JSON.stringify(plantilla, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${plantilla.meta.nombre.toLowerCase().replace(/\s+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[--color-borde] bg-[--color-panel] px-4 py-3">
      <button
        type="button"
        onClick={() => onDespachar({ tipo: "seleccionar", seleccion: { tipo: "meta" } })}
        className="mr-auto text-left"
      >
        <span className="font-medium">
          {plantilla.meta.emoji} {plantilla.meta.nombre}
        </span>
        <span className="ml-2 text-xs text-[--color-tenue]">{sucio ? "· sin guardar" : ""}</span>
      </button>

      <BotonBarra onClick={() => onDespachar({ tipo: "deshacer" })} disabled={!puedeDeshacer} titulo="Deshacer (Ctrl+Z)">
        ↶
      </BotonBarra>
      <BotonBarra onClick={() => onDespachar({ tipo: "rehacer" })} disabled={!puedeRehacer} titulo="Rehacer (Ctrl+Shift+Z)">
        ↷
      </BotonBarra>
      <BotonBarra onClick={() => onDespachar({ tipo: "seleccionar", seleccion: { tipo: "ajustes" } })}>
        Ajustes
      </BotonBarra>
      <BotonBarra onClick={descargar}>Descargar JSON</BotonBarra>

      {mensaje && <span className="text-xs text-[--color-tenue]">{mensaje}</span>}

      <button
        type="button"
        onClick={onGuardar}
        disabled={guardando || errores > 0}
        title={errores > 0 ? "Arreglá los problemas antes de guardar" : undefined}
        className="rounded-lg bg-[--color-marca] px-4 py-1.5 text-sm font-medium transition hover:bg-[--color-marca-claro] disabled:opacity-40"
      >
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </div>
  );
}

function BotonBarra({
  onClick,
  disabled,
  titulo,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  titulo?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      className="rounded-lg border border-[--color-borde] px-3 py-1.5 text-xs transition hover:bg-[--color-panel-alto] disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function ListaRoles({
  plantilla,
  seleccion,
  despachar,
}: {
  plantilla: Plantilla;
  seleccion: { tipo: string; clave?: string } | null;
  despachar: (a: AccionEditor) => void;
}) {
  const tieneEveryone = plantilla.roles.some((r) => r.clave === CLAVE_EVERYONE);

  return (
    <div className="space-y-1">
      {plantilla.roles.length === 0 && (
        <p className="px-2 py-4 text-xs text-[--color-tenue]">
          Sin roles. Creá uno para poder restringir canales a cierta gente.
        </p>
      )}

      {plantilla.roles.map((rol) => {
        const activo = seleccion?.tipo === "rol" && seleccion.clave === rol.clave;
        return (
          <button
            key={rol.clave}
            type="button"
            onClick={() => despachar({ tipo: "seleccionar", seleccion: { tipo: "rol", clave: rol.clave } })}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm transition ${
              activo ? "bg-[--color-marca]/20" : "hover:bg-[--color-panel-alto]"
            }`}
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full border"
              style={{ background: rol.color ?? "transparent", borderColor: rol.color ?? "var(--color-borde)" }}
            />
            <span className="truncate">{rol.nombre}</span>
            {rol.permisos.includes("administrador") && <span className="ml-auto shrink-0 text-xs">👑</span>}
          </button>
        );
      })}

      <div className="flex flex-col gap-2 pt-3">
        <button
          type="button"
          onClick={() => despachar({ tipo: "anadir-rol" })}
          className="rounded-lg border border-dashed border-[--color-borde] px-3 py-1.5 text-xs text-[--color-tenue] transition hover:border-[--color-marca] hover:text-[--color-texto]"
        >
          + Rol
        </button>
        {!tieneEveryone && (
          <p className="px-1 text-[11px] leading-relaxed text-[--color-tenue]">
            Consejo: los permisos que tiene todo el mundo por defecto se ajustan desde el rol @everyone. Se puede añadir
            desde una plantilla de la galería.
          </p>
        )}
      </div>
    </div>
  );
}
