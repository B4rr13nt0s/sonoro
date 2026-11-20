// Empareja archivos de foto con productos por nombre de archivo — la mitad
// pura y testeable del pipeline de fotos; scripts/import-catalog.ts aporta
// el filesystem (los hashes de assets/productos/ y el manifiesto de Blob) y llama a estas
// funciones. CLAUDE.md § Imágenes: "cuando lleguen las fotos, es solo un
// cambio de datos, cero código" — por eso esto vive del lado del
// importador, no de los componentes (ProductImage/ProductGallery ya leen
// `imagenes` tal cual venga).
import type { Imagen } from "./types.ts";

// Formato: "SKU_vista.ext" (ej. "SRX62_frontal.jpg", "165 AS3_tres_cuartos.png").
// El sku nunca lleva "_" — SKU_REGEX (types.ts) solo admite espacio, punto o
// guion como separador interno — así que el PRIMER "_" del nombre de
// archivo separa sin ambigüedad el sku de la vista, sin importar cuántos
// guiones bajos traiga la vista misma.
const EXTENSIONES_VALIDAS = new Set(["jpg", "jpeg", "png", "webp"]);

/**
 * ¿El nombre parece una foto de producto («SKU_vista.ext» con una extensión
 * soportada)? Lo usa `npm run fotos:subir`: a un Blob PÚBLICO no debe llegar
 * cualquier archivo que alguien haya dejado en assets/productos/ (un .psd, un
 * .zip, un .env). No comprueba que el sku exista: eso lo reporta el importador.
 */
export function esNombreDeFoto(nombreArchivo: string): boolean {
  const punto = nombreArchivo.lastIndexOf(".");
  if (punto <= 0) return false;
  if (!EXTENSIONES_VALIDAS.has(nombreArchivo.slice(punto + 1).toLowerCase())) return false;
  const base = nombreArchivo.slice(0, punto);
  const guionBajo = base.indexOf("_");
  return guionBajo > 0 && guionBajo < base.length - 1;
}

export type ArchivoFoto = { sku: string; vista: string; archivo: string };

export type ResultadoEmparejamiento = {
  // Ordenadas alfabéticamente por vista (es) — es el orden en que
  // aparecen la foto principal y las miniaturas en ProductGallery. Para
  // controlar cuál sale primero, nombrar la vista para que ordene
  // primero (p. ej. "frontal" antes que "lateral" o "trasera" ya cae así
  // alfabéticamente en español).
  porSku: Map<string, ArchivoFoto[]>;
  // Un archivo por línea, con el motivo — para reports/import-errors.md.
  // Un archivo que no matchea ningún sku casi siempre es un typo de sku o
  // de vista, nunca se adivina cuál (CLAUDE.md § Fuente de verdad).
  ignorados: string[];
};

export function emparejarFotosConSkus(
  nombresArchivo: string[],
  skusValidos: ReadonlySet<string>,
): ResultadoEmparejamiento {
  const porSku = new Map<string, ArchivoFoto[]>();
  const ignorados: string[] = [];

  for (const nombreArchivo of nombresArchivo) {
    const punto = nombreArchivo.lastIndexOf(".");
    if (punto <= 0) {
      ignorados.push(`${nombreArchivo}: sin extensión`);
      continue;
    }

    const base = nombreArchivo.slice(0, punto);
    const extension = nombreArchivo.slice(punto + 1).toLowerCase();
    if (!EXTENSIONES_VALIDAS.has(extension)) {
      ignorados.push(
        `${nombreArchivo}: extensión ".${extension}" no soportada (usar jpg, jpeg, png o webp)`,
      );
      continue;
    }

    const guionBajo = base.indexOf("_");
    if (guionBajo <= 0 || guionBajo === base.length - 1) {
      ignorados.push(`${nombreArchivo}: no sigue el formato "SKU_vista"`);
      continue;
    }

    const sku = base.slice(0, guionBajo);
    const vista = base.slice(guionBajo + 1);

    if (!skusValidos.has(sku)) {
      ignorados.push(`${nombreArchivo}: "${sku}" no coincide con ningún sku del catálogo`);
      continue;
    }

    const lista = porSku.get(sku) ?? [];
    lista.push({ sku, vista, archivo: nombreArchivo });
    porSku.set(sku, lista);
  }

  // Por puntos de código, no con localeCompare: el orden decide cuál foto
  // es imagenes[0] —la ampliada en la ficha, el imagenSnapshot del carrito,
  // la del JSON-LD— y no puede cambiar entre máquinas ni versiones de ICU
  // (mismo criterio que lib/catalog/orden.ts). Para vistas en minúsculas y sin
  // acentos es el mismo orden alfabético. El nombre de archivo desempata una
  // misma vista en dos formatos, que si no quedaba en el orden del disco.
  // Las vistas «frontal…» (frontal, frontal2) van primero: solas por orden
  // alfabético, una «cenital» o una «diagonal» le quitaban el lugar a la
  // frontal (VPAS12, VR10) y salía de foto principal. Delante de todas, las
  // «completo…»: el juego entero (165 AS, 165 AS3) es la foto principal y la
  // de la tarjeta.
  const comparar = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const rango = (vista: string) =>
    vista.startsWith("completo") ? 0 : vista.startsWith("frontal") ? 1 : 2;
  for (const lista of porSku.values()) {
    lista.sort(
      (a, b) =>
        rango(a.vista) - rango(b.vista) ||
        comparar(a.vista, b.vista) ||
        comparar(a.archivo, b.archivo),
    );
  }

  return { porSku, ignorados };
}

// Vistas cuyo nombre de archivo pega dos palabras: se leen como dos.
const VISTAS_COMPUESTAS: Readonly<Record<string, string>> = {
  frontalposterior: "frontal y posterior",
  diagonalderecha: "diagonal derecha",
  diagonalizquierda: "diagonal izquierda",
};

/**
 * La vista como se lee en voz alta. El nombre del archivo es un identificador
 * («frontal2», «tres_cuartos», «frontalposterior»), y como `alt` un lector de
 * pantalla lo decía tal cual: «frontal dos» sin separar, o una palabra pegada
 * que no existe. El número se conserva, separado, porque distingue dos fotos
 * del mismo ángulo.
 */
export function vistaLegible(vista: string): string {
  const base = vista.replace(/\d+$/, "");
  const numero = vista.slice(base.length);
  const palabras = VISTAS_COMPUESTAS[base] ?? base.replaceAll("_", " ");
  return numero ? `${palabras} ${numero}` : palabras;
}

// `urlDe` da la URL de cada foto (hoy, la del manifiesto de Blob). Una foto
// sin URL —todavía sin subir— no entra: sin ninguna, `imagenes` queda [] y
// el componente dibuja el placeholder.
export function construirImagenes(
  archivos: ArchivoFoto[],
  nombreProducto: string,
  urlDe: (archivo: string) => string | undefined,
): Imagen[] {
  return archivos.flatMap(({ archivo, vista }): Imagen[] => {
    const url = urlDe(archivo);
    return url ? [{ url, alt: `${nombreProducto} — ${vistaLegible(vista)}` }] : [];
  });
}
