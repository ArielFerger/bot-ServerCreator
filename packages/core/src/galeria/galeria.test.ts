import { describe, expect, it } from "vitest";
import { CLAVES_GALERIA, listarGaleria, plantillaDeGaleria } from "./index";
import { LIMITES } from "../limites";
import { CLAVE_EVERYONE, todosLosCanales } from "../schema";
import { normalizarNombreCanal } from "../limites";

describe("galería de plantillas", () => {
  it("incluye las seis plantillas previstas", () => {
    expect(CLAVES_GALERIA.sort()).toEqual(["comunidad", "estudio", "gaming", "soporte", "streamer", "trabajo"]);
  });

  it.each(CLAVES_GALERIA)("«%s» valida contra el esquema", (clave) => {
    expect(() => plantillaDeGaleria(clave)).not.toThrow();
  });

  it.each(CLAVES_GALERIA)("«%s» tiene metadatos presentables", (clave) => {
    const { meta } = plantillaDeGaleria(clave);
    expect(meta.nombre.length).toBeGreaterThan(3);
    expect(meta.descripcion.length).toBeGreaterThan(30);
    expect(meta.emoji).toBeTruthy();
    expect(meta.etiquetas.length).toBeGreaterThan(0);
  });

  it.each(CLAVES_GALERIA)("«%s» respeta los topes de Discord", (clave) => {
    const p = plantillaDeGaleria(clave);
    expect(p.categorias.length).toBeLessThanOrEqual(LIMITES.categoriasPorServidor);
    expect(p.roles.length).toBeLessThanOrEqual(LIMITES.rolesPorServidor);
    for (const cat of p.categorias) {
      expect(cat.canales.length).toBeLessThanOrEqual(LIMITES.canalesPorCategoria);
    }
  });

  it.each(CLAVES_GALERIA)("«%s» no deja roles huérfanos sin usar en ningún sitio", (clave) => {
    const p = plantillaDeGaleria(clave);
    const usados = new Set<string>();
    for (const cat of p.categorias) {
      cat.permisos.forEach((o) => usados.add(o.rol));
      for (const canal of cat.canales) {
        canal.permisos.forEach((o) => usados.add(o.rol));
        canal.panelRoles?.roles.forEach((r) => usados.add(r));
      }
    }
    for (const canal of p.canalesSueltos) {
      canal.permisos.forEach((o) => usados.add(o.rol));
      canal.panelRoles?.roles.forEach((r) => usados.add(r));
    }
    // Un rol puede justificarse por sus permisos globales aunque no aparezca en overwrites.
    const huerfanos = p.roles.filter(
      (r) => r.clave !== CLAVE_EVERYONE && !usados.has(r.clave) && r.permisos.length === 0 && !r.separado,
    );
    expect(huerfanos.map((r) => r.clave)).toEqual([]);
  });

  it.each(CLAVES_GALERIA)("«%s» usa nombres de canal que Discord no va a reescribir", (clave) => {
    const p = plantillaDeGaleria(clave);
    for (const { canal } of todosLosCanales(p)) {
      if (canal.tipo === "voz" || canal.tipo === "escenario") continue; // los de voz admiten mayúsculas y espacios
      expect(normalizarNombreCanal(canal.nombre), `canal "${canal.clave}"`).toBe(canal.nombre);
    }
  });

  it.each(CLAVES_GALERIA)("«%s» tiene un canal de reglas o equivalente con un mensaje fijado", (clave) => {
    const p = plantillaDeGaleria(clave);
    const fijados = [...todosLosCanales(p)].flatMap(({ canal }) => canal.mensajes.filter((m) => m.fijar));
    expect(fijados.length).toBeGreaterThan(0);
  });

  it("listarGaleria devuelve todo listo para pintar la pantalla de elección", () => {
    const lista = listarGaleria();
    expect(lista).toHaveLength(CLAVES_GALERIA.length);
    expect(lista.every((e) => e.plantilla.meta.nombre)).toBe(true);
  });
});
