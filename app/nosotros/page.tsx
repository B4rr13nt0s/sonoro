import type { Metadata } from "next";

import { MarcasScroller } from "@/components/catalog/MarcasScroller";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { IconoCorreo, IconoInstagram, IconoTelefono } from "@/components/ui/IconosContacto";
import { listBrands } from "@/lib/catalog/index.ts";
import { ordenarMarcas } from "@/lib/catalog/marcas.ts";
import { INSTALACION } from "@/lib/politicas.ts";
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/whatsapp/index.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";
import { TEXTOS_NOSOTROS } from "@/lib/seo/textos.ts";

// Mismo mensaje genérico que la portada: consulta de existencia, sin
// lenguaje de asesoría (CLAUDE.md § reglas 2).
const MENSAJE_CONSULTA = "Hola Sonoro, quiero consultar disponibilidad de un producto.";

// El teléfono de mayoreo (noviembre de 2026). No es el de contacto del sitio
// (BUSINESS_PHONE / NEXT_PUBLIC_WHATSAPP_NUMBER): es otro número, el que el
// negocio dio para quien quiere distribuir al por mayor. Se escribe como se
// lee en el texto y el enlace de WhatsApp sale de sus dígitos con el prefijo de
// Guatemala (502), sin mensaje prellenado.
const TELEFONO_MAYOREO = "5951-2727";

// El mapa de «Visítanos» sale de dos variables del negocio, como la dirección:
// BUSINESS_MAP_EMBED_URL (la dirección del iframe que da Google Maps en
// Compartir > Insertar un mapa) y BUSINESS_MAP_URL (el enlace de Compartir, para
// «Cómo llegar»). Solo se dibuja un iframe de Google Maps: lo que no empiece
// así —una variable mal pegada— se ignora, no se incrusta.
const PREFIJO_MAPA_GOOGLE = "https://www.google.com/maps/embed";
const WHATSAPP_MAYOREO = `https://wa.me/502${TELEFONO_MAYOREO.replace(/\D/g, "")}`;

export const metadata: Metadata = metadataPagina({ ...TEXTOS_NOSOTROS, ruta: "/nosotros" });

export default async function NosotrosPage() {
  const marcas = ordenarMarcas(await listBrands());

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-7 px-6 pt-16 pb-10 sm:px-12 sm:pt-24 sm:pb-20">
        <div className="text-texto-terciario font-mono text-[12px] tracking-[0.18em] uppercase">
          Nosotros
        </div>
        <h1 className="text-44 sm:text-48 lg:text-64 max-w-[900px] leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          Importamos a Guatemala todo lo que necesitas para elevar tu vehículo a otro nivel.
        </h1>
        <p className="text-texto-secundario text-justify text-[18px] leading-[1.5] hyphens-auto sm:text-[21px]">
          Sonoro es una empresa de audio para carro, marino y motorsports donde importamos marcas de
          calidad y renombre a nivel internacional, con el objetivo de ofrecer productos que hagan
          que manejar se convierta en una experiencia excepcional.
        </p>
      </section>

      <PlaceholderImage
        label="FOTO — interior de la tienda o racks de bodega, horizontal"
        className="h-[260px] w-full items-end sm:h-[380px] lg:h-[520px]"
      />

      <section className="grid grid-cols-1 gap-10 px-6 pt-16 sm:grid-cols-2 sm:px-12 sm:pt-22">
        <div className="flex flex-col gap-4">
          <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.025em]">Cómo trabajamos</h2>
          <p className="text-texto-secundario text-[16px] leading-[1.6] sm:text-[17px]">
            Todos nuestros productos son adquiridos directamente con las marcas oficiales o
            distribuidores autorizados. En nuestro showroom, tenemos a tu disposición una gran
            variedad de productos en exhibición por si deseas ver nuestros equipos en persona.
          </p>
          {/* Venta al por mayor: el teléfono (lleva a WhatsApp) y el sitio de
              Sonido Digital son los que dio el negocio (noviembre de 2026). */}
          <p className="text-texto-secundario text-[16px] leading-[1.6] sm:text-[17px]">
            Si te interesa distribuir nuestros productos al por mayor, comunícate al{" "}
            <a
              href={WHATSAPP_MAYOREO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-negro underline underline-offset-2"
            >
              {TELEFONO_MAYOREO}
            </a>
            , o visita la página de{" "}
            <a
              href="https://sonidodigital.com.gt/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-negro underline underline-offset-2"
            >
              Sonido Digital
            </a>{" "}
            para más información.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.025em]">Qué vendemos</h2>
          <p className="text-texto-secundario text-[16px] leading-[1.6] sm:text-[17px]">
            Bocinas, subwoofers, amplificadores, radios, pantallas, ecualizadores, kits de cable,
            insonorización y accesorios; con varias gamas disponibles para ajustarnos a lo que
            buscas.
          </p>
          {/* Instalación: solo lo confirmado por el negocio (CLAUDE.md
              § regla 1). Qué trabajos son básicos, cuánto cuesta uno
              complejo y en cuánto tiempo sigue sin definirse, así que no
              se menciona. */}
          <p className="text-texto-secundario text-[16px] leading-[1.6] sm:text-[17px]">
            {INSTALACION} Al cerrar el pedido te informamos si lo que llevas requiere una
            instalación básica o una más compleja.
          </p>
        </div>
      </section>

      <section className="px-6 pt-12 pb-16 sm:px-12 sm:pt-12 sm:pb-24">
        <MarcasScroller marcas={marcas} />
      </section>

      <section className="flex flex-col gap-4 px-6 pb-16 sm:flex-row sm:px-12 sm:pb-24">
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">Visítanos</div>
          {/* La dirección sale de BUSINESS_ADDRESS_STREET, la misma variable
              que lee el JSON-LD de lib/seo/business.ts (CLAUDE.md § Decisiones
              abiertas: nunca incrustada en el código). Hasta septiembre de
              2026 estaba escrita acá a mano, y la página y Google mostraban
              dos direcciones distintas. */}
          {process.env.BUSINESS_ADDRESS_STREET ? (
            <div className="text-texto-secundario text-[15px] leading-[1.6]">
              {process.env.BUSINESS_ADDRESS_STREET}
            </div>
          ) : null}
          {process.env.BUSINESS_MAP_EMBED_URL?.startsWith(PREFIJO_MAPA_GOOGLE) ? (
            <iframe
              src={process.env.BUSINESS_MAP_EMBED_URL}
              title="Mapa con la ubicación de Sonoro"
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="rounded-field mt-auto h-[240px] w-full border-0"
            />
          ) : null}
          {process.env.BUSINESS_MAP_URL ? (
            <a
              href={process.env.BUSINESS_MAP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="pt-2 text-[15px]"
            >
              Cómo llegar →
            </a>
          ) : null}
        </div>
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">Escríbenos</div>
          {/* Teléfono, correo e Instagram salen de las env vars de
              lib/seo/business.ts, las mismas del JSON-LD y del pie: cada
              dato se omite si su variable no está definida. */}
          {process.env.BUSINESS_PHONE ? (
            <div className="text-texto-secundario flex items-center gap-2 text-[15px] leading-[1.6]">
              <IconoTelefono />
              {process.env.BUSINESS_PHONE}
            </div>
          ) : null}
          {process.env.BUSINESS_EMAIL ? (
            <div className="text-texto-secundario flex items-center gap-2 text-[15px] leading-[1.6]">
              <IconoCorreo />
              {process.env.BUSINESS_EMAIL}
            </div>
          ) : null}
          {process.env.BUSINESS_INSTAGRAM ? (
            <a
              href={`https://www.instagram.com/${process.env.BUSINESS_INSTAGRAM}/`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-texto-secundario flex items-center gap-2 text-[15px] leading-[1.6]"
            >
              <IconoInstagram />@{process.env.BUSINESS_INSTAGRAM}
            </a>
          ) : null}
          <a
            href={buildWhatsAppUrl(WHATSAPP_NUMBER, MENSAJE_CONSULTA)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto pt-5 text-[15px]"
          >
            Escríbenos por WhatsApp →
          </a>
        </div>
      </section>
    </div>
  );
}
