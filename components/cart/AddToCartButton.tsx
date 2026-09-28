"use client";

// La ficha de producto (app/producto/[slug]/page.tsx) es un Server
// Component — este botón es el único pedazo interactivo, aislado en su
// propio Client Component para no convertir la página entera en cliente.
import { useCart } from "@/lib/cart/index.ts";
import type { Producto } from "@/lib/catalog/index.ts";
import { trackEvent } from "@/lib/analytics/track.ts";
import {
  claseBoton,
  claseBotonInactivo,
  type TamanoBoton,
  type VarianteBoton,
} from "@/components/ui/boton.ts";

// `variante` para poder usarlo como acción secundaria junto a «Consultar por
// WhatsApp». Con el producto agotado no hay variante que valga: el botón queda
// deshabilitado (ver abajo).
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

  // Agotado no se puede agregar: gris, deshabilitado y con «Agotado», igual
  // que en la ficha (AgregarConCantidad).
  if (producto.disponibilidad === "agotado") {
    return (
      <button type="button" disabled className={claseBotonInactivo(variante, tamano)}>
        Agotado
      </button>
    );
  }

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
