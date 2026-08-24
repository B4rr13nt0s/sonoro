import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FiltroMarca } from "@/components/catalog/FiltroMarca";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { buildCatalogHref } from "@/lib/catalog/href.ts";
import { listBrands, listCategories, listProducts } from "@/lib/catalog/index.ts";
import type { Orden } from "@/lib/catalog/index.ts";

// Copy propia de la ficha de categoría (párrafo bajo el h1). Solo
// Subwoofers tiene texto en el handoff (design/catalogo-subwoofers.html);
// para las otras cinco categorías no hay copy aprobado — CLAUDE.md § reglas:
// "si una sección se ve vacía es un problema de layout, no falta de
// contenido", así que se omite el párrafo en vez de inventarlo.
const DESCRIPCIONES: Partial<Record<string, string>> = {
  subwoofers:
    "El subwoofer reproduce las frecuencias más bajas, las que una bocina normal no alcanza: es lo que da cuerpo y golpe a la música.",
};

// Solo estas seis rutas existen — CLAUDE.md § Rutas. Cualquier otro valor
// de [categoria] es 404, no una página renderizada al vuelo.
export const dynamicParams = false;

export async function generateStaticParams() {
  const categorias = await listCategories();
  return categorias.map((categoria) => ({ categoria: categoria.slug }));
}

function primeroDeQuery(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export async function generateMetadata(
  props: PageProps<"/catalogo/[categoria]">,
): Promise<Metadata> {
  const { categoria: categoriaSlug } = await props.params;
  const searchParams = await props.searchParams;
  const categoria = (await listCategories()).find((c) => c.slug === categoriaSlug);
  if (!categoria) return {};

  const marcaSlug = primeroDeQuery(searchParams.marca);
  const paginaParam = Number(primeroDeQuery(searchParams.page));
  const page = Number.isFinite(paginaParam) && paginaParam >= 1 ? paginaParam : 1;
  // Canonical propio, sin `orden`: el orden de precio no cambia el
  // contenido, así que no debe fragmentar el canonical. `marca`/`page` sí
  // se preservan — CLAUDE.md § Rutas los declara "rastreables por Google".
  const canonical = buildCatalogHref(categoriaSlug, { marca: marcaSlug, page });

  const title = `${categoria.nombre} — Sonoro`;
  const description = `Compra ${categoria.nombre.toLowerCase()} para audio de carro en Guatemala. Envíos a todo el país.`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical },
  };
}

export default async function CategoriaPage(props: PageProps<"/catalogo/[categoria]">) {
  const { categoria: categoriaSlug } = await props.params;
  const searchParams = await props.searchParams;

  const categorias = await listCategories();
  const categoria = categorias.find((c) => c.slug === categoriaSlug);
  if (!categoria) notFound();

  const marcaSlug = primeroDeQuery(searchParams.marca);
  const ordenParam = primeroDeQuery(searchParams.orden);
  const orden: Orden = ordenParam === "precio_desc" ? "precio_desc" : "precio_asc";
  const paginaParam = Number(primeroDeQuery(searchParams.page));
  const paginaSolicitada = Number.isFinite(paginaParam) && paginaParam >= 1 ? paginaParam : 1;

  const marcas = await listBrands();
  // Si el slug no resuelve a una marca real, se filtra por el slug crudo:
  // no matchea ningún producto, así que el resultado es "sin resultados"
  // en vez de mostrar el catálogo completo sin filtrar por error.
  const marcaNombre = marcaSlug
    ? (marcas.find((marca) => marca.slug === marcaSlug)?.nombre ?? marcaSlug)
    : undefined;

  const { items, total, page, pageSize } = await listProducts({
    categoria: categoria.nombre,
    marca: marcaNombre,
    orden,
    page: paginaSolicitada,
  });
  const totalPaginas = Math.max(1, Math.ceil(total / pageSize));

  const ordenSiguiente: Orden = orden === "precio_asc" ? "precio_desc" : "precio_asc";
  const labelOrden = orden === "precio_asc" ? "Ordenar: precio ↑" : "Ordenar: precio ↓";

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-6 px-6 pt-10 pb-6 sm:flex-row sm:items-end sm:justify-between sm:px-12 sm:pt-14 sm:pb-8">
        <div className="flex flex-col gap-3">
          <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
            Inicio / {categoria.nombre}
          </div>
          <h1 className="text-34 sm:text-40 lg:text-48 font-semibold tracking-[-0.03em]">
            {categoria.nombre}
          </h1>
          {DESCRIPCIONES[categoriaSlug] ? (
            <p className="text-texto-secundario max-w-[520px] text-[17px]">
              {DESCRIPCIONES[categoriaSlug]}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <FiltroMarca
            categoriaSlug={categoriaSlug}
            marcas={marcas}
            marcaActual={marcaSlug}
            orden={orden}
          />
          <Link
            href={buildCatalogHref(categoriaSlug, { marca: marcaSlug, orden: ordenSiguiente })}
            className="border-negro bg-negro rounded-full border px-4.5 py-3 text-white lg:py-2"
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
            buildCatalogHref(categoriaSlug, { marca: marcaSlug, orden, page: pagina })
          }
        />
      </section>
    </div>
  );
}
