import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { parse } from "csv-parse/sync";

import { SKU_REGEX, pareceValorMangeado } from "./types.ts";

const SKU_VALIDOS = [
  "SQ12-D2",
  "PRX60C",
  "6X9-2",
  "ACX 165",
  "STAGE2 634",
  "CLASSIC LITE BK",
  "MJP800.4",
  "XED62",
  "4GKIT",
];

const SKU_INVALIDOS = ["ACX  165", " ACX165", "ACX165-", "acx-165"];

test("SKU_REGEX acepta códigos de fabricante legítimos", () => {
  for (const sku of SKU_VALIDOS) {
    assert.match(sku, SKU_REGEX, `"${sku}" debería ser válido`);
  }
});

test("SKU_REGEX rechaza separadores dobles, espacios en los extremos y minúsculas", () => {
  for (const sku of SKU_INVALIDOS) {
    assert.doesNotMatch(sku, SKU_REGEX, `"${sku}" debería ser inválido`);
  }
});

test("pareceValorMangeado detecta fechas y notación científica", () => {
  assert.equal(pareceValorMangeado("2024-06-09"), true);
  assert.equal(pareceValorMangeado("9-Jun"), true);
  assert.equal(pareceValorMangeado("1.2E+05"), true);
});

test("pareceValorMangeado no marca los skus reales del catálogo", () => {
  for (const sku of SKU_VALIDOS) {
    assert.equal(pareceValorMangeado(sku), false, `"${sku}" no debería marcarse como mangeado`);
  }
});

// Parseo real (csv-parse), no un split("\n") ingenuo — un split por línea
// se rompe en cuanto una fila real trae un campo con coma o salto de línea
// entre comillas (specs_ficha ya los tiene hoy, ej. CAK42 "Corriente,
// tier..."), contando de más y produciendo skus falsos a partir de la
// segunda mitad de una fila partida. Mismas opciones que
// scripts/import-catalog.ts usa para parsear el mismo archivo.
function leerSkusDelCsv(): string[] {
  const csvPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../data/source/productos.csv",
  );
  const raw = readFileSync(csvPath, "utf-8");
  const filas = parse(raw, {
    bom: true,
    trim: false,
    skip_empty_lines: true,
    columns: true,
  }) as Record<string, string>[];
  return filas.map((fila) => fila.sku);
}

// Sin número fijo de filas — CLAUDE.md § Fuente de verdad: el catálogo de
// prueba crece hacia el catálogo real, y esta prueba debe seguir pasando
// sin tocarla cada vez que se importa un producto nuevo.
test("los sku de data/source/productos.csv pasan SKU_REGEX y ninguno está mangeado", () => {
  const skus = leerSkusDelCsv();
  assert.ok(skus.length > 0, "data/source/productos.csv no debería estar vacío");

  for (const sku of skus) {
    assert.match(sku, SKU_REGEX, `sku "${sku}" del CSV no pasa SKU_REGEX`);
    assert.equal(pareceValorMangeado(sku), false, `sku "${sku}" del CSV se marcó como mangeado`);
  }
});
