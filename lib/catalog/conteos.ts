// Cuántos productos tiene cada listado, para que proxy.ts pueda responder 404
// ANTES de que la página empiece a transmitirse.
//
// Por qué hace falta: los cuatro listados tienen loading.tsx, y en cuanto se
// dibuja ese esqueleto las cabeceras ya salieron con 200. Un `notFound()`
// dentro de la página llega tarde: Next solo puede agregar un noindex al
// HTML, y `?page=99999` respondía 200 — un soft 404 para Search Console
// (node_modules/next/dist/docs, loading.md § Status Codes, que recomienda
// justamente esto: validar en proxy). Las páginas conservan su notFound()
// como respaldo.
//
// scripts/import-catalog.ts escribe el resultado en data/conteos.json, igual
// que inactive-slugs.json: el proxy corre en cada petición y no tiene por qué
// cargar el catálogo entero para saber un número.
//
// Lógica pura y sin disco: la importan el importador, proxy.ts y las pruebas.
import { perteneceACategoria } from "./categorias.ts";
import { PAGE_SIZE_DEFECTO, parsePagina } from "./paginacion.ts";

// `porFiltro` trae TODOS los slugs del filtro secundario, también los que dan
// 0: un 0 es un listado vacío legítimo (una marca sin productos en esa
// categoría, que el propio filtro ofrece), y la ausencia es un slug que no
// existe.
export type Conteo = { total: number; porFiltro: Record<string, number> };

export type Conteos = {
  /** /catalogo — filtro: slug de marca. */
  catalogo: Conteo;
  /** /productos (solo destacados) — filtro: slug de marca. */
  productos: Conteo;
  /** /catalogo/[categoria] — filtro: slug de marca. */
  categorias: Record<string, Conteo>;
  /** /marcas/[marca] — filtro: slug de categoría. */
  marcas: Record<string, Conteo>;
};

type ProductoContable = {
  marca: string;
  categoria: string;
  categoriasSecundarias?: readonly string[];
  destacado: boolean;
  activo: boolean;
};

type Entrada = { nombre: string; slug: string };

function contar<P>(
  productos: readonly P[],
  filtros: readonly Entrada[],
  cumple: (producto: P, nombre: string) => boolean,
): Conteo {
  return {
    total: productos.length,
    porFiltro: Object.fromEntries(
      filtros.map((filtro) => [
        filtro.slug,
        productos.filter((p) => cumple(p, filtro.nombre)).length,
      ]),
    ),
  };
}

const deMarca = (producto: ProductoContable, marca: string) => producto.marca === marca;

/** Solo cuenta activos: es lo único que muestran los listados. */
export function construirConteos(
  productos: readonly ProductoContable[],
  marcas: readonly Entrada[],
  categorias: readonly Entrada[],
): Conteos {
  const activos = productos.filter((p) => p.activo);

  return {
    catalogo: contar(activos, marcas, deMarca),
    productos: contar(
      activos.filter((p) => p.destacado),
      marcas,
      deMarca,
    ),
    categorias: Object.fromEntries(
      categorias.map((categoria) => [
        categoria.slug,
        contar(
          activos.filter((p) => perteneceACategoria(p, categoria.nombre)),
          marcas,
          deMarca,
        ),
      ]),
    ),
    marcas: Object.fromEntries(
      marcas.map((marca) => [
        marca.slug,
        contar(
          activos.filter((p) => deMarca(p, marca.nombre)),
          categorias,
          perteneceACategoria,
        ),
      ]),
    ),
  };
}

/**
 * Si la URL pide un listado que no existe: una categoría o marca de la ruta
 * que no está, un filtro (`?marca=`, `?categoria=`) con un slug que no
 * existe, o una página más allá de la última.
 *
 * `null` si la ruta no es un listado — no le toca decidir.
 *
 * Lee los query params igual que las páginas: el PRIMER valor (`get`), un
 * filtro vacío es «sin filtro», y la página pasa por el mismo parsePagina,
 * así que `?page=abc` es la 1 aquí y allá.
 */
export function listadoInexistente(
  conteos: Conteos,
  pathname: string,
  params: URLSearchParams,
  pageSize: number = PAGE_SIZE_DEFECTO,
): boolean | null {
  const resuelto = resolverListado(conteos, pathname);
  if (resuelto === null) return null;
  const { conteo, filtro } = resuelto;
  if (!conteo) return true;

  let total = conteo.total;
  const slugFiltro = params.get(filtro);
  if (slugFiltro) {
    // Object.hasOwn y no `in` ni un acceso directo: `?marca=constructor`
    // encontraría la función heredada de Object.prototype.
    if (!Object.hasOwn(conteo.porFiltro, slugFiltro)) return true;
    total = conteo.porFiltro[slugFiltro];
  }

  const paginas = Math.max(1, Math.ceil(total / pageSize));
  return parsePagina(params.get("page") ?? undefined) > paginas;
}

function resolverListado(
  conteos: Conteos,
  pathname: string,
): { conteo: Conteo | undefined; filtro: "marca" | "categoria" } | null {
  if (pathname === "/catalogo") return { conteo: conteos.catalogo, filtro: "marca" };
  if (pathname === "/productos") return { conteo: conteos.productos, filtro: "marca" };

  const [, seccion, slug] = pathname.match(/^\/(catalogo|marcas)\/([^/]+)$/) ?? [];
  if (seccion === "catalogo") {
    return { conteo: propio(conteos.categorias, slug), filtro: "marca" };
  }
  if (seccion === "marcas") {
    return { conteo: propio(conteos.marcas, slug), filtro: "categoria" };
  }
  return null;
}

function propio(registro: Record<string, Conteo>, clave: string): Conteo | undefined {
  return Object.hasOwn(registro, clave) ? registro[clave] : undefined;
}
