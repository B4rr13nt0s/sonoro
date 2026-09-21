import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FiltroMarca } from "@/components/catalog/FiltroMarca";
import { OrdenSelector } from "@/components/catalog/OrdenSelector";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildProductosHref, hrefsDeOrden } from "@/lib/catalog/href.ts";
import { listBrands, listProducts, parseOrden, parsePagina } from "@/lib/catalog/index.ts";

const TITULO = "Productos destacados — Sonoro";
const DESCRIPCION =
  "Los productos destacados de Sonoro: equipo de audio para carro con envíos a toda Guatemala.";

function primeroDeQuery(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function generateMetadata(props: PageProps<"/productos">): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const marcaSlug = primeroDeQuery(searchParams.marca);
  const page = parsePagina(searchParams.page);
  // Mismo criterio que /catalogo/[categoria]: canonical sin `orden`, con
  // marca/page preservados.
  const canonical = buildProductosHref({ marca: marcaSlug, page });

  return {
    title: TITULO,
    description: DESCRIPCION,
    alternates: { canonical },
    openGraph: { title: TITULO, description: DESCRIPCION, url: canonical },
  };
}

export default async function ProductosPage(props: PageProps<"/productos">) {
  const searchParams = await props.searchParams;

  const marcaSlug = primeroDeQuery(searchParams.marca);
  const orden = parseOrden(searchParams.orden);
  const paginaSolicitada = parsePagina(searchParams.page);

  const marcas = await listBrands();
  // Mismo criterio que /catalogo/[categoria]: un slug que no resuelve a
  // marca real filtra por el slug crudo — "sin resultados", no el listado
  // completo sin filtrar por error.
  const marcaNombre = marcaSlug
    ? (marcas.find((marca) => marca.slug === marcaSlug)?.nombre ?? marcaSlug)
    : undefined;

  const { items, total, page, pageSize } = await listProducts({
    destacado: true,
    marca: marcaNombre,
    activo: true,
    orden,
    page: paginaSolicitada,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  // Una página que no existe es un 404, no un listado vacío con 200: de lo
  // contrario `?page=99999` le abre a Google un espacio infinito de URLs, y
  // cada una se renderiza en el servidor.
  if (paginaSolicitada > totalPaginas) notFound();

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-6 px-6 pt-10 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-12 sm:pt-14 sm:pb-8">
        <div className="flex flex-col gap-3">
          <Breadcrumbs
            items={[{ label: "Inicio", href: "/" }, { label: "Productos destacados" }]}
          />
          <h1 className="text-34 sm:text-40 lg:text-48 font-semibold tracking-[-0.03em]">
            Productos destacados
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <FiltroMarca
            opciones={marcas.map((marca) => ({
              slug: marca.slug,
              nombre: marca.nombre,
              href: buildProductosHref({ marca: marca.slug, orden }),
            }))}
            hrefTodas={buildProductosHref({ orden })}
            marcaActual={marcaSlug}
          />
          <OrdenSelector
            orden={orden}
            hrefs={hrefsDeOrden((valor) => buildProductosHref({ marca: marcaSlug, orden: valor }))}
          />
        </div>
      </section>

      <section className="px-6 pb-16 sm:px-12 sm:pb-22">
        <ProductGrid productos={items} />
        <Pagination
          paginaActual={page}
          totalPaginas={totalPaginas}
          hrefPara={(pagina) => buildProductosHref({ marca: marcaSlug, orden, page: pagina })}
        />
      </section>
    </div>
  );
}
