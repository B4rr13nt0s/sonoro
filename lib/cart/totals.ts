// CLAUDE.md § Modelo de conversión: "Totales siempre calculados, nunca
// almacenados." Nada de esto se guarda en el Cart ni en localStorage —
// se recalcula desde `items` en cada render. Envío y cuota no viven aquí:
// son decisiones de quien arme el resumen de pedido (futuro /carrito), no
// del estado del carrito.
import type { CartItem } from "./types.ts";

export function subtotalCents(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.unitPriceCents * item.qty, 0);
}

export function itemCount(items: CartItem[]): number {
  return items.reduce((total, item) => total + item.qty, 0);
}
