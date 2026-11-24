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
  memphis: { src: "/logos/marcas/memphis.webp", ancho: 851, alto: 202 },
  "rockford-fosgate": { src: "/logos/marcas/rockford-fosgate.webp", ancho: 960, alto: 151 },
  "cerwin-vega": { src: "/logos/marcas/cerwin-vega.webp", ancho: 541, alto: 163 },
  pioneer: { src: "/logos/marcas/pioneer.webp", ancho: 960, alto: 140 },
  kbt: { src: "/logos/marcas/kbt.webp", ancho: 494, alto: 459 },
  focal: { src: "/logos/marcas/focal.webp", ancho: 960, alto: 198 },
  jbl: { src: "/logos/marcas/jbl.webp", ancho: 960, alto: 804 },
  soundskins: { src: "/logos/marcas/soundskins.webp", ancho: 960, alto: 503 },
};

export type Logo = (typeof LOGOS)[string];

// Los logos que se dibujan MÁS GRANDES que el resto (decisión del negocio,
// noviembre de 2026): Rockford Fosgate y Memphis, en la portada y en /marcas.
// Rockford es el más alargado (960 × 151, casi 6.4 a 1): con el tope de ancho de
// los demás queda de unos 24 px de alto y se lee mucho menos. Memphis (851 ×
// 202, 4.2 a 1) se pidió igual, pero un poco menos grande que Rockford.
//
// Cada marca trae su tope de alto y de ancho por lugar, más el `sizes` de
// next/image (el mismo ancho que el `max-w`). En la portada el tamaño crece
// solo cuando la caja lo permite —las cajas miden 156 px en móvil y tableta, y
// 216 en lg—: más ancho se salía de la caja y pisaba al vecino. En /marcas el
// tope es `min(…, 100%)` de la caja. Las clases van escritas completas, no
// armadas, para que Tailwind las vea.
export type TamanoLogo = { clase: string; sizes: string };
export type LugarLogo = "portada" | "marcas";

export const LOGOS_AMPLIADOS: Readonly<Record<string, Record<LugarLogo, TamanoLogo>>> = {
  "rockford-fosgate": {
    portada: {
      clase: "max-h-[64px] max-w-[150px] lg:max-w-[190px] xl:max-w-[240px]",
      sizes: "(min-width: 1280px) 240px, (min-width: 1024px) 190px, 150px",
    },
    marcas: { clase: "max-h-[84px] max-w-[min(300px,100%)]", sizes: "300px" },
  },
  memphis: {
    portada: {
      clase: "max-h-[64px] max-w-[150px] lg:max-w-[172px] xl:max-w-[200px]",
      sizes: "(min-width: 1280px) 200px, (min-width: 1024px) 172px, 150px",
    },
    marcas: { clase: "max-h-[84px] max-w-[min(260px,100%)]", sizes: "260px" },
  },
};

/** El tamaño ampliado de una marca en un lugar, o `undefined` si no se amplía. */
export function tamanoAmpliado(slug: string, lugar: LugarLogo): TamanoLogo | undefined {
  return Object.hasOwn(LOGOS_AMPLIADOS, slug) ? LOGOS_AMPLIADOS[slug][lugar] : undefined;
}

export function logoDeMarca(marca: Pick<Brand, "slug">): Logo | null {
  return Object.hasOwn(LOGOS, marca.slug) ? LOGOS[marca.slug] : null;
}
