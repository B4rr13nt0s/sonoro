import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  ampliarRegistro,
  detectarAlertas,
  retiradosEnElLibro,
  skusPublicadosAusentes,
  type Retirado,
} from "./alertas.ts";

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

test("registro: un sku publicado que ya no está en el libro se reporta", () => {
  assert.deepEqual(skusPublicadosAusentes(["PRX60C", "SQ12-D2"], new Set(["PRX60C", "OTRO"])), [
    "SQ12-D2",
  ]);
  assert.deepEqual(skusPublicadosAusentes(["PRX60C"], new Set(["PRX60C"])), []);
});

test("registro: solo crece, sin repetidos y en puntos de código", () => {
  assert.deepEqual(ampliarRegistro(["SQ12-D2", "ACX 165"], ["PRX60C", "SQ12-D2", "R2-250X1"]), [
    "ACX 165",
    "PRX60C",
    "R2-250X1",
    "SQ12-D2",
  ]);
  // Mayúsculas antes que minúsculas, como localeCompare NO garantiza.
  assert.deepEqual(ampliarRegistro([], ["b1", "B1"]), ["B1", "b1"]);
});

test("data/skus-publicados.json: ordenado, sin repetidos y cubre todo el catálogo publicado", () => {
  const leer = (archivo: string) =>
    JSON.parse(readFileSync(new URL(`../../data/${archivo}`, import.meta.url), "utf-8"));
  const registro: string[] = leer("skus-publicados.json");
  const catalogo: { sku: string }[] = leer("catalog.json");
  const retirados: Retirado[] = leer("retirados.json");

  assert.deepEqual(registro, ampliarRegistro([], registro));
  // Los retirados siguen en el registro (se publicaron) pero ya no en el catálogo.
  assert.deepEqual(
    skusPublicadosAusentes(registro, new Set(catalogo.map((p) => p.sku)), retirados),
    [],
    "un sku del registro no está en el catálogo ni en retirados.json",
  );
  assert.deepEqual(
    catalogo.map((p) => p.sku).filter((sku) => !registro.includes(sku)),
    [],
    "un sku del catálogo falta en el registro: corre npm run import:catalog",
  );
});

const RETIRADO: Retirado = {
  sku: "SRX1244",
  slug: "memphis-srx1244",
  nombre: "Subwoofer de prueba",
  motivo: "prueba",
};

test("retirados: su sku ausente del libro ya no se reporta como fila borrada", () => {
  assert.deepEqual(
    skusPublicadosAusentes(["PRX60C", "SRX1244"], new Set(["PRX60C"]), [RETIRADO]),
    [],
  );
});

test("retirados: si el sku o el slug vuelven al libro, es un conflicto", () => {
  assert.deepEqual(retiradosEnElLibro([RETIRADO], new Set(["PRX60C"]), new Set(["x"])), []);
  assert.equal(retiradosEnElLibro([RETIRADO], new Set(["SRX1244"]), new Set()).length, 1);
  assert.equal(retiradosEnElLibro([RETIRADO], new Set(), new Set(["memphis-srx1244"])).length, 1);
});

test("data/retirados.json: ningún retirado sigue en el catálogo publicado", () => {
  const leer = (archivo: string) =>
    JSON.parse(readFileSync(new URL(`../../data/${archivo}`, import.meta.url), "utf-8"));
  const retirados: Retirado[] = leer("retirados.json");
  const catalogo: { sku: string; slug: string }[] = leer("catalog.json");

  assert.deepEqual(
    retiradosEnElLibro(
      retirados,
      new Set(catalogo.map((p) => p.sku)),
      new Set(catalogo.map((p) => p.slug)),
    ),
    [],
  );
  for (const r of retirados) {
    assert.ok(r.motivo.length > 0, `${r.sku}: falta el motivo`);
    if (r.reemplazo) {
      assert.ok(
        catalogo.some((p) => p.slug === r.reemplazo),
        `${r.sku}: el reemplazo «${r.reemplazo}» no está en el catálogo`,
      );
    }
  }
});
