import test from "node:test";
import assert from "node:assert/strict";

import { ErrorDeFormato, leerDimensiones, leerPotenciaPorCarga } from "./formatos.ts";

test("potencia: una potencia por impedancia, en el orden de la hoja", () => {
  assert.deepEqual(leerPotenciaPorCarga("3,000 W @ 1 Ω · 1,600 W @ 2 Ω · 900 W @ 4 Ω"), [
    { w: 3000, ohm: 1 },
    { w: 1600, ohm: 2 },
    { w: 900, ohm: 4 },
  ]);
  assert.deepEqual(leerPotenciaPorCarga("500 W @ 4 Ω"), [{ w: 500, ohm: 4 }]);
});

test("potencia: tolera espacios, mayúsculas, «ohm» y el signo de ohm", () => {
  assert.deepEqual(leerPotenciaPorCarga("  500w@4ohm  ·  300 W @ 8 Ω "), [
    { w: 500, ohm: 4 },
    { w: 300, ohm: 8 },
  ]);
});

test("potencia: vacía no es error (el obligatorio lo avisa aparte)", () => {
  assert.equal(leerPotenciaPorCarga(null), undefined);
  assert.equal(leerPotenciaPorCarga("  "), undefined);
});

test("potencia: lo que no tiene el formato se rechaza diciendo cuál es", () => {
  for (const mala of [800, "800", "800 W", "4 Ω"]) {
    const r = leerPotenciaPorCarga(mala);
    assert.ok(r instanceof ErrorDeFormato, String(mala));
    assert.match(r.message, /### W @ # Ω/);
  }
  assert.match(
    (leerPotenciaPorCarga("800 W @ 4 Ω · 900 W @ 4 Ω") as ErrorDeFormato).message,
    /repite la impedancia de 4 Ω/,
  );
  assert.ok(leerPotenciaPorCarga("0 W @ 4 Ω") instanceof ErrorDeFormato);
});

test("potencia: la descriptiva multicanal se conserva como texto", () => {
  assert.equal(leerPotenciaPorCarga("800 W × 2 @ 4 Ω  en puente"), "800 W × 2 @ 4 Ω en puente");
});

test("dimensiones: tres medidas en mm", () => {
  assert.deepEqual(leerDimensiones("300 × 200 × 50 mm"), [300, 200, 50]);
  assert.deepEqual(leerDimensiones("300x200x50mm"), [300, 200, 50]);
  assert.deepEqual(leerDimensiones("1,050 × 187.5 × 52 mm"), [1050, 187.5, 52]);
  assert.equal(leerDimensiones(null), undefined);
});

test("dimensiones: sin unidad, con dos medidas o en cero se rechaza", () => {
  for (const mala of ["300 × 200 × 50", "300 × 200 mm", "300 × 200 × 50 cm", 300, "0 × 1 × 2 mm"]) {
    const r = leerDimensiones(mala);
    assert.ok(r instanceof ErrorDeFormato, String(mala));
    assert.match(r.message, /## × ## × ## mm/);
  }
});
