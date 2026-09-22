import { ProductGrid } from "@/components/catalog/ProductGrid";

/**
 * Lo que se ve mientras un listado se arma en el servidor.
 *
 * Los cuatro listados —/catalogo, /catalogo/[categoria], /marcas/[marca] y
 * /productos— llevan filtros en la URL, así que se renderizan por petición y
 * tardan cerca de medio segundo. Sin esto, ese medio segundo transcurre con
 * la página anterior congelada: el visitante toca «Siguiente» y no pasa nada,
 * así que vuelve a tocar.
 *
 * Next lo muestra en cuanto empieza la navegación, por estar en un
 * `loading.tsx`. Repite el encabezado y la rejilla de tarjetas con los mismos
 * tamaños del listado real (ProductGrid ya trae su esqueleto), para que al
 * llegar el contenido nada salte de sitio.
 */
export function ListadoCargando() {
  return (
    <div className="flex flex-col" aria-busy="true">
      <section className="flex flex-col gap-6 px-6 pt-10 pb-6 sm:px-12 sm:pt-14 sm:pb-8">
        <div className="flex animate-pulse flex-col gap-3">
          <div className="bg-fondo-alt h-2.5 w-40 rounded-full" />
          <div className="bg-fondo-alt h-9 w-64 rounded-full sm:h-11" />
        </div>
      </section>
      <section className="px-6 pb-16 sm:px-12 sm:pb-24">
        <ProductGrid productos={[]} loading />
      </section>
    </div>
  );
}
