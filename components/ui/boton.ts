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

// El tamaño es un eje aparte de la variante, con valor por defecto para no
// tocar los usos que ya existen. "compacto" existe para las columnas de la
// tabla comparativa, que en móvil miden 132px: con el padding y el cuerpo de
// 16px del tamaño normal, «Consultar por WhatsApp» envuelve a tres líneas y
// los dos botones de una misma columna quedan de distinto alto.
export type TamanoBoton = "normal" | "compacto";

const BASE =
  "flex-1 cursor-pointer rounded-full text-center transition-transform duration-150 ease-out hover:scale-[1.02] active:scale-95";

const TAMANOS: Record<TamanoBoton, string> = {
  normal: "px-6 py-3.75 text-[16px]",
  compacto: "px-3 py-2.5 text-[13px]",
};

export function claseBoton(variante: VarianteBoton, tamano: TamanoBoton = "normal"): string {
  const base = `${BASE} ${TAMANOS[tamano]}`;
  return variante === "principal"
    ? `${base} bg-negro text-white`
    : `${base} border-borde-pildora text-negro border bg-white`;
}
