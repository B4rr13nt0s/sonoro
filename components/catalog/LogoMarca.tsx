import Image from "next/image";

import { logoDeMarca, tamanoAmpliado, type LugarLogo } from "@/lib/catalog/marcas.ts";

/**
 * El logo de una marca, centrado en su caja y sin deformarse. Cada logo tiene
 * su proporción —Pioneer es 7:1, KBT casi cuadrado—, así que se limita por
 * alto y por ancho a la vez: los anchos no se comen la fila y los cuadrados
 * no se salen de la caja. Sin logo (marca nueva), cae al nombre.
 *
 * Si se pasa `lugar` y la marca es una de `LOGOS_AMPLIADOS`, usa el tamaño que
 * esa marca tiene ahí en vez de `className` y `sizes`.
 */
export function LogoMarca({
  marca,
  className = "max-h-[52px] max-w-[150px]",
  sizes = "150px",
  lugar,
}: {
  marca: { slug: string; nombre: string };
  className?: string;
  /**
   * El ancho al que se dibuja, el mismo del `max-w` de `className`: de ahí
   * elige el navegador qué copia de /_next/image pide. Con uno fijo, el logo
   * de /marcas (hasta 220 px) salía de una copia pensada para 150.
   */
  sizes?: string;
  /** Dónde se dibuja, para las marcas que se ven más grandes ahí (`LOGOS_AMPLIADOS`). */
  lugar?: LugarLogo;
}) {
  const logo = logoDeMarca(marca);
  const ampliado = lugar ? tamanoAmpliado(marca.slug, lugar) : undefined;
  if (!logo) return <span className="text-[17px] font-semibold">{marca.nombre}</span>;
  return (
    <Image
      src={logo.src}
      alt={marca.nombre}
      width={logo.ancho}
      height={logo.alto}
      sizes={ampliado ? ampliado.sizes : sizes}
      className={`h-auto w-auto object-contain ${ampliado ? ampliado.clase : className}`}
    />
  );
}
