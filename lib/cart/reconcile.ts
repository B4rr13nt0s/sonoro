// Reconciliación del snapshot contra el catálogo actual. Corre al hidratar
// (lib/cart/context.tsx), fuera del reducer — es una función pura que no
// muta nada, solo calcula el carrito corregido y la lista de cambios.
//
// Nunca se envía por WhatsApp un precio que Sonoro ya no honra, ni un
// producto que ya no vende o que está agotado — así que esto corre ANTES de
// que el carrito hidratado quede disponible al resto de la app. /carrito le
// avisa al cliente qué cambió (components/cart/avisos.ts).
//
// Lo agotado se QUITA, igual que lo inactivo: desde septiembre de 2026 no se
// puede pedir (el botón de la ficha queda deshabilitado), así que una línea
// agregada antes de agotarse tampoco. Se reporta una sola vez, porque la
// línea ya no está en la carga siguiente. Lo bajo pedido sí se puede pedir y
// no es un cambio: /carrito lo lee de la disponibilidad actual
// (useCart().disponibilidadPorSku).
import { z } from "zod";

import type { Cart, CartItem, CatalogoSku } from "./types.ts";

// Con esquema porque los cambios todavía no avisados se guardan en
// localStorage (./storage.ts) hasta que el cliente abre /carrito, y lo que
// sale de ahí se valida antes de usarse.
export const CambioCarritoSchema = z.discriminatedUnion("tipo", [
  z.object({ tipo: z.literal("eliminado_no_existe"), sku: z.string(), nombreSnapshot: z.string() }),
  z.object({ tipo: z.literal("eliminado_inactivo"), sku: z.string(), nombreSnapshot: z.string() }),
  z.object({ tipo: z.literal("eliminado_agotado"), sku: z.string(), nombreSnapshot: z.string() }),
  z.object({
    tipo: z.literal("precio_actualizado"),
    sku: z.string(),
    nombreSnapshot: z.string(),
    precioAnteriorCents: z.number().int().nonnegative(),
    precioActualCents: z.number().int().nonnegative(),
  }),
]);
export type CambioCarrito = z.infer<typeof CambioCarritoSchema>;

/**
 * Por qué una línea con esta entrada del catálogo no puede estar en el
 * carrito, o `null` si puede. Es LA regla: reconcile() quita lo que ella
 * rechaza, y addItem() (./context.ts) no deja entrar lo mismo — así lo que
 * el carrito acepta y lo que quita en la carga siguiente no pueden
 * desincronizarse.
 */
export function motivoParaQuitar(
  actual: CatalogoSku | undefined,
): "eliminado_no_existe" | "eliminado_inactivo" | "eliminado_agotado" | null {
  if (!actual) return "eliminado_no_existe";
  if (!actual.activo) return "eliminado_inactivo";
  if (actual.disponibilidad === "agotado") return "eliminado_agotado";
  return null;
}

export function reconcile(
  cart: Cart,
  catalogo: CatalogoSku[],
): { cart: Cart; cambios: CambioCarrito[] } {
  const porSku = new Map(catalogo.map((p) => [p.sku, p]));
  const cambios: CambioCarrito[] = [];

  const items = cart.items.reduce<CartItem[]>((acumulado, item) => {
    const actual = porSku.get(item.sku);

    const motivo = motivoParaQuitar(actual);
    if (motivo !== null) {
      cambios.push({ tipo: motivo, sku: item.sku, nombreSnapshot: item.nombreSnapshot });
      return acumulado;
    }
    // Inalcanzable —sin entrada, motivoParaQuitar() ya devolvió un motivo—;
    // solo le dice a TypeScript que `actual` existe de acá en adelante.
    if (!actual) return acumulado;

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
