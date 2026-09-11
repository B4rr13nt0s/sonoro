import Image from "next/image";
import Link from "next/link";

const ENLACES_LEGALES = [
  { href: "/legal/terminos", nombre: "Términos" },
  { href: "/legal/privacidad", nombre: "Privacidad" },
  { href: "/legal/garantias", nombre: "Garantías" },
] as const;

// Ciudad y teléfono vienen de las mismas env vars que ya usa
// lib/seo/business.ts para el JSON-LD LocalBusiness — sin confirmar
// todavía (CLAUDE.md § Decisiones abiertas), así que cada segmento se omite
// si su variable no está definida, en vez de mostrar un placeholder falso
// como "+502 0000 0000".
function lineaDeContacto(): string {
  const segmentos = [
    process.env.BUSINESS_ADDRESS_LOCALITY,
    "Envíos gratis a todo el país",
    process.env.BUSINESS_PHONE,
  ].filter((segmento): segmento is string => Boolean(segmento));
  return segmentos.join(" · ");
}

export function SiteFooter() {
  return (
    <footer className="border-borde-nav flex flex-col items-center gap-4 border-t px-6 py-10 text-center sm:px-12 lg:flex-row lg:items-center lg:justify-between lg:text-left">
      {/* El lockup oficial de public/logos/, no reconstruido en código: ya
          trae la corrección óptica de las dos «s» (CLAUDE.md § El logo).
          34 px de alto como el monograma que reemplaza; el ancho sale de la
          proporción del archivo (2480 × 680).

          El PNG y no el SVG: en el SVG el wordmark sigue siendo <text> con
          Bakbak One por nombre (CLAUDE.md § El logo: "antes de imprenta o
          bordado, convertir a curvas"), y el navegador lo dibuja con la
          tipografía que tenga a mano — el logo salía con otra letra. El PNG
          no depende de ninguna fuente instalada. */}
      <Link href="/" className="flex items-center">
        <Image
          src="/logos/sonoro-lockup-negro.png"
          alt="Sonoro"
          width={124}
          height={34}
          className="h-[34px] w-auto"
        />
      </Link>
      <nav className="flex gap-5">
        {ENLACES_LEGALES.map((enlace) => (
          <Link
            key={enlace.href}
            href={enlace.href}
            className="text-texto-terciario hover:text-texto-secundario font-mono text-[11px]"
          >
            {enlace.nombre}
          </Link>
        ))}
      </nav>
      <span className="text-texto-terciario font-mono text-[11px]">{lineaDeContacto()}</span>
    </footer>
  );
}
