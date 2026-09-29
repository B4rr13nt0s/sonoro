import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoTarjeta } from "../../lib/catalog/types.ts";
import { coincide, normalizar, puntuarRelevancia } from "./busqueda.ts";

function producto(nombre: string, marca: string, sku: string): ProductoTarjeta {
  return {
    sku,
    slug: sku.toLowerCase(),
    nombre,
    marca,
    categoria: "Subwoofers",
    precioCents: 100000,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: [],
  };
}

const COR = producto('Subwoofer Coronel de 12" COR2-124D', "KBT", "COR2-124D");
const PRX = producto("Amplificador Power Reference PRX1500.1V2", "Memphis", "PRX1500.1V2");

test("coincide: cada palabra en cualquier campo y en cualquier orden", () => {
  assert.equal(coincide(COR, normalizar("kbt subwoofer")), true);
  assert.equal(coincide(COR, normalizar("12 kbt")), true);
  assert.equal(coincide(PRX, normalizar("memphis amplificador")), true);
  assert.equal(coincide(PRX, normalizar("  MEMPHIS   amplificador ")), true);
});

test("coincide: si una sola palabra falta, no coincide", () => {
  assert.equal(coincide(COR, normalizar("kbt amplificador")), false);
  assert.equal(coincide(PRX, normalizar("rockford amplificador")), false);
});

test("coincide: sin acentos ni mayúsculas", () => {
  const insono = producto("Lámina de insonorización", "Sonoro", "INS-1");
  assert.equal(coincide(insono, normalizar("INSONORIZACION lamina")), true);
});

test("puntuarRelevancia: la frase entera pesa más que las palabras repartidas", () => {
  const q = normalizar("coronel de 12");
  assert.equal(puntuarRelevancia(COR, q), 50);
  assert.equal(puntuarRelevancia(COR, normalizar("kbt 12")), 20);
  assert.equal(puntuarRelevancia(COR, normalizar("cor2-124d")), 100);
});
