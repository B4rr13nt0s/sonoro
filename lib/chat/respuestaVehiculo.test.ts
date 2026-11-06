import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import type { Producto } from "../catalog/types.ts";
import { INSTALACION } from "../politicas.ts";
import { armarDatosVehiculos } from "../vehiculos/datos.ts";
import {
  ERROR_CARGA,
  ETIQUETA_WHATSAPP_VEHICULO,
  NO_ESTA_VEHICULO,
  SIN_RESULTADOS,
  TEXTO_PEDIR_VEHICULO,
  VER_TODO_BUSCAR,
  lineaConsultar,
  notaReceptor,
} from "../vehiculos/textos.ts";
import type { DatosVehiculos, ProductoVehiculo, Vehiculo } from "../vehiculos/types.ts";
import { buildVehicleInquiryMessage } from "../whatsapp/message.ts";
import {
  bloquesSinVehiculos,
  idOpcionVehiculo,
  leerOpcionVehiculo,
  responderVehiculo,
  type PedidoVehiculo,
} from "./respuestaVehiculo.ts";
import type { Bloque } from "./tipos.ts";

function tarjeta(
  sku: string,
  categoria: string,
  precioCents: number,
  extra: Partial<ProductoVehiculo> = {},
): ProductoVehiculo {
  return {
    sku,
    slug: sku.toLowerCase(),
    nombre: `Producto ${sku}`,
    marca: "Memphis",
    categoria,
    precioCents,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: [],
    ...extra,
  };
}

function vehiculo(extra: Partial<Vehiculo>): Vehiculo {
  return {
    marca: "Prueba",
    marcaSlug: "prueba",
    modelo: "Uno",
    modeloSlug: "uno",
    version: null,
    versionSlug: null,
    desde: 2008,
    hasta: 2012,
    radio1din: null,
    radio2din: null,
    ubicaciones: [],
    ...extra,
  };
}

const UNO_2008 = vehiculo({
  radio1din: "con_marco",
  radio2din: "directo",
  ubicaciones: [
    { ubicacion: "Puertas delanteras", medidas: ['6.5"'], accesorio: "KSM-8" },
    { ubicacion: "Puertas traseras", medidas: ['6.5"'], accesorio: "otro" },
    { ubicacion: "Bandeja trasera", medidas: ['6x9"'], accesorio: null },
    { ubicacion: "Tablero", medidas: ['6x8"'], accesorio: null },
  ],
});

const DATOS: DatosVehiculos = {
  vehiculos: [
    UNO_2008,
    vehiculo({ desde: 2013, hasta: 2015 }),
    vehiculo({ desde: 2016, hasta: 2016, version: "A", versionSlug: "a", radio2din: "directo" }),
    vehiculo({ desde: 2016, hasta: 2016, version: "B", versionSlug: "b", radio2din: "directo" }),
    vehiculo({ modelo: "Dos", modeloSlug: "dos", desde: 2010, hasta: 2014, radio2din: "directo" }),
  ],
  receptores: [
    tarjeta("R1", "Receptores", 100000, { formato: "1-din" }),
    tarjeta("R2", "Receptores", 300000, { formato: "2-din" }),
    tarjeta("R3", "Receptores", 200000, { formato: "2-din" }),
    tarjeta("DMH-AP6650BT", "Receptores", 500000, { formato: "flotante" }),
    tarjeta("DMH-A5650BT", "Receptores", 400000, { formato: "1-din" }),
  ],
  bocinas: [
    ...[1, 2, 3, 4, 5, 6].map((n) => tarjeta(`B${n}`, "Bocinas", 10000 * n, { medida: '6.5"' })),
    tarjeta("B7", "Bocinas", 50000, { medida: '6x9"' }),
  ],
  piezas: [{ sku: "KSM-8", slug: "ksm-8", nombre: 'Alza para bocinas de 6.5"' }],
};

function pedido(sel: PedidoVehiculo["sel"], extra: Partial<PedidoVehiculo> = {}): PedidoVehiculo {
  return { sel, rango: false, ver: null, ...extra };
}

function textos(bloques: Bloque[]): string[] {
  return bloques.flatMap((b) => (b.tipo === "texto" ? [b.texto] : []));
}

function opciones(bloques: Bloque[]): { id: string; etiqueta: string }[] {
  return bloques.flatMap((b) => (b.tipo === "opciones" ? b.opciones : []));
}

const SEL_2010 = { marca: "prueba", modelo: "uno", anio: 2010 };

test("idOpcionVehiculo y leerOpcionVehiculo: ida y vuelta", () => {
  const casos: PedidoVehiculo[] = [
    pedido({}),
    pedido({ marca: "prueba" }),
    pedido(SEL_2010),
    pedido({ ...SEL_2010, version: "a" }, { rango: true }),
    pedido(SEL_2010, { ver: { tipo: "receptores" } }),
    pedido(SEL_2010, { ver: { tipo: "ubicacion", indice: 2 } }),
  ];
  for (const caso of casos) {
    const id = idOpcionVehiculo(caso);
    assert.ok(id.startsWith("vehiculo:"), id);
    assert.deepEqual(leerOpcionVehiculo(id), caso, id);
  }
  assert.equal(
    idOpcionVehiculo(pedido(SEL_2010, { ver: { tipo: "receptores" } })),
    "vehiculo:vehiculo=prueba&modelo=uno&anio=2010&ver=receptores",
  );
  assert.equal(leerOpcionVehiculo("marca:memphis"), null);
});

test("sin nada: pide el carro, ofrece las marcas y la salida por WhatsApp", () => {
  const { bloques, titulo, resultados } = responderVehiculo(pedido({}), DATOS);
  // Una lancha o un UTV no están en la lista: «¿No está tu vehículo?» es la salida.
  assert.deepEqual(textos(bloques), [TEXTO_PEDIR_VEHICULO, NO_ESTA_VEHICULO]);
  assert.equal(bloques.at(-1)?.tipo, "whatsapp");
  assert.deepEqual(opciones(bloques), [
    { id: idOpcionVehiculo(pedido({ marca: "prueba" })), etiqueta: "Prueba" },
  ]);
  assert.equal(titulo, null);
  assert.equal(resultados, null);
});

test("con la marca: pide el modelo", () => {
  const { bloques } = responderVehiculo(pedido({ marca: "prueba" }), DATOS);
  assert.deepEqual(textos(bloques), ["¿Qué modelo de Prueba?"]);
  assert.deepEqual(
    opciones(bloques).map((o) => o.etiqueta),
    ["Dos", "Uno"],
  );
});

test("un botón viejo vuelve a preguntar desde lo que falta", () => {
  const { bloques } = responderVehiculo(pedido({ marca: "prueba", modelo: "no-existe" }), DATOS);
  assert.deepEqual(textos(bloques), ["¿Qué modelo de Prueba?"]);
});

test("modelo sin año: un botón por generación, del más nuevo al más viejo", () => {
  const { bloques } = responderVehiculo(pedido({ marca: "prueba", modelo: "uno" }), DATOS);
  assert.deepEqual(textos(bloques), ["¿De qué año es tu Prueba Uno?"]);
  assert.deepEqual(opciones(bloques), [
    {
      id: idOpcionVehiculo(pedido({ marca: "prueba", modelo: "uno", anio: 2016 }, { rango: true })),
      etiqueta: "2016",
    },
    {
      id: idOpcionVehiculo(pedido({ marca: "prueba", modelo: "uno", anio: 2013 }, { rango: true })),
      etiqueta: "2013–2015",
    },
    {
      id: idOpcionVehiculo(pedido({ marca: "prueba", modelo: "uno", anio: 2008 }, { rango: true })),
      etiqueta: "2008–2012",
    },
  ]);
});

test("un modelo con una sola generación no pregunta el año", () => {
  const { bloques, titulo } = responderVehiculo(pedido({ marca: "prueba", modelo: "dos" }), DATOS);
  assert.equal(titulo, "Prueba Dos 2010–2014");
  assert.equal(textos(bloques)[0], "Prueba Dos 2010–2014");
  const enlace = bloques.find((b) => b.tipo === "texto" && b.enlace);
  assert.equal(
    enlace?.tipo === "texto" ? enlace.enlace?.href : null,
    "/buscar?vehiculo=prueba&modelo=dos&anio=2010",
  );
});

test("año fuera de la lista: lo dice, ofrece las generaciones y WhatsApp", () => {
  const { bloques } = responderVehiculo(
    pedido({ marca: "prueba", modelo: "uno", anio: 1980 }),
    DATOS,
  );
  assert.deepEqual(textos(bloques), ["No tengo el Prueba Uno 1980 en la lista.", NO_ESTA_VEHICULO]);
  assert.equal(opciones(bloques).length, 3);
  assert.deepEqual(bloques.at(-1), {
    tipo: "whatsapp",
    etiqueta: ETIQUETA_WHATSAPP_VEHICULO,
    motivo: "hablar",
    mensaje: buildVehicleInquiryMessage(),
  });
});

test("un año con versiones las pide", () => {
  const { bloques } = responderVehiculo(
    pedido({ marca: "prueba", modelo: "uno", anio: 2016 }, { rango: true }),
    DATOS,
  );
  assert.deepEqual(textos(bloques), ["¿Cuál es tu Prueba Uno 2016?"]);
  assert.deepEqual(opciones(bloques), [
    {
      id: idOpcionVehiculo(
        pedido({ marca: "prueba", modelo: "uno", anio: 2016, version: "a" }, { rango: true }),
      ),
      etiqueta: "A",
    },
    {
      id: idOpcionVehiculo(
        pedido({ marca: "prueba", modelo: "uno", anio: 2016, version: "b" }, { rango: true }),
      ),
      etiqueta: "B",
    },
  ]);
});

test("el resumen: receptores por estado, una línea por ubicación, instalación y botones", () => {
  const { bloques, titulo, resultados } = responderVehiculo(pedido(SEL_2010), DATOS);
  assert.equal(titulo, "Prueba Uno 2010");
  assert.equal(resultados, 5 + 6 + 6 + 1);
  assert.deepEqual(textos(bloques), [
    "Prueba Uno 2010",
    "Receptores: 2 caben y 2 caben con accesorios.",
    lineaConsultar("Producto DMH-AP6650BT"),
    'Puertas delanteras · 6.5": 6 bocinas, caben con',
    'Puertas traseras · 6.5": 6 bocinas, caben con accesorios.',
    'Bandeja trasera · 6x9": 1 bocina, cabe.',
    'No hay bocinas de 6x8" en el catálogo.',
    INSTALACION,
    "",
  ]);
  const conPieza = bloques[3];
  assert.deepEqual(conPieza.tipo === "texto" ? conPieza.enlace : null, {
    etiqueta: 'Alza para bocinas de 6.5"',
    href: "/producto/ksm-8",
    despues: ".",
  });
  assert.deepEqual(
    opciones(bloques).map((o) => o.etiqueta),
    [
      "Receptores",
      'Puertas delanteras · 6.5"',
      'Puertas traseras · 6.5"',
      'Bandeja trasera · 6x9"',
    ],
  );
  assert.equal(
    opciones(bloques)[0].id,
    idOpcionVehiculo(pedido(SEL_2010, { ver: { tipo: "receptores" } })),
  );
  assert.equal(
    opciones(bloques)[3].id,
    idOpcionVehiculo(pedido(SEL_2010, { ver: { tipo: "ubicacion", indice: 2 } })),
  );
  assert.deepEqual(bloques.at(-1), {
    tipo: "texto",
    texto: "",
    enlace: { etiqueta: VER_TODO_BUSCAR, href: "/buscar?vehiculo=prueba&modelo=uno&anio=2010" },
  });
});

test("un vehículo donde no cabe nada", () => {
  // La DMH-AP6650BT sale en cualquier vehículo (PANTALLAS_ESPECIALES), como en /buscar.
  const sinPantalla = {
    ...DATOS,
    receptores: DATOS.receptores.filter((r) => r.sku !== "DMH-AP6650BT"),
  };
  const { bloques, resultados } = responderVehiculo(
    pedido({ marca: "prueba", modelo: "uno", anio: 2014 }),
    sinPantalla,
  );
  assert.deepEqual(textos(bloques), ["Prueba Uno 2014", SIN_RESULTADOS]);
  assert.equal(bloques.at(-1)?.tipo, "whatsapp");
  assert.equal(resultados, 0);
});

test("el grupo de receptores: hasta 5, en el orden de compatibilidad, con su nota", () => {
  const { bloques, titulo, resultados } = responderVehiculo(
    pedido(SEL_2010, { ver: { tipo: "receptores" } }),
    DATOS,
  );
  assert.equal(titulo, "Prueba Uno 2010");
  assert.equal(resultados, null);
  assert.equal(textos(bloques)[0], "Receptores · Prueba Uno 2010");
  const productos = bloques.find((b) => b.tipo === "productos");
  assert.ok(productos?.tipo === "productos");
  // 2 DIN directo (cabe) por precio descendente, luego 1 DIN con marco, luego consultar.
  assert.deepEqual(productos.skus, ["R2", "R3", "DMH-A5650BT", "R1", "DMH-AP6650BT"]);
  assert.equal(productos.total, 5);
  assert.equal(productos.verTodosHref, "/buscar?vehiculo=prueba&modelo=uno&anio=2010");
  assert.deepEqual(productos.notas, { "DMH-A5650BT": notaReceptor("DMH-A5650BT") });
  assert.deepEqual(
    opciones(bloques).map((o) => o.etiqueta),
    ['Puertas delanteras · 6.5"', 'Puertas traseras · 6.5"', 'Bandeja trasera · 6x9"'],
  );
});

test("el grupo de una ubicación: los primeros 5 y el total", () => {
  const { bloques } = responderVehiculo(
    pedido(SEL_2010, { ver: { tipo: "ubicacion", indice: 0 } }),
    DATOS,
  );
  assert.equal(textos(bloques)[0], 'Puertas delanteras · 6.5" · Prueba Uno 2010');
  const productos = bloques.find((b) => b.tipo === "productos");
  assert.ok(productos?.tipo === "productos");
  assert.deepEqual(productos.skus, ["B6", "B5", "B4", "B3", "B2"]);
  assert.equal(productos.total, 6);
  assert.equal(productos.notas, undefined);
  assert.equal(opciones(bloques)[0].etiqueta, "Receptores");
});

test("un grupo que no existe vuelve al resumen", () => {
  const { bloques } = responderVehiculo(
    pedido(SEL_2010, { ver: { tipo: "ubicacion", indice: 9 } }),
    DATOS,
  );
  assert.equal(textos(bloques)[1], "Receptores: 2 caben y 2 caben con accesorios.");
});

test("bloquesSinVehiculos: el error y el enlace al selector", () => {
  assert.deepEqual(bloquesSinVehiculos(), [
    {
      tipo: "texto",
      texto: ERROR_CARGA,
      enlace: { etiqueta: "Buscar por vehículo", href: "/buscar?por=vehiculo", despues: "." },
    },
  ]);
});

test("con los datos reales: el resumen del Corolla 2010", () => {
  const catalogo = JSON.parse(readFileSync("data/catalog.json", "utf-8")) as Producto[];
  const vehiculos = (
    JSON.parse(readFileSync("data/vehiculos.json", "utf-8")) as { vehiculos: Vehiculo[] }
  ).vehiculos;
  const { bloques, titulo } = responderVehiculo(
    pedido({ marca: "toyota", modelo: "corolla", anio: 2010 }),
    armarDatosVehiculos(vehiculos, catalogo),
  );
  assert.equal(titulo, "Toyota Corolla 2010");
  assert.equal(textos(bloques)[0], "Toyota Corolla 2010");
  assert.ok(textos(bloques).includes(INSTALACION));
});
