import type { Metadata } from "next";

import { CarritoView } from "@/components/cart/CarritoView";
import { metadataPagina } from "@/lib/seo/metadata.ts";

// El carrito vive en localStorage — no hay nada que pre-renderizar por
// slug ni por producto, así que a diferencia de /producto/[slug] esta ruta
// no necesita generateStaticParams. Solo la metadata es estática; el
// contenido real lo arma CarritoView (Client Component) en el navegador.
// Carrito es sesión/localStorage — sin valor de indexación, y su contenido
// cambia por visitante (CLAUDE.md § Modelo de conversión).
export const metadata: Metadata = metadataPagina({
  titulo: "Carrito",
  descripcion: "Revisa tu carrito y pide por WhatsApp.",
  ruta: "/carrito",
  noIndexar: true,
});

export default function CarritoPage() {
  return <CarritoView />;
}
