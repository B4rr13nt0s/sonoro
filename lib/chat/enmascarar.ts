// Oculta los números de teléfono antes de que lo escrito en el chat llegue al
// registro anónimo (spec § Registro). El chat no pide nombre ni teléfono, pero
// el cliente puede escribir el suyo; no queremos guardarlo.
//
// Regla: toda tira de 7 o más dígitos, ignorando espacios y guiones entre
// ellos, se vuelve «•••••••». Es deliberadamente simple: «12», «3000» y
// «1,000 W» pasan intactos (la coma corta la tira), igual que «SQ12-D2» (la
// letra la corta). Un número de siete dígitos o más que no sea teléfono
// también se oculta: se prefiere perder un dato de búsqueda a guardar un
// teléfono.
//
// Corre en el navegador antes de enviar y OTRA VEZ en el servidor
// (lib/chatLog/decide.ts): el servidor no confía en lo que mande el cliente.

const TIRA_DE_DIGITOS = /\d(?:[\s-]*\d){6,}/g;

export function enmascarar(texto: string): string {
  return texto.replace(TIRA_DE_DIGITOS, "•••••••");
}
