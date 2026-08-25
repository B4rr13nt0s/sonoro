import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FiltroMarca } from "@/components/catalog/FiltroMarca";
import { Pagination } from "@/components/catalog/Pagination";
import { ProductGrid } from "@/components/catalog/ProductGrid";
import { buildCatalogHref } from "@/lib/catalog/href.ts";
import { listBrands, listCategories, listProducts } from "@/lib/catalog/index.ts";
import type { Orden } from "@/lib/catalog/index.ts";

// Copy propia de la ficha de categoría (párrafo bajo el h1). Solo Subwoofers
// tenía texto en el handoff (design/catalogo-subwoofers.html); el resto
// sigue el mismo tono: una frase factual sobre qué hace el producto, sin
// criterio de instalación ni de asesoría (CLAUDE.md § reglas 1 y 2).
const DESCRIPCIONES: Partial<Record<string, string>> = {
  bocinas:
    "La bocina reproduce el rango medio y agudo: voces, instrumentos y detalle. Vienen coaxiales, de dos vías en un solo cuerpo, o de componentes, con el tweeter aparte del woofer.",
  subwoofers:
    "El subwoofer reproduce las frecuencias más bajas, las que una bocina normal no alcanza: es lo que da cuerpo y golpe a la música.",
  amplificadores:
    "El amplificador entrega la potencia que la unidad principal no alcanza a dar: más volumen limpio, sin distorsión, para bocinas y subwoofers.",
  receptores:
    "El receptor reemplaza la unidad principal de fábrica: pantalla, CarPlay o Android Auto, y las salidas para conectar el resto del sistema.",
  kits: "El kit trae el cableado completo — corriente, tierra, señal — calibrado para la potencia del equipo que va a alimentar.",
  insonorizacion:
    "La lámina de insonorización se adhiere a la carrocería y reduce la vibración y el ruido que entra por la puerta, el piso o la cajuela.",
  ecualizadores:
    "El ecualizador ajusta el balance de frecuencias del sistema antes de que llegue a las bocinas, banda por banda.",
  accesorios:
    "Piezas complementarias del sistema — conectores, capacitores, controles remotos — que no encajan en el resto de categorías.",
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
    activo: true,
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
