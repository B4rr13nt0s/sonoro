import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

const TITULO = "Aviso de privacidad — Sonoro";
const DESCRIPCION = "Qué información recopila Sonoro al usar el carrito y pedir por WhatsApp.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/legal/privacidad" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/legal/privacidad" },
};

export default function PrivacidadPage() {
  return (
    <LegalPage
      etiqueta="Legal"
      titulo="Aviso de privacidad"
      actualizado="Última actualización: 24 de agosto de 2026"
      secciones={[
        {
          titulo: "Qué información recopilamos",
          parrafos: [
            "El carrito de compras vive únicamente en tu navegador (localStorage) — no llega a Sonoro a menos que decidas enviarlo.",
            "Cuando presionas «Pedir por WhatsApp», se abre una conversación de WhatsApp con el pedido ya redactado; a partir de ahí, lo que escribes y tu número de WhatsApp los ve Sonoro como en cualquier conversación de WhatsApp.",
            "Guardamos un registro interno de las cotizaciones que se envían por WhatsApp — los productos cotizados, la referencia del pedido, el subtotal y datos técnicos básicos del navegador — para dar seguimiento a pedidos y entender qué se cotiza más.",
          ],
        },
        {
          titulo: "Qué no recopilamos",
          parrafos: [
            "El sitio no tiene pago en línea, así que no pedimos ni almacenamos datos de tarjeta ni de pago. Tampoco necesitas crear una cuenta ni contraseña para navegar el catálogo o armar una cotización.",
          ],
        },
        {
          titulo: "Cómo usamos tu información",
          parrafos: [
            "Para dar seguimiento a tu cotización, coordinar el pedido contigo por WhatsApp, y para entender qué productos se cotizan más y con qué frecuencia.",
          ],
        },
        {
          titulo: "Con quién se comparte",
          parrafos: [
            "La conversación de WhatsApp queda en la plataforma de WhatsApp/Meta, como cualquier otra conversación tuya en esa aplicación.",
            "El registro interno de cotizaciones se guarda en una hoja de cálculo de uso interno de Sonoro. No vendemos ni compartimos tu información con terceros de publicidad.",
          ],
        },
        {
          titulo: "Cuánto tiempo se conserva",
          parrafos: [
            "El carrito se conserva en tu navegador hasta que lo borres tú mismo. El registro interno de cotizaciones se conserva mientras sea útil para dar seguimiento a pedidos.",
          ],
        },
        {
          titulo: "Tus opciones",
          parrafos: [
            "Puedes borrar el carrito desde tu propio navegador en cualquier momento. Si quieres que eliminemos tu registro de una cotización específica, escríbenos por WhatsApp.",
          ],
        },
        {
          titulo: "Cambios a este aviso",
          parrafos: [
            "Este aviso puede actualizarse conforme cambie lo que el sitio hace con tu información. La fecha de la última actualización aparece al inicio de esta página.",
          ],
        },
      ]}
    />
  );
}
