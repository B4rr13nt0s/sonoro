import test from "node:test";
import assert from "node:assert/strict";

import { detectarAlertas } from "./alertas.ts";

const p = (sku: string, slug: string, nombre = sku) => ({ sku, slug, nombre });

test("sin cambios: ninguna alerta", () => {
  const catalogo = [p("SQ12-D2", "memphis-sq12-d2"), p("PRX60C", "memphis-prx60c")];
  assert.deepEqual(detectarAlertas(catalogo, catalogo), []);
});

test("fila borrada: alerta que la fila vuelva con activo = FALSO", () => {
  const alertas = detectarAlertas(
    [p("SQ12-D2", "memphis-sq12-d2", 'Serie SQ 12" D2'), p("PRX60C", "memphis-prx60c")],
    [p("PRX60C", "memphis-prx60c")],
  );
  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /sku "SQ12-D2" \("Serie SQ 12" D2"\) ya no está en el libro/);
  assert.match(alertas[0], /activo = FALSO/);
});

test("fila rechazada por validación: no se reporta como borrada", () => {
  const alertas = detectarAlertas([p("SQ12-D2", "memphis-sq12-d2")], [], new Set(["SQ12-D2"]));
  assert.deepEqual(alertas, []);
});

test("sku cambiado con el mismo slug: una alerta de sku, no de fila borrada", () => {
  const alertas = detectarAlertas(
    [p("SQ12-D2", "memphis-sq12-d2")],
    [p("SQ12D2", "memphis-sq12-d2")],
  );
  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /sku cambió en "memphis-sq12-d2": "SQ12-D2" → "SQ12D2"/);
});

test("ceros iniciales perdidos: solo esa alerta, sin repetirla como borrada", () => {
  const alertas = detectarAlertas(
    [p("0450", "kbt-0450", "Cable 0450")],
    [p("450", "kbt-450", "Cable 0450")],
  );
  assert.equal(alertas.length, 1);
  assert.match(alertas[0], /perdió ceros iniciales/);
});

test("slug cambiado: la alerta de siempre", () => {
  const alertas = detectarAlertas([p("SQ12-D2", "viejo")], [p("SQ12-D2", "nuevo")]);
  assert.deepEqual(alertas, ['slug cambió para sku "SQ12-D2": "viejo" → "nuevo"']);
});

test("producto nuevo: no alerta", () => {
  assert.deepEqual(detectarAlertas([], [p("SQ12-D2", "memphis-sq12-d2")]), []);
});
