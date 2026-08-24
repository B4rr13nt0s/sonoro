// Base de URL para metadataBase, JSON-LD y las URLs absolutas de
// sitemap.ts/robots.ts. SITE_URL no es opcional en Production: next build
// fija NODE_ENV=production en TODO build de Vercel (Production y Preview por
// igual), y layout.tsx/sitemap.ts/robots.ts importan este módulo — un
// fallback silencioso a localhost produciría canonical/og:image apuntando a
// localhost en el sitio real, justo el enlace roto en WhatsApp que esta fase
// existe para evitar. Por eso esto falla el build en Production en vez de
// caer a ese fallback.
//
// Preview de Vercel sí tiene un fallback razonable: VERCEL_URL, la URL única
// que Vercel asigna a cada deploy (sin protocolo). Así un PR nuevo compila
// solo, sin que alguien tenga que configurar SITE_URL a mano por cada rama.
// Production NUNCA usa ese fallback — comprueba VERCEL_ENV antes que
// VERCEL_URL a propósito, para no terminar con el dominio real apuntando a
// un *.vercel.app.
//
// process.env.SITE_URL es "" (no undefined) cuando .env.local declara
// SITE_URL= sin valor — por eso todo el archivo trata "" igual que ausente
// (! y || en vez de ??, que solo cubre null/undefined).
// SITE_URL se pone a mano en Vercel como un dominio ("sonoro.gt"), no como
// URL — new URL() exige un esquema, y el proyecto de todas formas fuerza
// HTTPS en producción (docs/PLAN.md § Fase 9), así que un valor sin esquema
// se interpreta como https:// en vez de tronar por un detalle de captura.
function normalizarEsquema(valor: string): string {
  return /^https?:\/\//.test(valor) ? valor : `https://${valor}`;
}

function resolverSiteUrl(): string {
  const raw = process.env.SITE_URL;
  if (raw) return normalizarEsquema(raw);

  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "SITE_URL no está definida. Es obligatoria en Production: sin ella, " +
        "metadataBase cae a localhost y el canonical/og:image que ve Google " +
        "y WhatsApp queda roto. Definir SITE_URL en Vercel antes del build.",
    );
  }

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SITE_URL no está definida y no hay VERCEL_URL disponible. Es " +
        "obligatoria en producción: sin ella, metadataBase cae a localhost " +
        "y el canonical/og:image que ve Google y WhatsApp queda roto.",
    );
  }

  return "http://localhost:3000";
}

export const SITE_URL = new URL(resolverSiteUrl());

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
