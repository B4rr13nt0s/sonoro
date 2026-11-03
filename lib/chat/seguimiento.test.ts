import test from "node:test";
import assert from "node:assert/strict";

import {
  aplicarCambios,
  fraseCambios,
  interpretarSeguimiento,
  sinMedidas,
  type Cambio,
} from "./seguimiento.ts";
import type { BusquedaAcotable } from "./tipos.ts";

const MARCAS = [
  { nombre: "Memphis", slug: "memphis" },
  { nombre: "Rockford Fosgate", slug: "rockford-fosgate" },
  { nombre: "KBT", slug: "kbt" },
];
const OP: Parameters<typeof interpretarSeguimiento>[1] = {
  marcas: MARCAS,
  numeroSuelto: "medida",
};
const SUB12: BusquedaAcotable = {
  base: { tipo: "texto", consulta: "sub 12", visible: "sub 12" },
  acotes: [],
};
const SUBS: BusquedaAcotable = {
  base: { tipo: "texto", consulta: "subwoofers", visible: "subwoofers" },
  acotes: [],
};

const seg = (texto: string, op = OP) => interpretarSeguimiento(texto, op);

test("medida: con unidad, con «de» y número suelto", () => {
  const diez: Cambio[] = [{ tipo: "acote", acote: { campo: "medida", pulgadas: 10 } }];
  assert.deepEqual(seg("y de 10?"), diez);
  assert.deepEqual(seg("de 10 mejor"), diez);
  assert.deepEqual(seg("10 pulgadas"), diez);
  assert.deepEqual(seg('10"'), diez);
});

test("canales", () => {
  assert.deepEqual(seg("de 4 canales"), [
    { tipo: "acote", acote: { campo: "canales", canales: 4 } },
  ]);
  assert.deepEqual(seg("y de 4?", { marcas: MARCAS, numeroSuelto: "canales" }), [
    { tipo: "acote", acote: { campo: "canales", canales: 4 } },
  ]);
});

test("marca, con o sin «marca», también por su primera palabra", () => {
  const memphis: Cambio[] = [{ tipo: "acote", acote: { campo: "marca", slug: "memphis" } }];
  assert.deepEqual(seg("solo Memphis"), memphis);
  assert.deepEqual(seg("y de la marca memphis?"), memphis);
  assert.deepEqual(seg("y de rockford?"), [
    { tipo: "acote", acote: { campo: "marca", slug: "rockford-fosgate" } },
  ]);
});

test("precio: menos de, hasta, más de, entre", () => {
  assert.deepEqual(seg("menos de 2000"), [
    { tipo: "acote", acote: { campo: "precio", max: 200000 } },
  ]);
  assert.deepEqual(seg("hasta 1500"), [{ tipo: "acote", acote: { campo: "precio", max: 150000 } }]);
  assert.deepEqual(seg("más de 3000"), [
    { tipo: "acote", acote: { campo: "precio", min: 300000 } },
  ]);
  assert.deepEqual(seg("entre 1000 y 2000"), [
    { tipo: "acote", acote: { campo: "precio", min: 100000, max: 200000 } },
  ]);
});

test("disponibilidad", () => {
  for (const t of ["los disponibles", "solo los disponibles", "en existencia", "los que haya"]) {
    assert.deepEqual(seg(t), [{ tipo: "acote", acote: { campo: "disponibilidad" } }], t);
  }
});

test("orden", () => {
  for (const t of ["más baratos", "los más económicos", "de menor a mayor"]) {
    assert.deepEqual(seg(t), [{ tipo: "orden", orden: "precio_asc" }], t);
  }
  for (const t of ["más caros", "de mayor a menor"]) {
    assert.deepEqual(seg(t), [{ tipo: "orden", orden: "precio_desc" }], t);
  }
});

test("más resultados", () => {
  for (const t of ["más", "otros", "siguientes", "muéstrame más", "¿hay más?", "ver más"]) {
    assert.deepEqual(seg(t), [{ tipo: "mas" }], t);
  }
});

test("quitar", () => {
  for (const t of ["quita los filtros", "sin filtros", "todos", "todas"]) {
    assert.deepEqual(seg(t), [{ tipo: "quitar" }], t);
  }
  assert.deepEqual(seg("quita la marca"), [{ tipo: "quitar", campo: "marca" }]);
});

test("más baratos es orden, más de 3000 es precio, más es página", () => {
  assert.deepEqual(seg("más baratos"), [{ tipo: "orden", orden: "precio_asc" }]);
  assert.deepEqual(seg("más de 3000"), [
    { tipo: "acote", acote: { campo: "precio", min: 300000 } },
  ]);
  assert.deepEqual(seg("muéstrame más"), [{ tipo: "mas" }]);
});

test("y bocinas? es búsqueda nueva", () => {
  assert.equal(seg("y bocinas?"), null);
  assert.equal(seg("y amplificadores de 4 canales?"), null);
  assert.equal(seg("memphis de 12 para lancha"), null);
});

test("y entonces? no cambia nada", () => {
  assert.equal(seg("y entonces?"), null);
  assert.equal(seg("y"), null);
});

test("número suelto sin campo no es cambio; fuera de 1 a 20 tampoco", () => {
  assert.equal(seg("10", { marcas: MARCAS, numeroSuelto: null }), null);
  assert.equal(seg("y de 150?"), null);
});

test("solo memphis de 10: dos cambios y una frase", () => {
  const cambios = seg("solo memphis de 10");
  assert.equal(cambios?.length, 2);
  assert.equal(fraseCambios(SUBS, cambios ?? [], MARCAS), 'Ahora solo Memphis de 10".');
});

test("frases de cada cambio", () => {
  const f = (cambios: Cambio[], antes = SUBS) => fraseCambios(antes, cambios, MARCAS);
  assert.equal(f([{ tipo: "acote", acote: { campo: "medida", pulgadas: 10 } }]), 'Ahora de 10".');
  assert.equal(
    f([{ tipo: "acote", acote: { campo: "medida", pulgadas: 10 } }], SUB12),
    'Cambié 12" por 10".',
  );
  assert.equal(
    f([{ tipo: "acote", acote: { campo: "medida", pulgadas: 15 } }], {
      ...SUBS,
      acotes: [{ campo: "medida", pulgadas: 12 }],
    }),
    'Cambié 12" por 15".',
  );
  assert.equal(
    f([{ tipo: "acote", acote: { campo: "canales", canales: 4 } }]),
    "Ahora de 4 canales.",
  );
  assert.equal(
    f([{ tipo: "acote", acote: { campo: "marca", slug: "memphis" } }]),
    "Ahora solo Memphis.",
  );
  assert.equal(
    f([{ tipo: "acote", acote: { campo: "precio", max: 200000 } }]),
    "Ahora hasta Q 2,000.00.",
  );
  assert.equal(f([{ tipo: "acote", acote: { campo: "disponibilidad" } }]), "Solo los disponibles.");
  assert.equal(f([{ tipo: "orden", orden: "precio_asc" }]), "Ordené de menor a mayor precio.");
  assert.equal(f([{ tipo: "orden", orden: "precio_desc" }]), "Ordené de mayor a menor precio.");
  assert.equal(f([{ tipo: "quitar" }]), "Quité los filtros.");
  assert.equal(f([{ tipo: "quitar", campo: "marca" }]), "Quité la marca.");
});

test("aplicar: la medida escrita en la base pasa a acote", () => {
  const nueva = aplicarCambios(SUB12, [
    { tipo: "acote", acote: { campo: "medida", pulgadas: 10 } },
  ]);
  assert.equal(nueva.base.tipo === "texto" && nueva.base.consulta, "sub");
  assert.equal(nueva.base.tipo === "texto" && nueva.base.visible, "sub");
  assert.deepEqual(nueva.acotes, [{ campo: "medida", pulgadas: 10 }]);
});

test("aplicar: reemplaza el mismo campo, quita, ordena y pagina", () => {
  let b = aplicarCambios(SUBS, [{ tipo: "acote", acote: { campo: "marca", slug: "kbt" } }]);
  b = aplicarCambios(b, [{ tipo: "acote", acote: { campo: "marca", slug: "memphis" } }]);
  assert.deepEqual(b.acotes, [{ campo: "marca", slug: "memphis" }]);
  b = aplicarCambios(b, [{ tipo: "mas" }]);
  b = aplicarCambios(b, [{ tipo: "mas" }]);
  assert.equal(b.pagina, 2);
  b = aplicarCambios(b, [{ tipo: "orden", orden: "precio_asc" }]);
  assert.equal(b.orden, "precio_asc");
  assert.equal(b.pagina ?? 0, 0);
  b = aplicarCambios(b, [{ tipo: "quitar" }]);
  assert.deepEqual(b.acotes, []);
});

test("sinMedidas", () => {
  assert.equal(sinMedidas("sub 12"), "sub");
  assert.equal(sinMedidas('subwoofer 12" memphis'), "subwoofer memphis");
  assert.equal(sinMedidas("subwoofer de 12 pulgadas"), "subwoofer de");
  assert.equal(sinMedidas("mjp1244"), "mjp1244");
});
