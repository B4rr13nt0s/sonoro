// El comparador del orden "relevancia" (OrdenSchema en types.ts), que es con
// el que abren todos los listados.
//
// Archivo aparte, sin dependencias y sin acceso a disco, por dos razones:
//
//   1. Lo importa components/catalog/SearchExperience.tsx, que es
//      "use client". Ese componente hoy solo importa `type Producto` del
//      barrel — un import de TIPO, que desaparece al compilar. Importar un
//      VALOR desde lib/catalog/index.ts arrastraría el adaptador estático, y
//      con él node:fs y data/catalog.json, al bundle del navegador.
//   2. Es lógica pura: se prueba sin leer el catálogo (orden.test.ts).
import type { Producto } from "./types.ts";

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
export function compararRelevancia(a: Producto, b: Producto): number {
  if (a.destacado !== b.destacado) return a.destacado ? -1 : 1;
  if (a.precioCents !== b.precioCents) return b.precioCents - a.precioCents;
  return a.sku < b.sku ? -1 : a.sku > b.sku ? 1 : 0;
}
