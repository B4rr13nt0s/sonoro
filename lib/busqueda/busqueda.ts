// Qué productos coinciden con una búsqueda de /buscar y en qué orden de
// puntaje. Lógica pura, fuera del componente, para poder probarla
// (busqueda.test.ts) — mismo criterio que components/cart/avisos.ts.
//
// No es una búsqueda con backend: corre en el navegador sobre el catálogo
// que ya viajó con la página. Entiende lo que el cliente ESCRIBIÓ, no decide
// por él (CLAUDE.md § reglas 2): sin «te recomendamos», sin «lo más buscado».
//
// Cuatro niveles, del más preciso al más tolerante; solo se baja al siguiente
// si el anterior no trajo nada:
//
//   exacta      cada palabra aparece (tal cual, en singular o plural, o por un
//               sinónimo) en nombre, marca, código, categoría o specs.
//   aproximada  igual, pero perdonando errores de escritura («rockfor»).
//   cercana     todo coincide menos una medida o un rango: lo más cercano a
//               ese dato, con un aviso de qué no hay («Ninguno es de 6"…»).
//   parcial     coincide al menos una palabra, no todas.
//
// Antes de buscar texto, la consulta se «interpreta» (`interpretar`): las
// palabras que nombran una categoría de uso («marino», «utv», «carro») y las
// comparaciones con número («menos de Q 1,000», «más de 500 W», «de 8 a 10
// pulgadas») dejan de ser texto y pasan a ser FILTROS sobre el dato.
import { formatQ } from "../format/precio.ts";
import type { Atributos, ProductoTarjeta, Spec, Uso } from "../catalog/types.ts";
import { PALABRAS_VACIAS, sinonimosDe, USO_PALABRAS } from "./sinonimos.ts";

/**
 * La tarjeta más `claves`: los atributos normalizados del producto ya
 * traducidos a palabras de búsqueda (`12"`, `500w`, `4ohm`, `4ch`…), que
 * calcula app/buscar/page.tsx con `clavesDeAtributos`. Opcional: sin ellas,
 * se busca solo en lo que la tarjeta trae.
 */
export type ProductoBuscable = ProductoTarjeta & {
  claves?: string;
  /** Los números de `atributos` contra los que se comparan los rangos. */
  potenciaW?: number;
  pulgadas?: number;
  canales?: number;
};

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
      // 6x9, 6 x 9, 6x9", 6x9 pulgadas. No dentro de un código: «KSE-2X12LINEX»
      // o «R2-250X1» no son medidas, y alterarlos hacía que el código tecleado
      // nunca coincidiera con el del producto.
      .replace(
        /(?<![\w.-])(\d+)\s*x\s*(\d+)\s*(?:"|''|pulgadas?|pulg\.?|in(?![a-z]))?(?![\w-])/g,
        '$1x$2"',
      )
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
  if (Array.isArray(a.potencia_rms_w)) {
    for (const p of a.potencia_rms_w) claves.push(`${p.w}w`, `${p.ohm}ohm`);
    claves.push("rms");
  } else if (typeof a.potencia_rms_w === "string") {
    // «180 W × 4 @ 2 Ω · …»: cada potencia e impedancia nombrada es una clave.
    for (const m of a.potencia_rms_w.matchAll(/(\d[\d,.]*)\s*(W|Ω)/g)) {
      const n = m[1].replace(/,/g, "");
      claves.push(m[2] === "W" ? `${n}w` : `${n}ohm`);
    }
    claves.push("rms");
    // «@ 4 Ω puente»: quien busca «2 ohm puente» escribe esa palabra.
    if (/puente/i.test(a.potencia_rms_w)) claves.push("puente");
  } else if (a.potencia_rms_w) claves.push(`${a.potencia_rms_w}w`, "rms");
  if (a.impedancia_ohm) claves.push(`${a.impedancia_ohm}ohm`);
  if (a.bobinas) claves.push(`${a.bobinas} bobina`);
  if (a.configuracion) {
    claves.push(a.configuracion.replace(/-(\d)v$/, " $1 vias").replace(/-/g, " "));
  }
  if (a.canales) claves.push(`${a.canales}ch`, "canales");
  // «AB/D» (seleccionable entre dos clases) se busca por cualquiera de las dos.
  if (a.clase) {
    for (const c of a.clase.split("/")) claves.push(`clase-${c.toLowerCase()}`);
    claves.push("clase");
  }
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

/**
 * La medida nominal en pulgadas: `6.5"` → 6.5, `7/8"` → 0.875, `50 mm` →
 * 1.97. Una ovalada (`6x9"`) es otra medida, no una de 6": no tiene un número
 * que comparar, y sale cuando se escribe «6x9».
 */
function pulgadasDeMedida(medida: string): number | undefined {
  if (/^\d+(?:\.\d+)?x\d/.test(medida)) return undefined;
  const fraccion = /^(\d+)\/(\d+)"$/.exec(medida);
  if (fraccion) return Number(fraccion[1]) / Number(fraccion[2]);
  const primero = /\d+(?:\.\d+)?/.exec(medida);
  if (!primero) return undefined;
  const n = Number(primero[0]);
  return /mm$/.test(medida) ? Math.round((n / 25.4) * 100) / 100 : n;
}

/**
 * Los números de un producto contra los que se comparan «más de 500 W» o «de
 * 8 a 10 pulgadas». Solo viajan los que existen:
 *
 *   potenciaW  la mayor potencia RMS publicada (en un amplificador de varias
 *              cargas, la más alta de cualquier canal).
 *   pulgadas   la medida nominal (`pulgadasDeMedida`); en un receptor, la
 *              pantalla. Una 6x9" no lleva.
 *   canales    los de un amplificador o un ecualizador.
 */
export function numerosDeAtributos(
  a: Atributos | undefined,
): Pick<ProductoBuscable, "potenciaW" | "pulgadas" | "canales"> {
  const numeros: Pick<ProductoBuscable, "potenciaW" | "pulgadas" | "canales"> = {};
  if (!a) return numeros;

  const p = a.potencia_rms_w;
  let potencia: number | undefined;
  if (typeof p === "number") potencia = p;
  else if (Array.isArray(p)) potencia = Math.max(...p.map((c) => c.w));
  else if (typeof p === "string") {
    const vatios = [...p.matchAll(/(\d[\d,.]*)\s*W/g)].map((m) => Number(m[1].replace(/,/g, "")));
    if (vatios.length > 0) potencia = Math.max(...vatios);
  }
  if (potencia !== undefined && potencia > 0) numeros.potenciaW = potencia;

  if (a.medida) {
    const pulgadas = pulgadasDeMedida(a.medida);
    if (pulgadas !== undefined) numeros.pulgadas = pulgadas;
  } else if (a.pantalla_pulg) numeros.pulgadas = a.pantalla_pulg;

  if (a.canales) numeros.canales = a.canales;
  return numeros;
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
  /** El nombre sin el código que lo cierra: el «6» de «PPS4-6» no es un 6 del nombre. */
  nombreSinCodigo: string;
  marca: string;
  sku: string;
  /** Nombre, marca y código. */
  principal: string;
  /** Lo mismo sin la marca: un sinónimo corto («bt») no debe coincidir con «KBT». */
  principalSinMarca: string;
  /** Categoría, specs y claves: lo que el nombre no dice. */
  extra: string;
  /** La categoría y las secundarias, en singular: «receptor», «subwoofer». */
  categorias: ReadonlySet<string>;
  tokensPrincipal: ReadonlySet<string>;
  tokensExtra: ReadonlySet<string>;
  /** Solo letras, 4 o más: contra lo que se perdonan los errores de escritura. */
  palabras: readonly string[];
}

// Puntuación pegada al borde de una palabra: «lancha?», «bocinas,», «¿bocinas».
const PUNTUACION_DE_BORDE = /^[.,?!¿¡;:()@]+|[.,?!¿¡;:()@]+$/g;
const SEPARADORES = /[\s,()/;:]+/;
const NO_LETRAS = /[^a-z]+/;

const entradas = new WeakMap<ProductoBuscable, Entrada>();

function entradaDe(producto: ProductoBuscable): Entrada {
  const guardada = entradas.get(producto);
  if (guardada) return guardada;

  const nombre = canonizar(normalizar(producto.nombre));
  const marca = normalizar(producto.marca);
  const sku = normalizar(producto.sku);
  // El código también sin separadores: en la factura dice «TS-W312D4» y quien
  // lo teclea de memoria escribe «tsw312d4».
  const skuCompacto = sku.replace(/[\s.-]+/g, "");
  const codigos = `${sku}${skuCompacto === sku ? "" : ` ${skuCompacto}`}`;
  const principal = `${nombre} ${marca} ${codigos}`;
  const specs = producto.specsDestacadas.map((s) => `${s.etiqueta} ${s.valor}`).join(" ");
  const listaCategorias = [producto.categoria, ...(producto.categoriasSecundarias ?? [])];
  const categorias = listaCategorias.join(" ");
  const extra = canonizar(normalizar(`${categorias} ${specs} ${producto.claves ?? ""}`));

  const palabras = new Set<string>();
  for (const p of `${nombre} ${marca} ${extra}`.split(NO_LETRAS)) {
    if (p.length >= 4) palabras.add(p);
  }

  const entrada: Entrada = {
    producto,
    nombre,
    nombreSinCodigo: nombre.endsWith(sku) ? nombre.slice(0, -sku.length) : nombre,
    marca,
    sku,
    principal,
    principalSinMarca: `${nombre} ${codigos}`,
    extra,
    tokensPrincipal: new Set(principal.split(SEPARADORES)),
    tokensExtra: new Set(extra.split(SEPARADORES)),
    categorias: new Set(listaCategorias.map((c) => raiz(normalizar(c)))),
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
  /** Para un número: el número entero, sin otra cifra pegada («12» en `12"`, no en «mjm612»). */
  entero: RegExp | null;
  alternativas: readonly string[];
  /** Una palabra de verdad, sin dígitos: se le pueden perdonar errores. */
  tolerable: boolean;
}

// Recibe texto YA canonizado: `canonizar` no es idempotente («4ch canales»
// volvería a convertirse), así que se aplica una sola vez, en `interpretar`.
// Con `conFallback`, si solo se escribieron palabras vacías («para») se
// buscan tal cual; sin él —cuando ya hay filtros— no queda nada que buscar.
function terminosDe(textoCanonico: string, conFallback = true): Termino[] {
  const palabras = textoCanonico
    .replace(/[?!¿¡;:()@]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const utiles = palabras.filter((p) => !PALABRAS_VACIAS.has(p));
  return (utiles.length > 0 || !conFallback ? utiles : palabras).map((texto) => {
    const medida = ES_MEDIDA.test(texto);
    const numero = ES_NUMERO.test(texto);
    const r = medida || numero ? texto : raiz(texto);
    return {
      texto,
      raiz: r,
      medida,
      numero,
      // Sin lookbehind: Safari anterior a 16.4 no lo entiende. Delante no
      // puede ir letra, cifra ni punto («q12», «612», «6.5»); detrás, ni
      // cifra, ni decimal, ni la otra mitad de una ovalada (una 6x9" no es
      // una de 6), pero sí la unidad («12"», «4ohm»).
      entero: numero
        ? new RegExp(
            String.raw`(?:^|[^a-z0-9.])${texto.replace(".", "\\.")}(?![0-9]|\.[0-9]|x[0-9])`,
          )
        : null,
      alternativas: sinonimosDe(r),
      tolerable: !medida && !numero && !/\d/.test(r) && r.length >= 4,
    };
  });
}

// Qué tan arriba coincide una palabra. Lo que dice el nombre pesa más que la
// categoría que la palabra nombra, eso más que la marca o el código, y eso más
// que las specs; lo que solo coincide por un sinónimo o por un error de
// escritura, lo último. La categoría va arriba porque dice qué ES el producto:
// con «radio» las pantallas (Receptores) van antes que un convertidor cuya
// ficha menciona «las salidas de bocina del radio».
const NIVEL_NOMBRE = 5;
const NIVEL_CATEGORIA = 4;
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
    // El nombre trae el código al final: «12» dentro de «MJM612» (un sub de
    // 6.5") no es un 12 del nombre. Y en el código solo cuenta un número de
    // tres cifras o más («612» encuentra MJM612): un «6» o un «12» metidos
    // en un código («MJP6», «MJM612») son ruido, y taparían que no hay
    // bocinas de 6".
    if (t.entero?.test(e.nombreSinCodigo)) return NIVEL_NOMBRE;
    if (t.texto.length >= 3 && e.principal.includes(t.texto)) return NIVEL_MARCA_O_CODIGO;
    return e.tokensExtra.has(t.texto) ? NIVEL_EXTRA : 0;
  }
  if (e.nombre.includes(t.raiz)) return NIVEL_NOMBRE;
  // La palabra o su sinónimo ES la categoría: «radio» → receptor, «bajo» → subwoofer.
  if (e.categorias.has(t.raiz) || t.alternativas.some((a) => e.categorias.has(a))) {
    return NIVEL_CATEGORIA;
  }
  if (e.principal.includes(t.raiz)) return NIVEL_MARCA_O_CODIGO;
  // Una palabra de 3 letras o menos («amp», «eq») pegada en medio de otra de
  // las specs («Amperaje») no es una coincidencia: en categoría y specs se
  // pide la palabra entera.
  if (t.texto.length >= 4 ? e.extra.includes(t.raiz) : e.tokensExtra.has(t.raiz)) {
    return NIVEL_EXTRA;
  }
  for (const alternativa of t.alternativas) {
    // Sin la marca: «bluetooth» → «bt» calzaba con «kbt» y metía 74 productos KBT.
    if (e.principalSinMarca.includes(alternativa) || e.extra.includes(alternativa)) {
      return NIVEL_APROXIMADO;
    }
  }
  return 0;
}

// `enCatalogo`: las palabras que algún producto trae tal cual. Esas están bien
// escritas y no se leen como error de otra: «bocina» no es «bobina», la
// impedancia de casi todos los subwoofers.
function nivelConErrores(e: Entrada, t: Termino, enCatalogo: ReadonlySet<Termino>): number {
  const exacto = nivelExacto(e, t);
  if (exacto > 0 || !t.tolerable || enCatalogo.has(t)) return exacto;
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

/**
 * Una fracción menor que 1 con la suma de los niveles de todas las palabras:
 * desempata DENTRO de un mismo nivel. En «subwoofer 12 memphis» la marca deja
 * a todos en el nivel de marca, y sin esto daba igual si el «12» estaba en el
 * nombre o metido en el código.
 */
function afinidad(e: Entrada, terminos: readonly Termino[]): number {
  let suma = 0;
  for (const t of terminos) suma += nivelExacto(e, t);
  return suma / (NIVEL_NOMBRE * terminos.length + 1);
}

const PUNTAJE_POR_NIVEL: Readonly<Record<number, number>> = {
  [NIVEL_NOMBRE]: 25,
  [NIVEL_CATEGORIA]: 24,
  [NIVEL_MARCA_O_CODIGO]: 22,
  [NIVEL_EXTRA]: 20,
  [NIVEL_APROXIMADO]: 17,
};

/** Cuánto pesa la consulta ENTERA como frase en el sku, el nombre o la marca. */
function puntajeDeFrase(e: Entrada, frase: string): number {
  // `frase` ya viene canonizada (`interpretar`) y sin lo que fue filtro.
  if (e.sku === frase) return 100;
  if (e.nombre === frase) return 90;
  if (e.sku.startsWith(frase)) return 80;
  if (e.nombre.startsWith(frase)) return 70;
  if (e.marca.startsWith(frase)) return 60;
  if (e.nombre.includes(frase)) return 50;
  if (e.marca.includes(frase)) return 40;
  if (e.sku.includes(frase)) return 30;
  return 0;
}

// ---------------------------------------------------------------------------
// Filtros que se escriben en la consulta
// ---------------------------------------------------------------------------

export interface Restriccion {
  campo: "precio" | "potencia" | "pulgadas" | "canales";
  /** En la unidad del campo: quetzales, vatios, pulgadas, canales. */
  min?: number;
  max?: number;
  minIncluye: boolean;
  maxIncluye: boolean;
}

// Un número con su unidad, sin pegarse a letras que lo vuelvan otra cosa
// («100mm», «124d»). La unidad ya viene canonizada: `"`, `w`, `ch canales`.
const patronNumero = (i: number) =>
  String.raw`(?<q${i}>q\.?\s*)?(?<n${i}>\d+(?:\.\d+)?)\s*(?<u${i}>w|"|ch(?:\s+canales)?|quetzales?)?(?![a-z0-9])`;

const RANGO_CON_PALABRA = new RegExp(
  String.raw`\b(?:entre|de|desde)\s+${patronNumero(1)}\s*(?:y|a|hasta|-)\s*${patronNumero(2)}`,
  "g",
);
// Sin «de/entre/desde» al frente: «8-10 pulgadas», «Q500-Q1000» y, con espacios,
// «subwoofer 8 a 10 pulgadas», «500 a 1000 quetzales». Aquí la unidad (o la Q)
// es obligatoria: «y» no vale como separador porque «8 y 10 pulgadas» pueden
// ser dos productos.
const RANGO_CON_GUION = new RegExp(
  String.raw`(?<![\w-])${patronNumero(1)}(?:\s*-\s*|\s+a\s+)${patronNumero(2)}`,
  "g",
);

// Menos y más, con y sin el número incluido: «hasta 1000» llega a 1000;
// «menos de 1000» no.
const MAXIMO_EXCLUYE =
  "menos de|menos que|menor a|menor que|bajo|debajo de|por debajo de|inferior a";
const MAXIMO_INCLUYE = "hasta|maximo|como maximo|no mas de|a lo mucho";
const MINIMO_EXCLUYE = "mas de|mas que|mayor a|mayor que|arriba de|por encima de|superior a|sobre";
const MINIMO_INCLUYE = "desde|minimo|como minimo|al menos|a partir de";

const COMPARACION = new RegExp(
  String.raw`\b(?<c>${[MAXIMO_EXCLUYE, MAXIMO_INCLUYE, MINIMO_EXCLUYE, MINIMO_INCLUYE].join("|")})\s+${patronNumero(1)}`,
  "g",
);

// Sin unidad ni «Q», un número es un precio, pero solo de Q 50 para arriba:
// debajo de eso es casi seguro otra cosa («menos de 12»).
const PRECIO_MINIMO_SIN_UNIDAD = 50;

type Grupos = Record<string, string | undefined>;

// La unidad de un número de la consulta, ya canonizada: `w`, `"`, `ch` o `q`.
function unidadDe(unidad: string): string {
  return unidad.startsWith("quetzal") ? "q" : unidad.startsWith("ch") ? "ch" : unidad;
}

function campoDe(g: Grupos, valores: number[], hayPotencia: boolean): Restriccion["campo"] | null {
  const unidad = g.u1 ?? g.u2 ?? "";
  if (unidad.startsWith("w")) return "potencia";
  if (unidad === '"') return "pulgadas";
  if (unidad.startsWith("ch")) return "canales";
  if (unidad.startsWith("quetzal") || g.q1 || g.q2) return "precio";
  if (hayPotencia) return "potencia";
  return Math.min(...valores) >= PRECIO_MINIMO_SIN_UNIDAD ? "precio" : null;
}

function describir(r: Restriccion): string {
  const etiqueta = {
    precio: "Precio",
    potencia: "Potencia",
    pulgadas: "Tamaño",
    canales: "Canales",
  }[r.campo];
  return `${etiqueta} ${textoRango(r)}`;
}

/** Un valor de un campo, dicho: «Q 1,000.00», «500 W», «12"», «4 canales». */
function textoValor(campo: Restriccion["campo"], n: number): string {
  return campo === "precio"
    ? formatQ(Math.round(n * 100))
    : campo === "potencia"
      ? `${n} W`
      : campo === "pulgadas"
        ? `${n}"`
        : `${n} canales`;
}

/** «entre Q 500.00 y Q 1,000.00», «hasta 4 canales», «más de 500 W». */
function textoRango(r: Restriccion): string {
  const valor = (n: number) => textoValor(r.campo, n);
  if (r.min !== undefined && r.max !== undefined) {
    return `entre ${valor(r.min)} y ${valor(r.max)}`;
  }
  if (r.max !== undefined) return `${r.maxIncluye ? "hasta" : "menos de"} ${valor(r.max)}`;
  return `${r.minIncluye ? "desde" : "más de"} ${valor(r.min ?? 0)}`;
}

export interface Interpretacion {
  /** La consulta sin lo que se convirtió en filtro, canonizada. */
  resto: string;
  usos: Uso[];
  restricciones: Restriccion[];
  /** Lo que se aplicó, dicho en palabras, para mostrarlo. */
  aplicados: string[];
}

/**
 * Separa de la consulta lo que es un FILTRO de lo que es texto:
 *
 *   - las palabras de categoría («marino», «lancha», «utv», «carro») → `usos`;
 *   - «menos de Q 1,000», «hasta 3000», «más de 500 W», «de 8 a 10
 *     pulgadas», «entre 2 y 4 canales» → `restricciones`.
 *
 * Un número con comparación pero sin unidad es un precio (de Q 50 para
 * arriba), salvo que la consulta hable de potencia. Lo que no se reconoce
 * queda en `resto` y se busca como texto, como siempre.
 */
export function interpretar(consultaNormalizada: string): Interpretacion {
  let texto = canonizar(consultaNormalizada);
  const hayPotencia = /\b(?:potencia|rms|vatios?|watts?)\b/.test(texto);
  const restricciones: Restriccion[] = [];

  const consumir = (
    regex: RegExp,
    armar: (g: Grupos, coincidencia: string, despues: string) => Restriccion | null,
  ) => {
    texto = texto.replace(regex, (...args) => {
      const coincidencia = args[0] as string;
      const grupos = args[args.length - 1] as Grupos;
      const entero = args[args.length - 2] as string;
      const posicion = args[args.length - 3] as number;
      const r = armar(grupos, coincidencia, entero.slice(posicion + coincidencia.length));
      if (!r) return coincidencia;
      restricciones.push(r);
      return " ";
    });
  };

  const rango = (g: Grupos, exigeUnidad: boolean, despues = ""): Restriccion | null => {
    const a = Number(g.n1);
    const b = Number(g.n2);
    if (exigeUnidad && !g.u1 && !g.u2 && !g.q1 && !g.q2) return null;
    // Dos unidades distintas no son un rango: «de 2 canales a 500 w».
    if (g.u1 && g.u2 && unidadDe(g.u1) !== unidadDe(g.u2)) return null;
    // La unidad solo en el primer número y otra palabra después del segundo
    // («de 2 canales y 6 pies») es una descripción, no un rango de canales.
    // «de 8 a 10 pulgadas» (unidad al final) sí lo es.
    if (g.u1 && !g.u2 && /^\s*[a-zñ]/.test(despues)) return null;
    const campo = campoDe(g, [a, b], hayPotencia);
    if (!campo) return null;
    return {
      campo,
      min: Math.min(a, b),
      max: Math.max(a, b),
      minIncluye: true,
      maxIncluye: true,
    };
  };
  consumir(RANGO_CON_PALABRA, (g, _, despues) => rango(g, false, despues));
  consumir(RANGO_CON_GUION, (g) => rango(g, true));

  consumir(COMPARACION, (g) => {
    const n = Number(g.n1);
    const campo = campoDe(g, [n], hayPotencia);
    if (!campo) return null;
    const c = g.c ?? "";
    const dentro = (lista: string) => lista.split("|").includes(c);
    if (dentro(MAXIMO_EXCLUYE) || dentro(MAXIMO_INCLUYE)) {
      return { campo, max: n, minIncluye: false, maxIncluye: dentro(MAXIMO_INCLUYE) };
    }
    return { campo, min: n, minIncluye: dentro(MINIMO_INCLUYE), maxIncluye: false };
  });

  // «Para carro», «lancha», «utv»: categoría, no texto.
  const usos: Uso[] = [];
  const quedan: string[] = [];
  for (const token of texto.split(/\s+/).filter(Boolean)) {
    // «lancha?», «bocinas,»: la puntuación pegada a la palabra no es parte de
    // ella. Sin quitarla, «bocinas para lancha?» perdía el filtro marino y
    // «bocinas.» se leía como una errata. El punto o la coma de un número
    // («6.5», «1,000») van adentro y se quedan.
    const palabra = token.replace(PUNTUACION_DE_BORDE, "");
    if (palabra === "") continue;
    const uso = Object.hasOwn(USO_PALABRAS, palabra) ? USO_PALABRAS[palabra] : undefined;
    if (uso) {
      if (!usos.includes(uso)) usos.push(uso);
    } else quedan.push(palabra);
  }

  return {
    resto: quedan.join(" "),
    usos,
    restricciones,
    aplicados: [
      ...(usos.length > 0 ? [`Categoría ${usos.join(" o ")}`] : []),
      ...restricciones.map(describir),
    ],
  };
}

interface Consulta extends Interpretacion {
  terminos: Termino[];
  hayFiltros: boolean;
  /** La consulta como llegó (normalizada), para rearmar la corrección sin perder los filtros. */
  original: string;
}

function compilar(consultaNormalizada: string): Consulta {
  const i = interpretar(consultaNormalizada);
  const hayFiltros = i.usos.length > 0 || i.restricciones.length > 0;
  return {
    ...i,
    hayFiltros,
    original: consultaNormalizada,
    terminos: terminosDe(i.resto, !hayFiltros),
  };
}

function valorDe(p: ProductoBuscable, campo: Restriccion["campo"]): number | undefined {
  switch (campo) {
    case "precio":
      return p.precioCents / 100;
    case "potencia":
      return p.potenciaW;
    case "pulgadas":
      return p.pulgadas;
    case "canales":
      return p.canales;
  }
}

/** Un producto sin el dato que se compara no cumple: no se adivina. */
function cumpleFiltros(p: ProductoBuscable, c: Consulta): boolean {
  // Sin `uso` (un catalog.json anterior a la columna), el producto es de carro.
  if (c.usos.length > 0 && !c.usos.some((u) => (p.uso ?? ["carro"]).includes(u))) return false;
  return c.restricciones.every((r) => {
    const v = valorDe(p, r.campo);
    if (v === undefined) return false;
    if (r.min !== undefined && (r.minIncluye ? v < r.min : v <= r.min)) return false;
    if (r.max !== undefined && (r.maxIncluye ? v > r.max : v >= r.max)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export type ModoBusqueda = "exacta" | "aproximada" | "cercana" | "parcial";

export interface ResultadoBusqueda {
  /** Sin ordenar por `compararRelevancia`: vienen por puntaje, de mayor a menor. */
  productos: ProductoBuscable[];
  modo: ModoBusqueda;
  /** «Quizá quisiste decir…»: la consulta con las palabras mal escritas corregidas. */
  correccion: string | null;
  /** Los filtros que salieron de la consulta («Categoría marino», «Precio hasta Q 1,000.00»). */
  aplicados: string[];
  /** Las categorías de uso que nombró la consulta (vacío si ninguna). */
  usos: Uso[];
  /**
   * En el modo «cercana», qué no hay y qué se muestra en su lugar: «Ninguno es
   * de 6". Los más cercanos son de 5.25" y 6.5".». `null` en los demás.
   */
  cercania: string | null;
}

const SIN_RESULTADOS: ResultadoBusqueda = {
  productos: [],
  modo: "exacta",
  correccion: null,
  aplicados: [],
  usos: [],
  cercania: null,
};

// Cuando la consulta es solo filtros («marino», «menos de 1000») no hay texto
// que puntúe: todos valen lo mismo y manda el desempate.
const PUNTAJE_SOLO_FILTROS = 20;

/**
 * Las palabras de la consulta que NINGÚN producto trae, ni por sinónimo, y la
 * palabra del catálogo más parecida de cada una (a igual distancia, la que más
 * productos usan). `null` si no hay nada que corregir.
 */
function corregir(
  productos: readonly ProductoBuscable[],
  terminos: readonly Termino[],
  enCatalogo: ReadonlySet<Termino>,
): ReadonlyMap<string, string> | null {
  const vocabulario = vocabularioDe(productos);
  const cambios = new Map<string, string>();
  for (const t of terminos) {
    if (!t.tolerable || enCatalogo.has(t)) continue;
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
    if (mejor !== null && mejorDistancia <= maximo) cambios.set(t.texto, mejor);
  }
  return cambios.size > 0 ? cambios : null;
}

/**
 * La consulta con las palabras corregidas y TODO lo demás como estaba: los
 * filtros («menos de 1000», «marino», «de 8 a 12 pulgadas») no pueden perderse
 * al pulsar «Quizá quisiste decir…», que cambiaría los resultados en silencio.
 */
function reescribir(original: string, cambios: ReadonlyMap<string, string>): string {
  return original
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const palabra = token.replace(PUNTUACION_DE_BORDE, "");
      return cambios.get(palabra) ?? token;
    })
    .join(" ");
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

// ---------------------------------------------------------------------------
// Lo más cercano
// ---------------------------------------------------------------------------

// Un número suelto junto a la palabra («bocinas 6», «pantalla 10») se lee
// como pulgadas solo hasta acá; más arriba no es una medida de este catálogo.
const MAX_PULGADAS_SUELTAS = 20;

/** La medida que una palabra escribe: `6"`, `3ch`, `1000w`, o un número suelto (pulgadas). */
function medidaDe(t: Termino): { campo: Restriccion["campo"]; valor: number } | null {
  if (t.numero) {
    const n = Number(t.texto);
    return n > 0 && n <= MAX_PULGADAS_SUELTAS ? { campo: "pulgadas", valor: n } : null;
  }
  if (!t.medida) return null;
  const m = /^(\d+(?:\.\d+)?)("|ch|w)$/.exec(t.texto);
  if (!m) return null;
  const campo = m[2] === '"' ? "pulgadas" : m[2] === "ch" ? "canales" : "potencia";
  return { campo, valor: Number(m[1]) };
}

interface Cercanos {
  productos: ProductoBuscable[];
  /** Los valores que quedaron, de menor a mayor; vacío para el precio. */
  valores: number[];
}

/**
 * Los productos que cumplen todas las palabras pero no `objetivo`, con el
 * valor más cercano de cada lado: con 6" pedidas, las de 5.25" y las de
 * 6.5". En precio cada producto tiene el suyo, así que van todos, del más
 * cercano al más lejano. `null` si no queda ninguno, o si alguno sí cumple
 * (no se dice «ninguno es de 6"» de algo que lo es).
 */
function masCercanos(
  lista: readonly Entrada[],
  terminos: readonly Termino[],
  objetivo: Restriccion,
  desempate: (a: ProductoBuscable, b: ProductoBuscable) => number,
): Cercanos | null {
  const candidatos: {
    producto: ProductoBuscable;
    valor: number;
    falta: number;
    puntaje: number;
    /** De qué lado de lo pedido cae: con una cota exclusiva («más de 500 W»), el 500 exacto es «debajo». */
    debajo: boolean;
  }[] = [];
  for (const e of lista) {
    const nivel = terminos.length > 0 ? nivelDeProducto(e, terminos, nivelExacto) : NIVEL_NOMBRE;
    if (nivel === 0) continue;
    const valor = valorDe(e.producto, objetivo.campo);
    if (valor === undefined) continue;
    const { min, max } = objetivo;
    const debajo = min !== undefined && (objetivo.minIncluye ? valor < min : valor <= min);
    const encima = max !== undefined && (objetivo.maxIncluye ? valor > max : valor >= max);
    if (!debajo && !encima) return null;
    candidatos.push({
      producto: e.producto,
      valor,
      falta: debajo ? (min ?? 0) - valor : valor - (max ?? 0),
      debajo,
      puntaje: (PUNTAJE_POR_NIVEL[nivel] ?? 0) + afinidad(e, terminos),
    });
  }
  if (candidatos.length === 0) return null;

  let elegidos = candidatos;
  if (objetivo.campo !== "precio") {
    // El lado lo decide el MISMO predicado que armó `candidatos`: comparar con
    // `<` y `>` estrictos dejaba fuera el valor igual a una cota exclusiva
    // («más de 500 W» con un subwoofer de 500 W) y, si todos valían justo la
    // cota, una lista vacía con el aviso «Los más cercanos son de  canales.».
    const abajo = Math.max(...candidatos.filter((c) => c.debajo).map((c) => c.valor));
    const arriba = Math.min(...candidatos.filter((c) => !c.debajo).map((c) => c.valor));
    elegidos = candidatos.filter((c) => (c.debajo ? c.valor === abajo : c.valor === arriba));
  }
  elegidos.sort(
    (a, b) => a.falta - b.falta || b.puntaje - a.puntaje || desempate(a.producto, b.producto),
  );
  return {
    productos: elegidos.map((c) => c.producto),
    valores:
      objetivo.campo === "precio"
        ? []
        : [...new Set(elegidos.map((c) => c.valor))].sort((a, b) => a - b),
  };
}

/** «Ninguno es de 6". Los más cercanos son de 5.25" y 6.5".» */
function fraseCercania(
  objetivo: Restriccion,
  escrita: number | null,
  valores: readonly number[],
): string {
  const { campo } = objetivo;
  const pedido =
    escrita !== null
      ? `Ninguno es de ${textoValor(campo, escrita)}.`
      : campo === "precio"
        ? `Ninguno cuesta ${textoRango(objetivo)}.`
        : campo === "pulgadas"
          ? `Ninguno mide ${textoRango(objetivo)}.`
          : `Ninguno tiene ${textoRango(objetivo)}.`;
  if (campo === "precio") return `${pedido} Estos son los de precio más cercano.`;
  // «de 1 y 4 canales», no «de 1 canales y 4 canales».
  const dichos =
    campo === "canales" ? valores.map(String) : valores.map((v) => textoValor(campo, v));
  const lista = dichos.join(" y ") + (campo === "canales" ? " canales" : "");
  return valores.length === 1
    ? `${pedido} El más cercano es de ${lista}.`
    : `${pedido} Los más cercanos son de ${lista}.`;
}

/**
 * Cuando ningún producto cumple TODO pero sí todo menos un dato —una medida
 * escrita («6 pulgadas», «3 canales», un 10 suelto) o un rango («menos de
 * Q 1,000»)—, lo más cercano a ese dato, con el aviso de qué no hay. Con dos
 * datos que faltan no se adivina cuál soltar: `null`, y sigue la parcial.
 */
function cercana(
  productos: readonly ProductoBuscable[],
  c: Consulta,
  desempate: (a: ProductoBuscable, b: ProductoBuscable) => number,
): ResultadoBusqueda | null {
  const conFiltros = productos.filter((p) => cumpleFiltros(p, c)).map(entradaDe);
  for (const [i, t] of c.terminos.entries()) {
    const medida = medidaDe(t);
    if (!medida) continue;
    const resto = c.terminos.filter((_, j) => j !== i);
    if (resto.length === 0) continue;
    const objetivo: Restriccion = {
      campo: medida.campo,
      min: medida.valor,
      max: medida.valor,
      minIncluye: true,
      maxIncluye: true,
    };
    const r = masCercanos(conFiltros, resto, objetivo, desempate);
    if (r) {
      return {
        productos: r.productos,
        modo: "cercana",
        correccion: null,
        aplicados: c.aplicados,
        usos: c.usos,
        cercania: fraseCercania(objetivo, medida.valor, r.valores),
      };
    }
  }
  for (const objetivo of c.restricciones) {
    const sinEse = { ...c, restricciones: c.restricciones.filter((r) => r !== objetivo) };
    const lista = productos.filter((p) => cumpleFiltros(p, sinEse)).map(entradaDe);
    const r = masCercanos(lista, c.terminos, objetivo, desempate);
    if (r) {
      // El filtro que no se cumplió ya no se anuncia como aplicado: lo dice el aviso.
      const soltado = describir(objetivo);
      return {
        productos: r.productos,
        modo: "cercana",
        correccion: null,
        aplicados: c.aplicados.filter((a) => a !== soltado),
        usos: c.usos,
        cercania: fraseCercania(objetivo, null, r.valores),
      };
    }
  }
  return null;
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
  const c = compilar(normalizada);
  const { terminos, aplicados, usos } = c;
  if (terminos.length === 0 && !c.hayFiltros) return SIN_RESULTADOS;
  // Los filtros valen para los tres niveles: ni un error de escritura ni una
  // coincidencia parcial devuelven un producto fuera de la categoría o del
  // rango que se pidió.
  const lista = productos.filter((p) => cumpleFiltros(p, c)).map(entradaDe);

  if (terminos.length === 0) {
    const todos = lista.map((e) => ({ producto: e.producto, puntaje: PUNTAJE_SOLO_FILTROS }));
    if (todos.length === 0) {
      const cercanos = cercana(productos, c, desempate);
      if (cercanos) return cercanos;
    }
    return {
      productos: ordenar(todos, desempate),
      modo: "exacta",
      correccion: null,
      aplicados,
      usos,
      cercania: null,
    };
  }

  const exactos: Puntuado[] = [];
  let mejorNivel = 0;
  for (const e of lista) {
    const nivel = nivelDeProducto(e, terminos, nivelExacto);
    if (nivel > mejorNivel) mejorNivel = nivel;
    if (nivel > 0) {
      exactos.push({
        producto: e.producto,
        puntaje: Math.max(
          puntajeDeFrase(e, c.resto),
          (PUNTAJE_POR_NIVEL[nivel] ?? 0) + afinidad(e, terminos),
        ),
      });
    }
  }
  // Si lo único que coincide con todo lo hace por las specs («bocinas 6»: un
  // adaptador de 6 canales cuya ficha dice «salidas de bocina»), y falta una
  // medida o un rango, lo más cercano dice mejor lo que hay. `cercana` no
  // dispara si algún producto cumple el dato pedido.
  if (exactos.length > 0 && mejorNivel < NIVEL_MARCA_O_CODIGO) {
    const cercanos = cercana(productos, c, desempate);
    if (cercanos) return cercanos;
  }
  if (exactos.length > 0) {
    return {
      productos: ordenar(exactos, desempate),
      modo: "exacta",
      correccion: null,
      aplicados,
      usos,
      cercania: null,
    };
  }

  // En todo el catálogo, no solo en lo que pasó los filtros: una palabra bien
  // escrita lo sigue estando aunque el filtro deje fuera a quien la trae.
  const enCatalogo = new Set(
    terminos.filter((t) => productos.some((p) => nivelExacto(entradaDe(p), t) > 0)),
  );
  const conErrores = (e: Entrada, t: Termino) => nivelConErrores(e, t, enCatalogo);
  const cambios = corregir(productos, terminos, enCatalogo);
  const correccion = cambios ? reescribir(c.original, cambios) : null;

  const aproximados: Puntuado[] = [];
  for (const e of lista) {
    const nivel = nivelDeProducto(e, terminos, conErrores);
    if (nivel > 0) aproximados.push({ producto: e.producto, puntaje: 10 + nivel });
  }
  if (aproximados.length > 0) {
    return {
      productos: ordenar(aproximados, desempate),
      modo: "aproximada",
      correccion,
      aplicados,
      usos,
      cercania: null,
    };
  }

  const cercanos = cercana(productos, c, desempate);
  if (cercanos) return cercanos;

  if (terminos.length > 1) {
    // La palabra que dice qué producto es («pantalla», «bocinas») pesa más que
    // el número o la medida que lo acota: con «pantalla 10» van primero las
    // pantallas, aunque ninguna sea de 10", y después lo que solo trae el 10.
    // A igual cuenta, el que coincide más arriba (nombre antes que specs).
    const parciales: Puntuado[] = [];
    for (const e of lista) {
      let palabras = 0;
      let numeros = 0;
      let niveles = 0;
      for (const t of terminos) {
        const nivel = conErrores(e, t);
        if (nivel === 0) continue;
        if (t.medida || t.numero) numeros++;
        else palabras++;
        niveles += nivel;
      }
      if (palabras + numeros > 0) {
        parciales.push({
          producto: e.producto,
          puntaje: palabras * 10000 + numeros * 100 + niveles,
        });
      }
    }
    if (parciales.length > 0) {
      return {
        productos: ordenar(parciales, desempate),
        modo: "parcial",
        correccion,
        aplicados,
        usos,
        cercania: null,
      };
    }
  }

  return { productos: [], modo: "exacta", correccion, aplicados, usos, cercania: null };
}

// ---------------------------------------------------------------------------
// El dato que coincidió
// ---------------------------------------------------------------------------

// Qué spec muestra cada tipo de dato pedido, por su etiqueta. La medida y la
// potencia se buscan por etiqueta y no por el valor exacto: en la búsqueda
// «cercana» el valor pedido («6"») justamente no está.
const ETIQUETA_DE_CAMPO: Readonly<Record<Restriccion["campo"], RegExp | null>> = {
  pulgadas: /^(?:tamaño|diámetro|pantalla|medida)/i,
  potencia: /potencia/i,
  canales: /canal/i,
  precio: null,
};

/**
 * Las specs destacadas de `producto` que muestran el dato que pidió la
 * consulta: con «2 ohm», la impedancia; con «12 pulgadas» o «más de 500 W», la
 * medida o la potencia; con «clase d», la clase. Vacío si la consulta no pide
 * un dato o el producto no lo trae entre sus destacadas. Hasta dos, en el
 * orden de la ficha.
 */
export function specsCoincidentes(producto: ProductoTarjeta, consulta: string): Spec[] {
  const c = compilar(normalizar(consulta).replace(/\s+/g, " "));
  const porEtiqueta: RegExp[] = [];
  const porValor: string[] = [];
  for (const r of c.restricciones) {
    const etiqueta = ETIQUETA_DE_CAMPO[r.campo];
    if (etiqueta) porEtiqueta.push(etiqueta);
  }
  for (const t of c.terminos) {
    if (t.texto.startsWith("clase-")) porEtiqueta.push(/clase/i);
    if (!t.medida) continue;
    const unidad = /(?:"|ohm|w|ch|mm|m|din|awg)$/.exec(t.texto)?.[0];
    if (unidad === '"') porEtiqueta.push(ETIQUETA_DE_CAMPO.pulgadas as RegExp);
    else if (unidad === "w") porEtiqueta.push(/potencia/i);
    else if (unidad === "ch") porEtiqueta.push(/canal/i);
    else porValor.push(t.texto);
  }
  if (porEtiqueta.length === 0 && porValor.length === 0) return [];
  return producto.specsDestacadas
    .filter((spec) => {
      if (porEtiqueta.some((r) => r.test(spec.etiqueta))) return true;
      const tokens = canonizar(normalizar(spec.valor)).split(SEPARADORES);
      return porValor.some((v) => tokens.includes(v));
    })
    .slice(0, 2);
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
 * «parcial» y la «cercana» no entran: sugerir algo que no coincide con lo
 * escrito es ruido.
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
  const buscados = unaPalabra ? [raiz(q), ...sinonimosDe(raiz(q))] : [];

  const resultado = buscar(productos, q, desempate);
  return {
    marcas: buscados.length ? marcas.filter((m) => nombreSeParece(m.nombre, q)).slice(0, 3) : [],
    categorias: buscados.length
      ? categorias
          .filter((c) => buscados.some((b) => nombreSeParece(c.nombre, raiz(b))))
          .slice(0, 3)
      : [],
    productos:
      resultado.modo === "parcial" || resultado.modo === "cercana"
        ? []
        : resultado.productos.slice(0, MAX_PRODUCTOS_SUGERIDOS),
  };
}
