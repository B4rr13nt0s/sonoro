// Qué productos coinciden con una búsqueda de /buscar y en qué orden de
// puntaje. Lógica pura, fuera del componente, para poder probarla
// (busqueda.test.ts) — mismo criterio que components/cart/avisos.ts.
import type { ProductoTarjeta } from "../../lib/catalog/types.ts";

// Marcas diacríticas combinantes (U+0300–U+036F) que quedan sueltas después
// de normalize("NFD") — construido con RegExp + \\u en vez de un literal de
// clase de caracteres para no dejar marcas combinantes invisibles pegadas al
// código fuente.
const MARCAS_DIACRITICAS = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizar(texto: string): string {
  return texto.normalize("NFD").replace(MARCAS_DIACRITICAS, "").toLowerCase().trim();
}

type Campos = { nombre: string; marca: string; sku: string; todo: string };

function campos(producto: ProductoTarjeta): Campos {
  const nombre = normalizar(producto.nombre);
  const marca = normalizar(producto.marca);
  const sku = normalizar(producto.sku);
  return { nombre, marca, sku, todo: `${nombre} ${marca} ${sku}` };
}

/**
 * Coincide si CADA palabra de la consulta aparece en el nombre, la marca o el
 * código, en cualquier orden. Hasta septiembre de 2026 se buscaba la consulta
 * entera dentro de un solo campo, y como la marca casi nunca va en el nombre,
 * «memphis 12» o «rockford amplificador» daban cero resultados aunque hubiera
 * catorce productos de cada uno.
 */
export function coincide(producto: ProductoTarjeta, consultaNormalizada: string): boolean {
  const { todo } = campos(producto);
  return consultaNormalizada
    .split(/\s+/)
    .filter(Boolean)
    .every((palabra) => todo.includes(palabra));
}

/**
 * Relevancia simple, no una búsqueda con backend: la consulta entera como
 * sku o nombre exactos pesa más que «empieza con», que pesa más que
 * «contiene en cualquier parte»; y todo eso, más que las palabras sueltas
 * repartidas entre campos, que es lo último que se muestra.
 */
export function puntuarRelevancia(producto: ProductoTarjeta, consultaNormalizada: string): number {
  const { nombre, marca, sku } = campos(producto);

  if (sku === consultaNormalizada) return 100;
  if (nombre === consultaNormalizada) return 90;
  if (sku.startsWith(consultaNormalizada)) return 80;
  if (nombre.startsWith(consultaNormalizada)) return 70;
  if (marca.startsWith(consultaNormalizada)) return 60;
  if (nombre.includes(consultaNormalizada)) return 50;
  if (marca.includes(consultaNormalizada)) return 40;
  if (sku.includes(consultaNormalizada)) return 30;
  return 20; // las palabras coinciden, pero repartidas entre campos
}
