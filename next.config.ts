import type { NextConfig } from "next";

// docs/PLAN.md § Fase 0 nombra exactamente estos dominios: sonoro.gt
// canónico (apex, sin www), sonoro.com.gt y sonoro.com defensivos. No son
// secretos ni varían por entorno — son literales acá igual que cualquier
// regla de redirect, no variables de entorno.
//
// Esta regla por sí sola no hace nada hasta que el dominio esté agregado en
// Vercel (Settings → Domains): next.config.ts decide qué pasa con una
// petición una vez que ya llegó a esta app, no enruta el dominio.
const DOMINIOS_NO_CANONICOS = [
  "www.sonoro.gt",
  "sonoro.com",
  "www.sonoro.com",
  "sonoro.com.gt",
  "www.sonoro.com.gt",
];

// Cabeceras de seguridad para TODA respuesta. Vercel ya pone HSTS en el
// dominio; estas son las que faltaban.
//
// La política de contenido es a propósito PARCIAL: fija de dónde puede salir
// lo que no depende de scripts —base, formularios, plugins y quién puede
// meter el sitio en un iframe— y NO dice nada de scripts ni de estilos.
//
// OJO CON `default-src`, que es la trampa de este archivo: parece la
// directiva prudente «por defecto» y en realidad es el RESPALDO de
// `script-src` y `style-src`. Con `default-src 'self'` el navegador bloquea
// el bootstrap inline de Next, los estilos inline y Google Analytics: el
// sitio se dibuja pero no hidrata, así que nada responde — ni el carrito, ni
// el buscador, ni el carrusel. Probado en local antes de publicar.
//
// Una política de scripts de verdad necesita un nonce por respuesta, porque
// el inline es legítimo (bootstrap de Next, JSON-LD de cada ruta, GA), y
// `unsafe-inline` sería una política que se ve bien y no protege de nada. Eso
// va aparte, con proxy.ts generando el nonce; mientras tanto esto ya cierra
// el clickjacking y el secuestro de formularios.
const CABECERAS_SEGURIDAD = [
  // Sin esto el navegador puede "adivinar" que un .txt es HTML y ejecutarlo.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Al salir del sitio se manda solo el origen, no la URL completa: las de
  // listado llevan filtros en la query.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Nada del sitio necesita cámara, micrófono, ubicación ni pagos.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  // frame-ancestors es la versión moderna de X-Frame-Options; se manda la
  // vieja también porque algunos navegadores antiguos solo entienden esa.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Content-Security-Policy",
    value: [
      "base-uri 'self'",
      "object-src 'none'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      // wa.me y el resto de enlaces salientes son navegaciones, no cargas:
      // no los cubre ninguna de estas directivas.
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

// Los listados son PÚBLICOS e iguales para todos: no hay sesión, el carrito
// vive en localStorage y nada depende de cookies. Aun así Next los marca
// `private, no-cache, no-store` por llevar searchParams, así que cada visita
// levantaba una función. Con esto la red de Vercel los sirve cacheados por
// URL completa —filtros y página incluidos— y revalida por detrás:
// s-maxage cachea en el CDN, stale-while-revalidate deja servir la copia
// vieja mientras se rehace, y max-age=0 mantiene al navegador preguntando,
// que es lo que hace que un cambio de precio se vea al instante.
// Las imágenes OG de producto llevan además `revalidate` en su propio
// archivo, que es lo que las convierte en ISR; esta cabecera es la que se
// puede COMPROBAR desde fuera, y la que hace que la red de Vercel las sirva
// cacheadas en vez de rearmarlas en cada revisión de WhatsApp o Google.
const CACHE_OG = {
  key: "Cache-Control",
  value: "public, max-age=0, s-maxage=604800, stale-while-revalidate=86400",
};

const CACHE_LISTADOS = {
  key: "Cache-Control",
  value: "public, max-age=0, s-maxage=300, stale-while-revalidate=3600",
};

const nextConfig: NextConfig = {
  // lib/catalog/adapters/static.ts lee data/*.json con fs.readFile, en una
  // ruta calculada en tiempo de ejecución (path.join(fileURLToPath(...),
  // "..", "..", "..")) — el rastreador de archivos de Vercel
  // (@vercel/nft) no logra seguir esa construcción dinámica y no empaqueta
  // esos JSON en las funciones serverless. No falla local (next start
  // corre contra el repo completo, no un paquete mínimo) ni en rutas
  // estáticas (se leen en build time, cuando sí hay filesystem completo) —
  // solo en rutas dinámicas (ƒ) desplegadas, en runtime real. `/*` cubre
  // cualquier ruta dinámica actual o futura que use lib/catalog.
  outputFileTracingIncludes: {
    "/*": ["data/*.json"],
  },
  // Next 16 exige declarar las calidades permitidas del optimizador de
  // imágenes: cualquier `quality` que no esté en esta lista responde 400
  // («unrestricted access could allow malicious actors to optimize more
  // qualities than you intended», docs de next/image § qualities). El
  // default es [75] a secas, así que las fotos de categorías de la portada
  // —que piden 50— salían rotas EN PRODUCCIÓN aunque en local funcionaran:
  // `next start` no aplica la lista, el optimizador de Vercel sí.
  images: {
    qualities: [50, 75],
  },

  // Los .glb de public/models/ y el decoder de Draco de public/draco/ son
  // inmutables mientras no se regeneren: son binarios de contenido fijo,
  // no datos del catálogo. Consecuencia que hay que tener presente:
  // regenerar un modelo EXIGE cambiar el nombre del archivo, porque un
  // navegador que ya lo cacheó con `immutable` no lo vuelve a pedir nunca
  // (ver CLAUDE.md § Modelos 3D).
  async headers() {
    return [
      {
        source: "/models/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/draco/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      { source: "/:path*", headers: CABECERAS_SEGURIDAD },
      { source: "/producto/:slug/opengraph-image", headers: [CACHE_OG] },
      { source: "/catalogo", headers: [CACHE_LISTADOS] },
      { source: "/catalogo/:categoria", headers: [CACHE_LISTADOS] },
      { source: "/marcas/:marca", headers: [CACHE_LISTADOS] },
      { source: "/productos", headers: [CACHE_LISTADOS] },
    ];
  },
  async redirects() {
    return DOMINIOS_NO_CANONICOS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://sonoro.gt/:path*",
      permanent: true,
    }));
  },
};

export default nextConfig;
