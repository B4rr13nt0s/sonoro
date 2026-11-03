import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";
import { COMO_PEDIR, CUOTAS, CUOTAS_CONDICIONES, ENVIOS, INSTALACION } from "@/lib/politicas.ts";
import { metadataPagina } from "@/lib/seo/metadata.ts";

const TITULO = "Términos y condiciones";
const DESCRIPCION = "Cómo funciona un pedido en Sonoro, precios, envíos y garantías.";

export const metadata: Metadata = metadataPagina({
  titulo: TITULO,
  descripcion: DESCRIPCION,
  ruta: "/legal/terminos",
});

export default function TerminosPage() {
  return (
    <LegalPage
      etiqueta="Legal"
      titulo="Términos y condiciones"
      actualizado="Última actualización: 15 de octubre de 2026"
      secciones={[
        {
          titulo: "Qué es Sonoro",
          parrafos: [
            "Sonoro es un catálogo en línea de equipo de audio para carro, marino y motorsports en Guatemala. El sitio no procesa pagos: el pedido se arma en el carrito y se cierra directamente con Sonoro por WhatsApp.",
          ],
        },
        {
          titulo: "Cómo funciona un pedido",
          parrafos: [
            COMO_PEDIR,
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
          parrafos: [`${CUOTAS} ${CUOTAS_CONDICIONES}`],
        },
        {
          titulo: "Envíos",
          parrafos: [ENVIOS, "El tiempo de entrega depende del departamento de destino."],
        },
        {
          titulo: "Instalación",
          parrafos: [INSTALACION],
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
