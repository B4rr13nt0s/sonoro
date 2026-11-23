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

// `mostrarPrecios` en false (la casilla «Mostrar precios individuales» del
// cotizador, apagada) deja la línea en cantidad y nombre: el cliente ve solo el
// total de abajo, útil para cotizar un paquete sin desglose. La marca de
// «bajo pedido» se queda, porque no es un precio.
export function lineaCotizacion(linea: LineaCotizacion, mostrarPrecios = true): string {
  const estado = marcaDisponibilidad(linea.disponibilidad);
  const marca = estado ? ` · ${estado}` : "";
  const producto = `${linea.qty}x ${nombreConCodigo(linea.nombre, linea.sku)}`;
  if (!mostrarPrecios) return `${producto}${marca}`;
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
}): string {
  const { lineas, mostrarPrecios = true } = params;
  if (lineas.length === 0) return "";

  const cliente = normalizarCliente(params.cliente);
  const total = lineas.reduce((suma, l) => suma + l.qty * l.unitPriceCents, 0);

  // El pie es solo el total: sin subtotal, sin línea de envío y sin la leyenda
  // del IVA (decisión de Byron, noviembre de 2026). El precio sigue siendo con
  // IVA; lo que ya no hace el mensaje es decirlo.
  return [
    cliente ? `Cotización Sonoro para ${cliente}:` : "Cotización Sonoro:",
    "",
    ...lineas.map((linea) => lineaCotizacion(linea, mostrarPrecios)),
    "",
    `Total: ${formatQ(total)}`,
  ].join("\n");
}
