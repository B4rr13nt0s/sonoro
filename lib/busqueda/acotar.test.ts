import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoTarjeta } from "../catalog/types.ts";
import {
  acoteDeId,
  aplicarAcotes,
  cercanosEnLista,
  describirAcote,
  gruposDeAcote,
  hrefAcotado,
  idDeAcote,
  type Acote,
} from "./acotar.ts";
import type { ProductoBuscable } from "./busqueda.ts";

const MARCAS = [
  { nombre: "KBT", slug: "kbt" },
  { nombre: "Memphis", slug: "memphis" },
  { nombre: "Rockford Fosgate", slug: "rockford-fosgate" },
];

function producto(sku: string, extra: Partial<ProductoBuscable> = {}): ProductoBuscable {
  const base: ProductoTarjeta = {
    sku,
    slug: sku.toLowerCase(),
    nombre: `Producto ${sku}`,
    marca: "Memphis",
    categoria: "Subwoofers",
    precioCents: 100000,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: [],
  };
  return { ...base, ...extra };
}

const SUBS = [
  producto("A", { pulgadas: 10, precioCents: 50000, marca: "KBT" }),
  producto("B", { pulgadas: 10, precioCents: 80000 }),
  producto("C", { pulgadas: 12, precioCents: 120000 }),
  producto("D", { pulgadas: 12, precioCents: 150000, marca: "Rockford Fosgate" }),
  producto("E", { pulgadas: 12, precioCents: 200000 }),
  producto("F", { pulgadas: 15, precioCents: 300000 }),
];

const campos = (grupos: ReturnType<typeof gruposDeAcote>) => grupos.map((g) => g.campo);

test("grupos: solo los que tienen dos valores o más, en orden", () => {
  const grupos = gruposDeAcote(SUBS, MARCAS);
  // Todos son Subwoofers: no hay grupo de categoría. Ninguno trae canales.
  assert.deepEqual(campos(grupos), ["medida", "marca", "precio"]);
  const medida = grupos.find((g) => g.campo === "medida");
  assert.deepEqual(
    medida?.opciones.map((o) => [o.etiqueta, o.cantidad]),
    [
      ['10"', 2],
      ['12"', 3],
      ['15"', 1],
    ],
  );
});

test("marcas: en el orden del negocio, no por nombre ni por cantidad", () => {
  const marca = gruposDeAcote(SUBS, MARCAS).find((g) => g.campo === "marca");
  assert.deepEqual(
    marca?.opciones.map((o) => o.etiqueta),
    ["Memphis", "Rockford Fosgate", "KBT"],
  );
});

test("precio: tres tramos por tercios, con límites que son precios reales", () => {
  const precio = gruposDeAcote(SUBS, MARCAS).find((g) => g.campo === "precio");
  assert.deepEqual(
    precio?.opciones.map((o) => [o.etiqueta, o.cantidad]),
    [
      ["Hasta Q 800.00", 2],
      ["Q 800.00 a Q 1,500.00", 2],
      ["Más de Q 1,500.00", 2],
    ],
  );
  // Con menos de seis resultados no se parte por precio.
  assert.ok(!campos(gruposDeAcote(SUBS.slice(0, 5), MARCAS)).includes("precio"));
});

test("categoría: cuando los resultados mezclan categorías; un Sistema cuenta en sus secundarias", () => {
  const mezcla = [
    ...SUBS.slice(0, 2),
    producto("S", { categoria: "Sistemas", categoriasSecundarias: ["Subwoofers", "Bocinas"] }),
    producto("X", { categoria: "Bocinas" }),
  ];
  const categoria = gruposDeAcote(mezcla, MARCAS).find((g) => g.campo === "categoria");
  assert.deepEqual(
    categoria?.opciones.map((o) => [o.etiqueta, o.cantidad]),
    [
      ["Subwoofers", 3],
      ["Bocinas", 2],
    ],
  );
});

test("canales: «1 canal» y «4 canales»", () => {
  const amps = [producto("M", { canales: 1 }), producto("Q", { canales: 4 })];
  const canales = gruposDeAcote(amps, MARCAS).find((g) => g.campo === "canales");
  assert.deepEqual(
    canales?.opciones.map((o) => o.etiqueta),
    ["1 canal", "4 canales"],
  );
});

test("un campo ya elegido no vuelve a ofrecerse", () => {
  assert.ok(!campos(gruposDeAcote(SUBS, MARCAS, ["medida"])).includes("medida"));
});

test("aplicar: todos los acotes a la vez; el tramo de precio no incluye su mínimo", () => {
  const acotes: Acote[] = [
    { campo: "medida", pulgadas: 12 },
    { campo: "precio", min: 120000, max: 200000 },
  ];
  assert.deepEqual(
    aplicarAcotes(SUBS, acotes, MARCAS).map((p) => p.sku),
    ["D", "E"],
  );
  assert.deepEqual(
    aplicarAcotes(SUBS, [{ campo: "marca", slug: "kbt" }], MARCAS).map((p) => p.sku),
    ["A"],
  );
});

test("id: ida y vuelta, y un id que no es de acote da null", () => {
  const acotes: Acote[] = [
    { campo: "categoria", slug: "subwoofers" },
    { campo: "medida", pulgadas: 6.5 },
    { campo: "canales", canales: 4 },
    { campo: "marca", slug: "rockford-fosgate" },
    { campo: "precio", max: 80000 },
    { campo: "precio", min: 80000, max: 150000 },
    { campo: "precio", min: 150000 },
  ];
  for (const a of acotes) assert.deepEqual(acoteDeId(idDeAcote(a)), a);
  assert.equal(acoteDeId("acotar:precio:-"), null);
  assert.equal(acoteDeId("acotar:medida:abc"), null);
  assert.equal(acoteDeId("marca:memphis"), null);
});

test("describir y enlace a /buscar con lo mismo acotado", () => {
  assert.equal(describirAcote({ campo: "precio", max: 80000 }, MARCAS), "Precio hasta Q 800.00");
  assert.equal(
    hrefAcotado(
      "subwoofer",
      [
        { campo: "medida", pulgadas: 12 },
        { campo: "marca", slug: "memphis" },
        { campo: "precio", min: 80000, max: 150000 },
      ],
      MARCAS,
    ),
    "/buscar?q=subwoofer+mas+de+800+hasta+1500&medida=12&marca=Memphis",
  );
});

test("disponibilidad: filtra lo disponible y viaja como disp=disponible", () => {
  const lista = [producto("A"), producto("B", { disponibilidad: "bajo_pedido" })];
  assert.deepEqual(
    aplicarAcotes(lista, [{ campo: "disponibilidad" }], MARCAS).map((p) => p.sku),
    ["A"],
  );
  assert.equal(describirAcote({ campo: "disponibilidad" }, MARCAS), "Disponibles");
  assert.deepEqual(acoteDeId(idDeAcote({ campo: "disponibilidad" })), { campo: "disponibilidad" });
  assert.equal(
    hrefAcotado("sub", [{ campo: "disponibilidad" }], MARCAS, "precio_asc"),
    "/buscar?q=sub&disp=disponible&orden=precio_asc",
  );
  assert.ok(!gruposDeAcote(lista, MARCAS).some((g) => g.campo === "disponibilidad"));
});

test("cercanosEnLista: el de abajo y el de arriba, primero el más cercano", () => {
  const r = cercanosEnLista(SUBS, "medida", 13);
  assert.deepEqual(r?.valores, [12, 15]);
  assert.deepEqual(
    r?.productos.map((p) => p.sku),
    ["C", "D", "E", "F"],
  );
  assert.equal(cercanosEnLista(SUBS, "medida", 12), null);
  assert.equal(cercanosEnLista(SUBS, "canales", 4), null);
});
