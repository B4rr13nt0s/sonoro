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
  "buenas",
  "buenos dias",
  "buenas tardes",
  "buenas noches",
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
]
  // Los más largos primero: «precio de» antes que «precio».
  .sort((a, b) => b.length - a.length);

const ARTICULOS = ["el", "la", "los", "las", "un", "una"];

const SIGNOS = /[¿?¡!]/g;

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

/** Quita `prefijos` del inicio de `texto`, de a uno y repetidos. */
function quitarAlInicio(texto: string, prefijos: readonly string[]): string {
  let resto = texto;
  for (;;) {
    const prefijo = prefijos.find((p) => resto === p || resto.startsWith(`${p} `));
    if (prefijo === undefined) return resto;
    resto = resto.slice(prefijo.length).trimStart();
  }
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

  const limpio = normalizado.replace(SIGNOS, " ").replace(/\s+/g, " ").trim();
  const consulta = quitarAlInicio(quitarAlInicio(limpio, ARRANQUES), ARTICULOS);
  if (consulta === "") return { tipo: "saludo" };
  return { tipo: "busqueda", consulta };
}
