// Única puerta de entrada al catálogo (CLAUDE.md § Fuente de verdad).
//
// Ningún componente importa data/catalog.json ni lib/catalog/adapters/*
// directamente — todo pasa por aquí. Cambiar de fuente de datos (una API
// remota, por ejemplo) es cambiar el adaptador de esta línea; ningún
// componente se entera, porque las firmas ya son asíncronas y paginadas.
// parseOrden/ORDEN_DEFECTO se re-exportan como VALORES (no tipos): las
// páginas de listado los usan para resolver el query param `orden`, y deben
// entrar por esta misma puerta, no importando types.ts a mano.
export { ORDEN_DEFECTO, parseOrden } from "./types.ts";

import { staticAdapter } from "./adapters/static.ts";
import type { CatalogAdapter, Producto, ProductFilters } from "./types.ts";

const adapter: CatalogAdapter = staticAdapter;

export const getProduct = adapter.getProduct;
export const listProducts = adapter.listProducts;
export const listBrands = adapter.listBrands;
export const listCategories = adapter.listCategories;

// Compuesto sobre listProducts, no un método de adaptador — agota todas las
// páginas y no asume que el catálogo cabe en un solo pageSize. Lo usan
// generateStaticParams (necesita cada producto, no solo la primera página) y
// /buscar (la búsqueda del lado del cliente necesita el catálogo completo en
// memoria del navegador, filtra ahí, no aquí).
//
// Pide primero TODO en una página: con el adaptador estático sale en una
// vuelta. (Con páginas de 24 hacía 14 llamadas por catálogo, y cada una
// volvía a filtrar los 320 productos, en cada página del sitio: app/layout.tsx
// la usa.) Si el adaptador topa el tamaño, las páginas siguientes se piden con
// el tamaño que él devolvió —el único con el que su desplazamiento cuadra—.
//
// Y si una página llega vacía antes de completar el total, LANZA: devolver
// una lista incompleta en silencio haría que reconcile() quitara del carrito
// todo lo que faltó como «ya no está a la venta», y que /buscar y
// generateStaticParams perdieran productos, sin ningún error a la vista.
export async function listAllProducts(
  filters: Omit<ProductFilters, "page" | "pageSize"> = {},
): Promise<Producto[]> {
  const primera = await listProducts({ ...filters, page: 1, pageSize: Number.MAX_SAFE_INTEGER });
  const productos = [...primera.items];
  for (let page = 2; productos.length < primera.total; page += 1) {
    const { items } = await listProducts({ ...filters, page, pageSize: primera.pageSize });
    if (items.length === 0) {
      throw new Error(
        `listAllProducts: la página ${page} llegó vacía con ${productos.length} de ` +
          `${primera.total} productos; el adaptador no cumple el contrato de paginación.`,
      );
    }
    productos.push(...items);
  }
  return productos;
}

export type {
  Brand,
  Categoria,
  Disponibilidad,
  Imagen,
  Moneda,
  Orden,
  Producto,
  ProductoTarjeta,
  ProductFilters,
  Spec,
} from "./types.ts";
export { parsePagina } from "./paginacion.ts";
export { marcasDelFiltro, nombreDeMarca, primeroDeQuery } from "./filtros.ts";
