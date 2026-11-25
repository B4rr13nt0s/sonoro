// Cotizador privado: el borrador de la cotización que Byron está armando.
// Solo guarda LO QUE ELIGIÓ —sku y cantidad por línea, más el nombre del
// cliente—; el precio, el nombre y la disponibilidad se leen del catálogo en
// cada render (resolverBorrador), así que un borrador guardado nunca arrastra
// un precio viejo (docs/superpowers/specs/2026-11-16-cotizador-design.md).
//
// No toca el carrito: es un estado aparte, con su propia clave de
// sessionStorage (una cotización por pestaña; lo decide quien llama, componente
// Cotizador). El reductor es puro; leer y guardar reciben el almacén como
// argumento para probarlos sin navegador.
import { z } from "zod";

import type { ProductoBuscable } from "../busqueda/busqueda.ts";
import { MAX_CANTIDAD_POR_LINEA } from "../cart/types.ts";
import { MAX_CLIENTE, type LineaCotizacion } from "./mensaje.ts";

export type LineaBorrador = { sku: string; qty: number };
export type Borrador = {
  cliente: string;
  lineas: LineaBorrador[];
  /** La casilla «Mostrar precios»: apagada, las líneas del mensaje van sin precio. */
  mostrarPrecios: boolean;
  /** La casilla «Mostrar sólo SKU»: encendida, las líneas llevan el código y no el nombre. */
  soloSku: boolean;
  /** «Mostrar sólo precios individuales» (solo con los precios encendidos): líneas en viñeta con el precio unitario. */
  soloPrecioIndividual: boolean;
};

export const BORRADOR_VACIO: Borrador = {
  cliente: "",
  lineas: [],
  mostrarPrecios: true,
  soloSku: false,
  soloPrecioIndividual: false,
};

export type AccionBorrador =
  | { type: "agregar"; sku: string }
  | { type: "cantidad"; sku: string; qty: number }
  | { type: "quitar"; sku: string }
  | { type: "cliente"; texto: string }
  | { type: "precios"; mostrar: boolean }
  | { type: "soloSku"; activo: boolean }
  | { type: "soloPrecioIndividual"; activo: boolean }
  | { type: "vaciar" }
  | { type: "cargar"; borrador: Borrador };

const topar = (qty: number) => Math.min(qty, MAX_CANTIDAD_POR_LINEA);

export function borradorReducer(borrador: Borrador, accion: AccionBorrador): Borrador {
  switch (accion.type) {
    case "agregar": {
      const existe = borrador.lineas.some((l) => l.sku === accion.sku);
      const lineas = existe
        ? borrador.lineas.map((l) => (l.sku === accion.sku ? { ...l, qty: topar(l.qty + 1) } : l))
        : [...borrador.lineas, { sku: accion.sku, qty: 1 }];
      return { ...borrador, lineas };
    }
    case "cantidad": {
      // Sobre una línea que no existe no hace nada: los controles de cantidad
      // solo se dibujan en líneas que ya están.
      if (!borrador.lineas.some((l) => l.sku === accion.sku)) return borrador;
      if (accion.qty <= 0) {
        return { ...borrador, lineas: borrador.lineas.filter((l) => l.sku !== accion.sku) };
      }
      const qty = topar(accion.qty);
      return {
        ...borrador,
        lineas: borrador.lineas.map((l) => (l.sku === accion.sku ? { ...l, qty } : l)),
      };
    }
    case "quitar":
      return { ...borrador, lineas: borrador.lineas.filter((l) => l.sku !== accion.sku) };
    case "cliente":
      return { ...borrador, cliente: accion.texto.slice(0, MAX_CLIENTE) };
    case "precios":
      return { ...borrador, mostrarPrecios: accion.mostrar };
    case "soloSku":
      return { ...borrador, soloSku: accion.activo };
    case "soloPrecioIndividual":
      return { ...borrador, soloPrecioIndividual: accion.activo };
    case "vaciar":
      // Una cotización nueva: también vuelve a mostrar los precios y los nombres.
      return BORRADOR_VACIO;
    case "cargar":
      return accion.borrador;
  }
}

/** Lo mínimo del producto que necesita la cotización. */
export type ProductoCotizable = Pick<
  ProductoBuscable,
  "sku" | "nombre" | "precioCents" | "disponibilidad"
>;

/**
 * Las líneas con precio, nombre y disponibilidad del catálogo actual. Un sku
 * que ya no está (el navegador solo recibe los productos activos) o que se
 * agotó no es una línea: va a `quitados`, en el orden en que estaba.
 */
export function resolverBorrador(
  borrador: Borrador,
  catalogo: readonly ProductoCotizable[],
): { lineas: LineaCotizacion[]; quitados: string[] } {
  const porSku = new Map(catalogo.map((p) => [p.sku, p]));
  const lineas: LineaCotizacion[] = [];
  const quitados: string[] = [];
  for (const linea of borrador.lineas) {
    const producto = porSku.get(linea.sku);
    if (!producto || producto.disponibilidad === "agotado") {
      quitados.push(linea.sku);
      continue;
    }
    lineas.push({
      sku: producto.sku,
      nombre: producto.nombre,
      qty: linea.qty,
      unitPriceCents: producto.precioCents,
      disponibilidad: producto.disponibilidad,
    });
  }
  return { lineas, quitados };
}

export const CLAVE_BORRADOR = "sonoro:cotizador";

// Más líneas que productos a la venta (una por sku) no es una cotización: es
// un valor corrupto.
const MAX_LINEAS = 400;
const MAX_SKU = 64;

const BorradorSchema = z.object({
  cliente: z.string().max(MAX_CLIENTE),
  lineas: z
    .array(
      z.object({
        sku: z.string().max(MAX_SKU),
        qty: z.number().int().min(1).max(MAX_CANTIDAD_POR_LINEA),
      }),
    )
    .max(MAX_LINEAS),
  // Un borrador guardado antes de que existiera la casilla no trae el campo:
  // se lee como «mostrar», que es como se veía.
  mostrarPrecios: z.boolean().default(true),
  // Igual con la casilla del SKU: sin el campo se lee como «nombre completo».
  soloSku: z.boolean().default(false),
  // Y con la opción de solo precios individuales.
  soloPrecioIndividual: z.boolean().default(false),
});

/** Nunca lanza: modo privado, JSON corrupto o cantidades fuera de rango dan el borrador vacío. */
export function leerBorrador(almacen: Pick<Storage, "getItem"> | null): Borrador {
  try {
    const crudo = almacen?.getItem(CLAVE_BORRADOR);
    if (!crudo) return BORRADOR_VACIO;
    const resultado = BorradorSchema.safeParse(JSON.parse(crudo));
    return resultado.success ? resultado.data : BORRADOR_VACIO;
  } catch {
    return BORRADOR_VACIO;
  }
}

/** Nunca lanza: si el navegador no deja guardar, la cotización sigue en pantalla. */
export function guardarBorrador(
  almacen: Pick<Storage, "setItem"> | null,
  borrador: Borrador,
): void {
  try {
    almacen?.setItem(CLAVE_BORRADOR, JSON.stringify(borrador));
  } catch {
    // Sin persistencia no hay error que mostrar: se pierde solo la recarga.
  }
}
