// Qué se le dice al cliente sobre los cambios que reconcile()
// (lib/cart/reconcile.ts) le hizo a su carrito al abrirlo: un precio que ya
// no es el que vio, o un producto que dejó de venderse. Hasta septiembre de
// 2026 el carrito se corregía en silencio — el total cambiaba sin
// explicación.
//
// Lógica pura, fuera del componente, para poder probarla (avisos.test.ts).
import type { CambioCarrito } from "../../lib/cart/reconcile.ts";
import { formatQ } from "../../lib/format/precio.ts";

/**
 * Una frase por cambio, en el orden en que llegaron.
 *
 * Un precio actualizado solo se avisa mientras la línea siga en el carrito:
 * si el cliente la quitó, hablar de su precio ya no dice nada. Lo agotado o
 * bajo pedido no es un cambio: lo dice la etiqueta de la línea (CarritoView).
 */
export function avisosDeCambios(
  cambios: readonly CambioCarrito[],
  skusEnCarrito: ReadonlySet<string>,
): string[] {
  const avisos: string[] = [];
  for (const cambio of cambios) {
    switch (cambio.tipo) {
      case "precio_actualizado":
        if (skusEnCarrito.has(cambio.sku)) {
          avisos.push(
            `El precio de ${cambio.nombreSnapshot} cambió de ${formatQ(cambio.precioAnteriorCents)} a ${formatQ(cambio.precioActualCents)}.`,
          );
        }
        break;
      case "eliminado_inactivo":
      case "eliminado_no_existe":
        avisos.push(`Se quitó ${cambio.nombreSnapshot} del carrito: ya no está a la venta.`);
        break;
    }
  }
  return avisos;
}
