// docs/PLAN.md § Fase 7: sitemap.xml generado desde el catálogo. Excluye
// /carrito (privado, sesión/localStorage) y /styleguide (herramienta
// interna, no es una ruta de CLAUDE.md § Rutas).
import type { MetadataRoute } from "next";

import { listAllProducts, listBrands, listCategories } from "@/lib/catalog/index.ts";
import { absoluteUrl } from "@/lib/seo/site.ts";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [productos, marcas, categorias] = await Promise.all([
    listAllProducts(),
    listBrands(),
    listCategories(),
  ]);

  const estaticas: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/marcas"), changeFrequency: "weekly", priority: 0.6 },
    { url: absoluteUrl("/nosotros"), changeFrequency: "yearly", priority: 0.3 },
    { url: absoluteUrl("/buscar"), changeFrequency: "monthly", priority: 0.3 },
    { url: absoluteUrl("/legal/terminos"), changeFrequency: "yearly", priority: 0.1 },
    { url: absoluteUrl("/legal/privacidad"), changeFrequency: "yearly", priority: 0.1 },
    { url: absoluteUrl("/legal/garantias"), changeFrequency: "yearly", priority: 0.1 },
  ];

  const categoriaEntries: MetadataRoute.Sitemap = categorias.map((categoria) => ({
    url: absoluteUrl(`/catalogo/${categoria.slug}`),
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const marcaEntries: MetadataRoute.Sitemap = marcas.map((marca) => ({
    url: absoluteUrl(`/marcas/${marca.slug}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  // activo === false: la fila nunca se borra (CLAUDE.md § Mantenimiento del
  // catálogo), pero no debe seguir apareciendo en el sitemap — proxy.ts ya
  // fuerza 410 en esas URLs.
  const productoEntries: MetadataRoute.Sitemap = productos
    .filter((producto) => producto.activo)
    .map((producto) => ({
      url: absoluteUrl(`/producto/${producto.slug}`),
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  return [...estaticas, ...categoriaEntries, ...marcaEntries, ...productoEntries];
}
