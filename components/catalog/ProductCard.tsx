import Link from "next/link";

import { CompararToggle } from "@/components/comparador/CompararToggle";
import { ProductImage } from "@/components/media/ProductImage";
import { calcularCuotaCents, formatQ } from "@/lib/format/precio.ts";
import type { Producto } from "@/lib/catalog/index.ts";
import { etiquetaDisponibilidad } from "@/lib/catalog/disponibilidad.ts";

// CLAUDE.md § Patrones que se repiten — "Tarjeta de producto": imagen 200px,
// etiqueta mono con categoría o marca, nombre 17px/600, especificación 14px
// gris, precio 17px/600, cuota 13px gris.
//
// La tarjeta SIGUE siendo Server Component. El único pedazo interactivo es
// CompararToggle, que es su propia isla cliente: poner "use client" acá
// arrastraría ProductImage, formatQ y la rejilla entera al bundle de las
// cinco páginas que la usan.
//
// El <Link> ya no envuelve la tarjeta: un <button> dentro de un <a> es HTML
// inválido. En su lugar el enlace se ESTIRA con `after:absolute after:inset-0`
// sobre el contenedor relativo, así toda la tarjeta sigue siendo clicable, y
// el toggle va como hermano con `relative z-10` para quedar por encima de esa
// capa — si no, el enlace estirado se lo come y no se puede pulsar.
export function ProductCard({ producto }: { producto: Producto }) {
  const especificacion = producto.specsDestacadas
    .slice(0, 2)
    .map((spec) => spec.valor)
    .join(" · ");
  const etiquetaEstado = etiquetaDisponibilidad(producto.disponibilidad);

  return (
    <div className="rounded-card border-borde-tarjeta relative flex flex-col overflow-hidden border bg-white">
      <ProductImage imagenes={producto.imagenes} nombre={producto.nombre} className="h-[200px]" />
      <div className="flex flex-1 flex-col gap-1.5 p-5">
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
        <Link
          href={`/producto/${producto.slug}`}
          className="text-[17px] leading-tight font-semibold tracking-[-0.01em] after:absolute after:inset-0"
        >
          {producto.nombre}
        </Link>
        <div className="text-texto-secundario text-[14px]">{especificacion}</div>
        <div className="pt-2 text-[17px] font-semibold">{formatQ(producto.precioCents)}</div>
        <div className="text-texto-secundario text-[13px]">
          o {formatQ(calcularCuotaCents(producto.precioCents, 6))} al mes × 6
        </div>
        <div className="relative z-10 flex pt-4">
          <CompararToggle
            sku={producto.sku}
            categoria={producto.categoria}
            nombre={producto.nombre}
          />
        </div>
      </div>
    </div>
  );
}
