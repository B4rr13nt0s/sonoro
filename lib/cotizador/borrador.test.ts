import test from "node:test";
import assert from "node:assert/strict";

import {
  BORRADOR_VACIO,
  CLAVE_BORRADOR,
  borradorReducer,
  guardarBorrador,
  leerBorrador,
  resolverBorrador,
  type Borrador,
  type ProductoCotizable,
} from "./borrador.ts";

const CATALOGO: ProductoCotizable[] = [
  { sku: "A1", nombre: "Producto A1", precioCents: 10000, disponibilidad: "disponible" },
  { sku: "B2", nombre: "Producto B2", precioCents: 25000, disponibilidad: "bajo_pedido" },
  { sku: "C3", nombre: "Producto C3", precioCents: 5000, disponibilidad: "agotado" },
];

function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = { ...inicial };
  return {
    datos,
    getItem: (clave: string) => (clave in datos ? datos[clave] : null),
    setItem: (clave: string, valor: string) => {
      datos[clave] = valor;
    },
  };
}

// --- reductor ---------------------------------------------------------------

test("agregar suma de a una unidad y crea la línea en 1", () => {
  let b = borradorReducer(BORRADOR_VACIO, { type: "agregar", sku: "A1" });
  assert.deepEqual(b.lineas, [{ sku: "A1", qty: 1 }]);
  b = borradorReducer(b, { type: "agregar", sku: "A1" });
  b = borradorReducer(b, { type: "agregar", sku: "B2" });
  assert.deepEqual(b.lineas, [
    { sku: "A1", qty: 2 },
    { sku: "B2", qty: 1 },
  ]);
});

test("una línea no pasa de 99 unidades", () => {
  let b: Borrador = { cliente: "", lineas: [{ sku: "A1", qty: 99 }] };
  b = borradorReducer(b, { type: "agregar", sku: "A1" });
  assert.equal(b.lineas[0].qty, 99);
  b = borradorReducer(b, { type: "cantidad", sku: "A1", qty: 150 });
  assert.equal(b.lineas[0].qty, 99);
});

test("cantidad cambia la línea; 0 o menos la quita; sobre una línea inexistente no hace nada", () => {
  const base: Borrador = { cliente: "", lineas: [{ sku: "A1", qty: 3 }] };
  assert.deepEqual(borradorReducer(base, { type: "cantidad", sku: "A1", qty: 5 }).lineas, [
    { sku: "A1", qty: 5 },
  ]);
  assert.deepEqual(borradorReducer(base, { type: "cantidad", sku: "A1", qty: 0 }).lineas, []);
  assert.deepEqual(borradorReducer(base, { type: "cantidad", sku: "A1", qty: -2 }).lineas, []);
  assert.deepEqual(borradorReducer(base, { type: "cantidad", sku: "ZZ", qty: 4 }), base);
});

test("quitar saca la línea", () => {
  const base: Borrador = {
    cliente: "",
    lineas: [
      { sku: "A1", qty: 1 },
      { sku: "B2", qty: 2 },
    ],
  };
  assert.deepEqual(borradorReducer(base, { type: "quitar", sku: "A1" }).lineas, [
    { sku: "B2", qty: 2 },
  ]);
});

test("el cliente se corta a 80 caracteres", () => {
  const b = borradorReducer(BORRADOR_VACIO, { type: "cliente", texto: "x".repeat(200) });
  assert.equal(b.cliente.length, 80);
});

test("vaciar borra las líneas y también el cliente", () => {
  const base: Borrador = { cliente: "Juan", lineas: [{ sku: "A1", qty: 2 }] };
  assert.deepEqual(borradorReducer(base, { type: "vaciar" }), BORRADOR_VACIO);
});

test("cargar reemplaza el borrador", () => {
  const cargado: Borrador = { cliente: "Ana", lineas: [{ sku: "B2", qty: 4 }] };
  assert.deepEqual(borradorReducer(BORRADOR_VACIO, { type: "cargar", borrador: cargado }), cargado);
});

// --- resolver ---------------------------------------------------------------

test("el precio, el nombre y la disponibilidad salen del catálogo, no del borrador", () => {
  const { lineas, quitados } = resolverBorrador(
    {
      cliente: "",
      lineas: [
        { sku: "B2", qty: 2 },
        { sku: "A1", qty: 1 },
      ],
    },
    CATALOGO,
  );
  assert.deepEqual(quitados, []);
  assert.deepEqual(lineas, [
    {
      sku: "B2",
      nombre: "Producto B2",
      qty: 2,
      unitPriceCents: 25000,
      disponibilidad: "bajo_pedido",
    },
    {
      sku: "A1",
      nombre: "Producto A1",
      qty: 1,
      unitPriceCents: 10000,
      disponibilidad: "disponible",
    },
  ]);
});

test("un sku que no está en el catálogo o que se agotó va a quitados", () => {
  const { lineas, quitados } = resolverBorrador(
    {
      cliente: "",
      lineas: [
        { sku: "A1", qty: 1 },
        { sku: "NO-EXISTE", qty: 1 },
        { sku: "C3", qty: 2 },
      ],
    },
    CATALOGO,
  );
  assert.deepEqual(
    lineas.map((l) => l.sku),
    ["A1"],
  );
  assert.deepEqual(quitados, ["NO-EXISTE", "C3"]);
});

// --- almacenamiento ---------------------------------------------------------

test("guardar y leer dan el mismo borrador", () => {
  const almacen = almacenFalso();
  const borrador: Borrador = { cliente: "Juan Pérez", lineas: [{ sku: "A1", qty: 3 }] };
  guardarBorrador(almacen, borrador);
  assert.ok(CLAVE_BORRADOR in almacen.datos);
  assert.deepEqual(leerBorrador(almacen), borrador);
});

test("sin nada guardado, el borrador es el vacío", () => {
  assert.deepEqual(leerBorrador(almacenFalso()), BORRADOR_VACIO);
});

test("sin almacenamiento (null) no se rompe nada", () => {
  assert.deepEqual(leerBorrador(null), BORRADOR_VACIO);
  assert.doesNotThrow(() => guardarBorrador(null, BORRADOR_VACIO));
});

test("un almacenamiento que lanza al leer o al guardar no propaga el error", () => {
  const roto = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.deepEqual(leerBorrador(roto), BORRADOR_VACIO);
  assert.doesNotThrow(() => guardarBorrador(roto, { cliente: "", lineas: [] }));
});

test("lo guardado que está corrupto o fuera de rango se descarta entero", () => {
  const muchas = Array.from({ length: 401 }, (_, i) => ({ sku: `S${i}`, qty: 1 }));
  const malos: unknown[] = [
    "{no es json",
    "null",
    "[]",
    {},
    { cliente: "", lineas: [{ sku: "A1", qty: 0 }] },
    { cliente: "", lineas: [{ sku: "A1", qty: -1 }] },
    { cliente: "", lineas: [{ sku: "A1", qty: 1.5 }] },
    { cliente: "", lineas: [{ sku: "A1", qty: 500 }] },
    { cliente: "", lineas: [{ sku: "x".repeat(65), qty: 1 }] },
    { cliente: "", lineas: muchas },
    { cliente: 42, lineas: [] },
    { cliente: "x".repeat(81), lineas: [] },
  ];
  for (const malo of malos) {
    const crudo = typeof malo === "string" ? malo : JSON.stringify(malo);
    const almacen = almacenFalso({ [CLAVE_BORRADOR]: crudo });
    assert.deepEqual(
      leerBorrador(almacen),
      BORRADOR_VACIO,
      `debió descartar ${crudo.slice(0, 60)}`,
    );
  }
});
