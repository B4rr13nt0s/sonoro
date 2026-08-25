// Mismo patrón que lib/seo/site.ts para SITE_URL: NEXT_PUBLIC_WHATSAPP_NUMBER
// es tan crítica como SITE_URL — es el destino del botón "Pedir por
// WhatsApp" y del enlace "Escríbenos por WhatsApp" del inicio (CLAUDE.md §
// Modelo de conversión: el carrito TERMINA en WhatsApp). Sin ella,
// buildWhatsAppUrl arma wa.me/?text=... — un enlace que abre WhatsApp sin
// destinatario en vez del chat del negocio, y nada en la UI avisa que está
// roto. Por eso este módulo falla el build en Production en vez de caer a
// un fallback silencioso, igual que SITE_URL.
//
// Se importa desde app/layout.tsx (server, se evalúa en cada build) para
// que la corrida de build de Vercel truene ahí si falta la variable, en vez
// de descubrirlo un cliente que reporta que el botón no abre su chat.
function resolverNumero(): string {
  const raw = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (raw) return raw;

  if (process.env.VERCEL_ENV === "production") {
    throw new Error(
      "NEXT_PUBLIC_WHATSAPP_NUMBER no está definida. Es obligatoria en " +
        'Production: sin ella, "Pedir por WhatsApp" abre wa.me sin ' +
        "destinatario en vez del chat del negocio. Definirla en Vercel " +
        "(Project Settings → Environment Variables) antes del build.",
    );
  }

  return raw ?? "";
}

export const WHATSAPP_NUMBER = resolverNumero();
