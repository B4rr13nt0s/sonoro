// CLAUDE.md § Formato de precio. Única función de formato de precio del
// proyecto — la usan la UI, el mensaje de WhatsApp y las imágenes OG. Cero
// formateo inline en otro lado.

const NUMERO_ES_GT = new Intl.NumberFormat("es-GT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Espacio duro: U+00A0, no un espacio normal. Con espacio normal el
// navegador puede romper la línea entre el símbolo "Q" y la cifra.
const ESPACIO_DURO = "\u00A0";

// No usar `style: 'currency'`: la salida del símbolo de Intl varía entre
// versiones de ICU. Intl.NumberFormat solo formatea el número; el "Q" y el
// espacio duro se anteponen a mano.
export function formatQ(cents: number): string {
  return "Q" + ESPACIO_DURO + NUMERO_ES_GT.format(cents / 100);
}

// Cuotas: Math.ceil al centavo. Q 2,450.00 / 6 → Q 408.34 (nunca prometer una
// cuota menor a la real).
export function calcularCuotaCents(totalCents: number, pagos: number): number {
  return Math.ceil(totalCents / pagos);
}
