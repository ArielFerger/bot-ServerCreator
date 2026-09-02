import type { Evento } from "@aribuilder/applier";

export type EventoStream = Evento | { tipo: "ejecucion"; id: string };

/**
 * Lee un stream SSE de nuestras rutas de aplicar/deshacer.
 *
 * No usamos `EventSource` porque solo admite GET y aquí hace falta POST con
 * cuerpo; leemos el body a mano, que además nos deja propagar errores HTTP.
 */
export async function* leerEventos(
  url: string,
  cuerpo: unknown,
  señal?: AbortSignal,
): AsyncGenerator<EventoStream> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
    signal: señal,
  });

  if (!res.ok) {
    const datos = (await res.json().catch(() => ({}))) as { error?: string; solucion?: string };
    const mensaje = datos.error ?? `La petición falló (${res.status}).`;
    yield { tipo: "error", mensaje: datos.solucion ? `${mensaje} ${datos.solucion}` : mensaje };
    return;
  }
  if (!res.body) return;

  const lector = res.body.getReader();
  const decodificador = new TextDecoder();
  let resto = "";

  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    resto += decodificador.decode(value, { stream: true });

    // Cada evento SSE termina en una línea en blanco.
    const bloques = resto.split("\n\n");
    resto = bloques.pop() ?? "";
    for (const bloque of bloques) {
      const linea = bloque.split("\n").find((l) => l.startsWith("data: "));
      if (!linea) continue;
      try {
        yield JSON.parse(linea.slice(6)) as EventoStream;
      } catch {
        // Un fragmento corrupto no debe tumbar toda la aplicación.
      }
    }
  }
}
