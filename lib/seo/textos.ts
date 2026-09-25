// Títulos y descripciones de cada página, en UN solo lugar. Los arman
// funciones puras a partir de datos del catálogo, así que los conteos y las
// marcas se actualizan solos con cada import.
//
// Reglas que guían cada frase (CLAUDE.md § Reglas):
// - Solo hechos del catálogo: cuántos productos, de qué marcas, qué
//   categorías. Nada de «el ideal para tu carro» (regla 2).
// - «Envíos a todo el país», SIN «gratis»: la frase con «gratis» exige ir
//   acompañada de sus restricciones (regla 7), y en 160 caracteres no caben.
// - La frase de pagos es la fijada, «hasta 6 pagos precio contado» (regla 6).
//
// El título se escribe sin «— Sonoro»: lo agrega title.template del layout.
import type { CATEGORIAS_SITIO } from "@/lib/catalog/categorias.ts";
import { formatQ } from "../format/precio.ts";

// El sitio empezó vendiendo solo audio para carro, y el catálogo ya trae
// también equipo marino y de motorsports (lanchas, UTV, motos). «Carro» se
// queda porque es lo que más se busca; las otras dos líneas se suman.
export const LEMA = "Audio para carro, marino y motorsports";
export const TITULO_SITIO = `Sonoro — ${LEMA} en Guatemala`;
export const DESCRIPCION_SITIO =
  "Bocinas, subwoofers, amplificadores y receptores para carro, lancha y UTV, de marcas importadas a Guatemala. Hasta 6 pagos precio contado y envíos a todo el país.";

const CIERRE = "Precio con IVA, hasta 6 pagos precio contado y envíos a todo el país.";

type SlugCategoria = (typeof CATEGORIAS_SITIO)[number]["slug"];

// En qué vehículos se usa lo que hay en cada categoría, revisado producto por
// producto contra el catálogo de septiembre de 2026. Va a mano porque el
// catálogo no tiene un campo de uso y el texto libre engaña: una búsqueda de
// «moto» atrapa «control remoto» y «motor de neodimio». Ecualizadores e
// insonorización no traen nada marino ni de motorsports: decir «para lancha»
// ahí sería falso. Receptores dice «moto» y no «UTV» porque lo suyo es un
// receptor para Harley-Davidson. Si entra a una categoría el primer producto
// de otra línea, se actualiza esta tabla.
// Record sobre los slugs: una categoría nueva sin su entrada no compila.
const USOS: Record<SlugCategoria, string> = {
  bocinas: "carro, lancha y UTV",
  subwoofers: "carro, lancha y UTV",
  amplificadores: "carro, lancha y UTV",
  receptores: "carro, lancha y moto",
  ecualizadores: "carro",
  kits: "carro, lancha y UTV",
  insonorizacion: "carro",
  accesorios: "carro, lancha y UTV",
};

// El nombre del nav es corto a propósito (tiene que caber en la barra). En el
// título hay lugar para el nombre completo, que además es lo que se busca.
const NOMBRE_COMPLETO: Partial<Record<SlugCategoria, string>> = {
  receptores: "Receptores y pantallas",
  kits: "Kits de instalación",
  accesorios: "Accesorios de audio",
};

// «Insonorización» no tiene plural: «7 productos de insonorización».
function pluralCategoria(nombre: string): string {
  return nombre === "Insonorización" ? "productos de insonorización" : nombre.toLowerCase();
}

function conPagina(titulo: string, page: number): string {
  return page > 1 ? `${titulo}, página ${page}` : titulo;
}

// «A», «A y B», «A, B y C».
function unir(nombres: string[]): string {
  if (nombres.length <= 1) return nombres.join("");
  return `${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`;
}

// Como unir(), pero con más de tres corta en «A, B, C y más».
function enumerar(nombres: string[]): string {
  return nombres.length > 3 ? `${nombres.slice(0, 3).join(", ")} y más` : unir(nombres);
}

// Nombres ordenados de más a menos frecuente, desempate por orden de código
// (no localeCompare: el texto no puede cambiar entre builds).
export function masFrecuentes(valores: string[]): string[] {
  const cuenta = new Map<string, number>();
  for (const valor of valores) cuenta.set(valor, (cuenta.get(valor) ?? 0) + 1);
  return [...cuenta.keys()].sort(
    (a, b) => cuenta.get(b)! - cuenta.get(a)! || (a < b ? -1 : a > b ? 1 : 0),
  );
}

type Textos = { titulo: string; descripcion: string };

export function textosCategoria({
  slug,
  nombre,
  total,
  marcas,
  marcaFiltro,
  page,
}: {
  slug: string;
  nombre: string;
  total: number;
  // Marcas de los productos del listado, de más a menos frecuente.
  marcas: string[];
  marcaFiltro?: string;
  page: number;
}): Textos {
  const nombreCompleto = NOMBRE_COMPLETO[slug as SlugCategoria] ?? nombre;
  const usos = USOS[slug as SlugCategoria] ?? "carro";
  const plural = pluralCategoria(nombre);

  // Con marca filtrada no se nombran los usos: que la categoría tenga equipo
  // marino no quiere decir que esa marca lo tenga en esa categoría.
  if (marcaFiltro) {
    return {
      titulo: conPagina(`${nombreCompleto} ${marcaFiltro} en Guatemala`, page),
      descripcion: `${total} ${plural} ${marcaFiltro} en Sonoro. ${CIERRE}`,
    };
  }
  return {
    titulo: conPagina(`${nombreCompleto} para ${usos}`, page),
    descripcion: `${total} ${plural} para ${usos} de ${enumerar(marcas)}, en Guatemala. ${CIERRE}`,
  };
}

export function textosMarca({
  nombre,
  total,
  categorias,
  categoriaFiltro,
  page,
}: {
  nombre: string;
  total: number;
  // Categorías de los productos de la marca, de más a menos frecuente.
  categorias: string[];
  categoriaFiltro?: string;
  page: number;
}): Textos {
  // El título nombra lo que la marca SÍ tiene, en vez de «marino y
  // motorsports»: de ocho marcas, solo tres traen algo de esas líneas.
  if (categoriaFiltro) {
    return {
      titulo: conPagina(`${nombre}: ${categoriaFiltro.toLowerCase()} en Guatemala`, page),
      descripcion: `${total} ${pluralCategoria(categoriaFiltro)} ${nombre} en Sonoro. ${CIERRE}`,
    };
  }
  const principales = categorias.slice(0, 3).map((categoria) => categoria.toLowerCase());
  return {
    titulo: conPagina(`${nombre} en Guatemala: ${enumerar(principales.slice(0, 2))}`, page),
    descripcion: `${total} productos ${nombre} en Sonoro: ${enumerar(principales)}. ${CIERRE}`,
  };
}

export function textosCatalogo({
  total,
  marcaFiltro,
  page,
}: {
  total: number;
  marcaFiltro?: string;
  page: number;
}): Textos {
  if (marcaFiltro) {
    return {
      titulo: conPagina(`Catálogo ${marcaFiltro} en Guatemala`, page),
      descripcion: `${total} productos ${marcaFiltro} en el catálogo de Sonoro. ${CIERRE}`,
    };
  }
  return {
    titulo: conPagina(`Catálogo de ${LEMA.toLowerCase()}`, page),
    descripcion: `Los ${total} productos de Sonoro: bocinas, subwoofers, amplificadores, receptores, kits e insonorización. Hasta 6 pagos precio contado y envíos a todo el país.`,
  };
}

export function textosDestacados({
  total,
  marcaFiltro,
  page,
}: {
  total: number;
  marcaFiltro?: string;
  page: number;
}): Textos {
  if (marcaFiltro) {
    return {
      titulo: conPagina(`Destacados de ${marcaFiltro}`, page),
      descripcion: `${total} productos destacados de ${marcaFiltro} en Sonoro. ${CIERRE}`,
    };
  }
  return {
    titulo: conPagina(`Destacados: ${LEMA.toLowerCase()}`, page),
    descripcion: `${total} productos destacados del catálogo de Sonoro: ${LEMA.toLowerCase()} en Guatemala. Hasta 6 pagos precio contado y envíos a todo el país.`,
  };
}

export function textosProducto(producto: {
  nombre: string;
  marca: string;
  sku: string;
  descripcionCorta: string;
  precioCents: number;
}): Textos {
  // La marca va primero porque así se busca («Pioneer TS-W312D4»), y casi
  // ningún nombre la trae (6 de 320); a esos no se les repite.
  const conMarca = producto.nombre.toLowerCase().includes(producto.marca.toLowerCase());
  return {
    titulo: conMarca ? producto.nombre : `${producto.marca} ${producto.nombre}`,
    descripcion: `${producto.descripcionCorta.replace(/\.$/, "")}. Código ${producto.sku}, ${formatQ(producto.precioCents)} con IVA. Hasta 6 pagos precio contado.`,
  };
}

export function textosMarcas(marcas: string[]): Textos {
  return {
    titulo: `Marcas de ${LEMA.toLowerCase()}`,
    descripcion: `Las ${marcas.length} marcas que importa Sonoro: ${unir(marcas)}. Hasta 6 pagos precio contado y envíos a todo el país.`,
  };
}

export const TEXTOS_NOSOTROS: Textos = {
  titulo: `Nosotros: ${LEMA.toLowerCase()}`,
  descripcion: `Sonoro importa directamente ${LEMA.toLowerCase()} a Guatemala. Cada producto incluye la instalación básica; una compleja tiene costo adicional.`,
};

export const TEXTOS_BUSCAR: Textos = {
  titulo: `Buscar ${LEMA.toLowerCase()}`,
  descripcion:
    "Busca bocinas, subwoofers, amplificadores y más por nombre, marca o código de fabricante en el catálogo de Sonoro, con precios en quetzales con IVA incluido.",
};
