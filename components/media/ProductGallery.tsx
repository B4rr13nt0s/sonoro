import Image from "next/image";

import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import type { Imagen } from "@/lib/catalog/index.ts";

// CLAUDE.md § Imágenes: imagenes: [] → placeholder completo (foto principal
// + 4 miniaturas decorativas, sin etiqueta — el handoff no le pone texto a
// las miniaturas). imagenes: [..] → la primera es la foto principal, hasta
// 4 más se muestran como miniaturas reales. Nada de "seleccionar miniatura"
// todavía: sin fotos que intercambiar, esa interacción no existe.
type ProductGalleryProps = {
  imagenes: Imagen[];
  nombre: string;
};

const ALTO_PRINCIPAL = "h-[340px] sm:h-[420px] lg:h-[520px]";

export function ProductGallery({ imagenes, nombre }: ProductGalleryProps) {
  const [principal, ...miniaturas] = imagenes;

  return (
    <div className="flex flex-col gap-2.5">
      {principal ? (
        <div className={`rounded-card-lg relative overflow-hidden ${ALTO_PRINCIPAL}`}>
          <Image
            src={principal.url}
            alt={principal.alt || nombre}
            fill
            className="object-cover"
            priority
          />
        </div>
      ) : (
        <PlaceholderImage
          label={`FOTO — ${nombre}`}
          className={`rounded-card-lg ${ALTO_PRINCIPAL}`}
        />
      )}

      <div className="grid grid-cols-4 gap-2.5">
        {imagenes.length === 0
          ? Array.from({ length: 4 }, (_, indice) => (
              <div
                key={indice}
                className="rounded-field h-[100px] bg-[repeating-linear-gradient(135deg,#efefec_0_8px,#f7f7f5_8px_16px)]"
              />
            ))
          : miniaturas.slice(0, 4).map((imagen, indice) => (
              <div key={indice} className="rounded-field relative h-[100px] overflow-hidden">
                <Image src={imagen.url} alt={imagen.alt || nombre} fill className="object-cover" />
              </div>
            ))}
      </div>
    </div>
  );
}
