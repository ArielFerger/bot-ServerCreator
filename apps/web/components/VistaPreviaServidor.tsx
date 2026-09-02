"use client";

import { CLAVE_EVERYONE, describirAcceso, leerAcceso, type Plantilla, type TipoCanal } from "@aribuilder/core";

const ICONO: Record<TipoCanal, string> = {
  texto: "#",
  voz: "🔊",
  anuncios: "📢",
  foro: "💬",
  escenario: "🎙",
};

/**
 * Imita la barra lateral de Discord. Es lo que convierte una plantilla en algo
 * que alguien sin conocimientos puede juzgar de un vistazo: si acá se ve un
 * candado donde no toca, se arregla antes de aplicar y no después.
 */
export function VistaPreviaServidor({ plantilla }: { plantilla: Plantilla }) {
  const nombreDeRol = (clave: string) =>
    clave === CLAVE_EVERYONE ? "todos" : (plantilla.roles.find((r) => r.clave === clave)?.nombre ?? clave);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[--color-borde] bg-[#1e2129]">
      <div className="border-b border-[--color-borde] px-4 py-3 text-sm font-semibold">
        {plantilla.meta.emoji} {plantilla.meta.nombre}
      </div>

      <div className="scroll-fino flex-1 overflow-y-auto px-2 py-3">
        {plantilla.canalesSueltos.map((canal) => (
          <FilaCanal key={canal.clave} canal={canal} nombreDeRol={nombreDeRol} />
        ))}

        {plantilla.categorias.map((cat) => {
          const acceso = leerAcceso(cat.permisos);
          const restringida = acceso.quienVe.tipo === "roles";
          return (
            <div key={cat.clave} className="mt-4 first:mt-0">
              <p className="flex items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wide text-[--color-tenue]">
                {cat.nombre}
                {restringida && <span title={describirAcceso(acceso, nombreDeRol)}>🔒</span>}
              </p>
              {cat.canales.map((canal) => (
                <FilaCanal key={canal.clave} canal={canal} nombreDeRol={nombreDeRol} />
              ))}
            </div>
          );
        })}
      </div>

      {plantilla.roles.length > 0 && (
        <div className="border-t border-[--color-borde] px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[--color-tenue]">Roles</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {plantilla.roles
              .filter((r) => r.clave !== CLAVE_EVERYONE)
              .map((rol) => (
                <span
                  key={rol.clave}
                  className="rounded-full border px-2 py-0.5 text-xs"
                  style={{
                    borderColor: rol.color ?? "var(--color-borde)",
                    color: rol.color ?? "var(--color-tenue)",
                  }}
                >
                  {rol.nombre}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FilaCanal({
  canal,
  nombreDeRol,
}: {
  canal: Plantilla["canalesSueltos"][number];
  nombreDeRol: (clave: string) => string;
}) {
  const acceso = leerAcceso(canal.permisos, canal.tipo);
  const oculto = acceso.quienVe.tipo === "roles";
  const mudo = acceso.quienEscribe.tipo !== "todos";

  return (
    <div
      className="flex items-center gap-1.5 rounded px-2 py-1 text-sm text-[--color-tenue] hover:bg-[--color-panel-alto]"
      title={describirAcceso(acceso, nombreDeRol)}
    >
      <span className="w-4 shrink-0 text-center opacity-70">{ICONO[canal.tipo]}</span>
      <span className="truncate">{canal.nombre}</span>
      {oculto && <span className="shrink-0 text-xs opacity-60">🔒</span>}
      {!oculto && mudo && <span className="shrink-0 text-xs opacity-60">📖</span>}
      {canal.panelRoles && <span className="shrink-0 text-xs opacity-60">🎭</span>}
    </div>
  );
}
