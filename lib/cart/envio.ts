// El envío gratis depende del total del pedido: más de Q 500.00. Debajo (o
// justo en) ese monto el envío es «Por cobrar». Vive acá, y no en el
// componente ni en el mensaje de WhatsApp, para que /carrito, el mensaje y el
// registro de pedidos digan siempre lo mismo.
export const UMBRAL_ENVIO_GRATIS_CENTS = 50000;

export const ENVIO_POR_COBRAR = "Por cobrar";

/** Estrictamente mayor al umbral: un pedido de exactamente Q 500.00 paga envío. */
export function envioGratis(subtotalCents: number): boolean {
  return subtotalCents > UMBRAL_ENVIO_GRATIS_CENTS;
}
