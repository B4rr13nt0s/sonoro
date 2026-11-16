import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Cotizador } from "@/components/cotizador/Cotizador";
import { FormularioEntrada } from "@/components/cotizador/FormularioEntrada";
import { tarjetasBuscables } from "@/lib/catalog/buscables.ts";
import { listAllProducts } from "@/lib/catalog/index.ts";
import { estadoDelAcceso } from "@/lib/cotizador/acceso.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";

import { salir } from "./acciones.ts";

// Herramienta interna (docs/superpowers/specs/2026-11-16-cotizador-design.md):
// sin enlace en el sitio, noindex y fuera de robots.txt.
export const metadata: Metadata = metadataPagina({
  titulo: "Cotizador",
  descripcion: "Herramienta interna.",
  ruta: "/cotizador",
  noIndexar: true,
});

// Se arma en cada petición, nunca en el build: sin esto, con la variable de
// entorno ausente al compilar, el notFound() de abajo quedaría horneado como
// página estática y la ruta seguiría cerrada aunque después se configurara.
export const dynamic = "force-dynamic";

const ENCABEZADO = "px-6 pt-12 pb-8 sm:px-12 sm:pt-16 sm:pb-10";
const TITULO = "text-40 sm:text-48 font-semibold tracking-[-0.035em]";

export default async function CotizadorPage() {
  // El orden importa: (1) sin contraseña configurada la ruta no existe, nunca
  // queda abierta por olvido; (2) sin sesión, solo el formulario y NADA del
  // catálogo; (3) recién con sesión válida se consulta y se manda el catálogo.
  const acceso = await estadoDelAcceso();
  if (acceso === "cerrada") notFound();

  if (acceso === "formulario") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 py-16 sm:px-12">
        <h1 className={TITULO}>Cotizador</h1>
        <FormularioEntrada />
      </div>
    );
  }

  const tarjetas = tarjetasBuscables(await listAllProducts({ activo: true }));

  return (
    <div className="flex flex-1 flex-col">
      <div className={`${ENCABEZADO} flex items-center justify-between gap-4`}>
        <h1 className={TITULO}>Cotizador</h1>
        <form action={salir}>
          <button type="submit" className="text-texto-secundario text-[14px]">
            Salir
          </button>
        </form>
      </div>
      <Cotizador productos={tarjetas} />
    </div>
  );
}
