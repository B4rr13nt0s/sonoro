import type { Metadata } from "next";
import Link from "next/link";

import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { listBrands } from "@/lib/catalog/index.ts";

export const metadata: Metadata = {
  title: "Marcas — Sonoro",
  description: "Las marcas de audio para carro que vende Sonoro en Guatemala.",
};

export default async function MarcasPage() {
  const marcas = await listBrands();

  // "Nueve marcas" en el handoff es el conteo fijo del mockup — con datos
  // reales el número de marcas puede cambiar, así que se calcula.
  const titulo =
    marcas.length === 1
      ? "Una marca, importada de forma directa."
      : `${marcas.length} marcas, importadas de forma directa.`;

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-6 px-6 pt-16 pb-10 sm:px-12 sm:pt-22 sm:pb-16">
        <div className="text-texto-terciario font-mono text-[12px] tracking-[0.18em] uppercase">
          Marcas
        </div>
        <div className="flex max-w-[720px] flex-col gap-5">
          <h1 className="text-44 sm:text-64 leading-[1.05] font-semibold tracking-[-0.035em] text-balance">
            {titulo}
          </h1>
          <p className="text-texto-secundario max-w-[620px] text-[18px] leading-[1.5] sm:text-[20px]">
            Cada una cubre una parte del sistema: de la bocina de repuesto al componente de gama
            alta, del kit de cable a la lámina que silencia la puerta.
          </p>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 px-6 pb-16 sm:grid-cols-2 sm:px-12 sm:pb-22 lg:grid-cols-3">
        {marcas.map((marca) => (
          <div
            key={marca.slug}
            className="rounded-card-lg border-borde-tarjeta flex flex-col overflow-hidden border"
          >
            <PlaceholderImage label={`LOGO — ${marca.nombre}`} className="h-[180px] items-center" />
            <div className="flex flex-1 flex-col gap-2 p-6">
              {/* País de origen: sin dato real (data/brands.json no lo
                  trae). No se inventa — ver nota en el resumen del turno. */}
              <div className="text-22 font-semibold tracking-[-0.02em]">{marca.nombre}</div>
              <div className="mt-auto flex items-baseline justify-between gap-4 pt-5">
                <span className="text-texto-terciario font-mono text-[11px]">
                  {marca.cantidadProductos}{" "}
                  {marca.cantidadProductos === 1 ? "producto" : "productos"}
                </span>
                <Link href={`/marcas/${marca.slug}`} className="text-texto-secundario text-[15px]">
                  Ver catálogo →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
