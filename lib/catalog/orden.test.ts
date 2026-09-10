import test from "node:test";
import assert from "node:assert/strict";

import { compararRelevancia } from "./orden.ts";
import type { Producto } from "./types.ts";

// Productos sintéticos: estas pruebas fijan el COMPARADOR, no el catálogo.
// Solo importan cuatro campos; el resto es relleno válido para el tipo.
function producto(sku: string, precioCents: number, destacado: boolean): Producto {
  return {
    sku,
    slug: sku.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    nombre: sku,
    marca: "Sonoro",
    categoria: "Bocinas",
    descripcionCorta: "—",
    specsDestacadas: [
      { etiqueta: "A", valor: "1" },
      { etiqueta: "B", valor: "2" },
      { etiqueta: "C", valor: "3" },
    ],
    specsFicha: [
      { etiqueta: "A", valor: "1" },
      { etiqueta: "B", valor: "2" },
      { etiqueta: "C", valor: "3" },
      { etiqueta: "D", valor: "4" },
    ],
    precioCents,
    moneda: "GTQ",
    disponibilidad: "disponible",
    imagenes: [],
    destacado,
    activo: true,
  };
}

const skus = (lista: Producto[]) => lista.map((p) => p.sku);

test("relevancia: destacado va primero, aunque sea mucho más barato", () => {
  const barato = producto("BARATO", 3000, true);
  const caro = producto("CARO", 260000, false);

  assert.ok(compararRelevancia(barato, caro) < 0);
  assert.deepEqual(skus([caro, barato].sort(compararRelevancia)), ["BARATO", "CARO"]);
});

test("relevancia: a igual destacado, el precio va descendente", () => {
  const lista = [
    producto("MEDIO", 120000, false),
    producto("CARO", 260000, false),
    producto("BARATO", 3000, false),
  ];

  assert.deepEqual(skus(lista.sort(compararRelevancia)), ["CARO", "MEDIO", "BARATO"]);
});

test("relevancia: a igual destacado y precio, desempata el sku ascendente", () => {
  // Con separadores internos reales (espacio, punto, guion), que es como el
  // fabricante publica los códigos.
  const lista = [
    producto("MJP800.4", 50000, false),
    producto("ACX 165", 50000, false),
    producto("SQ12-D2", 50000, false),
  ];

  assert.deepEqual(skus(lista.sort(compararRelevancia)), ["ACX 165", "MJP800.4", "SQ12-D2"]);
});

test("relevancia: el orden no depende del orden de entrada — mismo resultado siempre", () => {
  // Esto es lo que fija "no cambia entre builds": el comparador es un orden
  // TOTAL (el sku es único), así que barajar la entrada no puede cambiar la
  // salida. Un comparador que dejara empates reales dependería de la
  // estabilidad de sort y del orden del JSON, y esta prueba lo detectaría.
  const base = [
    producto("A1", 50000, true),
    producto("A2", 50000, true),
    producto("B1", 50000, false),
    producto("B2", 120000, false),
    producto("C1", 3000, true),
  ];
  const esperado = skus([...base].sort(compararRelevancia));

  assert.deepEqual(esperado, ["A1", "A2", "C1", "B2", "B1"]);

  // Rotaciones e inversa: cinco permutaciones distintas de la misma entrada.
  for (let corte = 0; corte < base.length; corte += 1) {
    const barajado = [...base.slice(corte), ...base.slice(0, corte)].reverse();
    assert.deepEqual(skus(barajado.sort(compararRelevancia)), esperado);
  }
});
