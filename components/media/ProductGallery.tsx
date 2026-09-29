"use client";

import Image from "next/image";
import { useState } from "react";

import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import type { Imagen } from "@/lib/catalog/index.ts";

// CLAUDE.md § Imágenes: imagenes: [] → placeholder completo (foto principal
// + 4 miniaturas decorativas, sin etiqueta). imagenes: [..] → la foto
// principal es la miniatura seleccionada (por defecto, la primera), y las
// miniaturas son las mismas `imagenes`, no "principal + el resto" — clic en
// cualquiera la pone arriba en grande.
type ProductGalleryProps = {
  imagenes: Imagen[];
  nombre: string;
};

const ALTO_PRINCIPAL = "h-[340px] sm:h-[420px] lg:h-[520px]";

export function ProductGallery({ imagenes, nombre }: ProductGalleryProps) {
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0);

  if (imagenes.length === 0) {
    return (
      <div className="flex flex-col gap-2.5">
        <PlaceholderImage
          label={`FOTO — ${nombre}`}
          className={`rounded-card-lg ${ALTO_PRINCIPAL}`}
        />
        <div className="grid grid-cols-4 gap-2.5">
          {Array.from({ length: 4 }, (_, indice) => (
            <div
              key={indice}
              className="rounded-field h-[100px] bg-[repeating-linear-gradient(135deg,#efefec_0_8px,#f7f7f5_8px_16px)]"
            />
          ))}
        </div>
      </div>
    );
  }

  const seleccionada = imagenes[indiceSeleccionado];

  return (
    <div className="flex flex-col gap-2.5">
      <div className={`rounded-card-lg relative overflow-hidden ${ALTO_PRINCIPAL}`}>
        {/* `preload` y no `priority`, deprecado en Next 16 (docs de
            next/image). Solo la foto con la que abre la ficha, que es la del
            LCP; las que se eligen después con las miniaturas no. `sizes`:
            la columna de la galería, el ancho entero en móvil y lo que deja
            la columna de 440 px en escritorio. */}
        <Image
          src={seleccionada.url}
          alt={seleccionada.alt || nombre}
          fill
          sizes="(min-width: 1024px) calc(100vw - 440px), 100vw"
          className="object-cover"
          preload={indiceSeleccionado === 0}
        />
      </div>

      {imagenes.length > 1 ? (
        <div className="grid grid-cols-4 gap-2.5">
          {imagenes.map((imagen, indice) => (
            <button
              key={imagen.url}
              type="button"
              onClick={() => setIndiceSeleccionado(indice)}
              aria-label={`Ver foto ${indice + 1} de ${nombre}`}
              aria-current={indice === indiceSeleccionado}
              className={`rounded-field relative h-[100px] overflow-hidden border-2 ${
                indice === indiceSeleccionado ? "border-negro" : "border-transparent"
              }`}
            >
              <Image
                src={imagen.url}
                alt={imagen.alt || nombre}
                fill
                sizes="(min-width: 1024px) 15vw, 25vw"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
