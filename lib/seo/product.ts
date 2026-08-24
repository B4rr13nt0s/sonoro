// JSON-LD Product por ficha (CLAUDE.md/docs/PLAN.md § Fase 7): offers con
// price, priceCurrency GTQ y availability. Se implementa aunque hoy no haya
// venta en línea — es requisito para Google Shopping y rich results
// después.
import { absoluteUrl } from "./site.ts";
import type { Disponibilidad, Producto } from "@/lib/catalog/index.ts";

// schema.org/ItemAvailability. "bajo_pedido" no es "en stock" ni
// "agotado" — BackOrder ("disponible sobre pedido") es el que mejor
// describe ese estado intermedio.
const AVAILABILITY: Record<Disponibilidad, string> = {
  disponible: "https://schema.org/InStock",
  bajo_pedido: "https://schema.org/BackOrder",
  agotado: "https://schema.org/OutOfStock",
};

export function buildProductJsonLd(producto: Producto) {
  const url = absoluteUrl(`/producto/${producto.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    sku: producto.sku,
    name: producto.nombre,
    description: producto.descripcionCorta,
    brand: { "@type": "Brand", name: producto.marca },
    // "El placeholder es un estado de renderizado, no un dato" (CLAUDE.md §
    // Imágenes) — el mismo principio aplica acá: sin fotos reales no se
    // declara una imagen como si fuera la del producto.
    ...(producto.imagenes.length > 0
      ? { image: producto.imagenes.map((imagen) => absoluteUrl(imagen.url)) }
      : {}),
    offers: {
      "@type": "Offer",
      url,
      // Precio como número plano ("2450.00"): schema.org exige un valor
      // numérico, no "Q 2,450.00" — formatQ es para precio MOSTRADO al
      // humano; este es un contrato de datos distinto, no un segundo
      // formateador de precio.
      price: (producto.precioCents / 100).toFixed(2),
      priceCurrency: producto.moneda,
      availability: AVAILABILITY[producto.disponibilidad],
      itemCondition: "https://schema.org/NewCondition",
    },
  };
}
