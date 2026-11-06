import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PANTALLAS_ESPECIALES } from "./especiales.ts";
import { NOTAS_RECEPTOR } from "./textos.ts";
import { PIEZAS_NOMBRADAS } from "./types.ts";

// Contra el catálogo real, como el test de logos de marcas: si alguien
// renombra una de estas piezas o pantallas en el libro, falla CI y no el
// selector de /buscar, que dejaría de reconocerla sin avisar.
const catalogo: { sku: string; categoria: string }[] = JSON.parse(
  readFileSync("data/catalog.json", "utf-8"),
);

test("las pantallas especiales existen en el catálogo y son receptores", () => {
  for (const sku of Object.keys(PANTALLAS_ESPECIALES)) {
    const p = catalogo.find((x) => x.sku === sku);
    assert.ok(p, `falta ${sku} en el catálogo`);
    assert.equal(p.categoria, "Receptores");
  }
});

test("los receptores con anotación existen en el catálogo y son receptores", () => {
  for (const sku of Object.keys(NOTAS_RECEPTOR)) {
    const p = catalogo.find((x) => x.sku === sku);
    assert.ok(p, `falta ${sku} en el catálogo`);
    assert.equal(p.categoria, "Receptores");
  }
});

test("OEMBKT60, OEMBKT69 y KSM-8 existen en el catálogo", () => {
  for (const sku of PIEZAS_NOMBRADAS) {
    assert.ok(
      catalogo.some((x) => x.sku === sku),
      `falta ${sku} en el catálogo`,
    );
  }
});
