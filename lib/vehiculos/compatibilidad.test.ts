import test from "node:test";
import assert from "node:assert/strict";

import { compatibilidad, hayResultados, type Compatibilidad } from "./compatibilidad.ts";
import type { PiezaVehiculo, ProductoVehiculo, UbicacionVehiculo, Vehiculo } from "./types.ts";

const SPECS = [
  { etiqueta: "A", valor: "1" },
  { etiqueta: "B", valor: "2" },
  { etiqueta: "C", valor: "3" },
];

function producto(
  sku: string,
  categoria: string,
  extra: Partial<ProductoVehiculo>,
): ProductoVehiculo {
  return {
    sku,
    slug: sku.toLowerCase(),
    nombre: `Producto ${sku}`,
    marca: "Pioneer",
    categoria,
    precioCents: 100000,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: SPECS,
    ...extra,
  };
}

function receptor(
  sku: string,
  formato?: ProductoVehiculo["formato"],
  extra: Partial<ProductoVehiculo> = {},
) {
  return producto(sku, "Receptores", { ...(formato ? { formato } : {}), ...extra });
}

function bocina(
  sku: string,
  medida: ProductoVehiculo["medida"],
  extra: Partial<ProductoVehiculo> = {},
) {
  return producto(sku, "Bocinas", { medida, ...extra });
}

function vehiculo(extra: Partial<Vehiculo> = {}): Vehiculo {
  return {
    marca: "Toyota",
    marcaSlug: "toyota",
    modelo: "Corolla",
    modeloSlug: "corolla",
    version: null,
    versionSlug: null,
    desde: 2009,
    hasta: 2013,
    radio1din: null,
    radio2din: null,
    ubicaciones: [],
    ...extra,
  };
}

function ubicacion(
  nombre: string,
  medidas: string[],
  accesorio: UbicacionVehiculo["accesorio"] = null,
): UbicacionVehiculo {
  return { ubicacion: nombre, medidas, accesorio };
}

const KSM8: PiezaVehiculo = {
  sku: "KSM-8",
  slug: "kbt-ksm-8",
  nombre: 'Alza para bocinas de 6.5"',
};

function estados(c: Compatibilidad): [string, string][] {
  return c.receptores.map((r) => [r.producto.sku, r.estado.tipo]);
}

function skus(c: Compatibilidad, grupo: number): string[] {
  return c.grupos[grupo].bocinas.map((b) => b.producto.sku);
}

test("receptores: 1 DIN y 2 DIN siguen su columna", () => {
  const c = compatibilidad(vehiculo({ radio1din: "directo", radio2din: "con_marco" }), {
    receptores: [receptor("R1", "1-din"), receptor("R2", "2-din")],
    bocinas: [],
    piezas: [],
  });
  assert.deepEqual(estados(c), [
    ["R1", "cabe"],
    ["R2", "con_accesorios"],
  ]);
});

test("receptores: con no_cabe o sin dato, no sale", () => {
  const c = compatibilidad(vehiculo({ radio1din: "no_cabe", radio2din: null }), {
    receptores: [receptor("R1", "1-din"), receptor("R2", "2-din")],
    bocinas: [],
    piezas: [],
  });
  assert.deepEqual(estados(c), []);
});

test("DMH-ZS9350BT toma la mejor columna, aunque hoy su formato diga flotante", () => {
  const datos = { receptores: [receptor("DMH-ZS9350BT", "flotante")], bocinas: [], piezas: [] };
  assert.deepEqual(
    estados(compatibilidad(vehiculo({ radio1din: "con_marco", radio2din: "directo" }), datos)),
    [["DMH-ZS9350BT", "cabe"]],
  );
  assert.deepEqual(
    estados(compatibilidad(vehiculo({ radio1din: "con_marco", radio2din: "no_cabe" }), datos)),
    [["DMH-ZS9350BT", "con_accesorios"]],
  );
  assert.deepEqual(
    estados(compatibilidad(vehiculo({ radio1din: "no_cabe", radio2din: null }), datos)),
    [],
  );
});

test("DMH-AP6650BT sale siempre, con Consultar", () => {
  const c = compatibilidad(vehiculo({ radio1din: "no_cabe", radio2din: "no_cabe" }), {
    receptores: [receptor("DMH-AP6650BT", "flotante")],
    bocinas: [],
    piezas: [],
  });
  assert.deepEqual(estados(c), [["DMH-AP6650BT", "consultar"]]);
});

test("otro receptor específico o flotante no sale nunca", () => {
  const c = compatibilidad(vehiculo({ radio1din: "directo", radio2din: "directo" }), {
    receptores: [receptor("PMX-3", "especifico"), receptor("X1", "flotante"), receptor("X2")],
    bocinas: [],
    piezas: [],
  });
  assert.deepEqual(estados(c), []);
});

test("bocinas: solo la misma medida", () => {
  const c = compatibilidad(
    vehiculo({ ubicaciones: [ubicacion("Delanteras", ['6.5"']), ubicacion("Traseras", ['6"'])] }),
    {
      receptores: [],
      bocinas: [bocina("B65", '6.5"'), bocina("B675", '6.75"'), bocina("B69", '6x9"')],
      piezas: [],
    },
  );
  assert.deepEqual(skus(c, 0), ["B65"]);
  assert.deepEqual(skus(c, 1), []);
});

test("bocinas: dos medidas traen las de ambas, y una bocina sale en dos ubicaciones", () => {
  const c = compatibilidad(
    vehiculo({
      ubicaciones: [ubicacion("Delanteras", ['5.25"', '6.5"']), ubicacion("Traseras", ['6.5"'])],
    }),
    {
      receptores: [],
      bocinas: [bocina("B525", '5.25"', { precioCents: 200000 }), bocina("B65", '6.5"')],
      piezas: [],
    },
  );
  assert.deepEqual(skus(c, 0), ["B525", "B65"]);
  assert.deepEqual(skus(c, 1), ["B65"]);
});

test("bocinas: el accesorio de la ubicación decide el estado", () => {
  const c = compatibilidad(
    vehiculo({
      ubicaciones: [
        ubicacion("Uno", ['6.5"'], null),
        ubicacion("Dos", ['6.5"'], "KSM-8"),
        ubicacion("Tres", ['6.5"'], "OEMBKT60"),
        ubicacion("Cuatro", ['6.5"'], "otro"),
      ],
    }),
    { receptores: [], bocinas: [bocina("B65", '6.5"')], piezas: [KSM8] },
  );
  assert.deepEqual(
    c.grupos.map((g) => g.bocinas[0].estado),
    [
      { tipo: "cabe" },
      { tipo: "con_pieza", pieza: KSM8 },
      { tipo: "con_accesorios" },
      { tipo: "con_accesorios" },
    ],
  );
});

test("un grupo sin bocinas sale igual, vacío, con su ubicación y sus medidas", () => {
  const c = compatibilidad(
    vehiculo({ ubicaciones: [ubicacion("Delanteras", ['6.5"']), ubicacion("Traseras", ['6x8"'])] }),
    { receptores: [], bocinas: [bocina("B65", '6.5"')], piezas: [] },
  );
  assert.equal(c.grupos.length, 2);
  assert.deepEqual(
    {
      ubicacion: c.grupos[1].ubicacion,
      medidas: c.grupos[1].medidas,
      bocinas: c.grupos[1].bocinas,
    },
    { ubicacion: "Traseras", medidas: ['6x8"'], bocinas: [] },
  );
});

test("orden: por estado y, dentro, por relevancia", () => {
  const c = compatibilidad(vehiculo({ radio1din: "con_marco", radio2din: "directo" }), {
    receptores: [
      receptor("DMH-AP6650BT", "flotante", { destacado: true, precioCents: 900000 }),
      receptor("C1", "2-din", { precioCents: 100000 }),
      receptor("C2", "2-din", { destacado: true, precioCents: 50000 }),
      receptor("M1", "1-din", { precioCents: 900000 }),
    ],
    bocinas: [],
    piezas: [],
  });
  assert.deepEqual(
    c.receptores.map((r) => r.producto.sku),
    ["C2", "C1", "M1", "DMH-AP6650BT"],
  );
});

test("hayResultados: falso solo sin receptores y con todos los grupos vacíos", () => {
  const vacio = compatibilidad(vehiculo({ ubicaciones: [ubicacion("Traseras", ['6x8"'])] }), {
    receptores: [receptor("R1", "1-din")],
    bocinas: [bocina("B65", '6.5"')],
    piezas: [],
  });
  assert.equal(hayResultados(vacio), false);
  const conBocina = compatibilidad(vehiculo({ ubicaciones: [ubicacion("Delanteras", ['6.5"'])] }), {
    receptores: [],
    bocinas: [bocina("B65", '6.5"')],
    piezas: [],
  });
  assert.equal(hayResultados(conBocina), true);
  const conReceptor = compatibilidad(vehiculo({ radio1din: "directo" }), {
    receptores: [receptor("R1", "1-din")],
    bocinas: [],
    piezas: [],
  });
  assert.equal(hayResultados(conReceptor), true);
});
