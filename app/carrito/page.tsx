import type { Metadata } from "next";

import { CarritoView } from "@/components/cart/CarritoView";

// El carrito vive en localStorage — no hay nada que pre-renderizar por
// slug ni por producto, así que a diferencia de /producto/[slug] esta ruta
// no necesita generateStaticParams. Solo la metadata es estática; el
// contenido real lo arma CarritoView (Client Component) en el navegador.
export const metadata: Metadata = {
  title: "Carrito — Sonoro",
  description: "Revisa tu carrito y pide por WhatsApp.",
  alternates: { canonical: "/carrito" },
  // Carrito es sesión/localStorage — sin valor de indexación, y su
  // contenido cambia por visitante (CLAUDE.md § Modelo de conversión).
  robots: { index: false, follow: false },
};

export default function CarritoPage() {
  return <CarritoView />;
}
