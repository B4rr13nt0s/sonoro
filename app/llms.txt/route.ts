import { listAllProducts, listBrands, listCategories } from "@/lib/catalog/index.ts";
import { buildLlmsTxt } from "@/lib/seo/llms.ts";

// Se genera en el build, como sitemap.xml: el catálogo es estático entre
// deploys. Desde Next 15 un GET no se cachea si no se pide.
export const dynamic = "force-static";

export async function GET() {
  const [categorias, marcas, productos] = await Promise.all([
    listCategories(),
    listBrands(),
    listAllProducts({ activo: true }),
  ]);

  return new Response(buildLlmsTxt({ categorias, marcas, totalProductos: productos.length }), {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
