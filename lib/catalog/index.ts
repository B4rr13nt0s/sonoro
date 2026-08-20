// Única puerta de entrada al catálogo (CLAUDE.md § Fuente de verdad).
//
// Ningún componente importa data/catalog.json ni lib/catalog/adapters/*
// directamente — todo pasa por aquí. Cambiar de fuente de datos (una API
// remota, por ejemplo) es cambiar el adaptador de esta línea; ningún
// componente se entera, porque las firmas ya son asíncronas y paginadas.
import { staticAdapter } from "./adapters/static.ts";
import type { CatalogAdapter } from "./types.ts";

const adapter: CatalogAdapter = staticAdapter;

export const getProduct = adapter.getProduct;
export const listProducts = adapter.listProducts;
export const listBrands = adapter.listBrands;

export type {
  Brand,
  Disponibilidad,
  Imagen,
  Moneda,
  Producto,
  ProductFilters,
  Spec,
} from "./types.ts";
