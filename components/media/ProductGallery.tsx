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
//
// Devuelve DOS elementos de la rejilla de la ficha (un fragmento), no un
// contenedor propio: la foto principal en la fila 1 de la columna izquierda
// y la fila de miniaturas en la fila 2, cuyo alto lo da el bloque de envío de
// la columna derecha (app/producto/[slug]/page.tsx). Las miniaturas son
// cuadradas y toman ese alto; en móvil, una fila de cuatro debajo de la foto.
// Todas las fotos son cuadradas y se ven enteras (`object-contain` sobre
// blanco).
type ProductGalleryProps = {
  imagenes: Imagen[];
  nombre: string;
};

const PRINCIPAL = "rounded-card-lg aspect-square w-full lg:col-start-1 lg:row-start-1";
const FILA_MINIATURAS =
  "grid grid-cols-4 gap-2.5 pt-2.5 lg:col-start-1 lg:row-start-2 lg:flex lg:h-full lg:overflow-x-auto";
const MINIATURA = "rounded-field aspect-square lg:h-full lg:shrink-0";

export function ProductGallery({ imagenes, nombre }: ProductGalleryProps) {
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0);

  if (imagenes.length === 0) {
    return (
      <>
        <PlaceholderImage label={`FOTO — ${nombre}`} className={PRINCIPAL} />
        <div className={FILA_MINIATURAS}>
          {Array.from({ length: 4 }, (_, indice) => (
            <PlaceholderImage key={indice} label="" className={MINIATURA} />
          ))}
        </div>
      </>
    );
  }

  const seleccionada = imagenes[indiceSeleccionado];

  return (
    <>
      <div className={`${PRINCIPAL} relative overflow-hidden bg-white`}>
        {/* `preload` y no `priority`, deprecado en Next 16 (docs de
            next/image). Solo la foto con la que abre la ficha, que es la del
            LCP; las que se eligen después con las miniaturas no. `sizes`:
            la foto principal es cuadrada y mide 600 px como máximo en
            escritorio, el ancho entero en móvil. */}
        <Image
          src={seleccionada.url}
          alt={seleccionada.alt || nombre}
          fill
          sizes="(min-width: 1024px) 600px, 100vw"
          className="object-contain"
          preload={indiceSeleccionado === 0}
        />
      </div>

      {imagenes.length > 1 ? (
        <div className={FILA_MINIATURAS}>
          {imagenes.map((imagen, indice) => (
            <button
              key={imagen.url}
              type="button"
              onClick={() => setIndiceSeleccionado(indice)}
              aria-label={`Ver foto ${indice + 1} de ${nombre}`}
              aria-current={indice === indiceSeleccionado}
              className={`${MINIATURA} relative overflow-hidden border-2 bg-white ${
                indice === indiceSeleccionado ? "border-negro" : "border-borde-tarjeta"
              }`}
            >
              <Image
                src={imagen.url}
                alt={imagen.alt || nombre}
                fill
                sizes="120px"
                className="object-contain"
              />
            </button>
          ))}
        </div>
      ) : null}
    </>
  );
}
