import type { Metadata } from "next";

import { FiltroMarca } from "@/components/catalog/FiltroMarca";
import { OrdenSelector } from "@/components/catalog/OrdenSelector";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buildCatalogoCompletoHref, hrefsDeOrden } from "@/lib/catalog/href.ts";
import { listBrands, listProducts, parseOrden } from "@/lib/catalog/index.ts";

// Todo el catálogo. Es la RUTA HERMANA de /catalogo/[categoria], no su
// padre: misma plantilla, mismo orden, misma paginación y mismos filtros,
// y se diferencian solo en el alcance — acá no hay categoría fijada.
//
// Sobre el enrutamiento: este archivo y [categoria]/page.tsx conviven sin
// pisarse. En el App Router un segmento estático y uno dinámico son
// hermanos, no alternativas del mismo tramo: /catalogo entra acá y
// /catalogo/bocinas entra en el dinámico. Además [categoria] declara
// `dynamicParams = false` con los ocho slugs de listCategories(), así que
// tampoco podría capturar nada más.
//
// Existe porque /productos son solo los marcados `destacado` (72 de 320) y
// el sitio no tenía ninguna ruta para recorrer el catálogo entero.
const TITULO = "Catálogo completo — Sonoro";
const DESCRIPCION =
  "Catálogo completo de Sonoro: bocinas, subwoofers, amplificadores, receptores, kits, insonorización y accesorios. Envíos a toda Guatemala.";

function primeroDeQuery(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function generateMetadata(props: PageProps<"/catalogo">): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const marcaSlug = primeroDeQuery(searchParams.marca);
  const paginaParam = Number(primeroDeQuery(searchParams.page));
  const page = Number.isFinite(paginaParam) && paginaParam >= 1 ? paginaParam : 1;
  // Mismo criterio que /catalogo/[categoria]: canonical sin `orden`, con
  // marca/page preservados.
  const canonical = buildCatalogoCompletoHref({ marca: marcaSlug, page });

  return {
    title: TITULO,
    description: DESCRIPCION,
    alternates: { canonical },
    openGraph: { title: TITULO, description: DESCRIPCION, url: canonical },
  };
}

export default async function CatalogoPage(props: PageProps<"/catalogo">) {
  const searchParams = await props.searchParams;

  const marcaSlug = primeroDeQuery(searchParams.marca);
  const orden = parseOrden(searchParams.orden);
  const paginaParam = Number(primeroDeQuery(searchParams.page));
  const paginaSolicitada = Number.isFinite(paginaParam) && paginaParam >= 1 ? paginaParam : 1;

  const marcas = await listBrands();
  // Igual que en /catalogo/[categoria]: un slug que no resuelve a marca real
  // filtra por el slug crudo — "sin resultados", no el catálogo completo sin
  // filtrar por error.
  const marcaNombre = marcaSlug
    ? (marcas.find((marca) => marca.slug === marcaSlug)?.nombre ?? marcaSlug)
    : undefined;

  const { items, total, page, pageSize } = await listProducts({
    marca: marcaNombre,
    activo: true,
    orden,
    page: paginaSolicitada,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-6 px-6 pt-10 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-12 sm:pt-14 sm:pb-8">
        <div className="flex flex-col gap-3">
          <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Catálogo completo" }]} />
          <h1 className="text-34 sm:text-40 lg:text-48 font-semibold tracking-[-0.03em]">
            Catálogo completo
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <FiltroMarca
            opciones={marcas.map((marca) => ({
              slug: marca.slug,
              nombre: marca.nombre,
              href: buildCatalogoCompletoHref({ marca: marca.slug, orden }),
            }))}
            hrefTodas={buildCatalogoCompletoHref({ orden })}
            marcaActual={marcaSlug}
          />
          <OrdenSelector
            orden={orden}
            hrefs={hrefsDeOrden((valor) =>
              buildCatalogoCompletoHref({ marca: marcaSlug, orden: valor }),
            )}
          />
        </div>
      </section>

      <section className="px-6 pb-16 sm:px-12 sm:pb-22">
        <ProductGrid productos={items} />
        <Pagination
          paginaActual={page}
          totalPaginas={totalPaginas}
          hrefPara={(pagina) =>
            buildCatalogoCompletoHref({ marca: marcaSlug, orden, page: pagina })
          }
        />
      </section>
    </div>
  );
}
