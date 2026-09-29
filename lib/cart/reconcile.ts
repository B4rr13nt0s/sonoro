// Reconciliación del snapshot contra el catálogo actual. Corre en cada
// render del CartProvider (lib/cart/context.ts), fuera del reducer — es una
// función pura que no muta nada, solo calcula el carrito corregido y la
// lista de cambios. Lo que se muestra y se pide es SIEMPRE su resultado; lo
// guardado es el carrito tal como lo armó el cliente.
//
// Nunca se envía por WhatsApp un precio que Sonoro ya no honra, ni un
// producto que ya no vende o que está agotado. /carrito le avisa al cliente
// qué cambió (components/cart/avisos.ts).
//
// Lo agotado se QUITA, igual que lo inactivo: desde septiembre de 2026 no se
// puede pedir (el botón de la ficha queda deshabilitado), así que una línea
// agregada antes de agotarse tampoco. Se avisa hasta que /carrito guarda el
// carrito corregido. Lo bajo pedido sí se puede pedir y
// no es un cambio: /carrito lo lee de la disponibilidad actual
// (useCart().disponibilidadPorSku).
import type { Cart, CartItem, CatalogoSku } from "./types.ts";

export type CambioCarrito =
  | { tipo: "eliminado_no_existe"; sku: string; nombreSnapshot: string }
  | { tipo: "eliminado_inactivo"; sku: string; nombreSnapshot: string }
  | { tipo: "eliminado_agotado"; sku: string; nombreSnapshot: string }
  | {
      tipo: "precio_actualizado";
      sku: string;
      nombreSnapshot: string;
      precioAnteriorCents: number;
      precioActualCents: number;
    };

/**
 * Si una línea con esta entrada del catálogo puede estar en el carrito: la
 * entrada, o el motivo por el que no. Es LA regla: reconcile() quita lo que
 * ella rechaza, y addItem() (./context.ts) no deja entrar lo mismo — así lo
 * que el carrito acepta y lo que quita en la carga siguiente no pueden
 * desincronizarse.
 */
export function revisarEntrada(
  entrada: CatalogoSku | undefined,
):
  | { motivo: "eliminado_no_existe" | "eliminado_inactivo" | "eliminado_agotado" }
  | { entrada: CatalogoSku } {
  if (!entrada) return { motivo: "eliminado_no_existe" };
  if (!entrada.activo) return { motivo: "eliminado_inactivo" };
  if (entrada.disponibilidad === "agotado") return { motivo: "eliminado_agotado" };
  return { entrada };
}

export function reconcile(
  cart: Cart,
  catalogo: CatalogoSku[],
): { cart: Cart; cambios: CambioCarrito[] } {
  const porSku = new Map(catalogo.map((p) => [p.sku, p]));
  const cambios: CambioCarrito[] = [];

  const items = cart.items.reduce<CartItem[]>((acumulado, item) => {
    const revision = revisarEntrada(porSku.get(item.sku));
    if ("motivo" in revision) {
      cambios.push({ tipo: revision.motivo, sku: item.sku, nombreSnapshot: item.nombreSnapshot });
      return acumulado;
    }
    const actual = revision.entrada;

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
