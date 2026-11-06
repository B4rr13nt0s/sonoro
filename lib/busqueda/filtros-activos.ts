// Los filtros de /buscar que el cliente eligió en las listas, y cómo se quitan
// (docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md, decisiones 10,
// 11 y 13). Lógica pura: la usan SearchExperience y la barra de filtros.
import type { Disponibilidad, Uso } from "../catalog/types.ts";
import { etiquetaCanales } from "./acotar.ts";

/** Los filtros vigentes de una búsqueda: los de la dirección que existen entre los resultados. */
export interface Filtros {
  categoria: string | null;
  medida: number | null;
  canales: number | null;
  marca: string | null;
  disp: Disponibilidad | null;
  uso: Uso | null;
}

export const DISPONIBILIDADES: Record<Disponibilidad, string> = {
  disponible: "Disponible",
  bajo_pedido: "Bajo pedido",
  agotado: "Agotado",
};

// La «categoría» de uso del libro (columna `categoria` de cada hoja): para qué
// va el producto. No es la categoría del sitio —esas son las píldoras—.
export const USOS_ETIQUETA: Record<Uso, string> = {
  carro: "Carro",
  marino: "Marino",
  motorsports: "Motorsports",
};

export const ORDENES = {
  relevancia: "Ordenar: relevancia",
  precio_asc: "Ordenar: menor precio",
  precio_desc: "Ordenar: mayor precio",
} as const;
export type Orden = keyof typeof ORDENES;

// Los valores de la dirección: lo que no se reconoce no filtra.
export function leerOrden(valor: string | null): Orden {
  return valor !== null && Object.hasOwn(ORDENES, valor) ? (valor as Orden) : "relevancia";
}

export function leerUso(valor: string | null): Uso | null {
  return valor !== null && Object.hasOwn(USOS_ETIQUETA, valor) ? (valor as Uso) : null;
}

export function leerDisponibilidad(valor: string | null): Disponibilidad | null {
  return valor !== null && Object.hasOwn(DISPONIBILIDADES, valor)
    ? (valor as Disponibilidad)
    : null;
}

/** Una medida o un número de canales de la URL: un número positivo, o nada. */
export function leerNumero(valor: string | null): number | null {
  const numero = Number(valor);
  return valor !== null && Number.isFinite(numero) && numero > 0 ? numero : null;
}

export type CampoActivo = "marca" | "medida" | "canales" | "disp" | "uso";

/**
 * Una píldora con ✕ por cada filtro elegido en una lista, en el orden de la
 * barra. El tipo de producto no entra: su píldora ya se ve en negro. La
 * categoría que salió de lo escrito («bocinas marino», `usoEscrito`) tampoco:
 * se quita borrándola del texto.
 */
export function filtrosActivos(
  filtros: Filtros,
  usoEscrito: boolean,
): { campo: CampoActivo; etiqueta: string }[] {
  const activos: { campo: CampoActivo; etiqueta: string }[] = [];
  if (filtros.marca) activos.push({ campo: "marca", etiqueta: filtros.marca });
  if (filtros.medida !== null) activos.push({ campo: "medida", etiqueta: `${filtros.medida}"` });
  if (filtros.canales !== null) {
    activos.push({ campo: "canales", etiqueta: etiquetaCanales(filtros.canales) });
  }
  if (filtros.disp) activos.push({ campo: "disp", etiqueta: DISPONIBILIDADES[filtros.disp] });
  if (filtros.uso && !usoEscrito)
    activos.push({ campo: "uso", etiqueta: USOS_ETIQUETA[filtros.uso] });
  return activos;
}

/** «Quitar filtros»: todo a «todos». Lo escrito y el orden no son filtros: quedan. */
export const SIN_FILTROS: { [K in keyof Filtros]: null } = {
  categoria: null,
  medida: null,
  canales: null,
  marca: null,
  disp: null,
  uso: null,
};
