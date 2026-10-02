import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoTarjeta } from "../../lib/catalog/types.ts";
import {
  buscar,
  canonizar,
  clavesDeAtributos,
  coincide,
  distancia,
  normalizar,
  puntuarRelevancia,
  raiz,
  sugerir,
  type ProductoBuscable,
} from "./busqueda.ts";

function producto(
  nombre: string,
  marca: string,
  sku: string,
  extra: Partial<ProductoBuscable> = {},
): ProductoBuscable {
  const base: ProductoTarjeta = {
    sku,
    slug: sku.toLowerCase(),
    nombre,
    marca,
    categoria: "Subwoofers",
    precioCents: 100000,
    disponibilidad: "disponible",
    destacado: false,
    imagenes: [],
    specsDestacadas: [],
  };
  return { ...base, ...extra };
}

const COR = producto('Subwoofer Coronel de 12" COR2-124D', "KBT", "COR2-124D", {
  claves: clavesDeAtributos({
    medida: '12"',
    potencia_rms_w: 500,
    impedancia_ohm: 4,
    bobinas: "doble",
  }),
});
const SUB2 = producto('Subwoofer Marino de 10" MM1024', "Memphis", "MM1024", {
  claves: clavesDeAtributos({ medida: '10"', impedancia_ohm: 2, bobinas: "doble" }),
});
const PRX = producto("Amplificador Power Reference PRX1500.1V2", "Memphis", "PRX1500.1V2", {
  categoria: "Amplificadores",
  claves: clavesDeAtributos({ canales: 1, clase: "D", potencia_rms_w: 1500 }),
});
const AMP4 = producto("Amplificador de 4 canales XED4", "Rockford Fosgate", "XED4", {
  categoria: "Amplificadores",
  claves: clavesDeAtributos({ canales: 4, clase: "AB" }),
});
const BOC = producto('Bocinas coaxiales de 6.5" MJP6', "Memphis", "MJP6", {
  categoria: "Bocinas",
  claves: clavesDeAtributos({ medida: '6.5"', configuracion: "coaxial-2v" }),
});
const RADIO = producto('Pantalla de 7" DMH-A375BT', "Pioneer", "DMH-A375BT", {
  categoria: "Receptores",
  claves: clavesDeAtributos({
    pantalla_pulg: 7,
    carplay: true,
    android_auto: true,
    formato: "2-din",
  }),
});
const CATALOGO = [COR, SUB2, PRX, AMP4, BOC, RADIO];

const skus = (r: { productos: ProductoBuscable[] }) => r.productos.map((p) => p.sku).sort();

test("coincide: cada palabra en cualquier campo y en cualquier orden", () => {
  assert.equal(coincide(COR, normalizar("kbt subwoofer")), true);
  assert.equal(coincide(COR, normalizar("12 kbt")), true);
  assert.equal(coincide(PRX, normalizar("memphis amplificador")), true);
  assert.equal(coincide(PRX, normalizar("  MEMPHIS   amplificador ")), true);
});

test("coincide: si una sola palabra falta, no coincide", () => {
  assert.equal(coincide(COR, normalizar("kbt amplificador")), false);
  assert.equal(coincide(PRX, normalizar("rockford amplificador")), false);
});

test("coincide: sin acentos ni mayúsculas", () => {
  const insono = producto("Lámina de insonorización", "Sonoro", "INS-1");
  assert.equal(coincide(insono, normalizar("INSONORIZACION lamina")), true);
});

test("puntuarRelevancia: la frase entera pesa más que las palabras repartidas", () => {
  assert.equal(puntuarRelevancia(COR, normalizar("coronel de 12")), 50);
  // «kbt» sale de la marca y «12» del nombre: pesa menos que si todo fuera del nombre.
  assert.equal(puntuarRelevancia(COR, normalizar("kbt 12")), 22);
  assert.equal(puntuarRelevancia(COR, normalizar("cor2-124d")), 100);
  assert.equal(puntuarRelevancia(COR, normalizar("amplificador")), 0);
});

test("plural y singular dan lo mismo", () => {
  assert.equal(raiz("bocinas"), "bocina");
  assert.equal(raiz("amplificadores"), "amplificador");
  assert.equal(raiz("subwoofers"), "subwoofer");
  assert.equal(raiz("cables"), "cable");
  assert.equal(raiz("kits"), "kit");
  assert.equal(raiz("mclass"), "mclass");
  assert.deepEqual(skus(buscar(CATALOGO, "bocina")), skus(buscar(CATALOGO, "bocinas")));
  assert.deepEqual(skus(buscar(CATALOGO, "amplificadores")), ["PRX1500.1V2", "XED4"]);
});

test("canonizar: las maneras de escribir una medida llegan a una sola", () => {
  assert.equal(canonizar("12 pulgadas"), '12"');
  assert.equal(canonizar("12in"), '12"');
  assert.equal(canonizar("6,5 pulg"), '6.5"');
  assert.equal(canonizar("6x9"), '6x9"');
  assert.equal(canonizar('6x9"'), '6x9"');
  assert.equal(canonizar("4 ohms"), "4ohm");
  assert.equal(canonizar("4 ω"), "4ohm");
  assert.equal(canonizar("1,600 w"), "1600w");
  assert.equal(canonizar("1000 watts"), "1000w");
  assert.equal(canonizar("4 canales"), "4ch canales");
  assert.equal(canonizar("clase d"), "clase-d clase");
  assert.equal(canonizar("2 din"), "2din");
  assert.equal(canonizar("5 metros"), "5m");
  assert.equal(canonizar("8 mm"), "8mm");
});

test("medidas: «12 pulgadas», «2 ohm», «500w», «4 canales», «clase d»", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "12 pulgadas")), ["COR2-124D"]);
  assert.deepEqual(skus(buscar(CATALOGO, 'subwoofer 10"')), ["MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "subwoofer 2 ohm")), ["MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "500w")), ["COR2-124D"]);
  assert.deepEqual(skus(buscar(CATALOGO, "4 canales")), ["XED4"]);
  assert.deepEqual(skus(buscar(CATALOGO, "amplificador clase d")), ["PRX1500.1V2"]);
  assert.deepEqual(skus(buscar(CATALOGO, "doble bobina")), ["COR2-124D", "MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "carplay")), ["DMH-A375BT"]);
  assert.deepEqual(skus(buscar(CATALOGO, "7 pulgadas")), ["DMH-A375BT"]);
  assert.deepEqual(skus(buscar(CATALOGO, "coaxiales 2 vias")), ["MJP6"]);
});

test("una medida es una palabra entera: «500w» no es «1500w»", () => {
  assert.equal(coincide(PRX, normalizar("500w")), false);
  assert.equal(coincide(PRX, normalizar("1500w")), true);
});

test("un número suelto no se cuela por las specs", () => {
  // «1» aparece dentro de «1500w» y de «PRX1500.1V2»: solo cuenta en nombre o código.
  assert.equal(coincide(AMP4, normalizar("500")), false);
});

test("sinónimos: cómo lo dice la gente", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "sub")), ["COR2-124D", "MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "parlantes")), ["MJP6"]);
  assert.deepEqual(skus(buscar(CATALOGO, "radio")), ["DMH-A375BT"]);
  assert.deepEqual(skus(buscar(CATALOGO, "planta")), ["PRX1500.1V2", "XED4"]);
  assert.deepEqual(skus(buscar(CATALOGO, "lancha")), ["MM1024"]);
});

test("lo que dice el nombre pesa más que lo que solo coincide por sinónimo", () => {
  const radio = producto("Radio de carro AM/FM R1", "X", "R1", { categoria: "Receptores" });
  const r = buscar([RADIO, radio], "radio");
  assert.deepEqual(
    r.productos.map((p) => p.sku),
    ["R1", "DMH-A375BT"],
  );
});

test("palabras vacías: «bocinas para carro» pide solo bocinas", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "bocinas para carro")), ["MJP6"]);
  assert.deepEqual(skus(buscar(CATALOGO, "carro")).length, 0);
});

test("distancia: transposición y letra de más o de menos", () => {
  assert.equal(distancia("pioneer", "pionner", 2), 1);
  assert.equal(distancia("pioneer", "pioner", 2), 1);
  assert.equal(distancia("pioneer", "pioneer", 2), 0);
  assert.equal(distancia("pioneer", "memphis", 2), 3);
});

test("errores de escritura: «rokford amplificador» llega a Rockford", () => {
  const r = buscar(CATALOGO, "rokford amplificador");
  assert.equal(r.modo, "aproximada");
  assert.deepEqual(skus(r), ["XED4"]);
  assert.equal(r.correccion, "rockford amplificador");
});

test("errores de escritura: «subwofer» y «pionner»", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "subwofer")), ["COR2-124D", "MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "pionner")), ["DMH-A375BT"]);
});

test("no se perdonan errores en palabras cortas ni en números", () => {
  assert.equal(buscar(CATALOGO, "kbs").productos.length, 0);
  // Lo que se está tecleando (prefijo) no es un error: coincide como siempre.
  assert.equal(buscar(CATALOGO, "rockfor").modo, "exacta");
  assert.equal(buscar(CATALOGO, "13").productos.length, 0);
});

test("si hay coincidencia exacta, no se mezclan las aproximadas", () => {
  const r = buscar(CATALOGO, "memphis");
  assert.equal(r.modo, "exacta");
  assert.equal(r.correccion, null);
  assert.deepEqual(skus(r), ["MJP6", "MM1024", "PRX1500.1V2"]);
});

test("parcial: si no coinciden todas las palabras, las que coinciden con alguna", () => {
  const r = buscar(CATALOGO, "apple carplay");
  assert.equal(r.modo, "parcial");
  assert.deepEqual(skus(r), ["DMH-A375BT"]);
});

test("sin nada parecido: vacío", () => {
  const r = buscar(CATALOGO, "zzzz qqqq");
  assert.equal(r.productos.length, 0);
});

test("el desempate se aplica entre los del mismo puntaje", () => {
  const baratos = (a: ProductoBuscable, b: ProductoBuscable) => a.precioCents - b.precioCents;
  const caro = producto("Bocina cara", "Z", "Z1", { precioCents: 900000 });
  const barato = producto("Bocina barata", "Z", "Z2", { precioCents: 1000 });
  assert.deepEqual(
    buscar([caro, barato], "bocina", baratos).productos.map((p) => p.sku),
    ["Z2", "Z1"],
  );
});

test("sugerir: marcas, categorías y productos mientras se teclea", () => {
  const marcas = [
    { nombre: "Memphis", slug: "memphis" },
    { nombre: "Rockford Fosgate", slug: "rockford-fosgate" },
  ];
  const categorias = [
    { nombre: "Subwoofers", slug: "subwoofers" },
    { nombre: "Bocinas", slug: "bocinas" },
  ];
  const mem = sugerir(CATALOGO, marcas, categorias, "mem");
  assert.deepEqual(
    mem.marcas.map((m) => m.slug),
    ["memphis"],
  );

  const sub = sugerir(CATALOGO, marcas, categorias, "sub");
  assert.deepEqual(
    sub.categorias.map((c) => c.slug),
    ["subwoofers"],
  );
  assert.equal(sub.productos.length, 2);

  // Con error de escritura y por segunda palabra del nombre
  assert.deepEqual(
    sugerir(CATALOGO, marcas, categorias, "rockfor").marcas.map((m) => m.slug),
    ["rockford-fosgate"],
  );
  assert.deepEqual(
    sugerir(CATALOGO, marcas, categorias, "fosgate").marcas.map((m) => m.slug),
    ["rockford-fosgate"],
  );

  // Una letra no sugiere nada; lo parcial tampoco
  assert.deepEqual(sugerir(CATALOGO, marcas, categorias, "m").productos, []);
  assert.deepEqual(sugerir(CATALOGO, marcas, categorias, "apple carplay").productos, []);
});

test("clavesDeAtributos: sin atributos no hay claves", () => {
  assert.equal(clavesDeAtributos(undefined), "");
  assert.equal(clavesDeAtributos({ canales: 4, clase: "AB" }), "4ch canales clase-ab clase");
});
