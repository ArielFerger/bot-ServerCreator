"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useState } from "react";
import { leerAcceso, type Canal, type Plantilla, type TipoCanal } from "@aribuilder/core";
import type { AccionEditor, Seleccion } from "@/lib/editor";

const ICONO: Record<TipoCanal, string> = {
  texto: "#",
  voz: "🔊",
  anuncios: "📢",
  foro: "💬",
  escenario: "🎙",
};

/** Los ids de dnd-kit llevan prefijo para no confundir una categoría con un canal. */
const idCanal = (clave: string) => `canal:${clave}`;
const idCategoria = (clave: string) => `cat:${clave}`;
const SUELTOS = "zona:sueltos";

export function ArbolEstructura({
  plantilla,
  seleccion,
  despachar,
}: {
  plantilla: Plantilla;
  seleccion: Seleccion | null;
  despachar: (accion: AccionEditor) => void;
}) {
  const [arrastrando, setArrastrando] = useState<string | null>(null);

  const sensores = useSensors(
    // Un umbral pequeño evita que un clic para seleccionar se lea como arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  /** Dónde ha caído: en qué categoría y en qué posición. */
  function resolverDestino(overId: string): { categoria: string | null; indice: number } | null {
    if (overId === SUELTOS) return { categoria: null, indice: plantilla.canalesSueltos.length };

    if (overId.startsWith("cat:")) {
      const clave = overId.slice(4);
      const cat = plantilla.categorias.find((c) => c.clave === clave);
      return cat ? { categoria: clave, indice: cat.canales.length } : null;
    }

    if (overId.startsWith("canal:")) {
      const clave = overId.slice(6);
      const sueltoIdx = plantilla.canalesSueltos.findIndex((c) => c.clave === clave);
      if (sueltoIdx !== -1) return { categoria: null, indice: sueltoIdx };
      for (const cat of plantilla.categorias) {
        const i = cat.canales.findIndex((c) => c.clave === clave);
        if (i !== -1) return { categoria: cat.clave, indice: i };
      }
    }
    return null;
  }

  function alSoltar(evento: DragEndEvent) {
    setArrastrando(null);
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Reordenar categorías entre sí.
    if (activeId.startsWith("cat:")) {
      if (!overId.startsWith("cat:")) return;
      const indice = plantilla.categorias.findIndex((c) => c.clave === overId.slice(4));
      if (indice !== -1) despachar({ tipo: "mover-categoria", clave: activeId.slice(4), indice });
      return;
    }

    if (!activeId.startsWith("canal:")) return;
    const destino = resolverDestino(overId);
    if (destino) {
      despachar({
        tipo: "mover-canal",
        clave: activeId.slice(6),
        destinoCategoria: destino.categoria,
        indice: destino.indice,
      });
    }
  }

  const canalArrastrado =
    arrastrando?.startsWith("canal:") &&
    [...plantilla.canalesSueltos, ...plantilla.categorias.flatMap((c) => c.canales)].find(
      (c) => c.clave === arrastrando.slice(6),
    );

  return (
    <DndContext
      sensors={sensores}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragStart={(e: DragStartEvent) => setArrastrando(String(e.active.id))}
      onDragCancel={() => setArrastrando(null)}
      onDragEnd={alSoltar}
    >
      <div className="space-y-1">
        <ZonaSueltos
          canales={plantilla.canalesSueltos}
          plantilla={plantilla}
          seleccion={seleccion}
          despachar={despachar}
        />

        <SortableContext
          items={plantilla.categorias.map((c) => idCategoria(c.clave))}
          strategy={verticalListSortingStrategy}
        >
          {plantilla.categorias.map((cat) => (
            <FilaCategoria
              key={cat.clave}
              categoria={cat}
              plantilla={plantilla}
              seleccion={seleccion}
              despachar={despachar}
            />
          ))}
        </SortableContext>

        <div className="flex gap-2 pt-3">
          <BotonAnadir onClick={() => despachar({ tipo: "anadir-categoria" })}>+ Categoría</BotonAnadir>
          <BotonAnadir onClick={() => despachar({ tipo: "anadir-canal", categoriaClave: null })}>
            + Canal suelto
          </BotonAnadir>
        </div>
      </div>

      <DragOverlay>
        {canalArrastrado && (
          <div className="rounded bg-[--color-panel-alto] px-2 py-1 text-sm shadow-lg">
            {ICONO[canalArrastrado.tipo]} {canalArrastrado.nombre}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function ZonaSueltos({
  canales,
  plantilla,
  seleccion,
  despachar,
}: {
  canales: Canal[];
  plantilla: Plantilla;
  seleccion: Seleccion | null;
  despachar: (a: AccionEditor) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: SUELTOS });
  if (canales.length === 0 && !isOver) return <div ref={setNodeRef} className="h-2" />;

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg py-1 ${isOver ? "bg-[--color-marca]/10 ring-1 ring-[--color-marca]" : ""}`}
    >
      <SortableContext items={canales.map((c) => idCanal(c.clave))} strategy={verticalListSortingStrategy}>
        {canales.map((canal) => (
          <FilaCanal
            key={canal.clave}
            canal={canal}
            plantilla={plantilla}
            seleccion={seleccion}
            despachar={despachar}
          />
        ))}
      </SortableContext>
    </div>
  );
}

function FilaCategoria({
  categoria,
  plantilla,
  seleccion,
  despachar,
}: {
  categoria: Plantilla["categorias"][number];
  plantilla: Plantilla;
  seleccion: Seleccion | null;
  despachar: (a: AccionEditor) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: idCategoria(categoria.clave),
  });
  const { setNodeRef: refSoltar, isOver } = useDroppable({ id: idCategoria(categoria.clave) });

  const activa = seleccion?.tipo === "categoria" && seleccion.clave === categoria.clave;
  const restringida = leerAcceso(categoria.permisos).quienVe.tipo === "roles";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="mt-3 first:mt-0"
    >
      <div
        className={`group flex items-center gap-1 rounded px-1 py-0.5 ${activa ? "bg-[--color-marca]/20" : ""}`}
      >
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab px-1 text-[--color-tenue] opacity-0 transition group-hover:opacity-100"
          aria-label={`Mover la categoría ${categoria.nombre}`}
          type="button"
        >
          ⠿
        </button>
        <button
          type="button"
          onClick={() => despachar({ tipo: "seleccionar", seleccion: { tipo: "categoria", clave: categoria.clave } })}
          className="flex-1 truncate text-left text-[11px] font-semibold uppercase tracking-wide text-[--color-tenue] hover:text-[--color-texto]"
        >
          {categoria.nombre} {restringida && "🔒"}
        </button>
        <button
          type="button"
          onClick={() => despachar({ tipo: "anadir-canal", categoriaClave: categoria.clave })}
          className="px-1 text-[--color-tenue] opacity-0 transition hover:text-[--color-texto] group-hover:opacity-100"
          aria-label={`Añadir canal a ${categoria.nombre}`}
        >
          +
        </button>
      </div>

      <div
        ref={refSoltar}
        className={`min-h-[8px] rounded ${isOver ? "bg-[--color-marca]/10 ring-1 ring-[--color-marca]" : ""}`}
      >
        <SortableContext
          items={categoria.canales.map((c) => idCanal(c.clave))}
          strategy={verticalListSortingStrategy}
        >
          {categoria.canales.map((canal) => (
            <FilaCanal
              key={canal.clave}
              canal={canal}
              plantilla={plantilla}
              seleccion={seleccion}
              despachar={despachar}
            />
          ))}
        </SortableContext>
        {categoria.canales.length === 0 && (
          <p className="px-6 py-1 text-xs italic text-[--color-tenue] opacity-60">Vacía — arrastrá canales aquí</p>
        )}
      </div>
    </div>
  );
}

function FilaCanal({
  canal,
  seleccion,
  despachar,
}: {
  canal: Canal;
  plantilla: Plantilla;
  seleccion: Seleccion | null;
  despachar: (a: AccionEditor) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: idCanal(canal.clave),
  });

  const activo = seleccion?.tipo === "canal" && seleccion.clave === canal.clave;
  const acceso = leerAcceso(canal.permisos, canal.tipo);
  const oculto = acceso.quienVe.tipo === "roles";
  const mudo = acceso.quienEscribe.tipo !== "todos";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`group flex items-center gap-1 rounded px-1 ${activo ? "bg-[--color-marca]/20" : "hover:bg-[--color-panel-alto]"}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab px-1 text-[--color-tenue] opacity-0 transition group-hover:opacity-100"
        aria-label={`Mover el canal ${canal.nombre}`}
        type="button"
      >
        ⠿
      </button>
      <button
        type="button"
        onClick={() => despachar({ tipo: "seleccionar", seleccion: { tipo: "canal", clave: canal.clave } })}
        className="flex flex-1 items-center gap-1.5 overflow-hidden py-1 text-left text-sm text-[--color-tenue] hover:text-[--color-texto]"
      >
        <span className="w-4 shrink-0 text-center opacity-70">{ICONO[canal.tipo]}</span>
        <span className="truncate">{canal.nombre}</span>
        {oculto && <span className="shrink-0 text-xs opacity-60">🔒</span>}
        {!oculto && mudo && <span className="shrink-0 text-xs opacity-60">📖</span>}
        {canal.panelRoles && <span className="shrink-0 text-xs opacity-60">🎭</span>}
      </button>
    </div>
  );
}

function BotonAnadir({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg border border-dashed border-[--color-borde] px-3 py-1.5 text-xs text-[--color-tenue] transition hover:border-[--color-marca] hover:text-[--color-texto]"
    >
      {children}
    </button>
  );
}
