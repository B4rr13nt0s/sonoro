"use client";

// Una fila de producto en el chat (spec § Búsqueda, «Fila de producto»). A
// diferencia de las tarjetas de los listados, sí lleva precio y cuota:
// decisión de la spec. Lo agotado sale gris y con «Agotado» porque así lo
// dibuja AddToCartButton.
import Link from "next/link";

import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { PildoraDisponibilidad } from "@/components/catalog/PildoraDisponibilidad";
import { ProductImage } from "@/components/media/ProductImage";
import type { ProductoBuscable } from "@/lib/busqueda/busqueda.ts";
import { formatQ, lineaCuota } from "@/lib/format/precio.ts";

export function ProductoChat({
  producto,
  alAgregar,
  alNavegar,
}: {
  producto: ProductoBuscable;
  alAgregar: (agregadas: number, sku: string) => void;
  alNavegar?: () => void;
}) {
  return (
    <div className="border-borde-tarjeta flex gap-3 border-t py-3">
      <div className="h-14 w-14 flex-none overflow-hidden rounded-[10px]">
        <ProductImage
          imagenes={producto.imagenes}
          nombre={producto.nombre}
          sizes="56px"
          className="h-full w-full"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          {`${producto.marca} · ${producto.sku}`}
        </span>
        <Link
          href={`/producto/${producto.slug}`}
          onNavigate={alNavegar}
          className="text-[14px] leading-snug font-semibold"
        >
          {producto.nombre}
        </Link>
        <div className="text-[14px]">{formatQ(producto.precioCents)}</div>
        <div className="text-texto-secundario text-[12px]">{lineaCuota(producto.precioCents)}</div>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <PildoraDisponibilidad disponibilidad={producto.disponibilidad} />
          <AddToCartButton
            producto={producto}
            tamano="compacto"
            onAgregado={(agregadas) => alAgregar(agregadas, producto.sku)}
          />
        </div>
      </div>
    </div>
  );
}
