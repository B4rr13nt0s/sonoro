// A qué producto MOSTRADO se refiere un mensaje: «el primero», «el 3», «ese»,
// «agrégalo», o el código de uno de ellos (spec 2026-11-03 § Referencias).
// Lógica pura: recibe los skus de la última respuesta (`mostrados`) y el
// último producto del que se habló (`enfoque`), no el catálogo. Ante la duda
// —una posición que no existe, «ese» con varios en pantalla— no es
// referencia, y el mensaje sigue su camino como hoy.
import { normalizar } from "../busqueda/busqueda.ts";

interface Memoria {
  mostrados?: readonly string[];
  enfoque?: string | null;
}

const ORDINALES: Readonly<Record<string, number>> = {
  primero: 0,
  primera: 0,
  primer: 0,
  segundo: 1,
  segunda: 1,
  tercero: 2,
  tercera: 2,
  tercer: 2,
  cuarto: 3,
  cuarta: 3,
  quinto: 4,
  quinta: 4,
};
const ULTIMO = new Set(["ultimo", "ultima"]);
// Sin «esta»: normalizado es también «está» («¿está disponible el SQ12?»).
const PRONOMBRES = new Set(["ese", "este", "esa", "eso", "esto"]);
// «lo» y «la» solo en estas frases: sueltos son artículos («y de la marca
// memphis?» es un seguimiento, no una referencia).
const CON_LO = ["lo quiero", "la quiero", "me lo llevo", "me la llevo", "lo compro", "la compro"];
// «agrégalo», «cómpralo», «añádelo»: el pronombre pegado al verbo.
const CON_PRONOMBRE =
  /^(?:agrega|agregar|compra|comprar|anade|anadir|pasa|pasame|dame|muestra|ensena)(?:lo|la)$/;
// Lo que rodea a la referencia y no pregunta nada: «y el segundo?».
const ALREDEDOR = new Set(["y", "el", "la", "los", "las", "del", "al", "de", "numero"]);

function palabras(texto: string): string[] {
  return normalizar(texto)
    .replace(/[¿?¡!,;:]/g, " ")
    .replace(/\.(?=\s|$)/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** El resto del mensaje sin las palabras de `quitar` ni los artículos pegados a ellas. */
function resto(lista: readonly string[], quitar: ReadonlySet<number>): string {
  const fuera = new Set(quitar);
  for (const i of quitar) {
    for (let j = i - 1; j >= 0 && ALREDEDOR.has(lista[j]); j--) fuera.add(j);
  }
  return lista.filter((_, i) => !fuera.has(i)).join(" ");
}

export function encontrarReferencia(
  texto: string,
  memoria: Memoria,
): { sku: string; resto: string } | null {
  const mostrados = memoria.mostrados ?? [];
  const lista = palabras(texto);

  // Un código de los mostrados, tal cual o sin separadores.
  const enTexto = ` ${lista.join(" ")} `;
  for (const sku of mostrados) {
    const s = normalizar(sku);
    if (enTexto.includes(` ${s} `) || enTexto.includes(` ${s.replace(/[\s.-]+/g, "")} `)) {
      const partes = s.split(/\s+/);
      const inicio = lista.findIndex((_, i) => partes.every((p, j) => lista[i + j] === p));
      const quitar = new Set(inicio >= 0 ? partes.map((_, j) => inicio + j) : []);
      if (inicio < 0) quitar.add(lista.indexOf(s.replace(/[\s.-]+/g, "")));
      return { sku, resto: resto(lista, quitar) };
    }
  }

  for (const [i, p] of lista.entries()) {
    // «el primero», «la última».
    if (Object.hasOwn(ORDINALES, p) || ULTIMO.has(p)) {
      const posicion = ULTIMO.has(p) ? mostrados.length - 1 : ORDINALES[p];
      const sku = mostrados[posicion];
      return sku ? { sku, resto: resto(lista, new Set([i])) } : null;
    }
    // «el 3», «el número 2»: solo tras artículo o «número», para que «de 10»
    // siga siendo una medida.
    if (/^[1-9]$/.test(p) && ["el", "la", "numero"].includes(lista[i - 1] ?? "")) {
      const sku = mostrados[Number(p) - 1];
      return sku ? { sku, resto: resto(lista, new Set([i])) } : null;
    }
  }

  // «ese», «lo quiero», «agrégalo»: el producto del que se venía hablando, o
  // el único en pantalla.
  const aludido = memoria.enfoque ?? (mostrados.length === 1 ? mostrados[0] : null);
  if (!aludido) return null;
  for (const [i, p] of lista.entries()) {
    if (PRONOMBRES.has(p)) return { sku: aludido, resto: resto(lista, new Set([i])) };
    if (CON_PRONOMBRE.test(p)) return { sku: aludido, resto: resto(lista, new Set()) };
  }
  if (CON_LO.some((f) => enTexto.includes(` ${f} `))) {
    return { sku: aludido, resto: lista.join(" ") };
  }
  return null;
}

export type Accion = "carrito" | "precio" | null;

const CARRITO = [
  "agregalo",
  "agregala",
  "agregar",
  "agrega",
  "lo quiero",
  "me lo llevo",
  "me llevo",
  "compralo",
  "comprar",
  "anadir",
  "anadelo",
  "llevo",
  "quiero",
];
const PRECIO = ["cuanto cuesta", "cuanto vale", "cuanto sale", "precio", "cuesta"];

/** Qué se pide del producto referido, con lo que quedó del mensaje (`resto`). */
export function accionDe(textoResto: string): Accion {
  const t = ` ${palabras(textoResto).join(" ")} `;
  if (CARRITO.some((f) => t.includes(` ${f} `))) return "carrito";
  if (PRECIO.some((f) => t.includes(` ${f} `))) return "precio";
  return null;
}
