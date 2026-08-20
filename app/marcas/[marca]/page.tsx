import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { buildMarcaHref } from "@/lib/catalog/href.ts";
import { listAllProducts, listBrands, listCategories, listProducts } from "@/lib/catalog/index.ts";
import type { Orden } from "@/lib/catalog/index.ts";

// Todas las marcas son data estática (data/brands.json, generado en build) —
// igual que categorías y productos, cualquier slug fuera de esta lista es
// 404 real.
export const dynamicParams = false;

export async function generateStaticParams() {
  const marcas = await listBrands();
  return marcas.map((marca) => ({ marca: marca.slug }));
}

export async function generateMetadata(props: PageProps<"/marcas/[marca]">): Promise<Metadata> {
  const { marca: marcaSlug } = await props.params;
  const marca = (await listBrands()).find((m) => m.slug === marcaSlug);
  if (!marca) return {};

  return {
    title: `${marca.nombre} — Sonoro`,
    description: `Catálogo de ${marca.nombre} en Sonoro: equipo de audio para carro con envíos a toda Guatemala.`,
  };
}

function primeroDeQuery(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default async function MarcaPage(props: PageProps<"/marcas/[marca]">) {
  const { marca: marcaSlug } = await props.params;
  const searchParams = await props.searchParams;

  const marcas = await listBrands();
  const marca = marcas.find((m) => m.slug === marcaSlug);
  if (!marca) notFound();

  const todasLasCategorias = await listCategories();
  // Categorías presentes en el catálogo de ESTA marca, no las seis del sitio
  // — un pill de categoría sin productos sería un filtro que siempre da
  // "sin resultados". Se ordenan según el orden canónico del sitio, no el
  // orden en que aparecen en el JSON.
  const productosDeLaMarca = await listAllProducts({ marca: marca.nombre });
  const nombresPresentes = new Set(productosDeLaMarca.map((p) => p.categoria));
  const categoriasDisponibles = todasLasCategorias.filter((c) => nombresPresentes.has(c.nombre));

  const categoriaSlugParam = primeroDeQuery(searchParams.categoria);
  const categoriaActual = categoriaSlugParam
    ? categoriasDisponibles.find((c) => c.slug === categoriaSlugParam)
    : undefined;
  // Un slug de categoría que no aplica a esta marca (o que no existe) filtra
  // por un nombre que no matchea nada — "sin resultados" en vez de mostrar
  // el catálogo completo de la marca sin filtrar por error.
  const categoriaNombre = categoriaSlugParam
    ? (categoriaActual?.nombre ?? categoriaSlugParam)
    : undefined;

  const ordenParam = primeroDeQuery(searchParams.orden);
  const orden: Orden = ordenParam === "precio_desc" ? "precio_desc" : "precio_asc";
  const paginaParam = Number(primeroDeQuery(searchParams.page));
  const paginaSolicitada = Number.isFinite(paginaParam) && paginaParam >= 1 ? paginaParam : 1;

  const { items, total, page, pageSize } = await listProducts({
    marca: marca.nombre,
    categoria: categoriaNombre,
    orden,
    page: paginaSolicitada,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const ordenSiguiente: Orden = orden === "precio_asc" ? "precio_desc" : "precio_asc";
  const labelOrden = orden === "precio_asc" ? "Ordenar: precio ↑" : "Ordenar: precio ↓";

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-7 px-6 pt-10 sm:px-12 sm:pt-14">
        <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          Inicio / Marcas / {marca.nombre}
        </div>
        <div className="flex flex-col items-start gap-6 lg:flex-row lg:items-center">
          <PlaceholderImage
            label={`LOGO — ${marca.nombre}`}
            className="h-[160px] w-full items-center justify-center lg:h-[220px] lg:w-[380px]"
          />
          <div className="flex flex-col gap-3">
            <h1 className="text-40 sm:text-56 leading-[1.05] font-semibold tracking-[-0.035em]">
              {marca.nombre}
            </h1>
            {/* Descripción de marca: sin dato real (Brand solo trae nombre,
                slug, cantidadProductos). No se inventa una biografía de cada
                marca — ver nota en el resumen del turno. */}
          </div>
        </div>
      </section>

      <section className="flex flex-col items-start gap-4 px-6 pt-12 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-12 sm:pt-16 sm:pb-8">
        <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.03em]">
          {marca.cantidadProductos} {marca.cantidadProductos === 1 ? "producto" : "productos"}
        </h2>
        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <Link
            href={buildMarcaHref(marcaSlug, { orden })}
            className={`rounded-full border px-4.5 py-2 ${
              !categoriaSlugParam
                ? "border-negro bg-negro text-white"
                : "border-borde-pildora text-texto-nav"
            }`}
          >
            Todos
          </Link>
          {categoriasDisponibles.map((categoria) => (
            <Link
              key={categoria.slug}
              href={buildMarcaHref(marcaSlug, { categoria: categoria.slug, orden })}
              className={`rounded-full border px-4.5 py-2 ${
                categoria.slug === categoriaSlugParam
                  ? "border-negro bg-negro text-white"
                  : "border-borde-pildora text-texto-nav"
              }`}
            >
              {categoria.nombre}
            </Link>
          ))}
          <Link
            href={buildMarcaHref(marcaSlug, {
              categoria: categoriaSlugParam,
              orden: ordenSiguiente,
            })}
            className="border-negro bg-negro rounded-full border px-4.5 py-2 text-white"
          >
            {labelOrden}
          </Link>
        </div>
      </section>

      <section className="px-6 pb-16 sm:px-12 sm:pb-22">
        <ProductGrid productos={items} />
        <Pagination
          paginaActual={page}
          totalPaginas={totalPaginas}
          hrefPara={(pagina) =>
            buildMarcaHref(marcaSlug, { categoria: categoriaSlugParam, orden, page: pagina })
          }
        />
      </section>
    </div>
  );
}
