"use client";

// Consulta por un producto puntual, sin pasar por el carrito. Igual que
// AddToCartButton, es un Client Component aislado para no volver cliente la
// ficha entera (app/producto/[slug]/page.tsx es Server Component): lo único
// que necesita del navegador es disparar el evento de analítica al hacer
// clic — el <a> navega solo.
import { trackEvent } from "@/lib/analytics/track.ts";
import type { Producto } from "@/lib/catalog/index.ts";
import { claseBoton, type VarianteBoton } from "@/components/ui/boton.ts";
import {
  buildProductInquiryMessage,
  buildWhatsAppUrl,
  WHATSAPP_NUMBER,
} from "@/lib/whatsapp/index.ts";

export function ConsultarWhatsAppButton({
  producto,
  url,
  variante,
}: {
  producto: Producto;
  // URL absoluta de la ficha, resuelta en el servidor: absoluteUrl() lee
  // SITE_URL, que no es NEXT_PUBLIC_*, así que en el cliente no existe.
  // Componerla acá con location.href traería además los query params.
  url: string;
  variante: VarianteBoton;
}) {
  const mensaje = buildProductInquiryMessage({
    nombre: producto.nombre,
    sku: producto.sku,
    url,
  });

  return (
    <a
      href={buildWhatsAppUrl(WHATSAPP_NUMBER, mensaje)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        // Mismo nombre de evento que el botón del carrito (CarritoView), que
        // manda `value` y `ref`. Este manda `item_id`: es lo que permite
        // separar en el reporte una consulta por un producto de una
        // cotización de carrito, sin inventar un evento nuevo que habría que
        // dar de alta aparte en GA.
        trackEvent("whatsapp_click", {
          item_id: producto.sku,
          item_name: producto.nombre,
          currency: "GTQ",
        });
      }}
      className={claseBoton(variante)}
    >
      Consultar por WhatsApp
    </a>
  );
}
