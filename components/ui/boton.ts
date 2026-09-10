// Las dos variantes de botón de acción del sistema: negro relleno para la
// acción principal, contorno para la secundaria — el mismo par que ya usan
// las píldoras de filtro (seleccionada en negro, el resto con
// `border-borde-pildora`), en tamaño de botón.
//
// Vive en un archivo compartido porque en la ficha de producto las dos
// variantes SE INTERCAMBIAN: normalmente «Agregar al carrito» es la
// principal, pero con el producto agotado pasa a serlo «Consultar por
// WhatsApp». Con las clases escritas dentro de cada componente, los dos
// botones podrían derivar y quedar de distinto alto o distinta forma justo
// cuando se intercambian.
//
// No lleva borde en la principal a propósito: los dos botones van dentro de
// un `flex`, que por defecto los estira a la misma altura, así que el borde
// del secundario no descuadra nada y la principal conserva exactamente las
// medidas del handoff (padding 15px, radio 999px).
export type VarianteBoton = "principal" | "secundario";

const BASE =
  "flex-1 cursor-pointer rounded-full px-6 py-3.75 text-center text-[16px] transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-95";

export function claseBoton(variante: VarianteBoton): string {
  return variante === "principal"
    ? `${BASE} bg-negro text-white`
    : `${BASE} border-borde-pildora text-negro border bg-white`;
}
