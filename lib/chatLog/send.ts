// Igual que lib/quoteLog/send.ts: fire-and-forget. Si el registro falla el
// cliente NO debe notarlo, así que un error de red nunca se propaga como
// promesa rechazada sin manejar. `keepalive` pide al navegador completar la
// petición aunque la pestaña cambie de página (p. ej. al abrir WhatsApp). El
// cuerpo pesa menos de 1 KB, muy por debajo del tope de 64 KiB de keepalive.
import { enmascarar } from "../chat/enmascarar.ts";
import type { EventoChat } from "../chat/tipos.ts";
import type { ChatLogRequest } from "./types.ts";

const ALFABETO = "abcdefghijklmnopqrstuvwxyz0123456789";

/**
 * Identificador de una conversación: 8 caracteres [a-z0-9] al azar, que viven
 * solo en memoria mientras el panel está abierto. No es una cuenta ni un
 * identificador persistente: sirve para agrupar los eventos de una misma
 * sesión en la hoja.
 */
export function nuevaConversacion(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  // 256 no es múltiplo de 36: el módulo sesga un poco los primeros
  // caracteres, irrelevante para un identificador que no protege nada.
  return Array.from(bytes, (b) => ALFABETO[b % ALFABETO.length]).join("");
}

export function sendChatLog(
  conversacion: string,
  evento: EventoChat,
  fetchImpl: typeof fetch = fetch,
): void {
  const payload: ChatLogRequest = { tipo: "chat", conversacion, ...evento };
  if (payload.consulta !== undefined) payload.consulta = enmascarar(payload.consulta);

  fetchImpl("/api/chat-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Best-effort: nada que hacer si el registro no llega.
  });
}
