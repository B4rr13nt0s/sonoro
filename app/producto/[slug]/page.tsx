import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ViewProductTracker } from "@/components/analytics/ViewProductTracker";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ProductGallery } from "@/components/media/ProductGallery";
import { calcularCuotaCents, formatQ } from "@/lib/format/precio.ts";
import { getProduct, listAllProducts, listBrands, listCategories } from "@/lib/catalog/index.ts";
import { buildCatalogHref, buildMarcaHref } from "@/lib/catalog/href.ts";
import { buildProductJsonLd } from "@/lib/seo/product.ts";
import { jsonLdScriptProps } from "@/lib/seo/jsonLd.ts";

// El catálogo entero es data estática generada en build (scripts/import-catalog.ts
// → data/catalog.json) — todo slug válido se conoce de antemano, igual que
// las categorías. Cualquier slug fuera de esta lista es 404 real, no una
// página armada al vuelo.
export const dynamicParams = false;

export async function generateStaticParams() {
  const productos = await listAllProducts();
  return productos.map((producto) => ({ slug: producto.slug }));
}

export async function generateMetadata(props: PageProps<"/producto/[slug]">): Promise<Metadata> {
  const { slug } = await props.params;
  const producto = await getProduct(slug);
  if (!producto) return {};

  // activo === false: proxy.ts ya fuerza el status 410 para esta URL — acá
  // solo evitamos que Google indexe el título/descripción del producto
  // como si siguiera a la venta.
  if (!producto.activo) {
    return {
      title: "Producto ya no disponible — Sonoro",
      robots: { index: false, follow: false },
    };
  }

  const canonical = `/producto/${slug}`;
  const title = `${producto.nombre} — Sonoro`;

  return {
    title,
    description: producto.descripcionCorta,
    alternates: { canonical },
    // Sin `openGraph.images`: el opengraph-image.tsx colocado en esta misma
    // carpeta ya inyecta esas etiquetas — fijarlas a mano las duplicaría.
    openGraph: { title, description: producto.descripcionCorta, url: canonical },
  };
}

export default async function ProductoPage(props: PageProps<"/producto/[slug]">) {
  const { slug } = await props.params;
  const producto = await getProduct(slug);
  if (!producto) notFound();

  // Se resuelven una sola vez y sirven a las dos ramas de abajo: la de
  // producto inactivo (link "Ver {categoría}") y la de breadcrumbs del
  // producto activo (CLAUDE.md § Breadcrumbs: "en ficha de producto
  // terminan en la marca, no en el nombre del producto").
  const [categorias, marcas] = await Promise.all([listCategories(), listBrands()]);
  const categoriaSlug = categorias.find((c) => c.nombre === producto.categoria)?.slug;
  const marcaSlug = marcas.find((m) => m.nombre === producto.marca)?.slug;

  // activo === false (CLAUDE.md § Mantenimiento del catálogo): la fila
  // nunca se borra, así que el slug sigue existiendo y sigue
  // pre-renderizado — pero no es un 404. proxy.ts pone el status en 410;
  // esta rama solo decide qué HTML se manda con ese status.
  if (!producto.activo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
          Producto ya no disponible
        </div>
        <h1 className="text-40 max-w-[520px] font-semibold tracking-[-0.03em]">
          {producto.nombre} ya no está a la venta
        </h1>
        <p className="text-texto-secundario max-w-[440px] text-[17px]">
          Este producto dejó de venderse en Sonoro. Puede seguir viendo el resto del catálogo.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {categoriaSlug ? (
            <Link
              href={`/catalogo/${categoriaSlug}`}
              className="bg-negro rounded-full px-6 py-3.75 text-[16px] text-white"
            >
              Ver {producto.categoria}
            </Link>
          ) : null}
          <Link
            href="/"
            className="border-borde-tarjeta rounded-full border px-6 py-3.75 text-[16px]"
          >
            Ir a Inicio
          </Link>
        </div>
      </div>
    );
  }

  // specsDestacadas es SIEMPRE 3 (ProductoSchema lo exige) — el "Código" es
  // la cuarta tarjeta, derivado de sku, no vive en el arreglo (CLAUDE.md §
  // Esquema de producto). specsDestacadas y specsFicha se pintan en el
  // orden del arreglo, sin reordenar.
  const tarjetas = [...producto.specsDestacadas, { etiqueta: "Código", valor: producto.sku }];
  const cuota = calcularCuotaCents(producto.precioCents, 6);

  return (
    <div className="flex flex-col">
      <script {...jsonLdScriptProps(buildProductJsonLd(producto))} />
      <ViewProductTracker
        sku={producto.sku}
        nombre={producto.nombre}
        precioCents={producto.precioCents}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px]">
        <div className="flex flex-col gap-2.5 px-6 py-8 sm:px-12 lg:py-8 lg:pr-6 lg:pl-12">
          <ProductGallery imagenes={producto.imagenes} nombre={producto.nombre} />
        </div>

        <div className="flex flex-col gap-5 px-6 pb-8 sm:px-12 lg:pt-11 lg:pr-12 lg:pb-8 lg:pl-6">
          {/* CLAUDE.md § Breadcrumbs: "en ficha de producto terminan en la
              marca, no en el nombre del producto" — a diferencia de
              /catalogo/[categoria] y /marcas/[marca], ningún segmento acá
              es "la página actual" (esta es la ficha del producto, no la
              de categoría ni la de marca), así que los tres son
              navegables. */}
          <Breadcrumbs
            items={[
              { label: "Inicio", href: "/" },
              {
                label: producto.categoria,
                href: categoriaSlug ? buildCatalogHref(categoriaSlug, {}) : undefined,
              },
              {
                label: producto.marca,
                href: marcaSlug ? buildMarcaHref(marcaSlug, {}) : undefined,
              },
            ]}
          />

          <h1 className="text-40 leading-[1.1] font-semibold tracking-[-0.03em]">
            {producto.nombre}
          </h1>

          <div className="flex flex-col gap-1 pt-1">
            <div className="text-34 font-semibold tracking-[-0.03em]">
              {formatQ(producto.precioCents)}
            </div>
            <div className="text-texto-secundario text-[14px]">
              o {formatQ(cuota)} al mes × 6 · IVA incluido
            </div>
          </div>

          {/* Las variantes no son selectores (CLAUDE.md § reglas): tamaño e
              impedancia se muestran como datos junto al Código, nunca como
              opciones desplegables — este producto YA es el D2 de 12", no
              hay nada que elegir aquí. */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {tarjetas.map((spec) => (
              <div
                key={spec.etiqueta}
                className="rounded-field border-borde-tarjeta flex flex-col gap-1 border px-4.5 py-4"
              >
                <div className="text-texto-terciario font-mono text-[10px] tracking-[0.14em] uppercase">
                  {spec.etiqueta}
                </div>
                <div className="text-[17px] font-semibold tracking-[-0.01em]">{spec.valor}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <AddToCartButton producto={producto} />
          </div>

          <div className="border-borde-nav text-texto-secundario flex flex-col gap-2.5 border-t pt-5 text-[14px]">
            <div className="flex justify-between gap-4">
              <span>Envío gratis a todo el país</span>
              <span className="text-negro">24 a 72 horas</span>
            </div>
            <div className="flex justify-between gap-4">
              <span>Pagos</span>
              <span className="text-negro">Hasta 6 pagos precio contado.</span>
            </div>
          </div>
          <div className="text-texto-terciario font-mono text-[11px]">
            Aplican restricciones según destino y volumen del pedido.
          </div>
        </div>
      </div>

      <section className="bg-negro flex flex-col gap-10 px-6 py-14 text-white sm:px-12 sm:py-20">
        <div className="flex flex-col gap-3">
          <h2 className="text-34 font-semibold tracking-[-0.025em]">Ficha técnica</h2>
          <p className="text-texto-sobre-negro max-w-[620px] text-[16px] leading-[1.55]">
            {producto.descripcionCorta}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-x-16 sm:grid-cols-2">
          {producto.specsFicha.map((spec) => (
            <div
              key={spec.etiqueta}
              className="border-borde-sobre-negro flex justify-between gap-6 border-t py-4 text-[15px]"
            >
              <span className="text-texto-sobre-negro">{spec.etiqueta}</span>
              <span>{spec.valor}</span>
            </div>
          ))}
        </div>
        <div className="font-mono text-[11px] text-[#6e6e72]">
          Datos publicados por el fabricante.
        </div>
      </section>
    </div>
  );
}
