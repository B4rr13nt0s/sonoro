// Única puerta de entrada al catálogo (CLAUDE.md § Fuente de verdad).
//
// Ningún componente importa data/catalog.json ni lib/catalog/adapters/*
// directamente — todo pasa por aquí. Cambiar de fuente de datos (una API
// remota, por ejemplo) es cambiar el adaptador de esta línea; ningún
// componente se entera, porque las firmas ya son asíncronas y paginadas.
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
export async function listAllProducts(
  filters: Omit<ProductFilters, "page" | "pageSize"> = {},
): Promise<Producto[]> {
  const productos: Producto[] = [];
  let page = 1;
  for (;;) {
    const { items, total } = await listProducts({ ...filters, page });
    productos.push(...items);
    if (productos.length >= total) break;
    page += 1;
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
  ProductFilters,
  Spec,
} from "./types.ts";
