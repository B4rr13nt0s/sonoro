// Reducer puro: no toca localStorage, no conoce el carrito ni WhatsApp. Cada
// acción que muta lleva su propio `now` (ISO 8601) en vez de que el reducer
// llame a new Date() — así es determinista y se prueba sin mockear el reloj.
// Mismo criterio que lib/cart/reducer.ts.
import { evaluarToggle } from "./seleccion.ts";
import { crearSeleccionVacia, type Seleccion } from "./types.ts";

export type ComparadorAction =
  | { type: "agregar"; sku: string; categoria: string; now: string }
  | { type: "quitar"; sku: string; now: string }
  // Vacía la selección y arranca una nueva con este producto: es lo que
  // ocurre cuando el usuario acepta cambiar de categoría.
  | { type: "reemplazar"; sku: string; categoria: string; now: string }
  | { type: "vaciar"; now: string }
  | { type: "hidratar"; seleccion: Seleccion };

export function comparadorReducer(estado: Seleccion, action: ComparadorAction): Seleccion {
  switch (action.type) {
    case "agregar": {
      // El reducer revalida con la misma función que usó la UI. No es
      // redundante: la UI decide qué mostrar, el reducer garantiza que nunca
      // se guarde una selección mezclada o de más de MAX_COMPARAR, aunque
      // alguien despache directo.
      const veredicto = evaluarToggle(estado, { sku: action.sku, categoria: action.categoria });
      if (veredicto.tipo !== "agrega") return estado;

      return {
        ...estado,
        categoria: action.categoria,
        skus: [...estado.skus, action.sku],
        updatedAt: action.now,
      };
    }

    case "quitar": {
      if (!estado.skus.includes(action.sku)) return estado;
      const skus = estado.skus.filter((sku) => sku !== action.sku);
      return {
        ...estado,
        // Sin esto, quitar el último deja la categoría vieja pegada y el
        // siguiente producto de otra categoría dispara "¿reemplazar?" contra
        // una selección vacía.
        categoria: skus.length === 0 ? null : estado.categoria,
        skus,
        updatedAt: action.now,
      };
    }

    case "reemplazar":
      return {
        ...estado,
        categoria: action.categoria,
        skus: [action.sku],
        updatedAt: action.now,
      };

    case "vaciar":
      return crearSeleccionVacia(action.now);

    case "hidratar":
      return action.seleccion;

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
