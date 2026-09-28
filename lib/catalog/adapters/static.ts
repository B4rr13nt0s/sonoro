// Adaptador estático: lee data/catalog.json y data/brands.json del disco.
// Implementa CatalogAdapter (lib/catalog/types.ts) — es una de varias fuentes
// posibles, no LA fuente. lib/catalog/index.ts es el único lugar que sabe
// cuál adaptador está activo.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { perteneceACategoria } from "../categorias.ts";
import { compararPrecioAsc, compararPrecioDesc, compararRelevancia } from "../orden.ts";
import { PAGE_SIZE_DEFECTO } from "../paginacion.ts";
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

// Cache en memoria del proceso: los JSON de data/ los regenera
// scripts/import-catalog.ts como paso de build, no cambian mientras el
// proceso corre. Evita releer y re-validar el archivo en cada llamada.
//
// Lo que se guarda es la PROMESA, para que dos llamadas simultáneas no lean
// el archivo dos veces — y por eso una lectura que falla se olvida: si se
// quedara guardada rechazada, un error pasajero (EMFILE bajo carga) tumbaría
// todas las páginas de esa instancia hasta que se reinicie.
function enCache<T>(cargar: () => Promise<T>): () => Promise<T> {
  let cache: Promise<T> | null = null;
  return () => {
    if (!cache) {
      cache = cargar().catch((error: unknown) => {
        cache = null;
        throw error;
      });
    }
    return cache;
  };
}

async function leerJson(ruta: string): Promise<unknown> {
  return JSON.parse(await readFile(ruta, "utf-8"));
}

const cargarProductos = enCache(async () => CatalogoSchema.parse(await leerJson(RUTA_CATALOG)));
const cargarBrands = enCache(async () => BrandsSchema.parse(await leerJson(RUTA_BRANDS)));
const cargarCategorias = enCache(async () => CategoriasSchema.parse(await leerJson(RUTA_TAXONOMY)));

async function getProduct(slug: string): Promise<Producto | null> {
  const productos = await cargarProductos();
  return productos.find((p) => p.slug === slug) ?? null;
}

async function listProducts(
  filters: ProductFilters,
): Promise<{ items: Producto[]; total: number; page: number; pageSize: number }> {
  const productos = await cargarProductos();

  const filtrados = productos.filter((p) => {
    if (filters.categoria !== undefined && !perteneceACategoria(p, filters.categoria)) {
      return false;
    }
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
  if (filters.orden === "relevancia") {
    filtrados.sort(compararRelevancia);
  } else if (filters.orden === "precio_asc") {
    filtrados.sort(compararPrecioAsc);
  } else if (filters.orden === "precio_desc") {
    filtrados.sort(compararPrecioDesc);
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
