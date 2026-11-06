// La charla del chat: agradecimientos, «¿cómo estás?», «¿eres un bot?»,
// despedidas, confirmaciones sueltas y groserías, más las frases que
// presentan resultados y las preguntas cuando la búsqueda es vaga (spec
// 2026-11-03-chat-conversacion-design.md § Charla). Vocabulario a mano, como
// el de `intencion.ts`, comparado sobre el texto normalizado y ENTERO: una
// frase de charla dentro de una búsqueda («gracias, y de 10?») no es charla.
import { normalizar } from "../busqueda/busqueda.ts";

export type ClaseCharla =
  "gracias" | "como_estas" | "quien_eres" | "adios" | "confirmacion" | "negacion" | "groseria";

/** Fórmulas de saludo que abren un mensaje. Las usa también `intencion.ts`. */
export const SALUDOS_DE_APERTURA = [
  "hola",
  "buenas",
  "buenos dias",
  "buen dia",
  "buenas tardes",
  "buenas noches",
  "que tal",
  "saludos",
];

const FRASES: Readonly<Record<Exclude<ClaseCharla, "groseria">, readonly string[]>> = {
  gracias: ["gracias", "muchas gracias", "mil gracias", "te agradezco", "gracias por la info"],
  como_estas: ["como estas", "como esta", "que tal estas", "como te va"],
  quien_eres: [
    "eres un bot",
    "eres una persona",
    "eres humano",
    "con quien hablo",
    "quien eres",
    "eres real",
  ],
  adios: ["adios", "bye", "chao", "hasta luego", "eso es todo", "nada mas", "es todo"],
  confirmacion: ["ok", "okay", "si", "dale", "va", "listo", "perfecto", "entendido", "esta bien"],
  negacion: ["no", "no gracias", "ninguno"],
};

// Basta UNA de estas palabras en el mensaje. La respuesta no la repite.
const GROSERIAS = new Set([
  "idiota",
  "estupido",
  "estupida",
  "imbecil",
  "pendejo",
  "pendeja",
  "mierda",
  "puta",
  "puto",
  "cerote",
  "hijueputa",
  "culero",
  "baboso",
  "babosa",
]);

export const TEXTOS_CHARLA: Readonly<Record<Exclude<ClaseCharla, "confirmacion">, string>> = {
  gracias: "Con gusto. ¿Te ayudo con algo más?",
  como_estas: "Bien, gracias. ¿Qué producto buscas?",
  quien_eres:
    "Soy el asistente automático de Sonoro: busco productos y respondo dudas de envíos, garantía y pagos.",
  adios: "Gracias por escribir. Aquí estoy si necesitas algo más.",
  negacion: "Está bien. Aquí estoy si necesitas algo más.",
  groseria: "Estoy para ayudarte a buscar productos y resolver dudas de la tienda.",
};

/** La confirmación suelta sin una pregunta pendiente. */
export const TEXTO_QUE_MAS = "¿Qué más buscas?";

export const TEXTO_TIPO_EQUIPO = "¿Qué tipo de equipo buscas?";

/** Sin acentos, sin signos ni comas, con un espacio entre palabras. */
function limpio(texto: string): string {
  return normalizar(texto)
    .replace(/[¿?¡!,.;:]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** El texto sin el saludo con que abre, si lo trae («hola, cómo estás» → «como estas»). */
function sinSaludo(texto: string): string {
  const saludo = [...SALUDOS_DE_APERTURA]
    .sort((a, b) => b.length - a.length)
    .find((s) => texto === s || texto.startsWith(`${s} `));
  return saludo ? texto.slice(saludo.length).trim() : texto;
}

export function detectarCharla(texto: string): ClaseCharla | null {
  const entero = limpio(texto);
  if (entero.split(" ").some((p) => GROSERIAS.has(p))) return "groseria";
  // Primero el texto entero: «qué tal estás» empieza con el saludo «qué tal».
  for (const candidato of [entero, sinSaludo(entero)]) {
    if (candidato === "") continue;
    for (const [clase, frases] of Object.entries(FRASES) as [ClaseCharla, readonly string[]][]) {
      if (frases.includes(candidato)) return clase;
    }
  }
  return null;
}

// Pedidos de equipo sin decir cuál (§ Preguntar cuando es vago). La frase
// entera: «bajo de 12» es una búsqueda, «quiero más bajo» no.
const VAGOS = [
  "algo",
  "quiero mejorar el sonido",
  "mejorar el sonido",
  "quiero mas bajo",
  "que suene mas fuerte",
  "quiero que suene mas fuerte",
  "busco equipo",
  "quiero armar mi sistema",
  "armar mi sistema",
];
const DEL_CARRO = ["para mi carro", "de mi carro", "en mi carro", "para el carro", "del carro"];

export function esVago(texto: string): boolean {
  let t = limpio(texto);
  const final = DEL_CARRO.find((f) => t.endsWith(` ${f}`));
  if (final) t = t.slice(0, -final.length - 1);
  return VAGOS.includes(t);
}

/** La línea que presenta una búsqueda exacta. Rota con el turno, sin azar. */
export function fraseResultados(total: number, turno: number): string {
  if (total === 1) return "Encontré 1 resultado.";
  const variantes = [`Encontré ${total} resultados.`, `Estos son los ${total} resultados.`];
  return variantes[turno % variantes.length];
}

const PREGUNTAS = {
  medida: "¿Qué medida buscas?",
  canales: "¿De cuántos canales?",
  categoria: TEXTO_TIPO_EQUIPO,
} as const;

/** «Hay 118 resultados. ¿Qué medida buscas?» */
export function preguntaVaga(total: number, pendiente: keyof typeof PREGUNTAS): string {
  return `Hay ${total} resultados. ${PREGUNTAS[pendiente]}`;
}

/** Solo la pregunta, para repetirla tras un «ok». */
export function pregunta(pendiente: keyof typeof PREGUNTAS): string {
  return PREGUNTAS[pendiente];
}
