// CLAUDE.md § Modelo de conversión: "El número va en
// NEXT_PUBLIC_WHATSAPP_NUMBER. Nunca incrustado en el código." — por eso
// esta función RECIBE el número en vez de leer process.env ella misma:
// mantiene lib/whatsapp puro y testeable sin variables de entorno, y quien
// la llama (un Client Component) es quien de verdad tiene acceso a
// NEXT_PUBLIC_*.
export function buildWhatsAppUrl(numero: string, mensaje: string): string {
  const soloDigitos = numero.replace(/\D/g, "");
  return `https://wa.me/${soloDigitos}?text=${encodeURIComponent(mensaje)}`;
}
