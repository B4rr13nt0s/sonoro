import Image from "next/image";
import Link from "next/link";

import { IconoCorreo, IconoInstagram, IconoTelefono } from "@/components/ui/IconosContacto";

const ENLACES_LEGALES = [
  { href: "/legal/terminos", nombre: "Términos" },
  { href: "/legal/privacidad", nombre: "Privacidad" },
  { href: "/legal/garantias", nombre: "Garantías" },
] as const;

// Ciudad, teléfono, correo e Instagram vienen de las mismas env vars que ya
// usa lib/seo/business.ts para el JSON-LD LocalBusiness, así que cada
// segmento se omite si su variable no está definida, en vez de mostrar un
// placeholder falso como "+502 0000 0000".
//
// El teléfono y el correo son texto, no enlaces: la línea es de contacto,
// no un botón de pedido — para pedir está «Pedir por WhatsApp» del carrito.
// Instagram sí es enlace porque sin él no se llega a la cuenta.
//
// Los tres datos de contacto llevan icono a la izquierda. Los separadores «·»
// van entre segmentos, no dentro de ellos, para que un icono nunca quede
// colgado al final de un renglón lejos de su dato: cada segmento es un
// `inline-flex` que el navegador no parte.
function segmentosDeContacto() {
  const contacto = [
    process.env.BUSINESS_PHONE
      ? { clave: "tel", icono: IconoTelefono, texto: process.env.BUSINESS_PHONE }
      : null,
    process.env.BUSINESS_EMAIL
      ? { clave: "correo", icono: IconoCorreo, texto: process.env.BUSINESS_EMAIL }
      : null,
  ].filter((dato) => dato !== null);

  const previos = [process.env.BUSINESS_ADDRESS_LOCALITY, "Envíos gratis a todo el país"].filter(
    (segmento): segmento is string => Boolean(segmento),
  );

  return { previos, contacto };
}

export function SiteFooter() {
  const instagram = process.env.BUSINESS_INSTAGRAM;
  const { previos, contacto } = segmentosDeContacto();

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
      <span className="text-texto-terciario flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-mono text-[11px] lg:justify-end">
        {previos.map((segmento, i) => (
          <span key={segmento}>
            {segmento}
            {i < previos.length - 1 ? " ·" : null}
          </span>
        ))}
        {contacto.map(({ clave, icono: Icono, texto }) => (
          <span key={clave} className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">·</span>
            <Icono />
            {texto}
          </span>
        ))}
        {instagram ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true">·</span>
            <a
              href={`https://www.instagram.com/${instagram}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-texto-secundario inline-flex items-center gap-1.5"
            >
              <IconoInstagram />@{instagram}
            </a>
          </span>
        ) : null}
      </span>
    </footer>
  );
}
