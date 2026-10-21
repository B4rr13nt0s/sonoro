import test from "node:test";
import assert from "node:assert/strict";

import type { ProductoTarjeta } from "../../lib/catalog/types.ts";
import {
  buscar,
  canonizar,
  clavesDeAtributos,
  distancia,
  interpretar,
  normalizar,
  numerosDeAtributos,
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
  uso: ["carro"],
  precioCents: 80000,
  potenciaW: 500,
  pulgadas: 12,
  claves: clavesDeAtributos({
    medida: '12"',
    potencia_rms_w: 500,
    impedancia_ohm: 4,
    bobinas: "doble",
  }),
});
const SUB2 = producto('Subwoofer Marino de 10" MM1024', "Memphis", "MM1024", {
  uso: ["marino", "motorsports"],
  precioCents: 250000,
  potenciaW: 300,
  pulgadas: 10,
  claves: clavesDeAtributos({ medida: '10"', impedancia_ohm: 2, bobinas: "doble" }),
});
const PRX = producto("Amplificador Power Reference PRX1500.1V2", "Memphis", "PRX1500.1V2", {
  uso: ["carro"],
  precioCents: 300000,
  potenciaW: 1500,
  canales: 1,
  categoria: "Amplificadores",
  claves: clavesDeAtributos({ canales: 1, clase: "D", potencia_rms_w: 1500 }),
});
const AMP4 = producto("Amplificador de 4 canales XED4", "Rockford Fosgate", "XED4", {
  uso: ["carro"],
  precioCents: 120000,
  canales: 4,
  categoria: "Amplificadores",
  claves: clavesDeAtributos({ canales: 4, clase: "AB" }),
});
const BOC = producto('Bocinas coaxiales de 6.5" MJP6', "Memphis", "MJP6", {
  uso: ["carro", "marino"],
  precioCents: 45000,
  pulgadas: 6.5,
  categoria: "Bocinas",
  claves: clavesDeAtributos({ medida: '6.5"', configuracion: "coaxial-2v" }),
});
const RADIO = producto('Pantalla de 7" DMH-A375BT', "Pioneer", "DMH-A375BT", {
  uso: ["carro"],
  precioCents: 260000,
  pulgadas: 7,
  categoria: "Receptores",
  claves: clavesDeAtributos({
    pantalla_pulg: 7,
    carplay: true,
    android_auto: true,
    formato: "2-din",
  }),
});
const CATALOGO = [COR, SUB2, PRX, AMP4, BOC, RADIO];

// Un producto contra una consulta, por la vía real (`buscar`): solo cuenta la
// coincidencia exacta, no el «quizá quisiste decir» ni la parcial.
function coincide(p: ProductoBuscable, consulta: string): boolean {
  const r = buscar([p], consulta);
  return r.modo === "exacta" && r.productos.length > 0;
}

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

test("relevancia: la frase entera pesa más que las palabras repartidas", () => {
  const frase = producto("Subwoofer Coronel 12 A", "KBT", "A-1");
  const repartidas = producto("Subwoofer 12 Coronel B", "KBT", "B-1");
  const codigo = producto("Subwoofer COR2-124D importado", "KBT", "C-1");
  const otro = producto("Subwoofer otro", "KBT", "COR2-124D");

  assert.deepEqual(
    buscar([repartidas, frase], "coronel 12").productos.map((p) => p.sku),
    ["A-1", "B-1"],
  );
  // El sku exacto pesa más que el código dentro de un nombre.
  assert.deepEqual(
    buscar([codigo, otro], "cor2-124d").productos.map((p) => p.sku),
    ["COR2-124D", "C-1"],
  );
  // Una palabra que ningún producto trae no puntúa.
  assert.equal(buscar([COR], "amplificador").productos.length, 0);
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
  assert.deepEqual(skus(buscar(CATALOGO, "bocinas de")), ["MJP6"]);
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

test("amplificadores: la potencia por impedancia se busca por vatios y por ohms", () => {
  const amp = producto("Amplificador monoblock CM-1500X1", "Memphis", "CM-1500X1", {
    categoria: "Amplificadores",
    claves: clavesDeAtributos({
      canales: 1,
      potencia_rms_w: [
        { w: 1500, ohm: 1 },
        { w: 500, ohm: 4 },
      ],
    }),
  });
  assert.equal(coincide(amp, normalizar("1500w")), true);
  assert.equal(coincide(amp, normalizar("500 w")), true);
  assert.equal(coincide(amp, normalizar("4 ohm")), true);
  assert.equal(coincide(amp, normalizar("2 ohm")), false);
});

test("categoría: «marino», «lancha» y «utv» filtran por el dato, no por el nombre", () => {
  // MM1024 es marino y motorsports; MJP6 es de carro y marino y su nombre no lo dice.
  assert.deepEqual(skus(buscar(CATALOGO, "marino")), ["MJP6", "MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "lancha")), ["MJP6", "MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "utv")), ["MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "bocinas marinas")), ["MJP6"]);
  assert.deepEqual(skus(buscar(CATALOGO, "subwoofer motorsports")), ["MM1024"]);
});

test("categoría: carro excluye lo que no es de carro, y un producto sin `uso` es de carro", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "subwoofer carro")), ["COR2-124D"]);
  const sinUso = producto("Cable RCA", "X", "RCA1", { categoria: "Accesorios" });
  assert.deepEqual(skus(buscar([sinUso, SUB2], "cable carro")), ["RCA1"]);
  assert.equal(buscar([sinUso], "marino").productos.length, 0);
});

test("categoría: se aplica también a los errores de escritura y se anuncia", () => {
  const r = buscar(CATALOGO, "marino subwofer");
  assert.equal(r.modo, "aproximada");
  assert.deepEqual(skus(r), ["MM1024"]);
  assert.deepEqual(r.usos, ["marino"]);
  assert.deepEqual(r.aplicados, ["Categoría marino"]);
});

test("rangos de precio: «menos de Q 1,000», «hasta 3000», «más de 2,000»", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "menos de Q 1,000")), ["COR2-124D", "MJP6"]);
  assert.deepEqual(skus(buscar(CATALOGO, "amplificador hasta 1200")), ["XED4"]);
  assert.deepEqual(skus(buscar(CATALOGO, "mas de 2500")), ["DMH-A375BT", "PRX1500.1V2"]);
  // «hasta» incluye el número; «menos de», no.
  assert.deepEqual(skus(buscar(CATALOGO, "hasta 800")), ["COR2-124D", "MJP6"]);
  assert.deepEqual(skus(buscar(CATALOGO, "menos de 800")), ["MJP6"]);
});

test("rangos de precio: entre dos cifras", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "entre Q 1,000 y Q 2,600")), [
    "DMH-A375BT",
    "MM1024",
    "XED4",
  ]);
  const r = buscar(CATALOGO, "de 800 a 1200");
  assert.deepEqual(skus(r), ["COR2-124D", "XED4"]);
  assert.deepEqual(r.aplicados, ["Precio entre Q 800.00 y Q 1,200.00"]);
});

test("rangos de potencia, tamaño y canales", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "mas de 400w")), ["COR2-124D", "PRX1500.1V2"]);
  assert.deepEqual(skus(buscar(CATALOGO, "subwoofer menos de 400 watts")), ["MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "de 8 a 10 pulgadas")), ["MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "mas de 10 pulgadas")), ["COR2-124D"]);
  assert.deepEqual(skus(buscar(CATALOGO, "mas de 2 canales")), ["XED4"]);
  assert.deepEqual(skus(buscar(CATALOGO, "potencia mayor a 1000")), ["PRX1500.1V2"]);
});

test("rangos: sin el dato no cumple, y un número chico sin unidad ni Q no es precio", () => {
  // BOC no trae potencia: un filtro de potencia no la deja pasar.
  assert.equal(skus(buscar(CATALOGO, "coaxiales mas de 100w")).length, 0);
  assert.equal(interpretar("menos de 12").restricciones.length, 0);
});

test("rangos: combinados con texto y categoría", () => {
  assert.deepEqual(skus(buscar(CATALOGO, "subwoofer marino menos de 3000")), ["MM1024"]);
  assert.deepEqual(skus(buscar(CATALOGO, "subwoofer carro de 10 a 12 pulgadas")), ["COR2-124D"]);
});

test("interpretar: una medida con letras pegadas no se vuelve precio", () => {
  assert.equal(interpretar("menos de 100mm").restricciones.length, 0);
  assert.equal(interpretar("hasta 124d").restricciones.length, 0);
});

test("potencia en puente: se busca la palabra y las cargas del texto descriptivo", () => {
  const amp = producto("Amplificador de 4 canales CM-1200X4", "Memphis", "CM-1200X4", {
    categoria: "Amplificadores",
    claves: clavesDeAtributos({
      canales: 4,
      potencia_rms_w: "180 W × 4 @ 2 Ω · 120 W × 4 @ 4 Ω · 360 W × 2 @ 4 Ω puente",
    }),
  });
  assert.equal(coincide(amp, normalizar("puente")), true);
  assert.equal(coincide(amp, normalizar("bridge")), true);
  assert.equal(coincide(amp, normalizar("360w puente")), true);
  assert.equal(coincide(amp, normalizar("2 ohm")), true);
  assert.equal(coincide(amp, normalizar("360 w @ 4 ohm")), true);
  assert.equal(coincide(amp, normalizar("360 w a 4 ohm estable")), true);
  assert.equal(coincide(amp, normalizar("1 ohm")), false);
});

test("numerosDeAtributos: potencia máxima, pulgadas y canales", () => {
  assert.deepEqual(numerosDeAtributos({ potencia_rms_w: 500, medida: '12"' }), {
    potenciaW: 500,
    pulgadas: 12,
  });
  assert.deepEqual(
    numerosDeAtributos({
      potencia_rms_w: [
        { w: 3000, ohm: 1 },
        { w: 900, ohm: 4 },
      ],
      canales: 1,
    }),
    { potenciaW: 3000, canales: 1 },
  );
  assert.equal(
    numerosDeAtributos({ potencia_rms_w: "180 W × 4 + 600 W × 1 @ 2 Ω · 360 W × 2 @ 4 Ω puente" })
      .potenciaW,
    600,
  );
  assert.equal(numerosDeAtributos({ medida: '6x9"' }).pulgadas, 6);
  assert.equal(numerosDeAtributos({ medida: '7/8"' }).pulgadas, 0.875);
  assert.equal(numerosDeAtributos({ medida: "50 mm" }).pulgadas, 1.97);
  assert.equal(numerosDeAtributos({ pantalla_pulg: 7 }).pulgadas, 7);
  assert.deepEqual(numerosDeAtributos(undefined), {});
});

test("canonizar: una medida dentro de un código no se toca", () => {
  assert.equal(canonizar("kse-2x12linex"), "kse-2x12linex");
  assert.equal(canonizar("r2-250x1"), "r2-250x1");
  assert.equal(canonizar("cm-3000x5"), "cm-3000x5");
  // Con espacios alrededor sigue siendo una medida.
  assert.equal(canonizar("bocinas 6x9 memphis"), 'bocinas 6x9" memphis');
  assert.equal(canonizar("bocinas de 6 x 9 pulgadas"), 'bocinas de 6x9"');
});

test("buscar: el código del producto lo encuentra, con o sin separadores", () => {
  const cajon = producto(
    'Cajón porteado doble 12" con recubrimiento Linex',
    "KBT",
    "KSE-2X12LINEX",
    {
      categoria: "Accesorios",
    },
  );
  const sub = producto('Subwoofer Champion Series 12" TS-W312D4', "Pioneer", "TS-W312D4");
  const todos = [cajon, sub, COR];
  for (const consulta of ["KSE-2X12LINEX", "kse-2x12linex", "kse2x12linex"]) {
    assert.deepEqual(
      buscar(todos, consulta).productos.map((p) => p.sku),
      ["KSE-2X12LINEX"],
      consulta,
    );
  }
  assert.deepEqual(
    buscar(todos, "tsw312d4").productos.map((p) => p.sku),
    ["TS-W312D4"],
  );
});

test("interpretar: «de N canales y M pies» no es un rango de canales", () => {
  assert.deepEqual(interpretar(normalizar("cable rca de 2 canales y 6 pies")).restricciones, []);
  assert.deepEqual(interpretar(normalizar("cable rca de 4 canales y 17 pies")).restricciones, []);
  // La unidad al final vale para los dos números.
  assert.equal(interpretar(normalizar("amplificador de 2 a 4 canales")).restricciones.length, 1);
  assert.equal(interpretar(normalizar("subwoofer de 12 y 15 pulgadas")).restricciones.length, 1);
  // Dos unidades distintas no forman un rango.
  assert.deepEqual(interpretar(normalizar("de 2 canales a 500 w")).restricciones, []);
});

test("buscar: el nombre completo de un cable RCA encuentra ese cable", () => {
  const cable = producto("Cable RCA de 2 canales y 16 pies RFI-16", "Rockford Fosgate", "RFI-16", {
    categoria: "Accesorios",
  });
  const otro = producto("Cable RCA de 4 canales y 17 pies RV417", "Cerwin Vega", "RV417", {
    categoria: "Accesorios",
  });
  const r = buscar([cable, otro], "Cable RCA de 2 canales y 16 pies RFI-16");
  assert.equal(r.modo, "exacta");
  assert.deepEqual(r.aplicados, []);
  assert.deepEqual(
    r.productos.map((p) => p.sku),
    ["RFI-16"],
  );
});
