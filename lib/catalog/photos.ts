// Empareja archivos de foto con productos por nombre de archivo — la mitad
// pura y testeable del pipeline de fotos; scripts/import-catalog.ts aporta
// el filesystem (readdirSync de public/productos/) y llama a estas
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

  for (const lista of porSku.values()) {
    lista.sort((a, b) => a.vista.localeCompare(b.vista, "es"));
  }

  return { porSku, ignorados };
}

export function construirImagenes(
  archivos: ArchivoFoto[],
  nombreProducto: string,
  rutaBase: string,
): Imagen[] {
  return archivos.map(({ archivo, vista }) => ({
    url: `${rutaBase}/${archivo}`,
    alt: `${nombreProducto} — ${vista}`,
  }));
}
