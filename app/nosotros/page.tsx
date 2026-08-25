import type { Metadata } from "next";

import { MarcasScroller } from "@/components/catalog/MarcasScroller";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { listBrands } from "@/lib/catalog/index.ts";

const TITULO = "Nosotros — Sonoro";
const DESCRIPCION =
  "Sonoro importa de forma directa equipo de audio para carro a Guatemala. Vendemos únicamente equipo — la instalación la hace el taller de tu preferencia.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/nosotros" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/nosotros" },
};

export default async function NosotrosPage() {
  const marcas = await listBrands();

  return (
    <div className="flex flex-col">
      <section className="flex max-w-[900px] flex-col gap-7 px-6 pt-16 pb-10 sm:px-12 sm:pt-24 sm:pb-20">
        <div className="text-texto-terciario font-mono text-[12px] tracking-[0.18em] uppercase">
          Nosotros
        </div>
        <h1 className="text-44 sm:text-56 lg:text-68 leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
          Traemos a Guatemala el equipo que antes tocaba encargar afuera.
        </h1>
        <p className="text-texto-secundario max-w-[700px] text-[18px] leading-[1.5] sm:text-[21px]">
          Sonoro es una empresa de car audio donde importamos marcas de calidad y renombre a nivel
          internacional, con el objetivo de ofrecer productos que hagan de tus viajes en carro una
          experiencia excepcional.
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
            Bocinas, subwoofers, amplificadores, radios y pantallas, kits de cable e insonorización;
            con varias gamas disponibles, porque no todos los carros ni todos los presupuestos son
            iguales.
          </p>
          <p className="text-texto-secundario text-[16px] leading-[1.6] sm:text-[17px]">
            Vendemos únicamente equipo. La instalación la hace el taller de tu preferencia.
          </p>
        </div>
      </section>

      <section className="px-6 pt-10 pb-16 sm:px-12 sm:pt-10 sm:pb-24">
        <MarcasScroller marcas={marcas} />
      </section>

      <section className="flex flex-col gap-4 px-6 pb-16 sm:flex-row sm:px-12 sm:pb-24">
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">Visítanos</div>
          {/* Dirección: sin dato real confirmado (CLAUDE.md § Decisiones
              abiertas) — lee BUSINESS_ADDRESS_LOCALITY (misma env var que
              lib/seo/business.ts) en vez de un placeholder falso; sin
              configurar, dice explícitamente que falta, no inventa nada. */}
          <div className="text-texto-secundario text-[15px] leading-[1.6]">
            {process.env.BUSINESS_ADDRESS_LOCALITY
              ? `${process.env.BUSINESS_ADDRESS_LOCALITY}.`
              : "Dirección por confirmar."}
          </div>
          <span className="text-texto-terciario mt-auto pt-5 text-[15px]">Mapa próximamente</span>
        </div>
        <div className="bg-fondo-alt rounded-card-lg flex flex-1 flex-col gap-3 p-10">
          <div className="text-26 font-semibold tracking-[-0.025em]">Escríbenos</div>
          <div className="text-texto-secundario text-[15px] leading-[1.6]">
            {process.env.BUSINESS_PHONE ?? "Teléfono por confirmar."}
          </div>
          <span className="text-texto-terciario mt-auto pt-5 text-[15px]">
            WhatsApp próximamente
          </span>
        </div>
      </section>
    </div>
  );
}
