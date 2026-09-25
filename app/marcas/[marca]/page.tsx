import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { OrdenSelector } from "@/components/catalog/OrdenSelector";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PlaceholderImage } from "@/components/media/PlaceholderImage";
import { buildMarcaHref, hrefsDeOrden } from "@/lib/catalog/href.ts";
import {
  listAllProducts,
  listBrands,
  listCategories,
  listProducts,
  parseOrden,
  parsePagina,
} from "@/lib/catalog/index.ts";
import { CATEGORIA_SISTEMAS } from "@/lib/catalog/categorias.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";
import { masFrecuentes, textosMarca } from "@/lib/seo/textos.ts";

// Todas las marcas son data estática (data/brands.json, generado en build) —
// igual que categorías y productos, cualquier slug fuera de esta lista es
// 404 real.
export const dynamicParams = false;

export async function generateStaticParams() {
  const marcas = await listBrands();
  return marcas.map((marca) => ({ marca: marca.slug }));
}

function primeroDeQuery(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function generateMetadata(props: PageProps<"/marcas/[marca]">): Promise<Metadata> {
  const { marca: marcaSlug } = await props.params;
  const searchParams = await props.searchParams;
  const marca = (await listBrands()).find((m) => m.slug === marcaSlug);
  if (!marca) return {};

  const categoriaSlug = primeroDeQuery(searchParams.categoria);
  const page = parsePagina(searchParams.page);
  // Mismo criterio que /catalogo/[categoria]: canonical sin `orden`, con
  // categoria/page preservados.
  const canonical = buildMarcaHref(marcaSlug, { categoria: categoriaSlug, page });

  const categoriaFiltro = categoriaSlug
    ? (await listCategories()).find((categoria) => categoria.slug === categoriaSlug)?.nombre
    : undefined;
  const productos = await listAllProducts({
    marca: marca.nombre,
    categoria: categoriaFiltro,
    activo: true,
  });
  const { titulo, descripcion } = textosMarca({
    nombre: marca.nombre,
    total: productos.length,
    // «Sistemas» no es una categoría del sitio (CLAUDE.md § Fuente de verdad).
    categorias: masFrecuentes(
      productos
        .map((producto) => producto.categoria)
        .filter((categoria) => categoria !== CATEGORIA_SISTEMAS),
    ),
    categoriaFiltro,
    page,
  });

  // Un listado vacío existe —una marca sin productos en la categoría, que el
  // propio filtro ofrece— pero no tiene nada que indexar.
  return metadataPagina({
    titulo,
    descripcion,
    ruta: canonical,
    noIndexar: productos.length === 0,
  });
}

export default async function MarcaPage(props: PageProps<"/marcas/[marca]">) {
  const { marca: marcaSlug } = await props.params;
  const searchParams = await props.searchParams;

  const marcas = await listBrands();
  const marca = marcas.find((m) => m.slug === marcaSlug);
  if (!marca) notFound();

  const todasLasCategorias = await listCategories();
  // Categorías presentes en el catálogo de ESTA marca, no las ocho del sitio
  // — un pill de categoría sin productos sería un filtro que siempre da
  // "sin resultados". Se ordenan según el orden canónico del sitio, no el
  // orden en que aparecen en el JSON.
  const productosDeLaMarca = await listAllProducts({ marca: marca.nombre, activo: true });
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

  const orden = parseOrden(searchParams.orden);
  const paginaSolicitada = parsePagina(searchParams.page);

  const { items, total, page, pageSize } = await listProducts({
    marca: marca.nombre,
    categoria: categoriaNombre,
    activo: true,
    orden,
    page: paginaSolicitada,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));
  // Respaldo: el 404 con status real lo da proxy.ts (lib/catalog/conteos.ts),
  // porque para cuando la página llega acá loading.tsx ya mandó las cabeceras
  // con 200. Esto solo asegura que, si el proxy y la página divergieran, no
  // se dibuje un listado vacío.
  if (paginaSolicitada > totalPaginas) notFound();

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-7 px-6 pt-10 sm:px-12 sm:pt-14">
        <Breadcrumbs
          items={[
            { label: "Inicio", href: "/" },
            { label: "Marcas", href: "/marcas" },
            { label: marca.nombre },
          ]}
        />
        <div className="flex flex-col items-center gap-6">
          {/* El nombre sigue en el DOM como h1 (semántica/SEO — coincide con
              el <title> de generateMetadata) pero visualmente oculto: el
              logo va centrado y solo, sin el nombre escrito a la par. */}
          <h1 className="sr-only">{marca.nombre}</h1>
          <PlaceholderImage
            label={`LOGO — ${marca.nombre}`}
            className="h-[160px] w-full max-w-[380px] items-center justify-center lg:h-[220px]"
          />
        </div>
      </section>

      <section className="flex flex-col items-start gap-4 px-6 pt-12 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-12 sm:pt-16 sm:pb-8">
        <h2 className="text-26 sm:text-38 font-semibold tracking-[-0.03em]">
          {marca.cantidadProductos} {marca.cantidadProductos === 1 ? "producto" : "productos"}
        </h2>
        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <Link
            href={buildMarcaHref(marcaSlug, { orden })}
            className={`rounded-full border px-4.5 py-3 lg:py-2 ${
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
              className={`rounded-full border px-4.5 py-3 lg:py-2 ${
                categoria.slug === categoriaSlugParam
                  ? "border-negro bg-negro text-white"
                  : "border-borde-pildora text-texto-nav"
              }`}
            >
              {categoria.nombre}
            </Link>
          ))}
          <OrdenSelector
            orden={orden}
            hrefs={hrefsDeOrden((valor) =>
              buildMarcaHref(marcaSlug, { categoria: categoriaSlugParam, orden: valor }),
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
            buildMarcaHref(marcaSlug, { categoria: categoriaSlugParam, orden, page: pagina })
          }
        />
      </section>
    </div>
  );
}
