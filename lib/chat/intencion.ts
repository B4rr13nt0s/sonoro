// Intención del texto del cliente: reglas a mano, en orden, y gana la primera
// que coincide (spec 2026-11-03 § Intención): charla → saludo → recomendación
// → tema → respuesta pendiente → referencia → seguimiento → vago → dato →
// búsqueda. Los pasos de memoria (pendiente, referencia, seguimiento) solo
// aplican con un Estado que los traiga: sin él, el chat es el de siempre.
// El vocabulario vive acá, como `sinonimos.ts`, ya normalizado (sin acentos ni
// mayúsculas). Todo se compara por palabras o frases enteras, nunca por pedazos
// de palabra: «pagos» no coincide dentro de «mapagos».

import { normalizar, raiz } from "../busqueda/busqueda.ts";
import { SINONIMOS } from "../busqueda/sinonimos.ts";
import { CATEGORIAS_SITIO } from "../catalog/categorias.ts";
// Las fórmulas de saludo que abren un mensaje y se quitan antes de buscar.
import { SALUDOS_DE_APERTURA, detectarCharla, esVago, type ClaseCharla } from "./charla.ts";
import { PALABRAS_DE_PREGUNTA, VOCABULARIO_DATOS, type Campo } from "./datos.ts";
import { accionDe, encontrarReferencia } from "./referencia.ts";
import { interpretarSeguimiento, type Cambio } from "./seguimiento.ts";
import type { Contexto, Estado, Tema } from "./tipos.ts";

interface Consulta {
  consulta: string;
  visible: string;
}

export type Intencion =
  | { tipo: "saludo" }
  | { tipo: "recomendacion" }
  | {
      tipo: "tema";
      tema: Tema;
      /**
       * Presente solo cuando el tema salió de una palabra AMBIGUA y el texto
       * trae además otras palabras de contenido: las consultas que el motor
       * prueba en el catálogo, en este orden, antes de contestar el tema.
       * Cada una va normalizada (para buscar) y tal como la escribió el
       * cliente (para mostrar). La primera es el texto entero; la segunda, el
       * texto sin la palabra del tema, porque «teléfono» no aparece en la
       * ficha de un radio con CarPlay y con ella la búsqueda nunca es exacta.
       */
      ambigua?: readonly Consulta[];
    }
  | {
      tipo: "dato";
      campos: readonly Campo[];
      /** El producto por el que se pregunta, sin las palabras de la pregunta. Vacía si no nombró ninguno. */
      consulta: string;
      visible: string;
    }
  | { tipo: "busqueda"; consulta: string }
  | { tipo: "charla"; clase: ClaseCharla }
  /** Contesta «¿Qué tipo de equipo buscas?»: el slug de la categoría nombrada. */
  | { tipo: "respuesta_pendiente"; categoria: string }
  | { tipo: "referencia"; sku: string; resto: string }
  | { tipo: "seguimiento"; cambios: Cambio[] }
  | { tipo: "vago" };

/** Lo que la memoria necesita del contexto: las marcas, y a qué va un número suelto. */
export type ContextoIntencion = Pick<Contexto, "marcas"> & {
  numeroSuelto?: "medida" | "canales" | null;
};

/** El texto entero, sin puntuación, es uno de estos. */
const SALUDOS = [
  "hola",
  "hola buenas",
  "buenas",
  "buenos dias",
  "buen dia",
  "buenas tardes",
  "buenas noches",
  "que tal",
  "saludos",
];

/** Pide criterio: el sitio no asesora (regla 2), así que se redirige. */
const RECOMENDACION = [
  "recomienda",
  "recomiendan",
  "recomiendas",
  "recomendarias",
  "recomendacion",
  "cual es mejor",
  "cual es el mejor",
  "cual me conviene",
  "que me conviene",
  "que le queda",
  "cual le queda",
  "que me sirve",
];

/** En el orden en que se prueban; el primero que coincide gana. */
const TEMAS: readonly { tema: Tema; palabras: readonly string[]; salvo?: readonly string[] }[] = [
  { tema: "envios", palabras: ["envio", "envios", "envian", "entregan", "entrega", "flete"] },
  { tema: "garantia", palabras: ["garantia", "defecto", "se arruino", "se dano"] },
  {
    tema: "instalacion",
    palabras: ["instalan", "instalacion", "instalar", "colocan"],
    // «kits de instalación» es un producto, no la pregunta por el servicio.
    salvo: ["kit", "kits"],
  },
  { tema: "cuotas", palabras: ["cuotas", "financiamiento", "visacuotas"] },
  {
    tema: "como_pedir",
    palabras: ["como compro", "como pido", "como pago", "como hago el pedido", "pagar en linea"],
  },
  { tema: "contacto", palabras: ["donde estan", "ubicados"] },
];

/**
 * Palabras de tema que también son palabras corrientes de una pregunta por un
 * producto: «radio con carplay para el teléfono» (teléfono es el aparato que
 * se conecta), «tarjeta de sonido» (tarjeta no es la de crédito). Solo ganan
 * si el texto no trae nada más que preguntar; si trae, el motor prueba primero
 * la búsqueda y, si encuentra productos, deja el tema como botón. Las de
 * `TEMAS` son inequívocas y ganan siempre. Se prueban después de aquellas.
 */
const TEMAS_AMBIGUOS: readonly { tema: Tema; palabras: readonly string[] }[] = [
  { tema: "cuotas", palabras: ["pagos", "tarjeta"] },
  { tema: "contacto", palabras: ["direccion", "telefono", "correo"] },
];

/**
 * Palabras de relleno de una pregunta («cuál es su teléfono», «número de
 * correo»): no cuentan como contenido al decidir si una palabra ambigua va
 * sola. Verbos como «aceptan» o «tienen» van aquí porque preguntan por el
 * tema, no por un producto.
 */
const RELLENO = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "cual",
  "cuales",
  "es",
  "son",
  "su",
  "sus",
  "mi",
  "me",
  "de",
  "del",
  "en",
  "con",
  "para",
  "por",
  "y",
  "o",
  "a",
  "que",
  "numero",
  "aceptan",
  "aceptas",
  "reciben",
  "manejan",
  "dan",
  "pueden",
  "puedo",
  "pasar",
  "pasan",
  "dame",
  "dime",
  "favor",
]);

/** Arranques conversacionales que se quitan antes de buscar. */
const ARRANQUES = [
  "tienen",
  "tienes",
  "hay",
  "venden",
  "vendes",
  "tendran",
  "tendrian",
  "tendras",
  "manejan",
  "manejas",
  "cuentan con",
  "ando buscando",
  "estoy buscando",
  "buscaba",
  "quisiera",
  "me gustaria ver",
  "me gustaria",
  "quiero ver",
  "puedo ver",
  "cuanto cuesta",
  "cuanto vale",
  "cuanto sale",
  "precio de",
  "precio del",
  "precio",
  "busco",
  "quiero",
  "necesito",
  "me interesa",
];

/**
 * Saludos y arranques juntos, porque llegan mezclados («hola, busco…»).
 * Los más largos primero: «precio de» antes que «precio», «buenas tardes»
 * antes que «buenas».
 */
const APERTURAS = [...SALUDOS_DE_APERTURA, ...ARRANQUES]
  .sort((a, b) => b.length - a.length)
  .map((frase) => frase.split(" "));

/** Cortesías que, solas tras un saludo («hola gracias»), siguen siendo un saludo. */
const CORTESIAS = ["gracias", "muchas gracias", "ok", "okay", "vale", "adios", "listo"];

const ARTICULOS = [["el"], ["la"], ["los"], ["las"], ["un"], ["una"]];

const SIGNOS = /[¿?¡!]/g;

/**
 * Quita la puntuación que separa palabras: los signos de pregunta y
 * exclamación, y `, . ; :` cuando están pegados a un espacio, al borde del
 * texto o (salvo el punto) entre letras. Lo que está entre dos cifras se
 * queda: «1,000 W», «6.5"» y «MJP800.4» son datos del producto.
 */
function sinPuntuacion(texto: string): string {
  // Sin lookbehind (aserción hacia atrás): Safari anterior a 16.4 no lo parsea y con él
  // fallaría la carga de todo el chunk del chat.
  return texto
    .replace(SIGNOS, " ")
    .replace(/(\p{L})[,;:](?=\p{L})/gu, "$1 ")
    .replace(/[,.;:]+(?=\s|$)/g, " ")
    .replace(/(^|\s)[,.;:]+/g, "$1 ");
}

/** Palabras del texto ya normalizado, sin puntuación, rodeadas de espacios. */
function enPalabras(normalizado: string): string {
  return ` ${normalizado
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join(" ")} `;
}

function contiene(palabras: string, frase: string): boolean {
  return palabras.includes(` ${frase} `);
}

/**
 * Quita `prefijos` del inicio, de a uno y repetidos. `originales` y
 * `normalizadas` son las mismas palabras, una con lo que escribió el cliente y
 * otra normalizada para comparar; se recortan juntas.
 */
function quitarAlInicio(
  originales: string[],
  normalizadas: string[],
  prefijos: readonly (readonly string[])[],
): void {
  for (;;) {
    const prefijo = prefijos.find(
      (p) =>
        p.length <= normalizadas.length && p.every((palabra, i) => normalizadas[i] === palabra),
    );
    if (prefijo === undefined) return;
    originales.splice(0, prefijo.length);
    normalizadas.splice(0, prefijo.length);
  }
}

/**
 * Lo que queda de lo escrito sin saludos, arranques ni artículos al inicio:
 * normalizado (para buscar) y tal como lo escribió el cliente (para mostrarlo
 * y mandarlo por WhatsApp).
 */
function despojar(texto: string): Consulta {
  const originales = sinPuntuacion(texto).split(/\s+/).filter(Boolean);
  const normalizadas = originales.map(normalizar);
  quitarAlInicio(originales, normalizadas, APERTURAS);
  quitarAlInicio(originales, normalizadas, ARTICULOS);
  return { consulta: normalizadas.join(" "), visible: originales.join(" ") };
}

/**
 * La consulta sin las palabras del tema, y sin el relleno que quedó colgando
 * en los bordes («radio con carplay para el teléfono» → «radio con carplay»).
 */
function sinPalabras(despojado: Consulta, quitar: readonly string[]): Consulta {
  const visibles = despojado.visible.split(" ");
  const normalizadas = despojado.consulta.split(" ");
  const quedan = normalizadas.flatMap((p, i) => (quitar.includes(p) ? [] : [i]));
  while (quedan.length > 0 && RELLENO.has(normalizadas[quedan[0]])) quedan.shift();
  while (quedan.length > 0 && RELLENO.has(normalizadas[quedan[quedan.length - 1]])) quedan.pop();
  return {
    consulta: quedan.map((i) => normalizadas[i]).join(" "),
    visible: quedan.map((i) => visibles[i]).join(" "),
  };
}

/**
 * Una pregunta por un dato del producto (`datos.ts`): una palabra del
 * vocabulario que no va tras un número —«1000 watts», «2 ohm», «4 canales» o
 * «1000 w rms» son lo que se busca, no una pregunta—. Lo que queda sin
 * saludos, palabras de la pregunta ni relleno es el producto.
 */
function detectarDato(texto: string): Extract<Intencion, { tipo: "dato" }> | null {
  const originales = sinPuntuacion(texto).split(/\s+/).filter(Boolean);
  const normalizadas = originales.map(normalizar);
  // «cuánto cuesta» y «precio de» son también arranques de búsqueda: el
  // precio se pregunta ANTES de que `quitarAlInicio` se los lleve.
  const campos: Campo[] = [];
  const precio = VOCABULARIO_DATOS.find((v) => v.campo.tipo === "precio");
  if (precio?.palabras.some((p) => enPalabras(normalizadas.join(" ")).includes(` ${p} `))) {
    campos.push(precio.campo);
  }
  quitarAlInicio(originales, normalizadas, APERTURAS);

  const trasNumero = (i: number) =>
    [normalizadas[i - 1], normalizadas[i - 2]].some((p) => p !== undefined && /^\d/.test(p));
  const usadas = new Set<number>();
  for (const { campo, palabras } of VOCABULARIO_DATOS) {
    for (const frase of palabras) {
      const partes = frase.split(" ");
      for (let i = 0; i + partes.length <= normalizadas.length; i++) {
        if (!partes.every((p, j) => normalizadas[i + j] === p)) continue;
        if (campo.tipo === "spec" && trasNumero(i)) continue;
        partes.forEach((_, j) => usadas.add(i + j));
        if (!campos.includes(campo)) campos.push(campo);
      }
    }
  }
  if (campos.length === 0) return null;

  const quedan = normalizadas.flatMap((p, i) =>
    usadas.has(i) || RELLENO.has(p) || PALABRAS_DE_PREGUNTA.has(p) ? [] : [i],
  );
  return {
    tipo: "dato",
    campos,
    consulta: quedan.map((i) => normalizadas[i]).join(" "),
    visible: quedan.map((i) => originales[i]).join(" "),
  };
}

/** ¿Lo que queda tras quitar la referencia pregunta por el producto referido, y por nada más? */
function preguntaPorReferido(resto: string): boolean {
  if (resto === "" || accionDe(resto) !== null) return true;
  return detectarDato(resto)?.consulta === "";
}

/** La consulta como la escribió el cliente: con mayúsculas, acentos y ñ. */
export function consultaVisible(texto: string): string {
  return despojar(texto).visible;
}

/** La categoría del sitio que el texto ENTERO nombra («subwoofers», «un radio»), por nombre o sinónimo. */
function categoriaNombrada(consulta: string): string | null {
  const palabras = consulta
    .split(" ")
    .filter((p) => p && !["un", "una", "unos", "unas"].includes(p));
  if (palabras.length !== 1) return null;
  const r = raiz(palabras[0]);
  const buscadas = [r, ...(SINONIMOS[r] ?? [])];
  const categoria = CATEGORIAS_SITIO.find((c) => buscadas.includes(raiz(normalizar(c.nombre))));
  return categoria?.slug ?? null;
}

export function detectarIntencion(
  texto: string,
  estado?: Estado,
  contexto?: ContextoIntencion,
): Intencion {
  const normalizado = normalizar(texto);
  const palabras = enPalabras(normalizado);

  const clase = detectarCharla(texto);
  if (clase) return { tipo: "charla", clase };

  if (SALUDOS.some((s) => palabras === ` ${s} `)) return { tipo: "saludo" };

  if (RECOMENDACION.some((r) => contiene(palabras, r))) return { tipo: "recomendacion" };

  for (const { tema, palabras: vocabulario, salvo } of TEMAS) {
    if (salvo?.some((s) => contiene(palabras, s))) continue;
    if (vocabulario.some((p) => contiene(palabras, p))) return { tipo: "tema", tema };
  }

  const despojado = despojar(texto);

  for (const { tema, palabras: vocabulario } of TEMAS_AMBIGUOS) {
    const nombradas = vocabulario.filter((p) => contiene(palabras, p));
    if (nombradas.length === 0) continue;
    const otras = despojado.consulta
      .split(" ")
      .filter((p) => p !== "" && !nombradas.includes(p) && !RELLENO.has(p));
    return otras.length === 0
      ? { tipo: "tema", tema }
      : { tipo: "tema", tema, ambigua: [despojado, sinPalabras(despojado, nombradas)] };
  }

  if (estado?.pendiente === "categoria") {
    const categoria = categoriaNombrada(despojado.consulta);
    if (categoria) return { tipo: "respuesta_pendiente", categoria };
  }

  if (estado?.mostrados?.length) {
    const referencia = encontrarReferencia(texto, estado);
    // Lo demás del mensaje tiene que preguntar POR ese producto: nada («¿y el
    // segundo?»), un pedido de carrito o un dato sin otro producto. «busco un
    // amplificador para este carro» o «espera un segundo» siguen su camino.
    if (referencia && preguntaPorReferido(referencia.resto)) {
      return { tipo: "referencia", ...referencia };
    }
  }

  if (estado?.busqueda) {
    const pendienteNumero =
      estado.pendiente === "medida" || estado.pendiente === "canales" ? estado.pendiente : null;
    const cambios = interpretarSeguimiento(texto, {
      marcas: contexto?.marcas ?? [],
      numeroSuelto: pendienteNumero ?? contexto?.numeroSuelto ?? null,
    });
    if (cambios) return { tipo: "seguimiento", cambios };
  }

  // «busco algo para mi carro»: el arranque se quita antes de comparar.
  if (esVago(texto) || esVago(despojado.consulta)) return { tipo: "vago" };

  const dato = detectarDato(texto);
  if (dato) return dato;

  const { consulta } = despojado;
  if (consulta === "" || CORTESIAS.includes(consulta)) return { tipo: "saludo" };
  return { tipo: "busqueda", consulta };
}
