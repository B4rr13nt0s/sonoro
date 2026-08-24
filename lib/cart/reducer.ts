// Reducer puro: no toca localStorage ni conoce WhatsApp (CLAUDE.md § Modelo
// de conversión — "El estado del carrito no conoce WhatsApp. WhatsApp es un
// consumidor del carrito, igual que lo será el checkout en el futuro").
//
// Cada acción que muta el carrito lleva su propio `now` (ISO 8601) en vez de
// que el reducer llame `new Date()` — así el reducer es determinista y se
// puede probar sin mockear el reloj.
import { crearCarritoVacio, type Cart, type CartItem } from "./types.ts";

export type CartAction =
  | {
      type: "add";
      item: Pick<
        CartItem,
        "sku" | "qty" | "unitPriceCents" | "currency" | "nombreSnapshot" | "imagenSnapshot"
      >;
      now: string;
    }
  | { type: "remove"; sku: string; now: string }
  // qty <= 0 elimina la línea — es la misma operación que "remove", vista
  // desde el control de cantidad en la UI, no dos formas de mutar el carrito.
  | { type: "setQty"; sku: string; qty: number; now: string }
  | { type: "clear"; now: string }
  | { type: "hydrate"; cart: Cart };

export function cartReducer(cart: Cart, action: CartAction): Cart {
  switch (action.type) {
    case "add": {
      const existente = cart.items.find((i) => i.sku === action.item.sku);
      const items = existente
        ? cart.items.map((i) =>
            i.sku === action.item.sku ? { ...i, ...action.item, qty: i.qty + action.item.qty } : i,
          )
        : [...cart.items, { ...action.item, addedAt: action.now }];
      return { ...cart, items, updatedAt: action.now };
    }

    case "remove": {
      return {
        ...cart,
        items: cart.items.filter((i) => i.sku !== action.sku),
        updatedAt: action.now,
      };
    }

    case "setQty": {
      if (action.qty <= 0) {
        return {
          ...cart,
          items: cart.items.filter((i) => i.sku !== action.sku),
          updatedAt: action.now,
        };
      }
      return {
        ...cart,
        items: cart.items.map((i) => (i.sku === action.sku ? { ...i, qty: action.qty } : i)),
        updatedAt: action.now,
      };
    }

    case "clear": {
      return crearCarritoVacio(action.now);
    }

    case "hydrate": {
      return action.cart;
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
