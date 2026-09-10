import Link from "next/link";

import { ProductImage } from "@/components/media/ProductImage";
import { calcularCuotaCents, formatQ } from "@/lib/format/precio.ts";
import type { Producto } from "@/lib/catalog/index.ts";
import { etiquetaDisponibilidad } from "@/lib/catalog/disponibilidad.ts";

// CLAUDE.md § Patrones que se repiten — "Tarjeta de producto": imagen 200px,
// etiqueta mono con categoría o marca, nombre 17px/600, especificación 14px
// gris, precio 17px/600, cuota 13px gris.
export function ProductCard({ producto }: { producto: Producto }) {
  const especificacion = producto.specsDestacadas
    .slice(0, 2)
    .map((spec) => spec.valor)
    .join(" · ");
  const etiquetaEstado = etiquetaDisponibilidad(producto.disponibilidad);

  return (
    <Link
      href={`/producto/${producto.slug}`}
      className="rounded-card border-borde-tarjeta flex flex-col overflow-hidden border bg-white"
    >
      <ProductImage imagenes={producto.imagenes} nombre={producto.nombre} className="h-[200px]" />
      <div className="flex flex-col gap-1.5 p-5">
        {/* El estado va en la misma fila mono que la categoría, en negro
            contra el gris: no suma alto a la tarjeta y se ve antes de
            entrar a la ficha. La categoría sola se mantiene igual en los
            319 productos disponibles. */}
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px] tracking-[0.14em] uppercase">
          <span className="text-texto-terciario">{producto.categoria}</span>
          {etiquetaEstado ? (
            <>
              <span className="text-texto-terciario" aria-hidden="true">
                ·
              </span>
              <span className="text-negro">{etiquetaEstado}</span>
            </>
          ) : null}
        </div>
        <div className="text-[17px] leading-tight font-semibold tracking-[-0.01em]">
          {producto.nombre}
        </div>
        <div className="text-texto-secundario text-[14px]">{especificacion}</div>
        <div className="pt-2 text-[17px] font-semibold">{formatQ(producto.precioCents)}</div>
        <div className="text-texto-secundario text-[13px]">
          o {formatQ(calcularCuotaCents(producto.precioCents, 6))} al mes × 6
        </div>
      </div>
    </Link>
  );
}
