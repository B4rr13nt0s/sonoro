import type { MetadataRoute } from "next";

import { DESCRIPCION_SITIO, TITULO_SITIO } from "@/lib/seo/textos.ts";

// Manifiesto para cuando alguien guarda el sitio en la pantalla de inicio del
// teléfono — el caso realista acá, con el tráfico mayoritariamente móvil.
//
// Reemplaza al site.webmanifest que venía con el paquete del favicon: aquel
// traía `name` y `short_name` vacíos y apuntaba a los PNG en la raíz de
// /public. Este se genera desde el App Router (convención app/manifest.ts) y
// apunta a /icons/.
//
// El .ico va primero y con sizes "any": es el que ya trae los tamaños
// chicos, así que los PNG de 16 y 32 del paquete no hacen falta.
//
// Colores de la paleta, sin inventar ninguno (CLAUDE.md § Sistema visual):
// el fondo del sitio es blanco y el negro de marca tiñe la barra del sistema.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TITULO_SITIO,
    short_name: "Sonoro",
    description: DESCRIPCION_SITIO,
    lang: "es-GT",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#0B0B0C",
    icons: [
      { src: "/favicon.ico", sizes: "any", type: "image/x-icon" },
      { src: "/icons/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
