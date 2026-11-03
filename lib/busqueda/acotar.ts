// Acotar una búsqueda amplia con lo que traen sus propios resultados:
// categoría, medida o canales, marca y tramos de precio. Lógica pura, como
// busqueda.ts, para probarla con `node --test` y compartirla entre el chat y
// /buscar. Los botones salen SOLO de los datos de los resultados: nada de «lo
// más vendido» ni «recomendado» (CLAUDE.md § reglas 2).
import { CATEGORIAS_SITIO, perteneceACategoria } from "../catalog/categorias.ts";
import { ordenarMarcas } from "../catalog/marcas.ts";
import { formatQ } from "../format/precio.ts";
import type { ProductoBuscable } from "./busqueda.ts";

/** Lo que se eligió para acotar. El precio va en centavos; `min` no incluye, `max` sí. */
export type Acote =
  | { campo: "categoria"; slug: string }
  | { campo: "medida"; pulgadas: number }
  | { campo: "canales"; canales: number }
  | { campo: "marca"; slug: string }
  | { campo: "precio"; min?: number; max?: number };

export interface OpcionAcote {
  acote: Acote;
  etiqueta: string;
  cantidad: number;
}

export interface GrupoAcote {
  campo: Acote["campo"];
  titulo: string;
  opciones: OpcionAcote[];
}

type Marca = { nombre: string; slug: string };

/** Más de esto en un grupo no cabe en una fila del chat: van los que más productos tienen. */
export const MAX_OPCIONES_POR_GRUPO = 6;

/** Con menos resultados, partir en tercios deja tramos de uno o dos productos. */
const MIN_PARA_PRECIO = 6;

export function etiquetaCanales(canales: number): string {
  return `${canales} ${canales === 1 ? "canal" : "canales"}`;
}

function etiquetaPrecio(min: number | undefined, max: number | undefined): string {
  if (min === undefined) return `Hasta ${formatQ(max ?? 0)}`;
  if (max === undefined) return `Más de ${formatQ(min)}`;
  return `${formatQ(min)} a ${formatQ(max)}`;
}

function cumple(producto: ProductoBuscable, acote: Acote, marcas: readonly Marca[]): boolean {
  switch (acote.campo) {
    case "categoria": {
      const categoria = CATEGORIAS_SITIO.find((c) => c.slug === acote.slug);
      return !!categoria && perteneceACategoria(producto, categoria.nombre);
    }
    case "medida":
      return producto.pulgadas === acote.pulgadas;
    case "canales":
      return producto.canales === acote.canales;
    case "marca":
      return marcas.find((m) => m.slug === acote.slug)?.nombre === producto.marca;
    case "precio":
      return (
        (acote.min === undefined || producto.precioCents > acote.min) &&
        (acote.max === undefined || producto.precioCents <= acote.max)
      );
  }
}

/** Los productos que cumplen todos los acotes. */
export function aplicarAcotes(
  productos: readonly ProductoBuscable[],
  acotes: readonly Acote[],
  marcas: readonly Marca[],
): ProductoBuscable[] {
  return productos.filter((p) => acotes.every((a) => cumple(p, a, marcas)));
}

/** Un acote dicho en palabras, para «Filtros de tu búsqueda: …». */
export function describirAcote(acote: Acote, marcas: readonly Marca[]): string {
  switch (acote.campo) {
    case "categoria":
      return CATEGORIAS_SITIO.find((c) => c.slug === acote.slug)?.nombre ?? acote.slug;
    case "medida":
      return `${acote.pulgadas}"`;
    case "canales":
      return etiquetaCanales(acote.canales);
    case "marca":
      return marcas.find((m) => m.slug === acote.slug)?.nombre ?? acote.slug;
    case "precio":
      return acote.min === undefined
        ? `Precio hasta ${formatQ(acote.max ?? 0)}`
        : acote.max === undefined
          ? `Precio más de ${formatQ(acote.min)}`
          : `Precio de ${formatQ(acote.min)} a ${formatQ(acote.max)}`;
  }
}

/** Cuenta los valores de un número y se queda con los `max` que más productos tienen, de menor a mayor. */
function valoresMasComunes(
  numeros: readonly (number | undefined)[],
  max: number,
): [number, number][] {
  const conteo = new Map<number, number>();
  for (const n of numeros) if (n !== undefined) conteo.set(n, (conteo.get(n) ?? 0) + 1);
  return [...conteo.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, max)
    .sort((a, b) => a[0] - b[0]);
}

/** Las medidas de los resultados, con cuántos hay de cada una (para el selector de /buscar). */
export function medidasDe(
  productos: readonly ProductoBuscable[],
  max = MAX_OPCIONES_POR_GRUPO,
): [number, number][] {
  return valoresMasComunes(
    productos.map((p) => p.pulgadas),
    max,
  );
}

/** Los canales de los resultados, con cuántos hay de cada uno. */
export function canalesDe(
  productos: readonly ProductoBuscable[],
  max = MAX_OPCIONES_POR_GRUPO,
): [number, number][] {
  return valoresMasComunes(
    productos.map((p) => p.canales),
    max,
  );
}

/**
 * Tres tramos que parten los resultados en tercios por precio. Los límites
 * son precios REALES de esos productos —el del tercio y el de los dos
 * tercios—, no montos redondos inventados. Un tramo vacío no se ofrece.
 */
function tramosDePrecio(productos: readonly ProductoBuscable[]): OpcionAcote[] {
  if (productos.length < MIN_PARA_PRECIO) return [];
  const precios = productos.map((p) => p.precioCents).sort((a, b) => a - b);
  const primero = precios[Math.floor(precios.length / 3) - 1];
  const segundo = precios[Math.floor((precios.length * 2) / 3) - 1];
  const tramos: { min?: number; max?: number }[] =
    primero < segundo
      ? [{ max: primero }, { min: primero, max: segundo }, { min: segundo }]
      : [{ max: primero }, { min: primero }];
  const opciones: OpcionAcote[] = [];
  for (const { min, max } of tramos) {
    const acote: Acote = {
      campo: "precio",
      ...(min !== undefined ? { min } : {}),
      ...(max !== undefined ? { max } : {}),
    };
    const cantidad = productos.filter((p) => cumple(p, acote, [])).length;
    if (cantidad > 0) opciones.push({ acote, etiqueta: etiquetaPrecio(min, max), cantidad });
  }
  return opciones.length >= 2 ? opciones : [];
}

/**
 * Los grupos para acotar `productos`, en orden: categoría, medida, canales,
 * marca, precio. Un grupo sale solo con dos valores o más: un botón que no
 * cambia nada no acota. Los campos de `elegidos` ya se acotaron y no vuelven.
 */
export function gruposDeAcote(
  productos: readonly ProductoBuscable[],
  marcas: readonly Marca[],
  elegidos: readonly Acote["campo"][] = [],
): GrupoAcote[] {
  const grupos: GrupoAcote[] = [];
  const agregar = (campo: Acote["campo"], titulo: string, opciones: OpcionAcote[]) => {
    if (!elegidos.includes(campo) && opciones.length >= 2) grupos.push({ campo, titulo, opciones });
  };

  // Las categorías del sitio, en el orden del nav: un Sistema cuenta en sus
  // secundarias, como en los listados, y «Sistemas» no es opción.
  agregar(
    "categoria",
    "Categoría",
    CATEGORIAS_SITIO.map((c) => ({
      acote: { campo: "categoria" as const, slug: c.slug },
      etiqueta: c.nombre,
      cantidad: productos.filter((p) => perteneceACategoria(p, c.nombre)).length,
    }))
      .filter((o) => o.cantidad > 0)
      .sort((a, b) => b.cantidad - a.cantidad)
      .slice(0, MAX_OPCIONES_POR_GRUPO),
  );

  agregar(
    "medida",
    "Medida",
    medidasDe(productos).map(([pulgadas, cantidad]) => ({
      acote: { campo: "medida", pulgadas },
      etiqueta: `${pulgadas}"`,
      cantidad,
    })),
  );

  agregar(
    "canales",
    "Canales",
    canalesDe(productos).map(([canales, cantidad]) => ({
      acote: { campo: "canales", canales },
      etiqueta: etiquetaCanales(canales),
      cantidad,
    })),
  );

  const porMarca = new Map<string, number>();
  for (const p of productos) porMarca.set(p.marca, (porMarca.get(p.marca) ?? 0) + 1);
  const masComunes = marcas
    .filter((m) => porMarca.has(m.nombre))
    .sort((a, b) => (porMarca.get(b.nombre) ?? 0) - (porMarca.get(a.nombre) ?? 0))
    .slice(0, MAX_OPCIONES_POR_GRUPO);
  agregar(
    "marca",
    "Marca",
    ordenarMarcas(masComunes).map((m) => ({
      acote: { campo: "marca", slug: m.slug },
      etiqueta: m.nombre,
      cantidad: porMarca.get(m.nombre) ?? 0,
    })),
  );

  agregar("precio", "Precio", tramosDePrecio(productos));
  return grupos;
}

/** El id de opción del chat para un acote: `acotar:medida:12`, `acotar:precio:149500-319500`. */
export function idDeAcote(acote: Acote): `acotar:${string}` {
  switch (acote.campo) {
    case "categoria":
    case "marca":
      return `acotar:${acote.campo}:${acote.slug}`;
    case "medida":
      return `acotar:medida:${acote.pulgadas}`;
    case "canales":
      return `acotar:canales:${acote.canales}`;
    case "precio":
      return `acotar:precio:${acote.min ?? ""}-${acote.max ?? ""}`;
  }
}

/** Lo contrario de `idDeAcote`; `null` si el id no es uno. */
export function acoteDeId(id: string): Acote | null {
  const m = /^acotar:(categoria|marca|medida|canales|precio):(.+)$/.exec(id);
  if (!m) return null;
  const [, campo, valor] = m;
  if (campo === "categoria" || campo === "marca") return { campo, slug: valor };
  if (campo === "precio") {
    const r = /^(\d*)-(\d*)$/.exec(valor);
    if (!r || (!r[1] && !r[2])) return null;
    return {
      campo,
      ...(r[1] ? { min: Number(r[1]) } : {}),
      ...(r[2] ? { max: Number(r[2]) } : {}),
    };
  }
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return null;
  return campo === "medida" ? { campo, pulgadas: n } : { campo: "canales", canales: n };
}

/**
 * El enlace a /buscar con lo mismo acotado: categoría, marca y medida o
 * canales como parámetros; el precio como texto que la búsqueda ya entiende
 * («más de 1495 hasta 3195»).
 */
export function hrefAcotado(
  visible: string,
  acotes: readonly Acote[],
  marcas: readonly Marca[],
): string {
  const params = new URLSearchParams();
  let q = visible;
  for (const a of acotes) {
    if (a.campo === "precio") {
      const partes = [
        a.min !== undefined ? `mas de ${a.min / 100}` : "",
        a.max !== undefined ? `hasta ${a.max / 100}` : "",
      ].filter(Boolean);
      q = `${q} ${partes.join(" ")}`;
    }
  }
  params.set("q", q);
  for (const a of acotes) {
    if (a.campo === "categoria") params.set("categoria", describirAcote(a, marcas));
    if (a.campo === "marca") params.set("marca", describirAcote(a, marcas));
    if (a.campo === "medida") params.set("medida", String(a.pulgadas));
    if (a.campo === "canales") params.set("canales", String(a.canales));
  }
  return `/buscar?${params}`;
}
