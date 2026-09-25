import type { Metadata } from "next";

import { MarcasScroller } from "@/components/catalog/MarcasScroller";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { IconoCorreo, IconoInstagram, IconoTelefono } from "@/components/ui/IconosContacto";
import { listBrands } from "@/lib/catalog/index.ts";
import { buildWhatsAppUrl, WHATSAPP_NUMBER } from "@/lib/whatsapp/index.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";
import { TEXTOS_NOSOTROS } from "@/lib/seo/textos.ts";

// Mismo mensaje genérico que la portada: consulta de existencia, sin
// lenguaje de asesoría (CLAUDE.md § reglas 2).
const MENSAJE_CONSULTA = "Hola Sonoro, quiero consultar disponibilidad de un producto.";

export const metadata: Metadata = metadataPagina({ ...TEXTOS_NOSOTROS, ruta: "/nosotros" });

export default async function NosotrosPage() {
  const marcas = await listBrands();

  return (
    <div className="flex flex-col">
      <section className="flex max-w-[900px] flex-col gap-7 px-6 pt-16 pb-10 sm:px-12 sm:pt-24 sm:pb-20">
        <div className="text-texto-terciario font-mono text-[12px] tracking-[0.18em] uppercase">
          Nosotros
        </div>
        <h1 className="text-44 sm:text-56 lg:text-68 leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          Importamos a Guatemala todo lo que necesitas para elevar tu vehículo a otro nivel.
        </h1>
        <p className="text-texto-secundario max-w-[700px] text-[18px] leading-[1.5] sm:text-[21px]">
          Sonoro es una empresa de car audio donde importamos marcas de calidad y renombre a nivel
          internacional, con el objetivo de ofrecer productos que hagan que manejar se convierta en
          una experiencia excepcional.
        </p>
      </section>

      <PlaceholderImage
        label="FOTO — interior de la tienda o racks de bodega, horizontal"
        className="h-[260px] w-full items-end sm:h-[380px] lg:h-[520px]"
      />

      <section className="grid grid-cols-1 gap-10 px-6 py-16 sm:grid-cols-2 sm:px-12 sm:py-22">
        <div className="flex flex-col gap-4">
          <h2 className="text-26 sm:text-36 font-semibold tracking-[-0.025em]">Cómo trabajamos</h2>
          <p className="text-texto-secundario text-[16px] leading-[1.6] sm:text-[17px]">
            Compramos por contenedor a marcas y distribuidores autorizados, así que lo que vendemos
            es producto nuevo con respaldo de marca. Nada de excedentes ni equipo reacondicionado.
          </p>
          <p className="text-texto-secundario text-[16px] leading-[1.6] sm:text-[17px]">
            En el caso de que tengas dudas, te invitamos a nuestro showroom y ver los equipos en
            persona.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="text-26 sm:text-36 font-semibold tracking-[-0.025em]">Qué vendemos</h2>
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
            Cada producto incluye la instalación básica. Si lo que compras requiere una instalación
            más compleja, tiene un costo adicional y te lo informamos al cerrar el pedido.
          </p>
        </div>
      </section>

      <section className="px-6 pt-10 pb-16 sm:px-12 sm:pt-10 sm:pb-24">
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
          <span className="text-texto-terciario mt-auto pt-5 text-[15px]">Mapa próximamente</span>
        </div>
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">Escríbenos</div>
          {/* Teléfono, correo e Instagram salen de las env vars de
              lib/seo/business.ts, las mismas del JSON-LD y del pie: cada
              dato se omite si su variable no está definida. */}
          <div className="text-texto-secundario flex items-center gap-2 text-[15px] leading-[1.6]">
            {process.env.BUSINESS_PHONE ? (
              <>
                <IconoTelefono />
                {process.env.BUSINESS_PHONE}
              </>
            ) : (
              "Teléfono por confirmar."
            )}
          </div>
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
