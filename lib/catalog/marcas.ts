// El orden en que el negocio quiere ver sus marcas, y sus logos. Una sola
// lista para la portada, /marcas y /nosotros: tres listas aparte se
// desordenarían entre sí. Sin dependencias, porque la importa también un
// componente cliente (MarcasScroller).
import type { Brand } from "./types.ts";

// Primero las que Sonoro distribuye de forma oficial, y luego el resto
// (decisión del negocio, 1 de octubre de 2026). Una marca nueva que no esté
// acá cae al final, por nombre.
export const ORDEN_MARCAS = [
  "memphis",
  "rockford-fosgate",
  "cerwin-vega",
  "pioneer",
  "kbt",
  "focal",
  "jbl",
  "soundskins",
] as const;

export function ordenarMarcas<T extends { slug: string; nombre: string }>(
  marcas: readonly T[],
): T[] {
  const lugar = (slug: string) => {
    const i = (ORDEN_MARCAS as readonly string[]).indexOf(slug);
    return i === -1 ? ORDEN_MARCAS.length : i;
  };
  return [...marcas].sort(
    (a, b) =>
      lugar(a.slug) - lugar(b.slug) ||
      // Puntos de código, no localeCompare: el orden no cambia entre builds.
      (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0),
  );
}

// Los generan `node scripts/fotos/logos-marcas.mjs` desde assets/logos_marcas/,
// recortados; las medidas son las que imprime. next/image las usa para
// reservar el espacio: sin ellas la página se movería al cargar cada logo.
export const LOGOS: Record<string, { src: string; ancho: number; alto: number }> = {
  memphis: { src: "/logos/marcas/memphis.webp", ancho: 480, alto: 114 },
  "rockford-fosgate": { src: "/logos/marcas/rockford-fosgate.webp", ancho: 480, alto: 75 },
  "cerwin-vega": { src: "/logos/marcas/cerwin-vega.webp", ancho: 480, alto: 145 },
  pioneer: { src: "/logos/marcas/pioneer.webp", ancho: 480, alto: 70 },
  kbt: { src: "/logos/marcas/kbt.webp", ancho: 480, alto: 446 },
  focal: { src: "/logos/marcas/focal.webp", ancho: 480, alto: 99 },
  jbl: { src: "/logos/marcas/jbl.webp", ancho: 480, alto: 402 },
  soundskins: { src: "/logos/marcas/soundskins.webp", ancho: 480, alto: 252 },
};

export type Logo = (typeof LOGOS)[string];

export function logoDeMarca(marca: Pick<Brand, "slug">): Logo | null {
  return Object.hasOwn(LOGOS, marca.slug) ? LOGOS[marca.slug] : null;
}
