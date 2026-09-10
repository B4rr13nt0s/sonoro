import type { Producto } from "../catalog/types.ts";

// El modelo de filas de la tabla comparativa. Lógica pura y testeable, fuera
// del componente — mismo criterio que lib/catalog/paginacion.ts.

export const SIN_DATO = "—";

export type FilaComparacion = {
  etiqueta: string;
  // Un valor por columna, en el mismo orden que los productos. Nunca vacío:
  // donde el producto no trae esa spec va SIN_DATO.
  valores: string[];
  // Todas las columnas traen dato, así que la fila se puede comparar.
  comparable: boolean;
  // comparable Y los valores no son todos iguales. Es la única que se
  // resalta.
  difieren: boolean;
};

// Une las specs de UN producto por etiqueta, conservando el orden en que
// aparecen. `specsFicha` solo valida .min(4).max(10) (lib/catalog/types.ts),
// NO que las etiquetas sean únicas — y hoy hay productos que repiten:
// M71512 repite «Serie» y «Aplicación», X317-STG6 y X317-STG4 repiten
// «Instalación». Un find() por etiqueta se quedaría con el primer valor y
// perdería el segundo en silencio, justo al comparar dos productos de la
// misma línea. Se unen con « · » en la misma fila.
function valoresPorEtiqueta(producto: Producto): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const spec of producto.specsFicha) {
    const previo = mapa.get(spec.etiqueta);
    mapa.set(spec.etiqueta, previo === undefined ? spec.valor : `${previo} · ${spec.valor}`);
  }
  return mapa;
}

export function construirFilas(productos: Producto[]): FilaComparacion[] {
  if (productos.length === 0) return [];

  const porProducto = productos.map(valoresPorEtiqueta);

  // Unión ORDENADA: se recorren los productos en orden de columna y, dentro
  // de cada uno, sus specs en el orden del arreglo, agregando las etiquetas
  // no vistas. Manda el orden editorial del primero — CLAUDE.md § Esquema de
  // producto declara ese orden "decisión editorial que debe respetarse", así
  // que nada de ordenar alfabéticamente.
  const etiquetas: string[] = [];
  const vistas = new Set<string>();
  for (const producto of productos) {
    for (const spec of producto.specsFicha) {
      if (vistas.has(spec.etiqueta)) continue;
      vistas.add(spec.etiqueta);
      etiquetas.push(spec.etiqueta);
    }
  }

  return etiquetas.map((etiqueta) => {
    const crudos = porProducto.map((mapa) => mapa.get(etiqueta));
    const comparable = crudos.every((valor) => valor !== undefined);
    // Un hueco NO es una diferencia entre los productos: es que el fabricante
    // no publicó el dato. Contarlo marcaba el 99% de las filas —con 4
    // subwoofers, 17 de 17.1— y el resaltado dejaba de distinguir nada.
    const difieren = comparable && new Set(crudos).size > 1;
    return {
      etiqueta,
      valores: crudos.map((valor) => valor ?? SIN_DATO),
      comparable,
      difieren,
    };
  });
}
