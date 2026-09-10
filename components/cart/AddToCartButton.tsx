"use client";

// La ficha de producto (app/producto/[slug]/page.tsx) es un Server
// Component — este botón es el único pedazo interactivo, aislado en su
// propio Client Component para no convertir la página entera en cliente.
import { useCart } from "@/lib/cart/index.ts";
import type { Producto } from "@/lib/catalog/index.ts";
import { trackEvent } from "@/lib/analytics/track.ts";
import { claseBoton, type TamanoBoton, type VarianteBoton } from "@/components/ui/boton.ts";

// `variante` porque en la ficha la jerarquía se INVIERTE cuando el producto
// está agotado: ahí la acción útil es preguntar, no agregar al carrito.
export function AddToCartButton({
  producto,
  variante = "principal",
  tamano = "normal",
}: {
  producto: Producto;
  variante?: VarianteBoton;
  // "compacto" para las columnas de la tabla comparativa.
  tamano?: TamanoBoton;
}) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() => {
        addItem({
          sku: producto.sku,
          qty: 1,
          unitPriceCents: producto.precioCents,
          currency: producto.moneda,
          nombreSnapshot: producto.nombre,
          imagenSnapshot: producto.imagenes[0]?.url ?? null,
        });
        trackEvent("add_to_quote", {
          item_id: producto.sku,
          item_name: producto.nombre,
          price: producto.precioCents / 100,
          currency: "GTQ",
          quantity: 1,
        });
      }}
      className={claseBoton(variante, tamano)}
    >
      Agregar al carrito
    </button>
  );
}
