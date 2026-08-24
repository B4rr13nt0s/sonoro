import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

const TITULO = "Términos y condiciones — Sonoro";
const DESCRIPCION = "Cómo funciona un pedido en Sonoro, precios, envíos y garantías.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/legal/terminos" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/legal/terminos" },
};

export default function TerminosPage() {
  return (
    <LegalPage
      etiqueta="Legal"
      titulo="Términos y condiciones"
      actualizado="Última actualización: 24 de agosto de 2026"
      secciones={[
        {
          titulo: "Qué es Sonoro",
          parrafos: [
            "Sonoro es un catálogo en línea de equipo de audio para carro en Guatemala. El sitio no procesa pagos: el pedido se arma en el carrito y se cierra directamente con Sonoro por WhatsApp.",
          ],
        },
        {
          titulo: "Cómo funciona un pedido",
          parrafos: [
            "Agregas productos al carrito, revisas el resumen en /carrito y presionas «Pedir por WhatsApp». Eso abre una conversación de WhatsApp con el pedido ya redactado — el pedido se confirma en esa conversación con Sonoro, no al presionar el botón.",
            "Los precios que ves en el sitio están en quetzales e incluyen IVA.",
          ],
        },
        {
          titulo: "Precios y disponibilidad",
          parrafos: [
            "Los precios y la disponibilidad mostrados en el sitio pueden cambiar sin previo aviso. El precio y la existencia que aplican son los que Sonoro confirma al momento de cerrar el pedido por WhatsApp.",
          ],
        },
        {
          titulo: "Pagos",
          parrafos: [
            "Hasta 6 pagos precio contado. Las condiciones de pago se acuerdan directamente con Sonoro al confirmar el pedido por WhatsApp.",
          ],
        },
        {
          titulo: "Envíos",
          parrafos: [
            "Envíos gratis a todo el país. Aplican restricciones según destino y volumen del pedido.",
            "El tiempo de entrega estimado es de 24 a 72 horas.",
          ],
        },
        {
          titulo: "Instalación",
          parrafos: [
            "Sonoro vende únicamente equipo. La instalación la hace el taller de tu preferencia.",
          ],
        },
        {
          titulo: "Garantías",
          parrafos: [
            "El alcance y las exclusiones de la garantía de fábrica están en /legal/garantias.",
          ],
        },
        {
          titulo: "Propiedad intelectual",
          parrafos: [
            "Las marcas, logotipos y nombres de fabricantes que aparecen en el catálogo pertenecen a sus respectivos dueños. El resto del contenido del sitio — textos, diseño y estructura del catálogo — es de Sonoro.",
          ],
        },
        {
          titulo: "Cambios a estos términos",
          parrafos: [
            "Sonoro puede actualizar estos términos en cualquier momento. La fecha de la última actualización aparece al inicio de esta página.",
          ],
        },
      ]}
    />
  );
}
