// Lo que los dos endpoints abiertos (/api/quote-log y /api/chat-log) piden de la
// petición ANTES de mirar su contenido. Los dos reciben de cualquiera y siempre
// responden 204, así que lo único que cuenta es no dejar que se use el sitio
// para llenar la hoja ni para gastar memoria.

/**
 * ¿La petición dice que trae JSON? Los clientes de verdad (send.ts de cada
 * registro) siempre mandan `application/json`. Un POST «simple» entre sitios
 * (`text/plain` con `mode: "no-cors"`) no puede poner ese tipo sin un
 * preflight, y estas rutas no contestan CORS: pedirlo cierra la vía de una
 * página ajena que haga mandar el POST a los navegadores de sus visitantes —
 * cada uno con su IP, así que el limitador por IP no la frenaba.
 */
export function esJson(headers: Headers): boolean {
  return /^application\/json\s*(?:;|$)/i.test(headers.get("content-type") ?? "");
}

/**
 * El cuerpo como texto, o `null` si pasa de `maxBytes`. Lee por trozos y se
 * detiene al pasarse: `request.text()` carga TODO el cuerpo en memoria antes
 * de poder medirlo, y con `Transfer-Encoding: chunked` no hay `content-length`
 * que lo corte antes (en Vercel, hasta 4.5 MB por petición).
 */
export async function leerTextoAcotado(request: Request, maxBytes: number): Promise<string | null> {
  const lector = request.body?.getReader();
  if (!lector) return "";
  const trozos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await lector.cancel().catch(() => undefined);
      return null;
    }
    trozos.push(value);
  }
  return Buffer.concat(trozos).toString("utf8");
}
