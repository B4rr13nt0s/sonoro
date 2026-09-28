// Reconciliación del snapshot contra el catálogo actual. Corre al hidratar
// (lib/cart/context.tsx), fuera del reducer — es una función pura que no
// muta nada, solo calcula el carrito corregido y la lista de cambios.
//
// Nunca se envía por WhatsApp un precio que Sonoro ya no honra, ni un
// producto que ya no vende — así que esto corre ANTES de que el carrito
// hidratado quede disponible al resto de la app. /carrito le avisa al
// cliente qué cambió (components/cart/avisos.ts).
import type { Cart, CartItem, CatalogoSku } from "./types.ts";

export type CambioCarrito =
  | { tipo: "eliminado_no_existe"; sku: string; nombreSnapshot: string }
  | { tipo: "eliminado_inactivo"; sku: string; nombreSnapshot: string }
  | { tipo: "agotado"; sku: string; nombreSnapshot: string }
  | {
      tipo: "precio_actualizado";
      sku: string;
      nombreSnapshot: string;
      precioAnteriorCents: number;
      precioActualCents: number;
    };

export function reconcile(
  cart: Cart,
  catalogo: CatalogoSku[],
): { cart: Cart; cambios: CambioCarrito[] } {
  const porSku = new Map(catalogo.map((p) => [p.sku, p]));
  const cambios: CambioCarrito[] = [];

  const items = cart.items.reduce<CartItem[]>((acumulado, item) => {
    const actual = porSku.get(item.sku);

    if (!actual) {
      cambios.push({
        tipo: "eliminado_no_existe",
        sku: item.sku,
        nombreSnapshot: item.nombreSnapshot,
      });
      return acumulado;
    }
    if (!actual.activo) {
      cambios.push({
        tipo: "eliminado_inactivo",
        sku: item.sku,
        nombreSnapshot: item.nombreSnapshot,
      });
      return acumulado;
    }

    if (actual.disponibilidad === "agotado") {
      cambios.push({ tipo: "agotado", sku: item.sku, nombreSnapshot: item.nombreSnapshot });
    }

    if (actual.precioCents !== item.unitPriceCents) {
      cambios.push({
        tipo: "precio_actualizado",
        sku: item.sku,
        nombreSnapshot: item.nombreSnapshot,
        precioAnteriorCents: item.unitPriceCents,
        precioActualCents: actual.precioCents,
      });
      acumulado.push({ ...item, unitPriceCents: actual.precioCents });
      return acumulado;
    }

    acumulado.push(item);
    return acumulado;
  }, []);

  return { cart: { ...cart, items }, cambios };
}
