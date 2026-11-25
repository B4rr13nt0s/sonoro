// Cotizador privado: el texto que Byron copia y pega en otro medio
// (docs/superpowers/specs/2026-11-16-cotizador-design.md § Mensaje).
//
// No es el pedido de WhatsApp: cada línea muestra cantidad, nombre, precio
// unitario Y total de la línea, y no lleva Ref ni se registra en la hoja. Por
// eso tiene su propia línea y no reusa `formatearLinea` (lib/whatsapp), que
// pone el sku entre paréntesis y el unitario solo si hay más de una unidad.
import { marcaDisponibilidad } from "../catalog/disponibilidad.ts";
import type { Disponibilidad } from "../catalog/types.ts";
import { formatQ } from "../format/precio.ts";

export type LineaCotizacion = {
  sku: string;
  nombre: string;
  qty: number;
  unitPriceCents: number;
  disponibilidad: Disponibilidad;
};

/** El nombre del cliente se corta acá: es una línea de encabezado, no un campo libre. */
export const MAX_CLIENTE = 80;

// En 308 de 327 productos el `nombre` del catálogo ya trae el código del
// fabricante («Subwoofer Champion Series 12" TS-W312D4»): repetirlo entre
// paréntesis sería ruido. En los demás se agrega al final, para que el cliente
// no se quede sin él.
function nombreConCodigo(nombre: string, sku: string): string {
  return nombre.toUpperCase().includes(sku.toUpperCase()) ? nombre : `${nombre} ${sku}`;
}

/** Las dos casillas del cotizador que cambian cómo se escribe cada línea. */
export type OpcionesLinea = {
  /** Por defecto `true`. En `false`, la línea no lleva precios. */
  mostrarPrecios?: boolean;
  /** Por defecto `false`. En `true`, la línea lleva el código (SKU) y no el nombre. */
  soloSku?: boolean;
  /**
   * Por defecto `false`. En `true` (y con precios), la línea es una viñeta con el
   * producto y su precio unitario, sin el total de la línea. Sin precios no hace nada.
   */
  soloPrecioIndividual?: boolean;
};

// `mostrarPrecios` en false (la casilla «Mostrar precios», apagada) deja la
// línea en cantidad y producto: el cliente ve solo el total de abajo, útil para
// cotizar un paquete sin desglose. `soloSku` en true (la casilla «Mostrar sólo
// SKU») escribe el código del fabricante en lugar del nombre: «1x PRXE12SFT».
// `soloPrecioIndividual` (la opción «Mostrar sólo precios individuales», que solo
// existe con los precios encendidos) cambia el formato a una viñeta con el
// precio unitario: «- PRXE12SFT — Q 3,995.00». Con más de una unidad la línea
// conserva la cantidad y dice «c/u» («- 2x PRX60C — Q 1,180.00 c/u»): sin ella
// el total de abajo no cuadraría con lo que se lee. La marca de «bajo pedido» se
// queda en todos los casos, porque no es un precio ni parte del nombre.
export function lineaCotizacion(
  linea: LineaCotizacion,
  { mostrarPrecios = true, soloSku = false, soloPrecioIndividual = false }: OpcionesLinea = {},
): string {
  const estado = marcaDisponibilidad(linea.disponibilidad);
  const marca = estado ? ` · ${estado}` : "";
  const nombre = soloSku ? linea.sku : nombreConCodigo(linea.nombre, linea.sku);
  const producto = `${linea.qty}x ${nombre}`;
  if (!mostrarPrecios) return `${producto}${marca}`;
  if (soloPrecioIndividual) {
    const varias = linea.qty > 1;
    const cantidad = varias ? `${linea.qty}x ` : "";
    return `- ${cantidad}${nombre} — ${formatQ(linea.unitPriceCents)}${varias ? " c/u" : ""}${marca}`;
  }
  const total = linea.qty * linea.unitPriceCents;
  return `${producto} — ${formatQ(linea.unitPriceCents)} c/u — ${formatQ(total)}${marca}`;
}

// Una sola línea y de largo acotado: un salto de línea en el campo «Cliente»
// no puede colar renglones propios dentro del mensaje.
function normalizarCliente(cliente: string): string {
  return cliente.replace(/\s+/g, " ").trim().slice(0, MAX_CLIENTE).trim();
}

/** `""` si no hay líneas: no hay nada que copiar. */
export function buildQuoteMessage(params: {
  cliente: string;
  lineas: readonly LineaCotizacion[];
  /** Por defecto `true`. En `false`, las líneas van sin precio y solo queda el total. */
  mostrarPrecios?: boolean;
  /** Por defecto `false`. En `true`, las líneas llevan el SKU en lugar del nombre. */
  soloSku?: boolean;
  /** Por defecto `false`. En `true`, las líneas son viñetas con solo el precio unitario. */
  soloPrecioIndividual?: boolean;
}): string {
  const { lineas, mostrarPrecios = true, soloSku = false, soloPrecioIndividual = false } = params;
  if (lineas.length === 0) return "";

  const cliente = normalizarCliente(params.cliente);
  const total = lineas.reduce((suma, l) => suma + l.qty * l.unitPriceCents, 0);

  // El pie es solo el total: sin subtotal, sin línea de envío y sin la leyenda
  // del IVA (decisión de Byron, noviembre de 2026). El precio sigue siendo con
  // IVA; lo que ya no hace el mensaje es decirlo.
  return [
    cliente ? `Cotización Sonoro para ${cliente}:` : "Cotización Sonoro:",
    "",
    ...lineas.map((linea) =>
      lineaCotizacion(linea, { mostrarPrecios, soloSku, soloPrecioIndividual }),
    ),
    "",
    `Total: ${formatQ(total)}`,
  ].join("\n");
}
