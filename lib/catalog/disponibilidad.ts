import type { Disponibilidad } from "./types.ts";

// El texto que ve el cliente para cada estado de disponibilidad, en un solo
// lugar: lo usan la ficha de producto y la tarjeta de producto, y tienen que
// decir lo mismo.
//
// `disponible` devuelve null a propósito: es el estado normal de 319 de los
// 320 productos activos, y etiquetar lo normal es copy de relleno (CLAUDE.md
// § reglas: "No agregues secciones, banners ni copy de relleno"). Esto es
// una EXCEPCIÓN que se señala, no un dato que se lista siempre.
//
// `bajo_pedido` no aparece hoy en el catálogo, pero está en el esquema
// (CLAUDE.md § Esquema de producto) y va a aparecer: si no tuviera texto,
// un producto bajo pedido se vería idéntico a uno disponible.
export function etiquetaDisponibilidad(disponibilidad: Disponibilidad): string | null {
  switch (disponibilidad) {
    case "disponible":
      return null;
    case "agotado":
      return "Agotado";
    case "bajo_pedido":
      return "Bajo pedido";
  }
}
