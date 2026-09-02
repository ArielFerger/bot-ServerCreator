"use client";

import {
  CLAVE_EVERYONE,
  construirPermisos,
  leerAcceso,
  type Escritura,
  type Overwrite,
  type Rol,
  type TipoCanal,
  type Visibilidad,
} from "@aribuilder/core";

/**
 * Las dos preguntas que sustituyen a las cuarenta casillas de Discord.
 *
 * El estado actual se lee desde los overwrites y se vuelve a escribir al
 * cambiar, así que esto también funciona sobre plantillas importadas o
 * generadas por IA que nunca pasaron por aquí.
 */
export function SelectorAcceso({
  permisos,
  roles,
  tipo,
  onCambio,
}: {
  permisos: Overwrite[];
  roles: Rol[];
  tipo: TipoCanal;
  onCambio: (permisos: Overwrite[]) => void;
}) {
  const acceso = leerAcceso(permisos, tipo);
  const esVoz = tipo === "voz" || tipo === "escenario";
  const asignables = roles.filter((r) => r.clave !== CLAVE_EVERYONE);

  const actualizar = (quienVe: Visibilidad, quienEscribe: Escritura) =>
    onCambio(construirPermisos({ quienVe, quienEscribe }, tipo));

  const alternar = (lista: string[], clave: string) =>
    lista.includes(clave) ? lista.filter((c) => c !== clave) : [...lista, clave];

  return (
    <div className="space-y-5">
      <Pregunta titulo="¿Quién puede ver este canal?">
        <Opcion activa={acceso.quienVe.tipo === "todos"} onClick={() => actualizar({ tipo: "todos" }, acceso.quienEscribe)}>
          Todo el mundo
        </Opcion>
        <Opcion
          activa={acceso.quienVe.tipo === "roles"}
          onClick={() =>
            actualizar({ tipo: "roles", roles: asignables[0] ? [asignables[0].clave] : [] }, acceso.quienEscribe)
          }
        >
          Solo estos roles
        </Opcion>

        {acceso.quienVe.tipo === "roles" && (
          <Chips
            roles={asignables}
            elegidos={acceso.quienVe.roles}
            vacio="Sin roles elegidos el canal quedará invisible para todos."
            onAlternar={(clave) =>
              actualizar(
                { tipo: "roles", roles: alternar((acceso.quienVe as { roles: string[] }).roles, clave) },
                acceso.quienEscribe,
              )
            }
          />
        )}
      </Pregunta>

      <Pregunta titulo={esVoz ? "¿Quién puede hablar?" : "¿Quién puede escribir?"}>
        <Opcion activa={acceso.quienEscribe.tipo === "todos"} onClick={() => actualizar(acceso.quienVe, { tipo: "todos" })}>
          Todos los que lo ven
        </Opcion>
        <Opcion
          activa={acceso.quienEscribe.tipo === "roles"}
          onClick={() => actualizar(acceso.quienVe, { tipo: "roles", roles: asignables[0] ? [asignables[0].clave] : [] })}
        >
          Solo estos roles
        </Opcion>
        <Opcion activa={acceso.quienEscribe.tipo === "nadie"} onClick={() => actualizar(acceso.quienVe, { tipo: "nadie" })}>
          {esVoz ? "Nadie (solo escuchar)" : "Nadie (solo lectura)"}
        </Opcion>

        {acceso.quienEscribe.tipo === "roles" && (
          <Chips
            roles={asignables}
            elegidos={acceso.quienEscribe.roles}
            vacio="Sin roles elegidos equivale a que no escriba nadie."
            onAlternar={(clave) =>
              actualizar(acceso.quienVe, {
                tipo: "roles",
                roles: alternar((acceso.quienEscribe as { roles: string[] }).roles, clave),
              })
            }
          />
        )}
      </Pregunta>

      {asignables.length === 0 && (
        <p className="rounded-lg border border-[--color-borde] bg-[--color-panel-alto] p-3 text-xs text-[--color-tenue]">
          Todavía no hay roles en la plantilla. Creá alguno en la pestaña «Roles» para poder restringir canales.
        </p>
      )}
    </div>
  );
}

function Pregunta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium">{titulo}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3 py-1.5 text-xs transition ${
        activa
          ? "border-[--color-marca] bg-[--color-marca]/15 text-[--color-texto]"
          : "border-[--color-borde] text-[--color-tenue] hover:border-[--color-marca-claro]"
      }`}
    >
      {children}
    </button>
  );
}

function Chips({
  roles,
  elegidos,
  vacio,
  onAlternar,
}: {
  roles: Rol[];
  elegidos: string[];
  vacio: string;
  onAlternar: (clave: string) => void;
}) {
  return (
    <div className="mt-1 w-full">
      <div className="flex flex-wrap gap-1.5">
        {roles.map((rol) => {
          const activo = elegidos.includes(rol.clave);
          return (
            <button
              key={rol.clave}
              type="button"
              onClick={() => onAlternar(rol.clave)}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${activo ? "" : "opacity-50"}`}
              style={{
                borderColor: rol.color ?? "var(--color-borde)",
                color: rol.color ?? "var(--color-tenue)",
                background: activo ? `${rol.color ?? "#5865f2"}22` : "transparent",
              }}
            >
              {activo ? "✓ " : ""}
              {rol.nombre}
            </button>
          );
        })}
      </div>
      {elegidos.length === 0 && <p className="mt-2 text-xs text-[--color-aviso]">{vacio}</p>}
    </div>
  );
}
