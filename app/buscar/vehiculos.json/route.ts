import { listAllProducts } from "@/lib/catalog/index.ts";
import { leerVehiculos } from "@/lib/vehiculos/archivo.ts";
import { armarDatosVehiculos } from "@/lib/vehiculos/datos.ts";

// Los datos del selector de vehículos de /buscar: los vehículos publicados
// (data/vehiculos.json) y los receptores, bocinas y piezas que pueden salir.
// Se genera en el build, como /chat/catalogo.json: vehículos y catálogo son
// estáticos entre deploys, así que cada visitante recibe un archivo ya hecho.
// Desde Next 15 un GET no se cachea si no se pide.
//
// /buscar lo baja solo cuando no hay nada escrito, que es cuando se ve el
// selector. Es público pero no es una página: noindex, y sin entrada en el
// sitemap. Tampoco va en el Disallow de robots.ts: así Google puede leer el
// noindex.
export const dynamic = "force-static";

export async function GET() {
  const [vehiculos, productos] = await Promise.all([leerVehiculos(), listAllProducts()]);
  return Response.json(armarDatosVehiculos(vehiculos, productos), {
    headers: { "X-Robots-Tag": "noindex" },
  });
}
