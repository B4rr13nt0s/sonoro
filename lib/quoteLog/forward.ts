// Reenvía una cotización ya validada a QUOTE_LOG_URL, con el token inyectado
// (nunca lo tuvo el navegador). Vive separado de app/api/quote-log/route.ts
// para poder probarse con `node --test` sin tocar next/server: route.ts la
// llama dentro de `after()`, que exige el contexto de petición real de
// Next.js y por eso no se puede invocar directamente en un test.
//
// CRÍTICO (CLAUDE.md): el registro es secundario al cierre de la venta y
// nunca puede bloquearlo — esta función NUNCA lanza. Cualquier falla (red,
// timeout, status no-2xx) se traga y solo queda en el log del servidor.
import type { QuoteLogRequest } from "./types.ts";

const TIMEOUT_MS = 5000;

export async function forwardQuoteLog(params: {
  url: string;
  token: string;
  request: QuoteLogRequest;
  fetchImpl?: typeof fetch;
}): Promise<void> {
  const fetchImpl = params.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetchImpl(params.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: params.token, ...params.request }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[quote-log] QUOTE_LOG_URL respondió ${response.status}`);
      return;
    }
    // El Apps Script responde SIEMPRE 200 —ContentService no puede poner
    // otro código— y avisa las fallas en el cuerpo: {ok:false, mensaje}.
    // Mirar solo el status tomaba un token desincronizado ("No autorizado")
    // o un script sin configurar por éxito, y los pedidos se perdían de la
    // hoja sin dejar rastro en el log del servidor.
    const cuerpo: unknown = await response.json().catch(() => null);
    if (
      typeof cuerpo === "object" &&
      cuerpo !== null &&
      (cuerpo as { ok?: unknown }).ok === false
    ) {
      const mensaje = (cuerpo as { mensaje?: unknown }).mensaje;
      console.error(`[quote-log] QUOTE_LOG_URL rechazó el registro: ${String(mensaje)}`);
    }
  } catch (error) {
    console.error("[quote-log] no se pudo registrar la cotización:", error);
  } finally {
    clearTimeout(timeout);
  }
}
