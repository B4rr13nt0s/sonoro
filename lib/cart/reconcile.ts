// Reconciliación del snapshot contra el catálogo actual. Corre al hidratar
// (lib/cart/context.tsx), fuera del reducer — es una función pura que no
// muta nada, solo calcula el carrito corregido y la lista de cambios.
//
// Nunca se envía por WhatsApp un precio que Sonoro ya no honra, ni un
// producto que ya no vende — así que esto corre ANTES de que el carrito
// hidratado quede disponible al resto de la app. /carrito le avisa al
// cliente qué cambió (components/cart/avisos.ts).
//
// Lo agotado o bajo pedido NO es un cambio: se puede pedir igual, y /carrito
// lo lee de la disponibilidad actual (useCart().disponibilidadPorSku), no de
// acá. Reportarlo en cada carga lo convertía en un «cambio» permanente.
import { z } from "zod";

import type { Cart, CartItem, CatalogoSku } from "./types.ts";

// Con esquema porque los cambios todavía no avisados se guardan en
// localStorage (./storage.ts) hasta que el cliente abre /carrito, y lo que
// sale de ahí se valida antes de usarse.
export const CambioCarritoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("eliminado_no_existe"), sku: z.string(), nombreSnapshot: z.string() }),
  z.object({ tipo: z.literal("eliminado_inactivo"), sku: z.string(), nombreSnapshot: z.string() }),
  z.object({
    tipo: z.literal("precio_actualizado"),
    sku: z.string(),
    nombreSnapshot: z.string(),
    precioAnteriorCents: z.number().int().nonnegative(),
    precioActualCents: z.number().int().nonnegative(),
  }),
]);
export type CambioCarrito = z.infer<typeof CambioCarritoSchema>;

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

/**
 * Suma cambios nuevos a los que todavía no se avisaron, uno por sku.
 *
 * Un precio que cambió dos veces antes de que el cliente abra /carrito se
 * avisa como UN cambio, del primer precio al último — y si volvió al
 * original, no hay nada que avisar. Un producto quitado reemplaza cualquier
 * aviso de precio anterior del mismo sku.
 */
export function acumularCambios(
  previos: readonly CambioCarrito[],
  nuevos: readonly CambioCarrito[],
): CambioCarrito[] {
  const porSku = new Map(previos.map((cambio) => [cambio.sku, cambio]));
  for (const nuevo of nuevos) {
    const previo = porSku.get(nuevo.sku);
    if (nuevo.tipo === "precio_actualizado" && previo?.tipo === "precio_actualizado") {
      if (previo.precioAnteriorCents === nuevo.precioActualCents) {
        porSku.delete(nuevo.sku);
      } else {
        porSku.set(nuevo.sku, { ...nuevo, precioAnteriorCents: previo.precioAnteriorCents });
      }
      continue;
    }
    porSku.set(nuevo.sku, nuevo);
  }
  return [...porSku.values()];
}
