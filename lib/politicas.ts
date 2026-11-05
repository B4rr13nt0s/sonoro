// Textos de política confirmados por el negocio, en UN solo lugar. Los leen
// las páginas legales, llms.txt y el chatbot: si el negocio cambia una
// condición, cambia acá y las tres superficies dicen lo mismo. Lo que NO está
// definido (plazo de garantía, qué es una instalación compleja, precios de
// instalación) no tiene constante: CLAUDE.md § Decisiones abiertas.
import { UMBRAL_ENVIO_GRATIS_CENTS } from "./cart/envio.ts";
import { formatQ } from "./format/precio.ts";

export const ENVIO_SALVEDAD = "Aplican restricciones según destino y volumen del pedido.";

/** CLAUDE.md regla 7: la frase pública de envíos, siempre con su salvedad. */
export const ENVIO_PUBLICO = `Envíos gratis a todo el país. ${ENVIO_SALVEDAD}`;

/**
 * Primer párrafo de «Envíos» de /legal/terminos. El monto sale del umbral que
 * decide `envioGratis()`, no de un literal.
 */
export const ENVIOS = `Envíos gratis a todo el país en pedidos con un total mayor a ${formatQ(UMBRAL_ENVIO_GRATIS_CENTS)}; en pedidos de ${formatQ(UMBRAL_ENVIO_GRATIS_CENTS)} o menos, el envío es por cobrar. ${ENVIO_SALVEDAD}`;

/** La frase de la ficha de producto. /legal/terminos conserva la suya. */
export const TIEMPO_ENTREGA = "El tiempo de entrega varía según el departamento.";

/** CLAUDE.md regla 6. */
export const CUOTAS = "Hasta 6 pagos precio contado.";

export const CUOTAS_CONDICIONES =
  "Las condiciones de pago se acuerdan directamente con Sonoro al confirmar el pedido por WhatsApp.";

/**
 * La frase de instalación, en un solo lugar (CLAUDE.md regla 1): el párrafo
 * «Instalación» de /legal/terminos, la respuesta de instalación del chat y el
 * final de los resultados del selector de vehículos de /buscar. Texto del
 * negocio, palabra por palabra (noviembre de 2026).
 */
export const INSTALACION =
  "Incluye instalación básica. En caso de que la instalación requiera una instalación más compleja, el uso de accesorios o componentes adicionales, dichos artículos se cobrarán por aparte y la instalación tendrá un costo adicional.";

/** CLAUDE.md regla 4. */
export const GARANTIA_ALCANCE = "La garantía de Sonoro cubre únicamente desperfectos de fábrica.";

/** Primer párrafo de «Qué anula la garantía» de /legal/garantias. */
export const GARANTIA_ANULA =
  "La garantía se pierde si hay evidencia de mal uso del producto, o de una instalación incorrecta hecha fuera de Sonoro.";

/** Primer párrafo de «Cómo funciona un pedido» de /legal/terminos. */
export const COMO_PEDIR =
  "Agregas productos al carrito, revisas el resumen en /carrito y presionas «Pedir por WhatsApp». Eso abre una conversación de WhatsApp con el pedido ya redactado — el pedido se confirma en esa conversación con Sonoro, no al presionar el botón.";

/** CLAUDE.md regla 3. */
export const SIN_PAGO_EN_LINEA = "No hay pago en línea.";
