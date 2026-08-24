// JSON-LD LocalBusiness (docs/PLAN.md § Fase 7). ElectronicsStore, no
// AutoPartsStore: Sonoro vende electrónica de audio para vehículo, no
// repuestos ni mecánica — ElectronicsStore es la clasificación deliberada
// más cercana a lo que realmente se vende.
//
// Dirección, teléfono, correo y horario NO están confirmados (CLAUDE.md §
// Decisiones abiertas: "teléfono, correo y dirección" siguen sin confirmar).
// Cada campo se omite si su variable de entorno no está definida — nunca se
// inventa un valor.
import { absoluteUrl } from "./site.ts";

function buildAddress() {
  const address = {
    "@type": "PostalAddress" as const,
    streetAddress: process.env.BUSINESS_ADDRESS_STREET,
    addressLocality: process.env.BUSINESS_ADDRESS_LOCALITY,
    addressRegion: process.env.BUSINESS_ADDRESS_REGION,
    postalCode: process.env.BUSINESS_ADDRESS_POSTAL_CODE,
    // || y no ?? — .env.local declara la variable vacía ("", no undefined)
    // hasta que se confirme; ?? no cae al default con string vacío.
    addressCountry: process.env.BUSINESS_ADDRESS_COUNTRY || "GT",
  };

  const tieneDireccion = Boolean(
    address.streetAddress || address.addressLocality || address.addressRegion,
  );

  return tieneDireccion ? address : undefined;
}

export function buildLocalBusinessJsonLd() {
  const address = buildAddress();
  const openingHours = process.env.BUSINESS_OPENING_HOURS?.split(",")
    .map((regla) => regla.trim())
    .filter(Boolean);

  return {
    "@context": "https://schema.org",
    "@type": "ElectronicsStore",
    name: "Sonoro",
    url: absoluteUrl("/"),
    ...(address ? { address } : {}),
    ...(process.env.BUSINESS_PHONE ? { telephone: process.env.BUSINESS_PHONE } : {}),
    ...(process.env.BUSINESS_EMAIL ? { email: process.env.BUSINESS_EMAIL } : {}),
    ...(openingHours && openingHours.length > 0 ? { openingHours } : {}),
  };
}
