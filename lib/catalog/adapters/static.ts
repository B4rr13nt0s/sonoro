// Adaptador estático: lee data/catalog.json y data/brands.json del disco.
// Implementa CatalogAdapter (lib/catalog/types.ts) — es una de varias fuentes
// posibles, no LA fuente. lib/catalog/index.ts es el único lugar que sabe
// cuál adaptador está activo.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  BrandsSchema,
  CatalogoSchema,
  CategoriasSchema,
  type Brand,
  type CatalogAdapter,
  type Categoria,
  type Producto,
  type ProductFilters,
} from "../types.ts";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const RUTA_CATALOG = path.join(RAIZ, "data", "catalog.json");
const RUTA_BRANDS = path.join(RAIZ, "data", "brands.json");
const RUTA_TAXONOMY = path.join(RAIZ, "data", "taxonomy.json");

const PAGE_SIZE_DEFECTO = 24;

// Cache en memoria del proceso: los JSON de data/ los regenera
// scripts/import-catalog.ts como paso de build, no cambian mientras el
// proceso corre. Evita releer y re-validar el archivo en cada llamada.
let productosCache: Promise<Producto[]> | null = null;
let brandsCache: Promise<Brand[]> | null = null;
let categoriasCache: Promise<Categoria[]> | null = null;

async function cargarProductos(): Promise<Producto[]> {
  if (!productosCache) {
    productosCache = readFile(RUTA_CATALOG, "utf-8").then((raw) =>
      CatalogoSchema.parse(JSON.parse(raw)),
    );
  }
  return productosCache;
}

async function cargarBrands(): Promise<Brand[]> {
  if (!brandsCache) {
    brandsCache = readFile(RUTA_BRANDS, "utf-8").then((raw) => BrandsSchema.parse(JSON.parse(raw)));
  }
  return brandsCache;
}

async function cargarCategorias(): Promise<Categoria[]> {
  if (!categoriasCache) {
    categoriasCache = readFile(RUTA_TAXONOMY, "utf-8").then((raw) =>
      CategoriasSchema.parse(JSON.parse(raw)),
    );
  }
  return categoriasCache;
}

async function getProduct(slug: string): Promise<Producto | null> {
  const productos = await cargarProductos();
  return productos.find((p) => p.slug === slug) ?? null;
}

async function listProducts(
  filters: ProductFilters,
): Promise<{ items: Producto[]; total: number; page: number; pageSize: number }> {
  const productos = await cargarProductos();

  const filtrados = productos.filter((p) => {
    if (filters.categoria !== undefined && p.categoria !== filters.categoria) return false;
    if (filters.marca !== undefined && p.marca !== filters.marca) return false;
    if (filters.disponibilidad !== undefined && p.disponibilidad !== filters.disponibilidad) {
      return false;
    }
    if (filters.destacado !== undefined && p.destacado !== filters.destacado) return false;
    if (filters.activo !== undefined && p.activo !== filters.activo) return false;
    if (filters.precioMinCents !== undefined && p.precioCents < filters.precioMinCents) {
      return false;
    }
    if (filters.precioMaxCents !== undefined && p.precioCents > filters.precioMaxCents) {
      return false;
    }
    return true;
  });

  // Sin `orden`, se conserva el orden del catálogo (ver nota en types.ts) —
  // no hay default aquí, cada llamador decide si le importa el orden.
  if (filters.orden === "precio_asc") {
    filtrados.sort((a, b) => a.precioCents - b.precioCents);
  } else if (filters.orden === "precio_desc") {
    filtrados.sort((a, b) => b.precioCents - a.precioCents);
  }

  const total = filtrados.length;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.max(1, filters.pageSize ?? PAGE_SIZE_DEFECTO);
  const inicio = (page - 1) * pageSize;
  const items = filtrados.slice(inicio, inicio + pageSize);

  return { items, total, page, pageSize };
}

async function listBrands(): Promise<Brand[]> {
  return cargarBrands();
}

async function listCategories(): Promise<Categoria[]> {
  return cargarCategorias();
}

export const staticAdapter: CatalogAdapter = {
  getProduct,
  listProducts,
  listBrands,
  listCategories,
};
