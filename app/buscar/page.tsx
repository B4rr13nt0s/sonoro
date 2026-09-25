import type { Metadata } from "next";

import { SearchExperience } from "@/components/catalog/SearchExperience";
import { listAllProducts } from "@/lib/catalog/index.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";

const TITULO = "Buscar";
const DESCRIPCION = "Busca en el catálogo de Sonoro por nombre, marca o código.";

export const metadata: Metadata = metadataPagina({
  titulo: TITULO,
  descripcion: DESCRIPCION,
  ruta: "/buscar",
});

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

  return (
    <SearchExperience
      productos={productos.map((producto) => ({
        sku: producto.sku,
        slug: producto.slug,
        nombre: producto.nombre,
        marca: producto.marca,
        categoria: producto.categoria,
        precioCents: producto.precioCents,
        disponibilidad: producto.disponibilidad,
        destacado: producto.destacado,
        imagenes: producto.imagenes,
        specsDestacadas: producto.specsDestacadas,
      }))}
    />
  );
}
