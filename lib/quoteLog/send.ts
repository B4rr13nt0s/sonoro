// CLAUDE.md / docs/PLAN.md § 6.4: "El cliente dispara la petición y abre
// WhatsApp sin esperar la respuesta." Por eso esta función no es async ni
// se espera con `await` desde quien la llama (components/cart/CarritoView.tsx)
// — dispara el POST y sigue. `keepalive: true` le pide al navegador que
// complete la petición aunque el click ya haya abierto wa.me en una pestaña
// nueva. El `.catch()` es el punto crítico: CLAUDE.md dice explícitamente
// que si el registro falla el usuario NO debe notarlo, así que un error de
// red acá nunca puede propagarse como una promesa rechazada sin manejar.
import type { QuoteLogRequest } from "./types.ts";

// Los navegadores rechazan un fetch con `keepalive` de más de 64 KiB de
// cuerpo —error de red, que el .catch de abajo tragaría—, y el servidor
// acepta hasta 256 KB (MAX_BODY_BYTES). Hoy un pedido con todo el catálogo
// pesa ~33 KB, pero un catálogo más grande o nombres más largos pasarían la
// raya: por encima de ella se manda sin keepalive, que llega igual mientras
// la pestaña siga abierta (WhatsApp abre en otra).
export const MAX_KEEPALIVE_BYTES = 60 * 1024;

export function sendQuoteLog(payload: QuoteLogRequest, fetchImpl: typeof fetch = fetch): void {
  const body = JSON.stringify(payload);
  fetchImpl("/api/quote-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: new TextEncoder().encode(body).length <= MAX_KEEPALIVE_BYTES,
  }).catch(() => {
    // Best-effort. Nada que hacer: el pedido ya se está cerrando por
    // WhatsApp, y ese cierre no puede depender de que esto haya funcionado.
  });
}
