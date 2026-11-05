import test from "node:test";
import assert from "node:assert/strict";

import type { Producto } from "../catalog/types.ts";
import { armarDatosVehiculos } from "./datos.ts";
import type { Vehiculo } from "./types.ts";

const SPECS = [
  { etiqueta: "A", valor: "1" },
  { etiqueta: "B", valor: "2" },
  { etiqueta: "C", valor: "3" },
];

function prod(sku: string, categoria: string, extra: Partial<Producto> = {}): Producto {
  return {
    sku,
    slug: sku.toLowerCase(),
    nombre: `Producto ${sku}`,
    marca: "KBT",
    categoria,
    descripcionCorta: "—",
    uso: ["carro"],
    specsDestacadas: SPECS,
    specsFicha: SPECS,
    precioCents: 100000,
    moneda: "GTQ",
    disponibilidad: "disponible",
    imagenes: [],
    destacado: false,
    activo: true,
    ...extra,
  };
}

const COROLLA: Vehiculo = {
  marca: "Toyota",
  marcaSlug: "toyota",
  modelo: "Corolla",
  modeloSlug: "corolla",
  version: null,
  versionSlug: null,
  desde: 2009,
  hasta: 2013,
  radio1din: null,
  radio2din: "directo",
  ubicaciones: [{ ubicacion: "Puertas delanteras", medidas: ['6.5"'], accesorio: null }],
};

test("armarDatosVehiculos: entran receptores y bocinas activos, para carro y que se pueden pedir", () => {
  const d = armarDatosVehiculos(
    [],
    [
      prod("R1", "Receptores", { atributos: { formato: "2-din" } }),
      prod("R2", "Receptores", { disponibilidad: "agotado" }),
      prod("R3", "Receptores", { activo: false }),
      prod("R4", "Receptores", { disponibilidad: "bajo_pedido" }),
      prod("B1", "Bocinas", { uso: ["marino"], atributos: { medida: '6.5"' } }),
      prod("B2", "Bocinas", { uso: ["carro", "marino"], atributos: { medida: '6.5"' } }),
      prod("B3", "Bocinas", { uso: undefined, atributos: { medida: '6x9"' } }),
      prod("S1", "Sistemas", { categoriasSecundarias: ["Bocinas"] }),
      prod("A1", "Amplificadores"),
    ],
  );
  assert.deepEqual(
    d.receptores.map((p) => p.sku),
    ["R1", "R4"],
  );
  assert.deepEqual(
    d.bocinas.map((p) => p.sku),
    ["B2", "B3"],
  );
});

test("armarDatosVehiculos: el receptor lleva formato y la bocina medida, sin ficha ni atributos", () => {
  const d = armarDatosVehiculos(
    [],
    [
      prod("R1", "Receptores", { atributos: { formato: "2-din" } }),
      prod("B1", "Bocinas", { atributos: { medida: '6.5"' } }),
    ],
  );
  assert.equal(d.receptores[0].formato, "2-din");
  assert.equal(d.bocinas[0].medida, '6.5"');
  for (const p of [d.receptores[0], d.bocinas[0]]) {
    assert.ok(!("specsFicha" in p), "no lleva specsFicha");
    assert.ok(!("atributos" in p), "no lleva atributos");
  }
});

test("armarDatosVehiculos: una pieza viaja solo si está activa y no agotada", () => {
  const d = armarDatosVehiculos(
    [],
    [
      prod("KSM-8", "Accesorios", { slug: "kbt-ksm-8", nombre: 'Alza para bocinas de 6.5"' }),
      prod("OEMBKT60", "Accesorios", { disponibilidad: "agotado" }),
      prod("OEMBKT69", "Accesorios", { activo: false }),
    ],
  );
  assert.deepEqual(d.piezas, [
    { sku: "KSM-8", slug: "kbt-ksm-8", nombre: 'Alza para bocinas de 6.5"' },
  ]);
});

test("armarDatosVehiculos: los vehículos pasan tal cual", () => {
  assert.deepEqual(armarDatosVehiculos([COROLLA], []).vehiculos, [COROLLA]);
});
