// Manifiesto de los nueve modelos 3D del carrusel del home.
//
// Los .glb viven en public/models/ y están validados: metros, Ymin = 0,
// centro XZ en (0,0), +Y up, Draco obligatorio, sin cámaras ni luces ni
// texturas (ver CLAUDE.md § Modelos 3D). Este archivo no los toca: solo
// declara cómo se muestran.
import { CATEGORIAS_SITIO } from "./catalog/categorias.ts";

export const MODEL_IDS = [
  "speaker",
  "subwoofer",
  "amplifier",
  "head-unit",
  "screen",
  "equalizer",
  "install-kit",
  "sound-deadening",
  "rca-cable",
] as const;

export type ModelId = (typeof MODEL_IDS)[number];

// El href tiene que ser una de las ocho rutas de categoría que existen
// (lib/catalog/categorias.ts es la fuente única). Tipar el campo así hace
// que agregar un modelo apuntando a una categoría inventada no compile,
// en vez de fallar con un 404 en producción.
type CategoriaSlug = (typeof CATEGORIAS_SITIO)[number]["slug"];
type CategoriaHref = `/catalogo/${CategoriaSlug}`;

export interface ModelEntry {
  archivo: string; // nombre del .glb en public/models/, CON su versión
  displayScale: number; // escala real^0.65, normalizada al modelo más grande
  radius: number; // radio horizontal en metros, sin escalar
  height: number; // altura en metros, sin escalar (el modelo apoya en Y=0)
  /**
   * Giro base sobre Y, en radianes, para que el producto mire a la cámara
   * en la vista predeterminada. Cada .glb decidió por su cuenta hacia
   * dónde apunta su frente, así que no hay una orientación global que
   * sirva para los nueve: esto lo corrige por modelo, sin tocar la malla.
   */
  giroBase?: number;
  label: string; // etiqueta visible, va en el DOM
  href: CategoriaHref; // ruta de la categoría en el catálogo
}

// `archivo` existe aparte del id porque /models/* se sirve con
// `Cache-Control: immutable`: regenerar un modelo EXIGE cambiar el nombre
// del archivo, o los navegadores que ya lo cachearon siguen mostrando el
// viejo por un año. El id es semántico y permanente; el archivo lleva la
// versión. Ver CLAUDE.md § Modelos 3D.
//
// displayScale = escala real elevada a 0.65, normalizada al modelo más
// grande — en la práctica, `(diámetro mayor / diámetro propio) ^ 0.35`.
// NO es auto-fit ni escala real: a escala real el speaker (165 mm)
// ocuparía un tercio del cuadro frente al sound-deadening (496 mm), y con
// auto-fit por modelo el speaker y el subwoofer se verían idénticos pese a
// medir 165 y 315 mm. El exponente 0.65 conserva el orden de tamaños y
// acerca los extremos.
//
// Los nueve valores se RECALCULAN de golpe cada vez que cambia el modelo
// más grande, porque la normalización cuelga de él. Al achicarse el
// rca-cable (radio 0.2533 → 0.1631) la referencia volvió a ser
// sound-deadening (radio 0.2480, displayScale 1.0000).
export const MODELS: Record<ModelId, ModelEntry> = {
  speaker: {
    archivo: "speaker-2.glb",
    displayScale: 1.4699,
    radius: 0.0825,
    height: 0.055,
    label: "Bocinas",
    href: "/catalogo/bocinas",
  },
  equalizer: {
    archivo: "equalizer-2.glb",
    displayScale: 1.3573,
    radius: 0.1036,
    height: 0.026,
    giroBase: Math.PI,
    label: "Ecualizadores",
    href: "/catalogo/ecualizadores",
  },
  "head-unit": {
    archivo: "head-unit.glb",
    displayScale: 1.2632,
    radius: 0.1272,
    height: 0.05,
    giroBase: Math.PI,
    label: "Receptores",
    href: "/catalogo/receptores",
  },
  screen: {
    archivo: "screen.glb",
    displayScale: 1.234,
    radius: 0.136,
    height: 0.1,
    giroBase: Math.PI,
    label: "Pantallas",
    href: "/catalogo/receptores",
  },
  amplifier: {
    archivo: "amplifier.glb",
    displayScale: 1.1767,
    radius: 0.1558,
    height: 0.055,
    giroBase: Math.PI,
    label: "Amplificadores",
    href: "/catalogo/amplificadores",
  },
  subwoofer: {
    archivo: "subwoofer-2.glb",
    displayScale: 1.1722,
    radius: 0.1575,
    height: 0.1652,
    label: "Subwoofers",
    href: "/catalogo/subwoofers",
  },
  "install-kit": {
    archivo: "install-kit.glb",
    displayScale: 1.1244,
    radius: 0.1774,
    height: 0.03,
    label: "Kits de instalación",
    href: "/catalogo/kits",
  },
  "sound-deadening": {
    archivo: "sound-deadening-2.glb",
    displayScale: 1.0,
    radius: 0.248,
    height: 0.1119,
    giroBase: Math.PI,
    label: "Insonorización",
    href: "/catalogo/insonorizacion",
  },
  "rca-cable": {
    archivo: "rca-cable-2.glb",
    displayScale: 1.158,
    radius: 0.1631,
    height: 0.0426,
    giroBase: Math.PI,
    label: "Accesorios",
    href: "/catalogo/accesorios",
  },
};

export const FRAME_RADIUS = 0.248; // radio horizontal máximo ya escalado
export const FRAME_HEIGHT = 0.1936; // altura máxima ya escalada

export const modelUrl = (id: ModelId) => `/models/${MODELS[id].archivo}`;

// El decoder de Draco es local (public/draco/), no el CDN de gstatic.com:
// es un tercero en el critical path del home.
export const DRACO_DECODER_PATH = "/draco/";
