// Intención del texto del cliente: reglas a mano, en orden, y gana la primera
// que coincide (spec § Intención): saludo → recomendación → tema → búsqueda.
// El vocabulario vive acá, como `sinonimos.ts`, ya normalizado (sin acentos ni
// mayúsculas). Todo se compara por palabras o frases enteras, nunca por pedazos
// de palabra: «pagos» no coincide dentro de «mapagos».

import { normalizar } from "../busqueda/busqueda.ts";
import type { Tema } from "./tipos.ts";

export type Intencion =
  | { tipo: "saludo" }
  | { tipo: "recomendacion" }
  | { tipo: "tema"; tema: Tema }
  | { tipo: "busqueda"; consulta: string };

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
  "gracias",
  "muchas gracias",
  "ok",
  "adios",
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
  { tema: "cuotas", palabras: ["cuotas", "pagos", "financiamiento", "visacuotas", "tarjeta"] },
  {
    tema: "como_pedir",
    palabras: ["como compro", "como pido", "como pago", "como hago el pedido", "pagar en linea"],
  },
  { tema: "contacto", palabras: ["direccion", "donde estan", "ubicados", "telefono", "correo"] },
];

/** Fórmulas de saludo que abren un mensaje y se quitan antes de buscar. */
const SALUDOS_DE_APERTURA = [
  "hola",
  "buenas",
  "buenos dias",
  "buen dia",
  "buenas tardes",
  "buenas noches",
  "que tal",
  "saludos",
];

/** Arranques conversacionales que se quitan antes de buscar. */
const ARRANQUES = [
  "tienen",
  "tienes",
  "hay",
  "venden",
  "vendes",
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

const ARTICULOS = [["el"], ["la"], ["los"], ["las"], ["un"], ["una"]];

const SIGNOS = /[¿?¡!]/g;

/**
 * Quita la puntuación que separa palabras: los signos de pregunta y
 * exclamación, y `, . ; :` cuando están pegados a un espacio, al borde del
 * texto o (salvo el punto) entre letras. Lo que está entre dos cifras se
 * queda: «1,000 W», «6.5"» y «MJP800.4» son datos del producto.
 */
function sinPuntuacion(texto: string): string {
  return texto
    .replace(SIGNOS, " ")
    .replace(/(?<=\p{L})[,;:](?=\p{L})/gu, " ")
    .replace(/[,.;:]+(?=\s|$)/g, " ")
    .replace(/(?<=^|\s)[,.;:]+/g, " ");
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
function despojar(texto: string): { consulta: string; visible: string } {
  const originales = sinPuntuacion(texto).split(/\s+/).filter(Boolean);
  const normalizadas = originales.map(normalizar);
  quitarAlInicio(originales, normalizadas, APERTURAS);
  quitarAlInicio(originales, normalizadas, ARTICULOS);
  return { consulta: normalizadas.join(" "), visible: originales.join(" ") };
}

/** La consulta como la escribió el cliente: con mayúsculas, acentos y ñ. */
export function consultaVisible(texto: string): string {
  return despojar(texto).visible;
}

export function detectarIntencion(texto: string): Intencion {
  const normalizado = normalizar(texto);
  const palabras = enPalabras(normalizado);

  if (SALUDOS.some((s) => palabras === ` ${s} `)) return { tipo: "saludo" };

  if (RECOMENDACION.some((r) => contiene(palabras, r))) return { tipo: "recomendacion" };

  for (const { tema, palabras: vocabulario, salvo } of TEMAS) {
    if (salvo?.some((s) => contiene(palabras, s))) continue;
    if (vocabulario.some((p) => contiene(palabras, p))) return { tipo: "tema", tema };
  }

  const { consulta } = despojar(texto);
  if (consulta === "") return { tipo: "saludo" };
  return { tipo: "busqueda", consulta };
}
