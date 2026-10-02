// Qué productos coinciden con una búsqueda de /buscar y en qué orden de
// puntaje. Lógica pura, fuera del componente, para poder probarla
// (busqueda.test.ts) — mismo criterio que components/cart/avisos.ts.
//
// No es una búsqueda con backend: corre en el navegador sobre el catálogo
// que ya viajó con la página. Entiende lo que el cliente ESCRIBIÓ, no decide
// por él (CLAUDE.md § reglas 2): sin «te recomendamos», sin «lo más buscado».
//
// Tres niveles, del más preciso al más tolerante; solo se baja al siguiente
// si el anterior no trajo nada:
//
//   exacta      cada palabra aparece (tal cual, en singular o plural, o por un
//               sinónimo) en nombre, marca, código, categoría o specs.
//   aproximada  igual, pero perdonando errores de escritura («rockfor»).
//   parcial     coincide al menos una palabra, no todas.
import type { Atributos, ProductoTarjeta } from "../../lib/catalog/types.ts";
import { PALABRAS_VACIAS, SINONIMOS } from "./sinonimos.ts";

/**
 * La tarjeta más `claves`: los atributos normalizados del producto ya
 * traducidos a palabras de búsqueda (`12"`, `500w`, `4ohm`, `4ch`…), que
 * calcula app/buscar/page.tsx con `clavesDeAtributos`. Opcional: sin ellas,
 * se busca solo en lo que la tarjeta trae.
 */
export type ProductoBuscable = ProductoTarjeta & { claves?: string };

// Marcas diacríticas combinantes (U+0300–U+036F) que quedan sueltas después
// de normalize("NFD") — construido con RegExp + \\u en vez de un literal de
// clase de caracteres para no dejar marcas combinantes invisibles pegadas al
// código fuente.
const MARCAS_DIACRITICAS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(MARCAS_DIACRITICAS, "").toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// Medidas y unidades
// ---------------------------------------------------------------------------

/**
 * Lleva a UNA forma las maneras de escribir una medida, igual en lo que
 * escribe el cliente y en lo que dice el catálogo: `12 pulgadas`, `12in` y
 * `12”` pasan a `12"`; `4 ohms` y `4Ω` a `4ohm`; `1,000 watts` a `1000w`;
 * `4 canales` a `4ch canales`; `6x9` a `6x9"`. Recibe texto ya normalizado.
 */
export function canonizar(texto: string): string {
  return (
    texto
      .replace(/[”“″]/g, '"')
      // 1,600 → 1600 (miles) y 6,5 → 6.5 (decimal)
      .replace(/(\d),(\d{3})(?!\d)/g, "$1$2")
      .replace(/(\d),(\d)/g, "$1.$2")
      // 6x9, 6 x 9, 6x9", 6x9 pulgadas
      .replace(/(?<![\w.])(\d+)\s*x\s*(\d+)\s*(?:"|''|pulgadas?|pulg\.?|in(?![a-z]))?/g, '$1x$2"')
      // 12", 12 pulgadas, 12in, 6.5 pulg
      .replace(
        /(?<![\d.x])(\d+(?:\.\d+)?)\s*(?:"|''|pulgadas?|pulg\.?|plg|inch(?:es)?|in(?![a-z]))/g,
        '$1"',
      )
      .replace(/(\d+)\s*(?:ohms?|ω)(?![a-z])/g, "$1ohm")
      .replace(/(\d+)\s*(?:w|watts?|vatios?)(?![a-z0-9])/g, "$1w")
      .replace(/(\d+)\s*(?:canales|canal|ch)(?![a-z0-9])/g, "$1ch canales")
      .replace(/(\d+(?:\.\d+)?)\s*mm(?![a-z])/g, "$1mm")
      .replace(/(\d+(?:\.\d+)?)\s*(?:metros?|mts?|m)(?![a-z0-9])/g, "$1m")
      .replace(/(?<![\w-])([12])\s*-?\s*din(?![a-z])/g, "$1din")
      .replace(/clase\s+(ab|bd|br|a|b|d|h)(?![a-z0-9])/g, "clase-$1 clase")
      .replace(/(\d+)\s*awg/g, "$1awg")
  );
}

// Una palabra de la consulta que es una medida con unidad: se compara como
// palabra entera, no como pedazo de otra (`500w` no es `1500w`).
const ES_MEDIDA = /^\d+(?:\.\d+)?(?:"|ohm|w|ch|mm|m|din|awg)$|^\d+x\d+"$/;
const ES_NUMERO = /^\d+(?:\.\d+)?$/;

/**
 * Los atributos normalizados de un producto como palabras de búsqueda, en la
 * misma forma canónica que `canonizar`. Lo calcula el servidor por producto
 * (app/buscar/page.tsx) y viaja ya armado: son pocas palabras, y así «12
 * pulgadas», «2 ohm» o «clase d» encuentran por el DATO y no solo por lo que
 * el nombre diga.
 */
export function clavesDeAtributos(atributos: Atributos | undefined): string {
  if (!atributos) return "";
  const a = atributos;
  const claves: string[] = [];
  if (a.medida) claves.push(a.medida);
  if (a.potencia_rms_w) claves.push(`${a.potencia_rms_w}w`, "rms");
  if (a.impedancia_ohm) claves.push(`${a.impedancia_ohm}ohm`);
  if (a.bobinas) claves.push(`${a.bobinas} bobina`);
  if (a.configuracion) {
    claves.push(a.configuracion.replace(/-(\d)v$/, " $1 vias").replace(/-/g, " "));
  }
  if (a.canales) claves.push(`${a.canales}ch`, "canales");
  if (a.clase) claves.push(`clase-${a.clase.toLowerCase()}`, "clase");
  if (a.formato) claves.push(a.formato.replace(/^(\d)-din$/, "$1din").replace(/-/g, " "));
  if (a.pantalla_pulg) claves.push("pantalla", `${a.pantalla_pulg}"`);
  if (a.carplay) claves.push("carplay");
  if (a.android_auto) claves.push("android auto");
  if (a.tipo_ecualizador) claves.push(a.tipo_ecualizador);
  if (a.bandas) claves.push(`${a.bandas}bandas`, "bandas");
  if (a.material_insono) claves.push(a.material_insono);
  if (a.calibre_awg) claves.push(`${a.calibre_awg}awg`, "awg");
  if (a.material_conductor) claves.push(a.material_conductor);
  if (a.tipo_accesorio) claves.push(a.tipo_accesorio.replace(/-/g, " "));
  if (a.longitud_m) claves.push(`${a.longitud_m}m`);
  if (a.espesor_mm) claves.push(`${a.espesor_mm}mm`);
  return claves.join(" ");
}

// ---------------------------------------------------------------------------
// Palabras: raíz y distancia
// ---------------------------------------------------------------------------

/**
 * Quita el plural: «bocinas» → «bocina», «amplificadores» → «amplificador»,
 * «subwoofers» → «subwoofer». Se compara contra el texto del producto por
 * «contiene», así que basta con que la raíz sea prefijo de la palabra.
 */
export function raiz(palabra: string): string {
  if (palabra.length < 4 || /\d/.test(palabra)) return palabra;
  if (palabra.length >= 6 && /(?:[rnzd]|[aeiou]l)es$/.test(palabra)) return palabra.slice(0, -2);
  if (palabra.endsWith("s") && !palabra.endsWith("ss")) return palabra.slice(0, -1);
  return palabra;
}

/**
 * Distancia de edición con transposición (Damerau–Levenshtein restringida).
 * Corta en cuanto se pasa de `max` y devuelve `max + 1`: no hace falta saber
 * cuánto se pasó.
 */
export function distancia(a: string, b: string, max: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let anterior2: number[] = [];
  let anterior: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const actual: number[] = [i];
    let minimo = i;
    for (let j = 1; j <= b.length; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let valor = Math.min(anterior[j] + 1, actual[j - 1] + 1, anterior[j - 1] + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        valor = Math.min(valor, anterior2[j - 2] + 1);
      }
      actual[j] = valor;
      if (valor < minimo) minimo = valor;
    }
    if (minimo > max) return max + 1;
    anterior2 = anterior;
    anterior = actual;
  }
  return anterior[b.length];
}

/** Cuántos errores se perdonan: ninguno en palabras cortas, donde casi todo se parece a todo. */
function errorMaximo(largo: number): number {
  return largo >= 7 ? 2 : largo >= 4 ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Índice por producto
// ---------------------------------------------------------------------------

interface Entrada {
  producto: ProductoBuscable;
  /** Nombre canonizado. */
  nombre: string;
  marca: string;
  sku: string;
  /** Nombre, marca y código. */
  principal: string;
  /** Categoría, specs y claves: lo que el nombre no dice. */
  extra: string;
  tokensPrincipal: ReadonlySet<string>;
  tokensExtra: ReadonlySet<string>;
  /** Solo letras, 4 o más: contra lo que se perdonan los errores de escritura. */
  palabras: readonly string[];
}

const SEPARADORES = /[\s,()/;:]+/;
const NO_LETRAS = /[^a-z]+/;

const entradas = new WeakMap<ProductoBuscable, Entrada>();

function entradaDe(producto: ProductoBuscable): Entrada {
  const guardada = entradas.get(producto);
  if (guardada) return guardada;

  const nombre = canonizar(normalizar(producto.nombre));
  const marca = normalizar(producto.marca);
  const sku = normalizar(producto.sku);
  const principal = `${nombre} ${marca} ${sku}`;
  const specs = producto.specsDestacadas.map((s) => `${s.etiqueta} ${s.valor}`).join(" ");
  const categorias = [producto.categoria, ...(producto.categoriasSecundarias ?? [])].join(" ");
  const extra = canonizar(normalizar(`${categorias} ${specs} ${producto.claves ?? ""}`));

  const palabras = new Set<string>();
  for (const p of `${nombre} ${marca} ${extra}`.split(NO_LETRAS)) {
    if (p.length >= 4) palabras.add(p);
  }

  const entrada: Entrada = {
    producto,
    nombre,
    marca,
    sku,
    principal,
    extra,
    tokensPrincipal: new Set(principal.split(SEPARADORES)),
    tokensExtra: new Set(extra.split(SEPARADORES)),
    palabras: [...palabras],
  };
  entradas.set(producto, entrada);
  return entrada;
}

/** Las palabras que existen en el catálogo, con cuántos productos las traen. */
const vocabularios = new WeakMap<readonly ProductoBuscable[], Map<string, number>>();

function vocabularioDe(productos: readonly ProductoBuscable[]): Map<string, number> {
  const guardado = vocabularios.get(productos);
  if (guardado) return guardado;
  const vocabulario = new Map<string, number>();
  for (const producto of productos) {
    for (const palabra of entradaDe(producto).palabras) {
      vocabulario.set(palabra, (vocabulario.get(palabra) ?? 0) + 1);
    }
  }
  vocabularios.set(productos, vocabulario);
  return vocabulario;
}

// ---------------------------------------------------------------------------
// La consulta
// ---------------------------------------------------------------------------

interface Termino {
  texto: string;
  raiz: string;
  medida: boolean;
  numero: boolean;
  alternativas: readonly string[];
  /** Una palabra de verdad, sin dígitos: se le pueden perdonar errores. */
  tolerable: boolean;
}

function terminosDe(consultaNormalizada: string): Termino[] {
  const palabras = canonizar(consultaNormalizada)
    .replace(/[?!¿¡;:()]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const utiles = palabras.filter((p) => !PALABRAS_VACIAS.has(p));
  // Si solo se escribieron palabras vacías («carro»), se buscan tal cual.
  return (utiles.length > 0 ? utiles : palabras).map((texto) => {
    const medida = ES_MEDIDA.test(texto);
    const numero = ES_NUMERO.test(texto);
    const r = medida || numero ? texto : raiz(texto);
    return {
      texto,
      raiz: r,
      medida,
      numero,
      alternativas: SINONIMOS[r] ?? [],
      tolerable: !medida && !numero && !/\d/.test(r) && r.length >= 4,
    };
  });
}

// Qué tan arriba coincide una palabra. Lo que dice el nombre pesa más que lo
// que dicen la marca o el código, y eso más que la categoría o las specs; lo
// que solo coincide por un sinónimo o por un error de escritura, lo último.
const NIVEL_NOMBRE = 4;
const NIVEL_MARCA_O_CODIGO = 3;
const NIVEL_EXTRA = 2;
const NIVEL_APROXIMADO = 1;

/** 0 si la palabra no coincide. Sin tolerancia a errores. */
function nivelExacto(e: Entrada, t: Termino): number {
  if (t.medida) {
    if (e.tokensPrincipal.has(t.texto)) return NIVEL_MARCA_O_CODIGO;
    return e.tokensExtra.has(t.texto) ? NIVEL_EXTRA : 0;
  }
  if (t.numero) {
    if (e.nombre.includes(t.texto)) return NIVEL_NOMBRE;
    if (e.principal.includes(t.texto)) return NIVEL_MARCA_O_CODIGO;
    return e.tokensExtra.has(t.texto) ? NIVEL_EXTRA : 0;
  }
  if (e.nombre.includes(t.raiz)) return NIVEL_NOMBRE;
  if (e.principal.includes(t.raiz)) return NIVEL_MARCA_O_CODIGO;
  // Una palabra de 3 letras o menos («amp», «eq») pegada en medio de otra de
  // las specs («Amperaje») no es una coincidencia: en categoría y specs se
  // pide la palabra entera.
  if (t.texto.length >= 4 ? e.extra.includes(t.raiz) : e.tokensExtra.has(t.raiz)) {
    return NIVEL_EXTRA;
  }
  for (const alternativa of t.alternativas) {
    if (e.principal.includes(alternativa) || e.extra.includes(alternativa)) {
      return NIVEL_APROXIMADO;
    }
  }
  return 0;
}

function nivelConErrores(e: Entrada, t: Termino): number {
  const exacto = nivelExacto(e, t);
  if (exacto > 0 || !t.tolerable) return exacto;
  const maximo = errorMaximo(t.raiz.length);
  for (const palabra of e.palabras) {
    if (distancia(t.raiz, raiz(palabra), maximo) <= maximo) return NIVEL_APROXIMADO;
  }
  return 0;
}

/** El peor nivel entre todas las palabras: basta que una no coincida para que sea 0. */
function nivelDeProducto(
  e: Entrada,
  terminos: readonly Termino[],
  nivel: (e: Entrada, t: Termino) => number,
): number {
  let peor = NIVEL_NOMBRE;
  for (const t of terminos) {
    const n = nivel(e, t);
    if (n === 0) return 0;
    if (n < peor) peor = n;
  }
  return peor;
}

const PUNTAJE_POR_NIVEL: Readonly<Record<number, number>> = {
  [NIVEL_NOMBRE]: 25,
  [NIVEL_MARCA_O_CODIGO]: 22,
  [NIVEL_EXTRA]: 20,
  [NIVEL_APROXIMADO]: 17,
};

/** Cuánto pesa la consulta ENTERA como frase en el sku, el nombre o la marca. */
function puntajeDeFrase(e: Entrada, consultaNormalizada: string): number {
  const frase = canonizar(consultaNormalizada);
  if (e.sku === consultaNormalizada) return 100;
  if (e.nombre === frase) return 90;
  if (e.sku.startsWith(consultaNormalizada)) return 80;
  if (e.nombre.startsWith(frase)) return 70;
  if (e.marca.startsWith(frase)) return 60;
  if (e.nombre.includes(frase)) return 50;
  if (e.marca.includes(frase)) return 40;
  if (e.sku.includes(consultaNormalizada)) return 30;
  return 0;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Coincide si CADA palabra de la consulta aparece —tal cual, en plural o por
 * un sinónimo— en el nombre, la marca, el código, la categoría o las specs,
 * en cualquier orden. Hasta septiembre de 2026 se buscaba la consulta entera
 * dentro de un solo campo, y como la marca casi nunca va en el nombre,
 * «memphis 12» o «rockford amplificador» daban cero resultados aunque hubiera
 * catorce productos de cada uno.
 */
export function coincide(producto: ProductoBuscable, consultaNormalizada: string): boolean {
  const terminos = terminosDe(consultaNormalizada);
  if (terminos.length === 0) return false;
  return nivelDeProducto(entradaDe(producto), terminos, nivelExacto) > 0;
}

/**
 * Relevancia simple: la consulta entera como sku o nombre exactos pesa más
 * que «empieza con», que pesa más que «contiene en cualquier parte»; y todo
 * eso, más que las palabras sueltas repartidas entre campos (por nombre,
 * marca, categoría o sinónimo, en ese orden). 0 si el producto no coincide.
 */
export function puntuarRelevancia(producto: ProductoBuscable, consultaNormalizada: string): number {
  const terminos = terminosDe(consultaNormalizada);
  const e = entradaDe(producto);
  const nivel = nivelDeProducto(e, terminos, nivelExacto);
  if (nivel === 0) return 0;
  return Math.max(puntajeDeFrase(e, consultaNormalizada), PUNTAJE_POR_NIVEL[nivel] ?? 0);
}

export type ModoBusqueda = "exacta" | "aproximada" | "parcial";

export interface ResultadoBusqueda {
  /** Sin ordenar por `compararRelevancia`: vienen por puntaje, de mayor a menor. */
  productos: ProductoBuscable[];
  modo: ModoBusqueda;
  /** «Quizá quisiste decir…»: la consulta con las palabras mal escritas corregidas. */
  correccion: string | null;
}

const SIN_RESULTADOS: ResultadoBusqueda = { productos: [], modo: "exacta", correccion: null };

/**
 * La corrección de una consulta: cada palabra que NINGÚN producto trae, ni
 * por sinónimo, se cambia por la palabra del catálogo más parecida (a igual
 * distancia, la que más productos usan). `null` si no hay nada que corregir.
 */
function corregir(
  productos: readonly ProductoBuscable[],
  terminos: readonly Termino[],
): string | null {
  const vocabulario = vocabularioDe(productos);
  let cambio = false;
  const palabras = terminos.map((t) => {
    if (!t.tolerable) return t.texto;
    if (productos.some((p) => nivelExacto(entradaDe(p), t) > 0)) return t.texto;
    const maximo = errorMaximo(t.raiz.length);
    let mejor: string | null = null;
    let mejorDistancia = maximo + 1;
    let mejorUso = 0;
    for (const [palabra, uso] of vocabulario) {
      const d = distancia(t.raiz, raiz(palabra), maximo);
      if (d < mejorDistancia || (d === mejorDistancia && uso > mejorUso)) {
        mejor = palabra;
        mejorDistancia = d;
        mejorUso = uso;
      }
    }
    if (mejor === null || mejorDistancia > maximo) return t.texto;
    cambio = true;
    return mejor;
  });
  return cambio ? palabras.join(" ") : null;
}

interface Puntuado {
  producto: ProductoBuscable;
  puntaje: number;
}

function ordenar(
  puntuados: Puntuado[],
  desempate: (a: ProductoBuscable, b: ProductoBuscable) => number,
): ProductoBuscable[] {
  return puntuados
    .sort((a, b) => b.puntaje - a.puntaje || desempate(a.producto, b.producto))
    .map((p) => p.producto);
}

/**
 * La búsqueda completa. `desempate` es el orden con que se rompen los
 * empates de puntaje (el de «relevancia» de los listados: destacado → precio
 * ↓ → sku); sin él, los cubos grandes —los de puntaje 20/25, donde casi
 * todo «contiene» la consulta— saldrían en el orden crudo de la hoja de
 * cálculo.
 */
export function buscar(
  productos: readonly ProductoBuscable[],
  consulta: string,
  desempate: (a: ProductoBuscable, b: ProductoBuscable) => number = () => 0,
): ResultadoBusqueda {
  const normalizada = normalizar(consulta).replace(/\s+/g, " ");
  const terminos = terminosDe(normalizada);
  if (terminos.length === 0) return SIN_RESULTADOS;
  const lista = productos.map(entradaDe);

  const exactos: Puntuado[] = [];
  for (const e of lista) {
    const nivel = nivelDeProducto(e, terminos, nivelExacto);
    if (nivel > 0) {
      exactos.push({
        producto: e.producto,
        puntaje: Math.max(puntajeDeFrase(e, normalizada), PUNTAJE_POR_NIVEL[nivel] ?? 0),
      });
    }
  }
  if (exactos.length > 0) {
    return { productos: ordenar(exactos, desempate), modo: "exacta", correccion: null };
  }

  const correccion = corregir(productos, terminos);

  const aproximados: Puntuado[] = [];
  for (const e of lista) {
    const nivel = nivelDeProducto(e, terminos, nivelConErrores);
    if (nivel > 0) aproximados.push({ producto: e.producto, puntaje: 10 + nivel });
  }
  if (aproximados.length > 0) {
    return { productos: ordenar(aproximados, desempate), modo: "aproximada", correccion };
  }

  if (terminos.length > 1) {
    const parciales: Puntuado[] = [];
    for (const e of lista) {
      const aciertos = terminos.filter((t) => nivelConErrores(e, t) > 0).length;
      if (aciertos > 0) parciales.push({ producto: e.producto, puntaje: aciertos });
    }
    if (parciales.length > 0) {
      return { productos: ordenar(parciales, desempate), modo: "parcial", correccion };
    }
  }

  return { productos: [], modo: "exacta", correccion };
}

// ---------------------------------------------------------------------------
// Sugerencias al teclear
// ---------------------------------------------------------------------------

export interface Sugerencias {
  marcas: { nombre: string; slug: string }[];
  categorias: { nombre: string; slug: string }[];
  productos: ProductoBuscable[];
}

const MAX_PRODUCTOS_SUGERIDOS = 5;

/** ¿Alguna palabra del nombre empieza con lo escrito, o se le parece a una? */
function nombreSeParece(nombre: string, escrito: string): boolean {
  const maximo = errorMaximo(escrito.length);
  return normalizar(nombre)
    .split(/\s+/)
    .some(
      (palabra) =>
        palabra.startsWith(escrito) ||
        (maximo > 0 && distancia(escrito, raiz(palabra), maximo) <= maximo),
    );
}

/**
 * Lo que se ofrece mientras se teclea: marcas y categorías que coinciden con
 * lo escrito (también por sinónimo y con errores: «sub» → Subwoofers,
 * «rockfor» → Rockford Fosgate) y los primeros productos. Los de la búsqueda
 * «parcial» no entran: sugerir algo que no coincide con lo escrito es ruido.
 */
export function sugerir(
  productos: readonly ProductoBuscable[],
  marcas: readonly { nombre: string; slug: string }[],
  categorias: readonly { nombre: string; slug: string }[],
  escrito: string,
  desempate?: (a: ProductoBuscable, b: ProductoBuscable) => number,
): Sugerencias {
  const q = normalizar(escrito).replace(/\s+/g, " ");
  if (q.length < 2) return { marcas: [], categorias: [], productos: [] };

  // Marcas y categorías se ofrecen por la consulta entera; con varias palabras
  // («memphis 12») la marca ya está en el resultado de productos.
  const unaPalabra = !q.includes(" ");
  const buscados = unaPalabra ? [raiz(q), ...(SINONIMOS[raiz(q)] ?? [])] : [];

  const resultado = buscar(productos, q, desempate);
  return {
    marcas: buscados.length ? marcas.filter((m) => nombreSeParece(m.nombre, q)).slice(0, 3) : [],
    categorias: buscados.length
      ? categorias
          .filter((c) => buscados.some((b) => nombreSeParece(c.nombre, raiz(b))))
          .slice(0, 3)
      : [],
    productos:
      resultado.modo === "parcial" ? [] : resultado.productos.slice(0, MAX_PRODUCTOS_SUGERIDOS),
  };
}
