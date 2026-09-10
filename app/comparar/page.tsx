import type { Metadata } from "next";
import Link from "next/link";

import { TablaComparacion } from "@/components/comparador/TablaComparacion";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { listAllProducts } from "@/lib/catalog/index.ts";
import type { Producto } from "@/lib/catalog/index.ts";
import { parsearSkus } from "@/lib/comparador/index.ts";

// Comparador de especificaciones. El estado vive en la URL —no en
// localStorage— porque lo que le da valor a la función es que se pueda
// compartir por WhatsApp: un cliente pone dos equipos lado a lado y manda el
// enlace exacto.
//
// Por eso esta página NO lee la selección guardada ni la modifica: quien abre
// un enlace ajeno ve lo que trae el enlace y no pierde lo suyo.
const TITULO = "Comparar productos — Sonoro";
const DESCRIPCION = "Pon hasta cuatro equipos lado a lado y revisa sus fichas técnicas completas.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  // Son combinaciones infinitas de productos, no páginas de catálogo: no hay
  // nada que indexar. A diferencia de /carrito, esta URL NO se agrega al
  // Disallow de robots.ts — un Disallow impediría que Google llegara a leer
  // este noindex, y la URL está hecha para compartirse.
  robots: { index: false, follow: false },
};

type Descarte = { sku: string; motivo: string };

export default async function CompararPage(props: PageProps<"/comparar">) {
  const searchParams = await props.searchParams;
  const pedidos = parsearSkus(searchParams.skus);

  // Sin filtrar, para poder decir «ya no está disponible» en vez de «no
  // existe» cuando el producto salió de venta (activo = false).
  const todos = await listAllProducts();
  const porSku = new Map(todos.map((p) => [p.sku, p]));

  const descartes: Descarte[] = [];
  const encontrados: Producto[] = [];
  for (const sku of pedidos) {
    const producto = porSku.get(sku);
    if (!producto) {
      descartes.push({ sku, motivo: "no está en el catálogo" });
      continue;
    }
    if (!producto.activo) {
      descartes.push({ sku, motivo: "ya no está disponible" });
      continue;
    }
    encontrados.push(producto);
  }

  // Manda la categoría del primero válido: comparar un subwoofer con un cable
  // RCA no significa nada, así que los de otra categoría se ignoran y se dice
  // cuáles.
  const categoria = encontrados[0]?.categoria ?? null;
  const productos: Producto[] = [];
  for (const producto of encontrados) {
    if (producto.categoria !== categoria) {
      descartes.push({
        sku: producto.sku,
        motivo: `es de ${producto.categoria.toLowerCase()} y no se compara con ${categoria?.toLowerCase()}`,
      });
      continue;
    }
    productos.push(producto);
  }

  return (
    <div className="flex flex-col">
      <section className="flex flex-col gap-3 px-6 pt-10 pb-6 sm:px-12 sm:pt-14">
        <Breadcrumbs items={[{ label: "Inicio", href: "/" }, { label: "Comparar" }]} />
        <h1 className="text-34 sm:text-40 lg:text-48 font-semibold tracking-[-0.03em]">
          {categoria && productos.length >= 2 ? `Comparar ${categoria.toLowerCase()}` : "Comparar"}
        </h1>
      </section>

      {descartes.length > 0 ? (
        <section className="px-6 pb-2 sm:px-12">
          <div className="border-borde-tarjeta rounded-card flex flex-col gap-1 border p-5 text-[14px]">
            {descartes.map((descarte) => (
              <span key={descarte.sku} className="text-texto-secundario">
                Se omitió <span className="text-negro font-medium">{descarte.sku}</span>:{" "}
                {descarte.motivo}.
              </span>
            ))}
          </div>
        </section>
      ) : null}

      {productos.length >= 2 ? (
        <section className="px-6 pt-4 pb-16 sm:px-12 sm:pb-22">
          <TablaComparacion productos={productos} />
        </section>
      ) : (
        <VolverAlCatalogo productos={productos} />
      )}
    </div>
  );
}

// No es un caso raro: el enlace del inicio llega siempre sin skus, así que
// esta es la pantalla de entrada del comparador. Copy descriptivo, sin
// criterio sobre qué le conviene al cliente (CLAUDE.md § reglas 2).
function VolverAlCatalogo({ productos }: { productos: Producto[] }) {
  const uno = productos[0];

  return (
    <section className="flex flex-col items-start gap-5 px-6 pt-4 pb-16 sm:px-12 sm:pb-22">
      <p className="text-texto-secundario max-w-[520px] text-[17px] leading-[1.55]">
        {uno
          ? `Hay un solo producto en esta comparación. Agrega al menos otro de ${uno.categoria.toLowerCase()} para verlos lado a lado.`
          : "Se comparan de dos a cuatro productos de una misma categoría. Elige los que quieras desde el catálogo con el botón «Comparar» de cada producto."}
      </p>
      <div className="flex flex-wrap gap-3 text-[15px]">
        <Link href="/catalogo" className="bg-negro rounded-full px-6 py-3 text-white">
          Ver el catálogo
        </Link>
        {uno ? (
          <Link
            href={`/producto/${uno.slug}`}
            className="border-borde-pildora rounded-full border px-6 py-3"
          >
            Ver {uno.nombre}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
