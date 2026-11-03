import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoBuscable } from "../busqueda/busqueda.ts";
import { RUTA_CATALOGO_CHAT, crearCargadorCatalogo, productosDeSkus } from "./catalogo.ts";

function producto(sku: string): ProductoBuscable {
  return {
    sku,
    slug: sku.toLowerCase(),
    nombre: `Producto ${sku}`,
    marca: "Memphis",
    categoria: "Subwoofers",
    precioCents: 100000,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: [],
  };
}

const CATALOGO = { productos: [producto("A")], marcas: [{ nombre: "Memphis", slug: "memphis" }] };

function respuesta(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

test("dos llamadas seguidas hacen un solo fetch y devuelven el mismo objeto", async () => {
  let llamadas = 0;
  const urls: string[] = [];
  const cargar = crearCargadorCatalogo((async (url: string) => {
    llamadas += 1;
    urls.push(url);
    return respuesta(CATALOGO);
  }) as unknown as typeof fetch);

  const [a, b] = await Promise.all([cargar(), cargar()]);
  const c = await cargar();

  assert.equal(llamadas, 1);
  assert.deepEqual(urls, [RUTA_CATALOGO_CHAT]);
  assert.ok(a);
  assert.equal(a, b);
  assert.equal(a, c);
  assert.deepEqual(a, CATALOGO);
});

test("un 500 da null y la llamada siguiente vuelve a pedir", async () => {
  let llamadas = 0;
  const cargar = crearCargadorCatalogo((async () => {
    llamadas += 1;
    return llamadas === 1 ? respuesta({ error: true }, 500) : respuesta(CATALOGO);
  }) as unknown as typeof fetch);

  assert.equal(await cargar(), null);
  assert.deepEqual(await cargar(), CATALOGO);
  assert.equal(llamadas, 2);
});

test("un fetch que lanza da null y permite reintentar", async () => {
  let llamadas = 0;
  const cargar = crearCargadorCatalogo((async () => {
    llamadas += 1;
    if (llamadas === 1) throw new TypeError("sin red");
    return respuesta(CATALOGO);
  }) as unknown as typeof fetch);

  assert.equal(await cargar(), null);
  assert.deepEqual(await cargar(), CATALOGO);
});

test("una descarga lenta pero que avanza: el plazo da null, no la cancela y la siguiente llamada la usa", async () => {
  let llamadas = 0;
  let senal: AbortSignal | undefined;
  const cargar = crearCargadorCatalogo(
    ((_url: string, init?: RequestInit) => {
      llamadas += 1;
      senal = init?.signal ?? undefined;
      return new Promise<Response>((resolve) => setTimeout(() => resolve(respuesta(CATALOGO)), 60));
    }) as unknown as typeof fetch,
    20,
  );

  assert.equal(await cargar(), null, "vence el plazo: quien espera sigue sin catálogo");
  assert.notEqual(senal?.aborted, true, "la descarga no se cancela");
  await new Promise((r) => setTimeout(r, 80)); // la descarga termina
  assert.deepEqual(await cargar(), CATALOGO);
  assert.equal(llamadas, 1, "nunca se pidió dos veces");
});

test("un fallo después de vencer el plazo no se recuerda: la siguiente llamada reintenta", async () => {
  let llamadas = 0;
  const cargar = crearCargadorCatalogo(
    ((): Promise<Response> => {
      llamadas += 1;
      if (llamadas === 1) {
        return new Promise((_resolve, rechazar) =>
          setTimeout(() => rechazar(new TypeError("se cortó")), 60),
        );
      }
      return Promise.resolve(respuesta(CATALOGO));
    }) as unknown as typeof fetch,
    20,
  );

  assert.equal(await cargar(), null);
  await new Promise((r) => setTimeout(r, 80)); // la descarga falla
  assert.deepEqual(await cargar(), CATALOGO);
  assert.equal(llamadas, 2);
});

test("una descarga que llega a tiempo no deja el plazo corriendo", async () => {
  const cargar = crearCargadorCatalogo(
    (async () => respuesta(CATALOGO)) as unknown as typeof fetch,
    60_000,
  );
  // Si el temporizador quedara vivo, el proceso de prueba no terminaría.
  assert.deepEqual(await cargar(), CATALOGO);
});

test("un JSON sin productos da null", async () => {
  const cargar = crearCargadorCatalogo((async () =>
    respuesta({ marcas: [] })) as unknown as typeof fetch);
  assert.equal(await cargar(), null);
});

test("un JSON sin marcas (arreglo) da null", async () => {
  const cargar = crearCargadorCatalogo((async () =>
    respuesta({ productos: [] })) as unknown as typeof fetch);
  assert.equal(await cargar(), null);
});

test("productosDeSkus descarta los que no están y conserva el orden pedido", () => {
  const porSku = new Map([
    ["A", producto("A")],
    ["B", producto("B")],
  ]);
  assert.deepEqual(
    productosDeSkus(["B", "X", "A"], porSku).map((p) => p.sku),
    ["B", "A"],
  );
});
