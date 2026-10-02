import Image from "next/image";

import { logoDeMarca } from "@/lib/catalog/marcas.ts";

/**
 * El logo de una marca, centrado en su caja y sin deformarse. Cada logo tiene
 * su proporción —Pioneer es 7:1, KBT casi cuadrado—, así que se limita por
 * alto y por ancho a la vez: los anchos no se comen la fila y los cuadrados
 * no se salen de la caja. Sin logo (marca nueva), cae al nombre.
 */
export function LogoMarca({
  marca,
  className = "max-h-[52px] max-w-[150px]",
  sizes = "150px",
}: {
  marca: { slug: string; nombre: string };
  className?: string;
  /**
   * El ancho al que se dibuja, el mismo del `max-w` de `className`: de ahí
   * elige el navegador qué copia de /_next/image pide. Con uno fijo, el logo
   * de /marcas (hasta 220 px) salía de una copia pensada para 150.
   */
  sizes?: string;
}) {
  const logo = logoDeMarca(marca);
  if (!logo) return <span className="text-[17px] font-semibold">{marca.nombre}</span>;
  return (
    <Image
      src={logo.src}
      alt={marca.nombre}
      width={logo.ancho}
      height={logo.alto}
      sizes={sizes}
      className={`h-auto w-auto object-contain ${className}`}
    />
  );
}
