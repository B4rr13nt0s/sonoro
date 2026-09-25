// /llms.txt (https://llmstxt.org): el resumen en Markdown del sitio para
// modelos de lenguaje. Se arma desde el catálogo, igual que sitemap.ts, para
// que una categoría o marca nueva entre sola.
//
// Solo afirma lo que el sitio ya dice en sus páginas, con las mismas frases
// de CLAUDE.md § Reglas: nada de «te ayudamos a escoger» (regla 2), y ningún
// plazo, precio de instalación ni condición que no esté definida.
import { absoluteUrl } from "./site.ts";
import type { Brand, Categoria } from "@/lib/catalog/index.ts";

function enlace(nombre: string, ruta: string, descripcion: string): string {
  return `- [${nombre}](${absoluteUrl(ruta)}): ${descripcion}`;
}

function productos(cantidad: number): string {
  return cantidad === 1 ? "1 producto" : `${cantidad} productos`;
}

export function buildLlmsTxt({
  categorias,
  marcas,
  totalProductos,
}: {
  categorias: Categoria[];
  marcas: Brand[];
  totalProductos: number;
}): string {
  return [
    "# Sonoro",
    "",
    "> Tienda en línea de equipo de audio para carro, marino y motorsports en Guatemala: bocinas, subwoofers, amplificadores, receptores, ecualizadores, kits de instalación, insonorización y accesorios. Precios en quetzales con IVA incluido.",
    "",
    "- El sitio es un catálogo con carrito. No hay pago en línea: el pedido se envía por WhatsApp desde el carrito.",
    "- Envíos gratis a todo el país. Aplican restricciones según destino y volumen del pedido.",
    "- Hasta 6 pagos precio contado.",
    "- Cada producto incluye la instalación básica; una instalación más compleja tiene costo adicional, y se informa al cerrar el pedido.",
    "- La garantía cubre únicamente desperfectos de fábrica.",
    "- Cada ficha de producto muestra el código del fabricante, el precio, la disponibilidad y la ficha técnica publicada por el fabricante.",
    "",
    "## Catálogo",
    "",
    enlace(
      "Catálogo completo",
      "/catalogo",
      `los ${productos(totalProductos)} a la venta, de todas las categorías.`,
    ),
    enlace("Productos destacados", "/productos", "una selección del catálogo."),
    enlace("Buscar", "/buscar", "búsqueda por nombre, marca o código."),
    "",
    "## Categorías",
    "",
    ...categorias.map((categoria) =>
      enlace(
        categoria.nombre,
        `/catalogo/${categoria.slug}`,
        productos(categoria.cantidadProductos) + ".",
      ),
    ),
    "",
    "## Marcas",
    "",
    enlace("Todas las marcas", "/marcas", "índice de marcas."),
    ...marcas.map((marca) =>
      enlace(marca.nombre, `/marcas/${marca.slug}`, productos(marca.cantidadProductos) + "."),
    ),
    "",
    "## Información",
    "",
    enlace("Nosotros", "/nosotros", "quiénes somos y datos de contacto."),
    enlace(
      "Términos y condiciones",
      "/legal/terminos",
      "cómo funciona un pedido, precios, envíos y garantías.",
    ),
    enlace("Garantías", "/legal/garantias", "alcance y exclusiones de la garantía."),
    enlace("Aviso de privacidad", "/legal/privacidad", "qué información se recopila."),
    "",
    "## Optional",
    "",
    enlace("Sitemap", "/sitemap.xml", "todas las fichas de producto."),
    "",
  ].join("\n");
}
