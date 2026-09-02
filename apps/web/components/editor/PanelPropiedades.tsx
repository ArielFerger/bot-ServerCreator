"use client";

import {
  CLAVE_EVERYONE,
  ETIQUETAS_PERMISO,
  LIMITES,
  NOMBRES_PERMISO,
  TIPOS_CANAL,
  normalizarNombreCanal,
  type NombrePermiso,
  type Plantilla,
  type TipoCanal,
} from "@aribuilder/core";
import { buscarCanal, type AccionEditor, type Seleccion } from "@/lib/editor";
import { SelectorAcceso } from "./SelectorAcceso";

const ETIQUETA_TIPO: Record<TipoCanal, string> = {
  texto: "Texto",
  voz: "Voz",
  anuncios: "Anuncios (necesita Comunidad)",
  foro: "Foro (necesita Comunidad)",
  escenario: "Escenario (necesita Comunidad)",
};

export function PanelPropiedades({
  plantilla,
  seleccion,
  despachar,
}: {
  plantilla: Plantilla;
  seleccion: Seleccion | null;
  despachar: (a: AccionEditor) => void;
}) {
  if (!seleccion) {
    return (
      <Marco titulo="Nada seleccionado">
        <p className="text-sm text-[--color-tenue]">
          Tocá un canal, una categoría o un rol de la izquierda para editarlo. También podés arrastrarlos para
          reordenarlos.
        </p>
      </Marco>
    );
  }

  switch (seleccion.tipo) {
    case "canal":
      return <PropiedadesCanal plantilla={plantilla} clave={seleccion.clave} despachar={despachar} />;
    case "categoria":
      return <PropiedadesCategoria plantilla={plantilla} clave={seleccion.clave} despachar={despachar} />;
    case "rol":
      return <PropiedadesRol plantilla={plantilla} clave={seleccion.clave} despachar={despachar} />;
    case "ajustes":
      return <PropiedadesAjustes plantilla={plantilla} despachar={despachar} />;
    case "meta":
      return <PropiedadesMeta plantilla={plantilla} despachar={despachar} />;
  }
}

function PropiedadesCanal({
  plantilla,
  clave,
  despachar,
}: {
  plantilla: Plantilla;
  clave: string;
  despachar: (a: AccionEditor) => void;
}) {
  const canal = buscarCanal(plantilla, clave);
  if (!canal) return <Marco titulo="Ese canal ya no existe">{null}</Marco>;

  const editar = (cambios: Parameters<typeof despachar>[0] extends never ? never : Partial<typeof canal>) =>
    despachar({ tipo: "editar-canal", clave, cambios });

  const esVoz = canal.tipo === "voz" || canal.tipo === "escenario";
  const nombreNormalizado = esVoz ? canal.nombre : normalizarNombreCanal(canal.nombre);

  return (
    <Marco titulo="Canal" onBorrar={() => despachar({ tipo: "borrar-canal", clave })}>
      <Campo etiqueta="Nombre">
        <input
          className={entrada}
          value={canal.nombre}
          maxLength={LIMITES.nombreCanal}
          onChange={(e) => editar({ nombre: e.target.value })}
        />
        {nombreNormalizado !== canal.nombre && (
          <Nota>Discord lo va a renombrar a «{nombreNormalizado}»: los canales de texto no admiten mayúsculas ni espacios.</Nota>
        )}
      </Campo>

      <Campo etiqueta="Tipo">
        <select className={entrada} value={canal.tipo} onChange={(e) => editar({ tipo: e.target.value as TipoCanal })}>
          {TIPOS_CANAL.map((t) => (
            <option key={t} value={t}>
              {ETIQUETA_TIPO[t]}
            </option>
          ))}
        </select>
      </Campo>

      {!esVoz && (
        <Campo etiqueta="Descripción del canal">
          <textarea
            className={`${entrada} h-16 resize-none`}
            value={canal.tema ?? ""}
            maxLength={LIMITES.temaCanal}
            placeholder="Para qué sirve este canal"
            onChange={(e) => editar({ tema: e.target.value || undefined })}
          />
        </Campo>
      )}

      {esVoz ? (
        <Campo etiqueta="Límite de usuarios (0 = sin límite)">
          <input
            type="number"
            min={0}
            max={99}
            className={entrada}
            value={canal.limiteUsuarios ?? 0}
            onChange={(e) => editar({ limiteUsuarios: Number(e.target.value) || undefined })}
          />
        </Campo>
      ) : (
        <Campo etiqueta="Modo lento (segundos entre mensajes)">
          <input
            type="number"
            min={0}
            max={21600}
            className={entrada}
            value={canal.modoLento}
            onChange={(e) => editar({ modoLento: Number(e.target.value) })}
          />
        </Campo>
      )}

      <Separador>Acceso</Separador>
      <SelectorAcceso
        permisos={canal.permisos}
        roles={plantilla.roles}
        tipo={canal.tipo}
        onCambio={(permisos) => editar({ permisos })}
      />
    </Marco>
  );
}

function PropiedadesCategoria({
  plantilla,
  clave,
  despachar,
}: {
  plantilla: Plantilla;
  clave: string;
  despachar: (a: AccionEditor) => void;
}) {
  const categoria = plantilla.categorias.find((c) => c.clave === clave);
  if (!categoria) return <Marco titulo="Esa categoría ya no existe">{null}</Marco>;

  return (
    <Marco titulo="Categoría" onBorrar={() => despachar({ tipo: "borrar-categoria", clave })}>
      <Campo etiqueta="Nombre">
        <input
          className={entrada}
          value={categoria.nombre}
          maxLength={LIMITES.nombreCategoria}
          onChange={(e) => despachar({ tipo: "editar-categoria", clave, cambios: { nombre: e.target.value } })}
        />
      </Campo>

      <Nota>Al borrar una categoría sus canales no se pierden: pasan a estar sueltos, fuera de toda categoría.</Nota>

      <Separador>Acceso a toda la categoría</Separador>
      <p className="-mt-2 mb-3 text-xs text-[--color-tenue]">
        Los canales de dentro heredan esto salvo que tengan su propia configuración.
      </p>
      <SelectorAcceso
        permisos={categoria.permisos}
        roles={plantilla.roles}
        tipo="texto"
        onCambio={(permisos) => despachar({ tipo: "editar-categoria", clave, cambios: { permisos } })}
      />
    </Marco>
  );
}

function PropiedadesRol({
  plantilla,
  clave,
  despachar,
}: {
  plantilla: Plantilla;
  clave: string;
  despachar: (a: AccionEditor) => void;
}) {
  const rol = plantilla.roles.find((r) => r.clave === clave);
  if (!rol) return <Marco titulo="Ese rol ya no existe">{null}</Marco>;

  const esEveryone = rol.clave === CLAVE_EVERYONE;
  const editar = (cambios: Partial<typeof rol>) => despachar({ tipo: "editar-rol", clave, cambios });

  const alternarPermiso = (permiso: NombrePermiso) =>
    editar({
      permisos: rol.permisos.includes(permiso)
        ? rol.permisos.filter((p) => p !== permiso)
        : [...rol.permisos, permiso],
    });

  return (
    <Marco titulo="Rol" onBorrar={esEveryone ? undefined : () => despachar({ tipo: "borrar-rol", clave })}>
      {esEveryone ? (
        <Nota>
          @everyone es el rol que tiene todo el mundo. No se puede renombrar ni borrar; solo cambiar lo que puede hacer
          por defecto en el servidor.
        </Nota>
      ) : (
        <>
          <Campo etiqueta="Nombre">
            <input
              className={entrada}
              value={rol.nombre}
              maxLength={LIMITES.nombreRol}
              onChange={(e) => editar({ nombre: e.target.value })}
            />
          </Campo>

          <Campo etiqueta="Color">
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-9 w-14 cursor-pointer rounded border border-[--color-borde] bg-transparent"
                value={rol.color ?? "#99aab5"}
                onChange={(e) => editar({ color: e.target.value })}
              />
              {rol.color && (
                <button
                  type="button"
                  className="text-xs text-[--color-tenue] underline"
                  onClick={() => editar({ color: undefined })}
                >
                  Quitar color
                </button>
              )}
            </div>
          </Campo>

          <Casilla
            marcada={rol.separado}
            onCambio={(v) => editar({ separado: v })}
            etiqueta="Mostrar a estos miembros aparte en la lista"
          />
          <Casilla
            marcada={rol.mencionable}
            onCambio={(v) => editar({ mencionable: v })}
            etiqueta="Cualquiera puede mencionar este rol"
          />
        </>
      )}

      <Separador>Permisos en todo el servidor</Separador>
      <p className="-mt-2 mb-3 text-xs text-[--color-tenue]">
        Esto es lo avanzado. Para decidir quién ve o escribe en un canal concreto, usá el canal, no esto.
      </p>

      {rol.permisos.includes("administrador") && (
        <p className="mb-3 rounded-lg border border-[--color-aviso] bg-[--color-aviso]/10 p-2 text-xs text-[--color-aviso]">
          «Administrador» concede todos los permisos y se salta cualquier restricción de canal. Dáselo solo a quien
          gestione el servidor de verdad.
        </p>
      )}

      <div className="max-h-64 space-y-1 overflow-y-auto pr-1 scroll-fino">
        {NOMBRES_PERMISO.map((permiso) => (
          <Casilla
            key={permiso}
            marcada={rol.permisos.includes(permiso)}
            onCambio={() => alternarPermiso(permiso)}
            etiqueta={ETIQUETAS_PERMISO[permiso]}
          />
        ))}
      </div>
    </Marco>
  );
}

function PropiedadesAjustes({
  plantilla,
  despachar,
}: {
  plantilla: Plantilla;
  despachar: (a: AccionEditor) => void;
}) {
  const a = plantilla.ajustes;
  const editar = (cambios: Partial<typeof a>) => despachar({ tipo: "editar-ajustes", cambios });

  const canalesTexto = [...plantilla.canalesSueltos, ...plantilla.categorias.flatMap((c) => c.canales)].filter(
    (c) => c.tipo === "texto",
  );
  const canalesVoz = [...plantilla.canalesSueltos, ...plantilla.categorias.flatMap((c) => c.canales)].filter(
    (c) => c.tipo === "voz",
  );

  return (
    <Marco titulo="Ajustes del servidor">
      <Campo etiqueta="Nivel de verificación">
        <select
          className={entrada}
          value={a.nivelVerificacion}
          onChange={(e) => editar({ nivelVerificacion: e.target.value as typeof a.nivelVerificacion })}
        >
          <option value="ninguno">Ninguno — cualquiera puede escribir</option>
          <option value="bajo">Bajo — email verificado</option>
          <option value="medio">Medio — cuenta con más de 5 minutos</option>
          <option value="alto">Alto — más de 10 minutos en el servidor</option>
          <option value="muy-alto">Muy alto — teléfono verificado</option>
        </select>
      </Campo>

      <Campo etiqueta="Filtro de contenido explícito">
        <select
          className={entrada}
          value={a.filtroContenido}
          onChange={(e) => editar({ filtroContenido: e.target.value as typeof a.filtroContenido })}
        >
          <option value="desactivado">No revisar nada</option>
          <option value="sin-rol">Revisar a quien no tenga rol</option>
          <option value="todos">Revisar a todo el mundo</option>
        </select>
      </Campo>

      <Campo etiqueta="Notificaciones por defecto">
        <select
          className={entrada}
          value={a.notificacionesPorDefecto}
          onChange={(e) => editar({ notificacionesPorDefecto: e.target.value as typeof a.notificacionesPorDefecto })}
        >
          <option value="solo-menciones">Solo menciones (recomendado)</option>
          <option value="todos-los-mensajes">Todos los mensajes</option>
        </select>
      </Campo>

      <Campo etiqueta="Canal de sistema (mensajes de bienvenida de Discord)">
        <select
          className={entrada}
          value={a.canalSistema ?? ""}
          onChange={(e) => editar({ canalSistema: e.target.value || undefined })}
        >
          <option value="">Ninguno</option>
          {canalesTexto.map((c) => (
            <option key={c.clave} value={c.clave}>
              #{c.nombre}
            </option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Canal de AFK">
        <select
          className={entrada}
          value={a.canalAfk ?? ""}
          onChange={(e) => editar({ canalAfk: e.target.value || undefined })}
        >
          <option value="">Ninguno</option>
          {canalesVoz.map((c) => (
            <option key={c.clave} value={c.clave}>
              🔊 {c.nombre}
            </option>
          ))}
        </select>
      </Campo>

      {a.canalAfk && (
        <Campo etiqueta="Mover a AFK tras">
          <select className={entrada} value={a.afkTimeout} onChange={(e) => editar({ afkTimeout: Number(e.target.value) })}>
            {LIMITES.afkTimeouts.map((s) => (
              <option key={s} value={s}>
                {s < 3600 ? `${s / 60} minutos` : "1 hora"}
              </option>
            ))}
          </select>
        </Campo>
      )}
    </Marco>
  );
}

function PropiedadesMeta({ plantilla, despachar }: { plantilla: Plantilla; despachar: (a: AccionEditor) => void }) {
  const editar = (cambios: Partial<typeof plantilla.meta>) => despachar({ tipo: "editar-meta", cambios });

  return (
    <Marco titulo="Datos de la plantilla">
      <Campo etiqueta="Nombre">
        <input className={entrada} value={plantilla.meta.nombre} maxLength={100} onChange={(e) => editar({ nombre: e.target.value })} />
      </Campo>
      <Campo etiqueta="Emoji">
        <input className={entrada} value={plantilla.meta.emoji ?? ""} maxLength={8} placeholder="🎮" onChange={(e) => editar({ emoji: e.target.value || undefined })} />
      </Campo>
      <Campo etiqueta="Descripción">
        <textarea
          className={`${entrada} h-20 resize-none`}
          value={plantilla.meta.descripcion}
          maxLength={500}
          placeholder="Para qué sirve esta plantilla"
          onChange={(e) => editar({ descripcion: e.target.value })}
        />
      </Campo>
    </Marco>
  );
}

// ─── Piezas compartidas ─────────────────────────────────────────────────────

const entrada =
  "w-full rounded-lg border border-[--color-borde] bg-[--color-fondo] px-3 py-2 text-sm outline-none focus:border-[--color-marca]";

function Marco({
  titulo,
  onBorrar,
  children,
}: {
  titulo: string;
  onBorrar?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[--color-borde] bg-[--color-panel] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[--color-tenue]">{titulo}</h3>
        {onBorrar && (
          <button type="button" onClick={onBorrar} className="text-xs text-[--color-error] hover:underline">
            Borrar
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <label className="mb-4 block">
      <span className="mb-1.5 block text-xs text-[--color-tenue]">{etiqueta}</span>
      {children}
    </label>
  );
}

function Casilla({
  marcada,
  onCambio,
  etiqueta,
}: {
  marcada: boolean;
  onCambio: (v: boolean) => void;
  etiqueta: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-[--color-panel-alto]">
      <input type="checkbox" checked={marcada} onChange={(e) => onCambio(e.target.checked)} />
      <span className="text-[--color-tenue]">{etiqueta}</span>
    </label>
  );
}

function Separador({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 mt-6 border-t border-[--color-borde] pt-4 text-xs font-semibold uppercase tracking-wide text-[--color-tenue]">
      {children}
    </p>
  );
}

function Nota({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-xs text-[--color-aviso]">{children}</p>;
}
