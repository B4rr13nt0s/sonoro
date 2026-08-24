"use client";

// La ficha de producto (app/producto/[slug]/page.tsx) es un Server
// Component — este botón es el único pedazo interactivo, aislado en su
// propio Client Component para no convertir la página entera en cliente.
import { useCart } from "@/lib/cart/index.ts";
import type { Producto } from "@/lib/catalog/index.ts";

export function AddToCartButton({ producto }: { producto: Producto }) {
  const { addItem } = useCart();

  return (
    <button
      type="button"
      onClick={() =>
        addItem({
          sku: producto.sku,
          qty: 1,
          unitPriceCents: producto.precioCents,
          currency: producto.moneda,
          nombreSnapshot: producto.nombre,
          imagenSnapshot: producto.imagenes[0]?.url ?? null,
        })
      }
      className="bg-negro flex-1 cursor-pointer rounded-full px-6 py-3.75 text-center text-[16px] text-white transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-95"
    >
      Agregar al carrito
    </button>
  );
}
