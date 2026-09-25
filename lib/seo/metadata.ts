import type { Metadata } from "next";

// Metadata de una página pública, armada en UN solo lugar: título,
// descripción, canonical, Open Graph y tarjeta de Twitter/X.
//
// Existe por una trampa de Next que ya costó una vez: la metadata de cada
// segmento se fusiona de forma SUPERFICIAL, así que el `openGraph` que
// declara una página reemplaza ENTERO al del layout — incluida la imagen de
// app/opengraph-image.tsx. Cada página que escribía su propio
// `openGraph: { title, description, url }` se quedaba sin og:image y con
// `twitter:card=summary`, y un link a /catalogo/subwoofers salía en WhatsApp
// sin imagen. Con esta función la imagen por defecto viaja siempre.
//
// El título se escribe SIN «— Sonoro»: lo agrega el `title.template` del
// layout raíz. El og:title no pasa por esa plantilla, por eso acá se le pone
// el sufijo a mano.

export const SUFIJO_TITULO = " — Sonoro";

// Los de la portada, que también son el respaldo del layout raíz para las
// rutas que no declaran los suyos (la 404).
export const TITULO_SITIO = "Sonoro — Equipo de audio para carro";
export const DESCRIPCION_SITIO =
  "Bocinas, subwoofers, amplificadores, receptores, kits, insonorización y accesorios. Envíos a toda Guatemala.";

// La ruta que Next le da a app/opengraph-image.tsx. Se resuelve contra
// metadataBase, así que sale absoluta (https://sonoro.gt/opengraph-image).
const IMAGEN_OG_DEFECTO = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: TITULO_SITIO,
};

type Opciones = {
  // Sin sufijo: «Subwoofers», no «Subwoofers — Sonoro».
  titulo: string;
  descripcion: string;
  // Ruta relativa y ya limpia (sin `orden`): es a la vez canonical y og:url.
  ruta: string;
  // Para la portada, cuyo título no lleva el sufijo de la plantilla.
  tituloAbsoluto?: boolean;
  // Rutas con su propio opengraph-image.tsx (la ficha de producto): la
  // imagen del archivo pisa a la de config, pero pasar la de por defecto
  // igual sería declarar dos.
  conImagenPropia?: boolean;
  noIndexar?: boolean;
};

export function metadataPagina({
  titulo,
  descripcion,
  ruta,
  tituloAbsoluto = false,
  conImagenPropia = false,
  noIndexar = false,
}: Opciones): Metadata {
  const tituloCompleto = tituloAbsoluto ? titulo : `${titulo}${SUFIJO_TITULO}`;
  const imagenes = conImagenPropia ? undefined : [IMAGEN_OG_DEFECTO];

  return {
    title: tituloAbsoluto ? { absolute: titulo } : titulo,
    description: descripcion,
    alternates: { canonical: ruta },
    openGraph: {
      title: tituloCompleto,
      description: descripcion,
      url: ruta,
      siteName: "Sonoro",
      locale: "es_GT",
      type: "website",
      ...(imagenes ? { images: imagenes } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: tituloCompleto,
      description: descripcion,
      ...(imagenes ? { images: imagenes } : {}),
    },
    ...(noIndexar ? { robots: { index: false, follow: false } } : {}),
  };
}
