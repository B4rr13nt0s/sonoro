// Lee el carro que el cliente escribe en el chat («corolla 2010», «Toyota
// Corolla 2010», «crv») contra los vehículos publicados del selector
// (docs/superpowers/specs/2026-11-06-chat-compatibilidad-design.md, § Cómo
// entiende el carro). Lógica pura: no decide qué falta preguntar —eso lo hace
// resolverSeleccion en respuestaVehiculo.ts—, solo qué nombró.
import { buscar, normalizar, type ProductoBuscable } from "../busqueda/busqueda.ts";
import { SINONIMOS, USO_PALABRAS } from "../busqueda/sinonimos.ts";
import { CATEGORIAS_SITIO } from "../catalog/categorias.ts";
import { compararRelevancia } from "../catalog/orden.ts";
import type { Vehiculo } from "../vehiculos/types.ts";
import type { Seleccion } from "../vehiculos/url.ts";

/**
 * Frases que preguntan por el carro aunque no lo nombren. Normalizadas, y
 * sin el «qué» o el «cuál»: «qué tamaño de bocina LE CABE a mi Civic».
 */
export const FRASES_VEHICULO: readonly string[] = [
  "le queda",
  "le quedan",
  "le cabe",
  "le caben",
  "cabe en",
  "caben en",
];

const ANIO_MINIMO = 1940;

/** Sin acentos ni mayúsculas, y cualquier separador como un espacio: «CR-V» es «cr v». */
function clave(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function palabras(texto: string): string[] {
  const c = clave(texto);
  return c === "" ? [] : c.split(" ");
}

/** ¿La secuencia `buscada` aparece entera, palabra por palabra, en `texto`? */
function contiene(texto: readonly string[], buscada: readonly string[]): boolean {
  if (buscada.length === 0) return false;
  for (let i = 0; i + buscada.length <= texto.length; i += 1) {
    if (buscada.every((p, j) => texto[i + j] === p)) return true;
  }
  return false;
}

/** El nombre sin separadores («crv», «rav4») igual a una palabra o a dos seguidas («rav 4»). */
function contieneCompacto(texto: readonly string[], compacto: string): boolean {
  for (let i = 0; i < texto.length; i += 1) {
    if (texto[i] === compacto) return true;
    if (i + 1 < texto.length && texto[i] + texto[i + 1] === compacto) return true;
  }
  return false;
}

interface Modelo {
  marcaSlug: string;
  modeloSlug: string;
  palabrasModelo: string[];
  compacto: string;
  palabrasMarca: string[];
}

function modelosDe(vehiculos: readonly Vehiculo[]): Modelo[] {
  const vistos = new Map<string, Modelo>();
  for (const v of vehiculos) {
    const llave = `${v.marcaSlug}/${v.modeloSlug}`;
    if (vistos.has(llave)) continue;
    const palabrasModelo = palabras(v.modelo);
    vistos.set(llave, {
      marcaSlug: v.marcaSlug,
      modeloSlug: v.modeloSlug,
      palabrasModelo,
      compacto: palabrasModelo.join(""),
      palabrasMarca: palabras(v.marca),
    });
  }
  return [...vistos.values()];
}

/** Lo que sigue a un número que es potencia, no año: «2000 w», «1200 rms». */
const UNIDADES_POTENCIA = new Set(["w", "watt", "watts", "vatios", "rms", "wrms"]);

function leerAnio(texto: readonly string[], anioActual: number): number | undefined {
  for (const [i, p] of texto.entries()) {
    if (!/^\d{4}$/.test(p)) continue;
    if (UNIDADES_POTENCIA.has(texto[i + 1] ?? "")) continue;
    const anio = Number(p);
    if (anio >= ANIO_MINIMO && anio <= anioActual + 1) return anio;
  }
  return undefined;
}

/**
 * La marca, el modelo y el año que el texto nombra, como slugs del selector.
 * `null` si no nombra ni una marca ni un modelo de la lista. El año es el
 * ESCRITO: si ese modelo no lo tiene, resolverSeleccion lo deja fuera y la
 * respuesta lo dice.
 */
export function leerVehiculo(
  texto: string,
  vehiculos: readonly Vehiculo[],
  ambiguos: ReadonlySet<string>,
  anioActual: number = new Date().getFullYear(),
): Seleccion | null {
  const escrito = palabras(texto);
  if (escrito.length === 0) return null;
  const anio = leerAnio(escrito, anioActual);
  const modelos = modelosDe(vehiculos);
  const conAnio = (sel: Seleccion): Seleccion => (anio === undefined ? sel : { ...sel, anio });

  let elegido: Modelo | null = null;
  for (const m of modelos) {
    const calza = contiene(escrito, m.palabrasModelo) || contieneCompacto(escrito, m.compacto);
    if (!calza) continue;
    // Un nombre que también es un producto («fit») necesita marca o año.
    if (ambiguos.has(m.modeloSlug) && anio === undefined && !contiene(escrito, m.palabrasMarca)) {
      continue;
    }
    if (!elegido || m.compacto.length > elegido.compacto.length) elegido = m;
  }
  if (elegido) return conAnio({ marca: elegido.marcaSlug, modelo: elegido.modeloSlug });

  const marca = modelos.find((m) => contiene(escrito, m.palabrasMarca));
  return marca ? conAnio({ marca: marca.marcaSlug }) : null;
}

// Las categorías que la compatibilidad no cubre: solo hay datos de receptores
// y bocinas. «Amplificador para mi Corolla» busca amplificadores.
const RAICES_OTRAS = new Set(
  CATEGORIAS_SITIO.filter((c) => c.nombre !== "Receptores" && c.nombre !== "Bocinas").map((c) =>
    clave(c.nombre).replace(/(es|s)$/, ""),
  ),
);

function nombraOtraCategoria(palabra: string): boolean {
  const raiz = palabra.replace(/(es|s)$/, "");
  if (RAICES_OTRAS.has(raiz) || RAICES_OTRAS.has(palabra)) return true;
  const sinonimos = Object.hasOwn(SINONIMOS, palabra) ? SINONIMOS[palabra] : [];
  return sinonimos.some((s) => RAICES_OTRAS.has(clave(s)));
}

/**
 * ¿El texto no es de compatibilidad aunque nombre un carro? Si nombra otra
 * categoría del sitio («amplificador», «sub») o un uso que no es carro
 * («lancha», «utv»): la lista de vehículos solo trae carros, y sus datos solo
 * receptores y bocinas. Esos textos siguen como búsqueda.
 */
export function excluyeVehiculo(texto: string): boolean {
  return palabras(texto).some((p) => {
    const uso = Object.hasOwn(USO_PALABRAS, p) ? USO_PALABRAS[p] : undefined;
    return (uso !== undefined && uso !== "carro") || nombraOtraCategoria(p);
  });
}

/** ¿Pregunta qué le queda a un carro, lo nombre o no? */
export function tieneFraseVehiculo(texto: string): boolean {
  const escrito = palabras(texto);
  return FRASES_VEHICULO.some((frase) => contiene(escrito, frase.split(" ")));
}

/**
 * Los modelos que, escritos solos, pueden ser un producto: su nombre, buscado
 * en el catálogo del chat, trae resultados exactos («Fit»). Esos piden marca
 * o año para contar como vehículo.
 */
export function nombresAmbiguos(
  vehiculos: readonly Vehiculo[],
  productos: readonly ProductoBuscable[],
): Set<string> {
  const ambiguos = new Set<string>();
  if (productos.length === 0) return ambiguos;
  for (const m of modelosDe(vehiculos)) {
    const v = vehiculos.find((x) => x.modeloSlug === m.modeloSlug);
    if (!v) continue;
    const resultado = buscar(productos, normalizar(v.modelo), compararRelevancia);
    if (resultado.modo === "exacta" && resultado.productos.length > 0) ambiguos.add(m.modeloSlug);
  }
  return ambiguos;
}

export interface Generacion {
  desde: number;
  hasta: number;
}

/** Los rangos de años del libro para un modelo, distintos, del más nuevo al más viejo. */
export function generaciones(
  vehiculos: readonly Vehiculo[],
  marcaSlug: string,
  modeloSlug: string,
): Generacion[] {
  const rangos = new Map<string, Generacion>();
  for (const v of vehiculos) {
    if (v.marcaSlug !== marcaSlug || v.modeloSlug !== modeloSlug) continue;
    rangos.set(`${v.desde}-${v.hasta}`, { desde: v.desde, hasta: v.hasta });
  }
  return [...rangos.values()].sort((a, b) => b.desde - a.desde || b.hasta - a.hasta);
}

export function etiquetaGeneracion(g: Generacion): string {
  return g.desde === g.hasta ? String(g.desde) : `${g.desde}–${g.hasta}`;
}
