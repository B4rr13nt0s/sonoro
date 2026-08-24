// Base de URL para metadataBase, JSON-LD y las URLs absolutas de
// sitemap.ts/robots.ts. SITE_URL no es opcional en producción: next build
// fija NODE_ENV=production, y layout.tsx/sitemap.ts/robots.ts importan este
// módulo — un fallback silencioso a localhost produciría canonical/og:image
// apuntando a localhost en el sitio real, justo el enlace roto en WhatsApp
// que esta fase existe para evitar. Por eso esto falla el build en vez de
// caer a ese fallback.
// process.env.SITE_URL es "" (no undefined) cuando .env.local declara
// SITE_URL= sin valor — por eso todo el archivo trata "" igual que ausente
// (! y || en vez de ??, que solo cubre null/undefined).
const raw = process.env.SITE_URL;

if (!raw && process.env.NODE_ENV === "production") {
  throw new Error(
    "SITE_URL no está definida. Es obligatoria en producción: sin ella, " +
      "metadataBase cae a localhost y el canonical/og:image que ve Google " +
      "y WhatsApp queda roto. Definir SITE_URL en Vercel antes del build.",
  );
}

export const SITE_URL = new URL(raw || "http://localhost:3000");

export function absoluteUrl(path: string): string {
  return new URL(path, SITE_URL).toString();
}
