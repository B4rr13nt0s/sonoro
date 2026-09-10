// Única puerta de entrada al comparador, igual que lib/cart/index.ts.
// MIGRATIONS queda fuera a propósito: es detalle interno de storage.ts.
export { ComparadorProvider, useComparador } from "./context.ts";
export type { ProductoComparable } from "./context.ts";
export { comparadorReducer } from "./reducer.ts";
export type { ComparadorAction } from "./reducer.ts";
export { evaluarToggle } from "./seleccion.ts";
export type { ResultadoToggle } from "./seleccion.ts";
export { reconcile } from "./reconcile.ts";
export type { CambioComparador } from "./reconcile.ts";
export { loadSeleccion, saveSeleccion, COMPARADOR_STORAGE_KEY } from "./storage.ts";
export { construirFilas, SIN_DATO } from "./tabla.ts";
export type { FilaComparacion } from "./tabla.ts";
export { parsearSkus, construirHrefComparar } from "./url.ts";
export { crearSeleccionVacia, MAX_COMPARAR, SCHEMA_VERSION, SeleccionSchema } from "./types.ts";
export type { CatalogoComparable, Seleccion } from "./types.ts";
