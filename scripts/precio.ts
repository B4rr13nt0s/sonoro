// Conversión de precio (texto, quetzales) a centavos enteros, por manipulación
// de cadena — nunca `parseFloat(x) * 100`. `parseFloat("1350.29") * 100` da
// `135028.99999999999` por imprecisión de punto flotante; con cientos de SKUs,
// alguno cae en ese caso. Aislada del importador para poder testearla sola.
export function precioACents(texto: string): number {
  const [entero, decimal = ""] = texto.split(".");

  if (!/^\d+$/.test(entero) || !/^\d{0,2}$/.test(decimal)) {
    throw new Error(`precioACents: "${texto}" no tiene forma de precio válida`);
  }

  const decimalRellenado = (decimal + "00").slice(0, 2);
  return parseInt(entero + decimalRellenado, 10);
}
