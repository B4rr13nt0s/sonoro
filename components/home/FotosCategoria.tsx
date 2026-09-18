"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

/**
 * Las fotos de una tarjeta de categoría de la portada.
 *
 * Vive en un componente CLIENTE, y no en app/page.tsx con el resto de la
 * sección, por una sola razón: las fotos se piden cuando el visitante se
 * acerca a la sección, no durante la carga inicial.
 *
 * `loading="lazy"` no alcanza — es lo que traen de fábrica. El umbral de
 * Chrome para «ya casi se ve» es generoso, así que con una conexión rápida
 * las ocho fotos de móvil se descargaban igual dentro de la carga inicial:
 * 280 KB que se lleva también quien nunca baja de la portada. Medido en el
 * runner de CI, con esto la portada baja UNA imagen al arrancar en vez de
 * nueve.
 *
 * Lo que se pierde: las fotos no vienen en el HTML inicial. Es aceptable
 * porque ILUSTRAN la categoría —el nombre, la descripción y el enlace de cada
 * tarjeta siguen en el HTML, que es lo que se indexa— pero no sirve para una
 * imagen que haya que ver sí o sí.
 *
 * El alto lo reserva la tarjeta, no las fotos, así que esperar no mueve nada
 * de sitio: el CLS de la portada sigue en 0.
 */
export type Foto = { src: string; alt: string };

export type Anclaje = "centro" | "abajo" | "arriba";

const ANCLAJE_EN_FILA: Record<Anclaje, string> = {
  centro: "items-center",
  abajo: "items-end",
  arriba: "items-start",
};
const ANCLAJE_EN_COLUMNA: Record<Anclaje, string> = {
  centro: "justify-center",
  abajo: "justify-end",
  arriba: "justify-start",
};

/** Cuánto antes de entrar en pantalla se piden las fotos. */
const MARGEN = "400px";

function useCerca(): [React.RefObject<HTMLDivElement | null>, boolean] {
  const nodo = useRef<HTMLDivElement>(null);
  const [cerca, setCerca] = useState(false);

  useEffect(() => {
    const actual = nodo.current;
    if (!actual) return;
    // Sin IntersectionObserver (navegador viejo) se muestran de una: mejor
    // bajarlas de más que dejar la tarjeta vacía para siempre.
    if (typeof IntersectionObserver !== "function") {
      // En un temporizador y no aquí mismo: un setState dentro del cuerpo del
      // efecto encadena renders (regla react-hooks/set-state-in-effect).
      const id = window.setTimeout(() => setCerca(true), 0);
      return () => window.clearTimeout(id);
    }
    const observer = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setCerca(true);
          observer.disconnect();
        }
      },
      { rootMargin: MARGEN },
    );
    observer.observe(actual);
    return () => observer.disconnect();
  }, []);

  return [nodo, cerca];
}

export function FotosCategoria({
  fotos,
  direccion,
  columnas,
  anclaje = "centro",
  separacionL = false,
}: {
  fotos: Foto[];
  direccion: "fila" | "columna";
  columnas: 1 | 2;
  anclaje?: Anclaje;
  separacionL?: boolean;
}) {
  const [nodo, cerca] = useCerca();
  const enFila = direccion === "fila";
  const ancho = columnas === 2 ? "w-full lg:w-[calc((100%-72px)/2)]" : "w-full";

  return (
    <div
      ref={nodo}
      className={`flex flex-1 ${separacionL ? "gap-6 lg:gap-18" : "gap-6"} ${
        enFila
          ? `flex-row justify-center ${ANCLAJE_EN_FILA[anclaje]}`
          : `flex-col items-center ${ANCLAJE_EN_COLUMNA[anclaje]}`
      }`}
    >
      {fotos.map((foto, i) => (
        <div key={foto.src} className={`${ancho} ${i > 0 ? "hidden lg:block" : ""}`}>
          <div className="relative aspect-[3/2] w-full">
            {/* `sizes` describe el ancho REAL en cada pantalla, y de ahí sale
                cuál de las copias de /_next/image pide el navegador. Las
                fotos de la segunda en adelante están ocultas debajo de lg
                (`hidden lg:block`), pero el navegador las descarga igual, así
                que ahí su ancho declarado es 1px: en móvil baja una miniatura
                y recién en escritorio, donde se ven, pide la copia buena.

                `quality` baja de 75 a 50: son fotos de producto sobre fondo
                transparente, sin degradados finos, y a este tamaño no se
                nota. */}
            {cerca ? (
              <Image
                src={foto.src}
                alt={foto.alt}
                fill
                sizes={i > 0 ? "(min-width: 1024px) 22vw, 1px" : "(min-width: 1024px) 22vw, 90vw"}
                quality={50}
                className="object-contain p-6"
              />
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
