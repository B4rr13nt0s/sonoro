// Oculta los números de teléfono antes de que lo escrito en el chat llegue al
// registro anónimo (spec § Registro). El chat no pide nombre ni teléfono, pero
// el cliente puede escribir el suyo; no queremos guardarlo.
//
// Regla: toda tira de 7 o más dígitos, ignorando lo que suele ir ENTRE los
// dígitos de un teléfono —espacios (también el no separable), puntos,
// paréntesis, guiones de cualquier largo (el «-» del teclado y la raya «–» que
// pone un procesador de texto al pegar), barra, guion bajo, punto medio y los
// caracteres de ancho cero que algunos teclados insertan— (y un «(» antes del
// primero), se vuelve «•••••••». Los dígitos son cualquier \p{Nd}: «５２９５»
// de ancho completo o los arábigos «٥٢٩٥» tampoco pasan. Es deliberadamente
// simple: «12», «3000» y «1,000 W» pasan intactos (la coma corta la tira),
// igual que «SQ12-D2» (la letra la corta). Costo aceptado: 7 o más dígitos
// partidos por separadores (p. ej. «sub 12 4 3000» o un rango de años como
// «2003-2018») también se ocultan. Un número de siete dígitos o más que no sea
// teléfono también se oculta: se prefiere perder un dato de búsqueda a guardar
// un teléfono. /legal/privacidad promete que se oculta un teléfono escrito: un
// formato que se cuela rompe esa promesa.
//
// Los separadores van como escapes (\u…) y no como caracteres: varios son
// invisibles y no se distinguen de un espacio al leer el archivo.
//
// Corre en el navegador antes de enviar y OTRA VEZ en el servidor
// (lib/chatLog/decide.ts): el servidor no confía en lo que mande el cliente.

const SEPARADORES_DE_TELEFONO =
  "\\s.()\\-" + // espacio (también el no separable), punto, paréntesis, guion
  "\\u2010-\\u2015\\u2212" + // guiones, rayas y signo menos
  "/_\\u00b7" + // barra, guion bajo, punto medio
  "\\u200b-\\u200d\\u2060\\ufeff"; // ancho cero

const TIRA_DE_DIGITOS = new RegExp(`\\(?\\p{Nd}(?:[${SEPARADORES_DE_TELEFONO}]*\\p{Nd}){6,}`, "gu");

export function enmascarar(texto: string): string {
  return texto.replace(TIRA_DE_DIGITOS, "•••••••");
}
