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
//
// Antes de buscar texto, la consulta se «interpreta» (`interpretar`): las
// palabras que nombran una categoría de uso («marino», «utv», «carro») y las
// comparaciones con número («menos de Q 1,000», «más de 500 W», «de 8 a 10
// pulgadas») dejan de ser texto y pasan a ser FILTROS sobre el dato.
import { formatQ } from "../../lib/format/precio.ts";
import type { Atributos, ProductoTarjeta, Uso } from "../../lib/catalog/types.ts";
import { PALABRAS_VACIAS, SINONIMOS, USO_PALABRAS } from "./sinonimos.ts";

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

/**
 * Los números de un producto contra los que se comparan «más de 500 W» o «de
 * 8 a 10 pulgadas». Solo viajan los que existen:
 *
 *   potenciaW  la mayor potencia RMS publicada (en un amplificador de varias
 *              cargas, la más alta de cualquier canal).
 *   pulgadas   la medida nominal: `6x9"` → 6, `7/8"` → 0.875, `50 mm` → 1.97;
 *              en un receptor, la pantalla.
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
    const fraccion = /^(\d+)\/(\d+)"$/.exec(a.medida);
    const primero = /\d+(?:\.\d+)?/.exec(a.medida);
    if (fraccion) numeros.pulgadas = Number(fraccion[1]) / Number(fraccion[2]);
    else if (primero) {
      const n = Number(primero[0]);
      numeros.pulgadas = /mm$/.test(a.medida) ? Math.round((n / 25.4) * 100) / 100 : n;
    }
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
const RANGO_CON_GUION = new RegExp(
  String.raw`(?<![\w-])${patronNumero(1)}\s*-\s*${patronNumero(2)}`,
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
  const valor = (n: number) =>
    r.campo === "precio"
      ? formatQ(Math.round(n * 100))
      : r.campo === "potencia"
        ? `${n} W`
        : r.campo === "pulgadas"
          ? `${n}"`
          : `${n} canales`;
  if (r.min !== undefined && r.max !== undefined) {
    return `${etiqueta} entre ${valor(r.min)} y ${valor(r.max)}`;
  }
  if (r.max !== undefined)
    return `${etiqueta} ${r.maxIncluye ? "hasta" : "menos de"} ${valor(r.max)}`;
  return `${etiqueta} ${r.minIncluye ? "desde" : "más de"} ${valor(r.min ?? 0)}`;
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
    armar: (g: Grupos, coincidencia: string) => Restriccion | null,
  ) => {
    texto = texto.replace(regex, (...args) => {
      const coincidencia = args[0] as string;
      const grupos = args[args.length - 1] as Grupos;
      const r = armar(grupos, coincidencia);
      if (!r) return coincidencia;
      restricciones.push(r);
      return " ";
    });
  };

  const rango = (g: Grupos, exigeUnidad: boolean): Restriccion | null => {
    const a = Number(g.n1);
    const b = Number(g.n2);
    if (exigeUnidad && !g.u1 && !g.u2) return null;
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
  consumir(RANGO_CON_PALABRA, (g) => rango(g, false));
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
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
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
}

function compilar(consultaNormalizada: string): Consulta {
  const i = interpretar(consultaNormalizada);
  const hayFiltros = i.usos.length > 0 || i.restricciones.length > 0;
  return { ...i, hayFiltros, terminos: terminosDe(i.resto, !hayFiltros) };
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

/**
 * Coincide si CADA palabra de la consulta aparece —tal cual, en plural o por
 * un sinónimo— en el nombre, la marca, el código, la categoría o las specs,
 * en cualquier orden. Hasta septiembre de 2026 se buscaba la consulta entera
 * dentro de un solo campo, y como la marca casi nunca va en el nombre,
 * «memphis 12» o «rockford amplificador» daban cero resultados aunque hubiera
 * catorce productos de cada uno.
 */
export function coincide(producto: ProductoBuscable, consultaNormalizada: string): boolean {
  const c = compilar(consultaNormalizada);
  if (c.terminos.length === 0 && !c.hayFiltros) return false;
  if (!cumpleFiltros(producto, c)) return false;
  if (c.terminos.length === 0) return true;
  return nivelDeProducto(entradaDe(producto), c.terminos, nivelExacto) > 0;
}

/**
 * Relevancia simple: la consulta entera como sku o nombre exactos pesa más
 * que «empieza con», que pesa más que «contiene en cualquier parte»; y todo
 * eso, más que las palabras sueltas repartidas entre campos (por nombre,
 * marca, categoría o sinónimo, en ese orden). 0 si el producto no coincide.
 */
export function puntuarRelevancia(producto: ProductoBuscable, consultaNormalizada: string): number {
  const c = compilar(consultaNormalizada);
  if (!cumpleFiltros(producto, c)) return 0;
  if (c.terminos.length === 0) return c.hayFiltros ? PUNTAJE_SOLO_FILTROS : 0;
  const e = entradaDe(producto);
  const nivel = nivelDeProducto(e, c.terminos, nivelExacto);
  if (nivel === 0) return 0;
  return Math.max(puntajeDeFrase(e, c.resto), PUNTAJE_POR_NIVEL[nivel] ?? 0);
}

export type ModoBusqueda = "exacta" | "aproximada" | "parcial";

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
}

const SIN_RESULTADOS: ResultadoBusqueda = {
  productos: [],
  modo: "exacta",
  correccion: null,
  aplicados: [],
  usos: [],
};

// Cuando la consulta es solo filtros («marino», «menos de 1000») no hay texto
// que puntúe: todos valen lo mismo y manda el desempate.
const PUNTAJE_SOLO_FILTROS = 20;

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
  const c = compilar(normalizada);
  const { terminos, aplicados, usos } = c;
  if (terminos.length === 0 && !c.hayFiltros) return SIN_RESULTADOS;
  // Los filtros valen para los tres niveles: ni un error de escritura ni una
  // coincidencia parcial devuelven un producto fuera de la categoría o del
  // rango que se pidió.
  const lista = productos.filter((p) => cumpleFiltros(p, c)).map(entradaDe);

  if (terminos.length === 0) {
    const todos = lista.map((e) => ({ producto: e.producto, puntaje: PUNTAJE_SOLO_FILTROS }));
    return {
      productos: ordenar(todos, desempate),
      modo: "exacta",
      correccion: null,
      aplicados,
      usos,
    };
  }

  const exactos: Puntuado[] = [];
  for (const e of lista) {
    const nivel = nivelDeProducto(e, terminos, nivelExacto);
    if (nivel > 0) {
      exactos.push({
        producto: e.producto,
        puntaje: Math.max(puntajeDeFrase(e, c.resto), PUNTAJE_POR_NIVEL[nivel] ?? 0),
      });
    }
  }
  if (exactos.length > 0) {
    return {
      productos: ordenar(exactos, desempate),
      modo: "exacta",
      correccion: null,
      aplicados,
      usos,
    };
  }

  const correccion = corregir(productos, terminos);

  const aproximados: Puntuado[] = [];
  for (const e of lista) {
    const nivel = nivelDeProducto(e, terminos, nivelConErrores);
    if (nivel > 0) aproximados.push({ producto: e.producto, puntaje: 10 + nivel });
  }
  if (aproximados.length > 0) {
    return {
      productos: ordenar(aproximados, desempate),
      modo: "aproximada",
      correccion,
      aplicados,
      usos,
    };
  }

  if (terminos.length > 1) {
    const parciales: Puntuado[] = [];
    for (const e of lista) {
      const aciertos = terminos.filter((t) => nivelConErrores(e, t) > 0).length;
      if (aciertos > 0) parciales.push({ producto: e.producto, puntaje: aciertos });
    }
    if (parciales.length > 0) {
      return {
        productos: ordenar(parciales, desempate),
        modo: "parcial",
        correccion,
        aplicados,
        usos,
      };
    }
  }

  return { productos: [], modo: "exacta", correccion, aplicados, usos };
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
