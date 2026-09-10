import { MAX_COMPARAR, type Seleccion } from "./types.ts";

// La decisión de qué pasa al pulsar «Comparar», como función pura y fuera de
// React: el control es un toggle y hay dos casos que no puede resolver solo
// (la selección llena y la categoría distinta), así que quien llama recibe el
// veredicto y decide qué UI mostrar. Así las cuatro ramas se prueban sin
// montar un componente.
export type ResultadoToggle =
  | { tipo: "agrega" }
  | { tipo: "quita" }
  | { tipo: "lleno" }
  | { tipo: "otra_categoria"; categoriaActual: string };

export function evaluarToggle(
  seleccion: Seleccion,
  producto: { sku: string; categoria: string },
): ResultadoToggle {
  // "quita" se comprueba PRIMERO, antes que "lleno" y que la categoría. Al
  // revés, con la selección llena el botón de una tarjeta ya seleccionada
  // devolvería "lleno" y dejaría de poder quitarla — justo cuando el usuario
  // más necesita quitar algo para poder agregar otro.
  if (seleccion.skus.includes(producto.sku)) return { tipo: "quita" };

  // La categoría se comprueba antes que el cupo: si además de estar llena es
  // de otra categoría, lo que corresponde ofrecer es reemplazar la selección
  // entera, no avisar de un cupo que el reemplazo vuelve irrelevante.
  //
  // `categoria` puede ser no nula con skus vacío solo si el estado quedó
  // corrupto; el `skus.length > 0` evita preguntar por reemplazar una
  // selección que no existe.
  if (
    seleccion.skus.length > 0 &&
    seleccion.categoria !== null &&
    seleccion.categoria !== producto.categoria
  ) {
    return { tipo: "otra_categoria", categoriaActual: seleccion.categoria };
  }

  if (seleccion.skus.length >= MAX_COMPARAR) return { tipo: "lleno" };

  return { tipo: "agrega" };
}
