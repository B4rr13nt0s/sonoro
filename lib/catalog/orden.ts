// Los comparadores de los órdenes de listado (OrdenSchema en types.ts):
// «relevancia», con el que abren todos, y los dos por precio.
//
// Archivo aparte, sin dependencias y sin acceso a disco, por dos razones:
//
//   1. Lo importa components/catalog/SearchExperience.tsx, que es
//      "use client". Ese componente hoy solo importa `type Producto` del
//      barrel — un import de TIPO, que desaparece al compilar. Importar un
//      VALOR desde lib/catalog/index.ts arrastraría el adaptador estático, y
//      con él node:fs y data/catalog.json, al bundle del navegador.
//   2. Es lógica pura: se prueba sin leer el catálogo (orden.test.ts).
import type { ProductoTarjeta } from "./types.ts";

// destacado primero → precio DESCENDENTE → sku.
//
// El precio descendente como segundo criterio es lo que pone el equipo antes
// que los accesorios sin agregar un campo al esquema de producto: en KBT, con
// precio ascendente el listado abría con adaptadores RCA de Q 30 y los
// subwoofers caían en la página 3.
//
// El desempate por sku NO usa localeCompare: el requisito es que el orden no
// cambie entre builds, y la salida de ICU varía entre versiones (mismo motivo
// por el que lib/format/precio.ts no usa `style: "currency"`). Comparar por
// puntos de código es determinista en cualquier runtime. Como el sku es único
// (CLAUDE.md § Esquema de producto), este comparador es un orden TOTAL: no
// depende de que Array.prototype.sort sea estable ni del orden de entrada.
export function compararRelevancia(a: ProductoTarjeta, b: ProductoTarjeta): number {
  if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
  if (a.precioCents !== b.precioCents) return b.precioCents - a.precioCents;
  return compararSku(a, b);
}

// Los órdenes por precio, con el mismo desempate por sku: sin él, dos
// productos del mismo precio (los adaptadores de Q 30 de una marca) quedaban
// en el orden de catalog.json, que cambia al reordenar el libro — y un
// enlace a `?page=2` compartido mostraba otros productos después de un build.
export function compararPrecioAsc(a: ProductoTarjeta, b: ProductoTarjeta): number {
  return a.precioCents - b.precioCents || compararSku(a, b);
}

export function compararPrecioDesc(a: ProductoTarjeta, b: ProductoTarjeta): number {
  return b.precioCents - a.precioCents || compararSku(a, b);
}

function compararSku(a: ProductoTarjeta, b: ProductoTarjeta): number {
  return compararTexto(a.sku, b.sku);
}

/**
 * Orden de texto por PUNTOS DE CÓDIGO, no con localeCompare: la salida de ICU
 * cambia entre versiones de Node, y lo que se ordena con ella (las marcas de
 * brands.json, que está versionado y se regenera en cada build) dejaría de dar
 * el mismo resultado en cada máquina.
 */
export function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
