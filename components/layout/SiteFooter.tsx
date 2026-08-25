import Link from "next/link";

import { Monogram } from "./Monogram";

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
      <Link href="/" className="flex items-center gap-[11px]">
        <Monogram className="rounded-footer-mark h-[34px] w-[34px]" />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-negro text-[21px] leading-[0.84] tracking-[-0.015em]">
            sonoro
          </span>
          <span className="text-texto-secundario font-mono text-[9px] leading-none tracking-[0.22em]">
            CAR AUDIO
          </span>
        </span>
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
