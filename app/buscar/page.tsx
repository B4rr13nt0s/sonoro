import type { Metadata } from "next";

import { SearchExperience } from "@/components/catalog/SearchExperience";
import { listAllProducts } from "@/lib/catalog/index.ts";

export const metadata: Metadata = {
  title: "Buscar — Sonoro",
  description: "Busca en el catálogo de Sonoro por nombre, marca o código.",
};

// CLAUDE.md § Rutas: /buscar existe como ruta, pero la búsqueda en sí es del
// lado del cliente sobre el catálogo estático — este Server Component solo
// trae el catálogo una vez (misma fuente que el resto del sitio, lib/catalog)
// y se lo pasa al Client Component; el filtrado, orden y "sin resultados"
// pasan en el navegador, sin ida y vuelta al servidor.
export default async function BuscarPage() {
  const productos = await listAllProducts();

  return <SearchExperience productos={productos} />;
}
