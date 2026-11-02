import Image from "next/image";

import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import type { Imagen } from "@/lib/catalog/index.ts";

// CLAUDE.md § Imágenes: el placeholder es un ESTADO DE RENDERIZADO, no un
// dato — `imagenes: []` lo dispara, `imagenes: [..]` dibuja la foto. Nunca se
// escriben rutas de placeholder en el catálogo ni se asume que existan
// archivos en public/: cuando lleguen fotos reales, esto cambia de rama solo
// porque `imagenes` dejó de estar vacío, cero código.
// El ancho real de la tarjeta en la rejilla (1, 2, 4 o 6 columnas,
// ProductGrid). Si cambian las columnas de la rejilla, cambia también esta
// cuenta.
const SIZES_REJILLA =
  "(min-width: 1280px) 15vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw";

type ProductImageProps = {
  imagenes: Imagen[];
  nombre: string;
  dark?: boolean;
  className?: string;
  /** El ancho con que se dibuja, si no es el de una tarjeta de la rejilla (p. ej. la miniatura de 56 px del chat). */
  sizes?: string;
};

export function ProductImage({
  imagenes,
  nombre,
  dark = false,
  className,
  sizes = SIZES_REJILLA,
}: ProductImageProps) {
  const [imagen] = imagenes;

  if (!imagen) {
    return <PlaceholderImage label={`FOTO — ${nombre}`} dark={dark} className={className} />;
  }

  // El contenedor relative con `fill` hereda el tamaño que le pase className,
  // igual que PlaceholderImage (la tarjeta lo pasa cuadrado). Fondo blanco y
  // `object-contain`: la foto se ve entera, sin recortar, y el blanco de las
  // fotos se funde con el del contenedor.
  return (
    <div className={`relative overflow-hidden bg-white ${className ?? ""}`}>
      {/* `sizes` con el ancho real con que se dibuja: sin él, `fill` hace que
          el navegador asuma el ancho de la ventana y baje una imagen varias
          veces más grande. */}
      <Image
        src={imagen.url}
        alt={imagen.alt || nombre}
        fill
        sizes={sizes}
        className="object-contain"
      />
    </div>
  );
}
