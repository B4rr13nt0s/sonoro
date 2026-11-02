// La bandera del chat: apagado salvo que NEXT_PUBLIC_CHAT_ENABLED valga
// exactamente «true». Cualquier otro valor (ausente, «TRUE», «1», vacío) lo
// deja apagado. Recibe el valor y no lee `process.env`, para probarse sin entorno.

export function chatHabilitado(valor: string | undefined): boolean {
  return valor === "true";
}
