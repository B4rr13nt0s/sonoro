import test from "node:test";
import assert from "node:assert/strict";

import type { Celda } from "../catalogo/contrato.ts";
import type { FilaVehiculoCruda } from "./contrato.ts";
import { normalizarFilaVehiculo, type ContextoFila, type ResultadoFila } from "./filas.ts";
import { FILA_VALIDA } from "./libro-de-prueba.ts";

const ctx: ContextoFila = {
  listas: {
    ubicaciones: new Set(["Puertas delanteras", "Bandeja trasera"]),
    medidas: new Set(['6.5"', '5.25"', '6x9"', '7/8"', '6x8"']),
  },
  skusCatalogo: new Set(["KSM-8", "OEMBKT60", "OEMBKT69"]),
  anioActual: 2026,
};

function cruda(celdas: Record<string, Celda>, numero = 2): FilaVehiculoCruda {
  return { numero, celdas: { ...FILA_VALIDA, ...celdas } };
}

function motivos(r: ResultadoFila): string[] {
  return r.ok ? [] : r.motivos;
}

function normalizar(celdas: Record<string, Celda>): ResultadoFila {
  return normalizarFilaVehiculo(cruda(celdas), ctx);
}

test("fila válida: slugs, radios y ubicaciones normalizados", () => {
  const r = normalizar({ radio_1din: "Con marco", radio_2din: "no cabe" });
  assert.ok(r.ok, motivos(r).join("; "));
  const { vehiculo } = r.fila;
  assert.equal(r.fila.numero, 2);
  assert.equal(r.fila.revisado, true);
  assert.equal(vehiculo.marcaSlug, "toyota");
  assert.equal(vehiculo.modeloSlug, "corolla");
  assert.equal(vehiculo.radio1din, "con_marco");
  assert.equal(vehiculo.radio2din, "no_cabe");
  assert.equal(vehiculo.version, null);
  assert.equal(vehiculo.versionSlug, null);
  assert.deepEqual(vehiculo.ubicaciones, [
    { ubicacion: "Puertas delanteras", medidas: ['6.5"'], accesorio: null },
  ]);
});

test("versión: se guarda con su slug", () => {
  const r = normalizar({ version: "Tablero gris" });
  assert.ok(r.ok);
  assert.equal(r.fila.vehiculo.version, "Tablero gris");
  assert.equal(r.fila.vehiculo.versionSlug, "tablero-gris");
});

test("revisado: sí, si, SÍ y no; vacío o raro rechaza", () => {
  for (const valor of ["sí", "si", "SÍ", "SI", " Sí "]) {
    const r = normalizar({ revisado: valor });
    assert.ok(r.ok && r.fila.revisado === true, valor);
  }
  const no = normalizar({ revisado: " no " });
  assert.ok(no.ok && no.fila.revisado === false);
  for (const valor of ["", "tal vez", null]) {
    const r = normalizar({ revisado: valor });
    assert.equal(r.ok, false);
    assert.equal(r.ok ? undefined : r.revisado, null);
    assert.match(motivos(r).join(), /revisado/);
  }
});

test("años: enteros de 1940 al año actual más uno, y desde ≤ hasta", () => {
  assert.match(motivos(normalizar({ desde: 1939 })).join(), /desde/);
  assert.match(motivos(normalizar({ hasta: 2028 })).join(), /hasta/);
  assert.match(motivos(normalizar({ desde: 2010, hasta: 2009 })).join(), /desde.*hasta/);
  assert.match(motivos(normalizar({ desde: "2010" })).join(), /desde/);
  assert.match(motivos(normalizar({ desde: 2010.5 })).join(), /desde/);
  assert.match(motivos(normalizar({ hasta: null })).join(), /hasta/);
  assert.ok(normalizar({ desde: 1940, hasta: 2027 }).ok);
});

test("radio fuera de lista", () => {
  assert.match(motivos(normalizar({ radio_1din: "sí" })).join(), /radio_1din/);
});

test("ubicación y medida contra LISTAS", () => {
  assert.match(motivos(normalizar({ ubicacion_1: "Techo" })).join(), /Techo/);
  assert.match(motivos(normalizar({ medida_1: '6"' })).join(), /6"/);
});

test('varias medidas se separan con « / », y 7/8" es una sola', () => {
  const dos = normalizar({ medida_1: '5.25" / 6.5"' });
  assert.ok(dos.ok);
  assert.deepEqual(dos.fila.vehiculo.ubicaciones[0].medidas, ['5.25"', '6.5"']);
  const tweeter = normalizar({ medida_1: '7/8"' });
  assert.ok(tweeter.ok, motivos(tweeter).join());
  assert.deepEqual(tweeter.fila.vehiculo.ubicaciones[0].medidas, ['7/8"']);
});

test("ubicación sin medida, medida o accesorio sin ubicación", () => {
  assert.match(motivos(normalizar({ ubicacion_2: "Bandeja trasera" })).join(), /ubicacion_2/);
  assert.match(motivos(normalizar({ medida_3: '6x9"' })).join(), /medida_3/);
  assert.match(motivos(normalizar({ accesorio_4: "otro" })).join(), /accesorio_4/);
});

test("las ubicaciones se compactan en orden, aunque falte una del medio", () => {
  const r = normalizar({ ubicacion_3: "Bandeja trasera", medida_3: '6x9"', accesorio_3: "otro" });
  assert.ok(r.ok);
  assert.deepEqual(
    r.fila.vehiculo.ubicaciones.map((u) => [u.ubicacion, u.accesorio]),
    [
      ["Puertas delanteras", null],
      ["Bandeja trasera", "otro"],
    ],
  );
});

test("accesorio: los permitidos sin distinguir mayúsculas, y la pieza tiene que existir", () => {
  const ksm = normalizar({ accesorio_1: "ksm-8" });
  assert.ok(ksm.ok && ksm.fila.vehiculo.ubicaciones[0].accesorio === "KSM-8");
  const otro = normalizar({ accesorio_1: "Otro" });
  assert.ok(otro.ok && otro.fila.vehiculo.ubicaciones[0].accesorio === "otro");
  assert.match(motivos(normalizar({ accesorio_1: "XYZ" })).join(), /accesorio_1/);
  const sinPieza = normalizarFilaVehiculo(cruda({ accesorio_1: "OEMBKT69" }), {
    ...ctx,
    skusCatalogo: new Set(["KSM-8", "OEMBKT60"]),
  });
  assert.match(motivos(sinPieza).join(), /OEMBKT69/);
});

test("una ubicación repetida en la fila rechaza", () => {
  assert.match(
    motivos(normalizar({ ubicacion_2: "Puertas delanteras", medida_2: '6.5"' })).join(),
    /repetida/,
  );
});

test("fila sin ningún dato", () => {
  assert.match(
    motivos(normalizar({ radio_2din: null, ubicacion_1: null, medida_1: null })).join(),
    /ningún dato/,
  );
});

test("marca y modelo obligatorios", () => {
  assert.match(motivos(normalizar({ marca: "" })).join(), /marca/);
  assert.match(motivos(normalizar({ modelo: null })).join(), /modelo/);
});

test("un modelo escrito como número cuenta como texto", () => {
  const r = normalizar({ marca: "Mazda", modelo: 3 });
  assert.ok(r.ok);
  assert.equal(r.fila.vehiculo.modelo, "3");
  assert.equal(r.fila.vehiculo.modeloSlug, "3");
});

test("junta todos los motivos de la fila", () => {
  assert.equal(motivos(normalizar({ desde: 1900, radio_1din: "x" })).length, 2);
});
