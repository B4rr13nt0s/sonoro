import Image from "next/image";

import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import type { Imagen } from "@/lib/catalog/index.ts";

// CLAUDE.md § Imágenes: el placeholder es un ESTADO DE RENDERIZADO, no un
// dato — `imagenes: []` lo dispara, `imagenes: [..]` dibuja la foto. Nunca se
// escriben rutas de placeholder en el catálogo ni se asume que existan
// archivos en public/: cuando lleguen fotos reales, esto cambia de rama solo
// porque `imagenes` dejó de estar vacío, cero código.
type ProductImageProps = {
  imagenes: Imagen[];
  nombre: string;
  dark?: boolean;
  className?: string;
};

export function ProductImage({ imagenes, nombre, dark = false, className }: ProductImageProps) {
  const [imagen] = imagenes;

  if (!imagen) {
    return <PlaceholderImage label={`FOTO — ${nombre}`} dark={dark} className={className} />;
  }

  // CLAUDE.md § Imágenes: "Al reemplazar por <img>, conservar la altura del
  // contenedor" — el contenedor relative con `fill` hereda el alto que le
  // pase className, igual que PlaceholderImage.
  return (
    <div className={`relative overflow-hidden ${className ?? ""}`}>
      <Image src={imagen.url} alt={imagen.alt || nombre} fill className="object-cover" />
    </div>
  );
}
