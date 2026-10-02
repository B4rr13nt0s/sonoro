import type { Metadata } from "next";
import { Suspense } from "react";

import { Busqueda, SearchExperience } from "@/components/catalog/SearchExperience";
import { clavesDeAtributos } from "@/components/catalog/busqueda.ts";
import { listAllProducts, listBrands } from "@/lib/catalog/index.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";
import { TEXTOS_BUSCAR } from "@/lib/seo/textos.ts";

export const metadata: Metadata = metadataPagina({ ...TEXTOS_BUSCAR, ruta: "/buscar" });

// CLAUDE.md § Rutas: /buscar existe como ruta, pero la búsqueda en sí es del
// lado del cliente sobre el catálogo estático — este Server Component solo
// trae el catálogo una vez (misma fuente que el resto del sitio, lib/catalog)
// y se lo pasa al Client Component; el filtrado, orden y "sin resultados"
// pasan en el navegador, sin ida y vuelta al servidor.
//
// Va acotado a ProductoTarjeta y no al producto entero: esto viaja a CADA
// visitante dentro del HTML, y `specsFicha` y `atributos` —ficha técnica y
// materia prima de los filtros— no se usan acá. Con el producto completo
// eran 452 KB por visita.
export default async function BuscarPage() {
  const productos = await listAllProducts({ activo: true });
  const tarjetas = productos.map((producto) => ({
    sku: producto.sku,
    slug: producto.slug,
    nombre: producto.nombre,
    marca: producto.marca,
    categoria: producto.categoria,
    // Para agrupar los Sistemas en sus categorías, como los listados.
    ...(producto.categoriasSecundarias
      ? { categoriasSecundarias: producto.categoriasSecundarias }
      : {}),
    precioCents: producto.precioCents,
    disponibilidad: producto.disponibilidad,
    destacado: producto.destacado,
    imagenes: producto.imagenes,
    specsDestacadas: producto.specsDestacadas,
    // Los atributos como palabras de búsqueda (`12"`, `4ohm`, `clase-d`…):
    // unas pocas por producto, en lugar de mandar `atributos` entero.
    claves: clavesDeAtributos(producto.atributos),
  }));
  const marcas = (await listBrands()).map((marca) => ({ nombre: marca.nombre, slug: marca.slug }));

  // Prerenderizada: la búsqueda lee `?q=` con useSearchParams, que no existe
  // al prerenderizar, así que SOLO ese bloque va en un <Suspense>. El HTML
  // estático trae el fallback —la misma búsqueda, vacía— y el navegador la
  // cambia por la de la URL al cargar. Sin el Suspense la página entera
  // tendría que armarse en cada visita, y es la más visitada después del
  // inicio: la ruta principal de navegación.
  return (
    <Suspense fallback={<Busqueda productos={tarjetas} marcas={marcas} busqueda="" />}>
      <SearchExperience productos={tarjetas} marcas={marcas} />
    </Suspense>
  );
}
