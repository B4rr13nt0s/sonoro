import { tarjetasBuscables } from "@/lib/catalog/buscables.ts";
import { listAllProducts, listBrands } from "@/lib/catalog/index.ts";

// El catálogo que baja el chat al primer clic del lanzador. Se genera en el
// build, como llms.txt y sitemap.xml: el catálogo es estático entre deploys,
// así que cada visitante recibe un archivo ya hecho y no una función. Desde
// Next 15 un GET no se cachea si no se pide.
//
// Lleva lo mismo que baja /buscar (tarjetasBuscables), no el Producto entero,
// más la ficha técnica de cada sku para contestar «¿cuántos watts tiene…?»:
// ~130 KB (~22 KB comprimidos) que /buscar no paga, porque este archivo solo
// se baja al abrir el chat.
export const dynamic = "force-static";

export async function GET() {
  const [productos, marcas] = await Promise.all([listAllProducts({ activo: true }), listBrands()]);

  return Response.json(
    {
      productos: tarjetasBuscables(productos),
      marcas: marcas.map((marca) => ({ nombre: marca.nombre, slug: marca.slug })),
      fichas: Object.fromEntries(productos.map((p) => [p.sku, p.specsFicha])),
    },
    // Es público y se genera aunque el chat esté apagado; no es una página
    // para el buscador.
    { headers: { "X-Robots-Tag": "noindex" } },
  );
}
