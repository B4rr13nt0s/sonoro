// Importador de catálogo — docs/PLAN.md §2.3–2.4.
//
// Lee data/source/productos.csv, valida y normaliza cada fila, y emite
// data/catalog.json, data/brands.json, data/taxonomy.json,
// reports/import-errors.md y reports/price-diff.md.
//
// Dos niveles de fallo, deliberadamente distintos (§2.4):
//   - ABORT: contrato de encabezados no calza, un sku parece un valor
//     mangeado por hoja de cálculo (fecha/notación científica), o un precio
//     no vacío no tiene forma de número (texto real en la celda). Ninguno de
//     los tres archivos de salida se toca — no se pisa el último catálogo
//     bueno con una corrida corrupta.
//   - RECHAZO por fila: cualquier otra falla de ProductoSchema (precio
//     vacío, sku con formato inválido, specsFicha fuera de 4–10, booleano
//     ilegible, etc.). El import continúa; la fila queda fuera de
//     catalog.json y documentada en reports/import-errors.md.
//
// Nota: el paso 5 de §2.3 (unir content/productos/{sku}.mdx) no está
// implementado todavía — la carpeta está vacía y ProductoSchema no tiene un
// campo para contenido largo. Punto de extensión deliberadamente pendiente.
//
// Fotos (CLAUDE.md § Imágenes): public/productos/ se escanea buscando
// archivos "SKU_vista.ext" — lib/catalog/photos.ts hace el emparejamiento
// puro, este archivo solo aporta el filesystem. Un producto sin archivos
// que matcheen su sku sigue con imagenes: [] (placeholder), cero cambio de
// comportamiento — "cuando lleguen las fotos, es solo un cambio de datos".

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

import { CATEGORIAS_SITIO } from "../lib/catalog/categorias.ts";
import { construirImagenes, emparejarFotosConSkus } from "../lib/catalog/photos.ts";
import { pareceValorMangeado, ProductoSchema, type Producto } from "../lib/catalog/types.ts";
import { formatQ } from "../lib/format/precio.ts";
import { precioACents } from "./precio.ts";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUTA_CSV = path.join(RAIZ, "data", "source", "productos.csv");
const RUTA_CATALOG = path.join(RAIZ, "data", "catalog.json");
const RUTA_BRANDS = path.join(RAIZ, "data", "brands.json");
const RUTA_TAXONOMY = path.join(RAIZ, "data", "taxonomy.json");
const RUTA_FOTOS = path.join(RAIZ, "public", "productos");
// Lee esto proxy.ts para el 410 de /producto/[slug] — un arreglo plano de
// slugs en vez del catálogo completo, porque esa ruta corre en cada
// petición y no tiene por qué resolver 10+ productos con specs completas
// solo para mirar un booleano. Los slugs inactivos se conocen en tiempo de
// build (CLAUDE.md § Mantenimiento del catálogo: activo = FALSO, nunca se
// borra la fila), así que no hay razón para leer el catálogo entero ahí.
const RUTA_INACTIVE_SLUGS = path.join(RAIZ, "data", "inactive-slugs.json");
const RUTA_IMPORT_ERRORS = path.join(RAIZ, "reports", "import-errors.md");
const RUTA_PRICE_DIFF = path.join(RAIZ, "reports", "price-diff.md");

// Contrato de encabezados: conjunto exacto. Falta una o sobra una
// desconocida → abort (no se adivina). 3 pares fijos de destacada
// (specsDestacadas exige exactamente 3) + 10 pares fijos de ficha
// (specsFicha exige 4–10, con pares finales vacíos permitidos).
const COLUMNAS_REQUERIDAS = [
  "sku",
  "slug",
  "nombre",
  "marca",
  "categoria",
  "descripcion_corta",
  "precio",
  "precio_antes",
  "disponibilidad",
  "garantia_meses",
  "destacado",
  "activo",
  "spec_destacada_1_etiqueta",
  "spec_destacada_1_valor",
  "spec_destacada_2_etiqueta",
  "spec_destacada_2_valor",
  "spec_destacada_3_etiqueta",
  "spec_destacada_3_valor",
  "spec_ficha_1_etiqueta",
  "spec_ficha_1_valor",
  "spec_ficha_2_etiqueta",
  "spec_ficha_2_valor",
  "spec_ficha_3_etiqueta",
  "spec_ficha_3_valor",
  "spec_ficha_4_etiqueta",
  "spec_ficha_4_valor",
  "spec_ficha_5_etiqueta",
  "spec_ficha_5_valor",
  "spec_ficha_6_etiqueta",
  "spec_ficha_6_valor",
  "spec_ficha_7_etiqueta",
  "spec_ficha_7_valor",
  "spec_ficha_8_etiqueta",
  "spec_ficha_8_valor",
  "spec_ficha_9_etiqueta",
  "spec_ficha_9_valor",
  "spec_ficha_10_etiqueta",
  "spec_ficha_10_valor",
];

// Forma de número: dígitos, opcionalmente un punto y 1–2 decimales. Nada de
// letras, símbolos de moneda ni separadores de miles.
const PRECIO_REGEX = /^\d+(\.\d{1,2})?$/;

type FilaCsv = Record<string, string>;

type Grupo = { nombre: string; slug: string; cantidadProductos: number };

type ErrorFila = { fila: number; sku: string; motivo: string };

type DiffPrecio = { sku: string; nombre: string; antesCents: number; despuesCents: number };

function main(): void {
  const csvRaw = readFileSync(RUTA_CSV, "utf-8");

  let encabezadosVistos: string[] = [];
  let filas: FilaCsv[];
  try {
    filas = parse(csvRaw, {
      bom: true,
      trim: false,
      skip_empty_lines: true,
      columns: (encabezados: string[]) => {
        encabezadosVistos = encabezados;
        return encabezados;
      },
    }) as FilaCsv[];
  } catch (error) {
    abortar([`No se pudo parsear el CSV: ${(error as Error).message}`]);
    return;
  }

  const faltantes = COLUMNAS_REQUERIDAS.filter((c) => !encabezadosVistos.includes(c));
  const desconocidas = encabezadosVistos.filter((c) => !COLUMNAS_REQUERIDAS.includes(c));
  if (faltantes.length > 0 || desconocidas.length > 0) {
    const motivos: string[] = [];
    if (faltantes.length > 0) motivos.push(`Faltan columnas: ${faltantes.join(", ")}`);
    if (desconocidas.length > 0) motivos.push(`Columnas desconocidas: ${desconocidas.join(", ")}`);
    abortar(motivos);
    return;
  }

  // Chequeo defensivo — antes de normalizar nada (§2.4). Se recorren todas
  // las filas y se acumulan todas las ofensoras antes de abortar.
  const ofensores: string[] = [];
  filas.forEach((fila, indice) => {
    const numeroFila = indice + 2; // +1 por índice 0, +1 por la fila de encabezado
    const sku = (fila.sku ?? "").trim();
    if (pareceValorMangeado(sku)) {
      ofensores.push(
        `Fila ${numeroFila}: sku "${sku}" parece un valor mangeado por hoja de cálculo (fecha o notación científica)`,
      );
    }
    for (const columna of ["precio", "precio_antes"] as const) {
      const valor = (fila[columna] ?? "").trim();
      if (valor !== "" && !PRECIO_REGEX.test(valor)) {
        ofensores.push(
          `Fila ${numeroFila} (sku "${sku}"): ${columna} "${valor}" no tiene forma de número — parece texto`,
        );
      }
    }
  });
  if (ofensores.length > 0) {
    abortar(ofensores);
    return;
  }

  // Normalización + validación por fila.
  const productosValidos: Producto[] = [];
  const errores: ErrorFila[] = [];

  filas.forEach((fila, indice) => {
    const numeroFila = indice + 2;
    const sku = (fila.sku ?? "").trim();
    const normalizado = normalizarFila(fila);
    if (!normalizado.ok) {
      errores.push({ fila: numeroFila, sku, motivo: normalizado.motivo });
      return;
    }
    const parseo = ProductoSchema.safeParse(normalizado.candidato);
    if (!parseo.success) {
      const motivo = parseo.error.issues
        .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
        .join("; ");
      errores.push({ fila: numeroFila, sku, motivo });
      return;
    }
    productosValidos.push(parseo.data);
  });

  // public/productos/ puede no existir aún (repo fresco, antes de la
  // primera foto) — se trata como carpeta vacía, no como error: es el
  // mismo estado que "todavía no hay fotos", ya cubierto por imagenes: [].
  // Archivos punto (.gitkeep, .DS_Store de macOS) son bookkeeping del
  // filesystem, no fotos con typo — se descartan antes de reportar nada,
  // no cuentan como alerta.
  const nombresFotos = existsSync(RUTA_FOTOS)
    ? readdirSync(RUTA_FOTOS).filter((nombre) => !nombre.startsWith("."))
    : [];
  const skusValidos = new Set(productosValidos.map((p) => p.sku));
  const resultadoFotos = emparejarFotosConSkus(nombresFotos, skusValidos);
  for (const producto of productosValidos) {
    producto.imagenes = construirImagenes(
      resultadoFotos.porSku.get(producto.sku) ?? [],
      producto.nombre,
      "/productos",
    );
  }
  const productosConFotos = productosValidos.filter((p) => p.imagenes.length > 0).length;

  const catalogoAnterior: Producto[] = existsSync(RUTA_CATALOG)
    ? (JSON.parse(readFileSync(RUTA_CATALOG, "utf-8")) as Producto[])
    : [];
  const huboCatalogoAnterior = existsSync(RUTA_CATALOG);

  // Un archivo de foto que no matchea ningún sku es casi siempre un typo
  // (de sku o de vista) — se reporta junto a las demás alertas de
  // integridad de datos, nunca se ignora en silencio.
  const alertas = [
    ...detectarAlertas(catalogoAnterior, productosValidos),
    ...resultadoFotos.ignorados,
  ];
  alertas.forEach((alerta) => console.warn(`⚠ ALERTA: ${alerta}`));

  const diffPrecios = calcularDiffPrecios(catalogoAnterior, productosValidos);

  // Solo activos: un producto con activo=FALSE no aparece en ningún listado
  // de cara al cliente (listProducts/listAllProducts siempre pasan
  // activo: true — lib/catalog/types.ts § ProductFilters), así que su
  // conteo tampoco debe sumar en brands.json/taxonomy.json. Antes se
  // agrupaba sobre productosValidos completo: una marca o categoría con
  // productos inactivos mostraba "N productos" en /marcas y en la ficha de
  // marca/categoría mientras la rejilla de abajo mostraba menos, un
  // desfase real (ej. Cerwin Vega: CAK42 activo + XED62 inactivo → decía
  // "2 productos" y solo listaba 1).
  const productosActivos = productosValidos.filter((p) => p.activo);

  const brands = agruparPor(productosActivos, (p) => p.marca);
  // Categorías: lista fija de CATEGORIAS_SITIO, no agrupada dinámicamente
  // como las marcas — CLAUDE.md § Rutas las trata como un enum de negocio
  // fijo, no como algo que el catálogo descubre. Así una categoría sin
  // productos todavía (p. ej. recién agregada) sigue generando su ruta
  // estática con 0 productos y el grid vacío de ProductGrid, en vez de
  // desaparecer de taxonomy.json y devolver 404.
  const taxonomy = CATEGORIAS_SITIO.map(({ nombre, slug }) => ({
    nombre,
    slug,
    cantidadProductos: productosActivos.filter((p) => p.categoria === nombre).length,
  }));
  const inactiveSlugs = productosValidos
    .filter((p) => !p.activo)
    .map((p) => p.slug)
    .sort();

  mkdirSync(path.dirname(RUTA_CATALOG), { recursive: true });
  mkdirSync(path.dirname(RUTA_IMPORT_ERRORS), { recursive: true });

  writeFileSync(RUTA_CATALOG, JSON.stringify(productosValidos, null, 2) + "\n");
  writeFileSync(RUTA_BRANDS, JSON.stringify(brands, null, 2) + "\n");
  writeFileSync(RUTA_TAXONOMY, JSON.stringify(taxonomy, null, 2) + "\n");
  writeFileSync(RUTA_INACTIVE_SLUGS, JSON.stringify(inactiveSlugs, null, 2) + "\n");
  writeFileSync(RUTA_IMPORT_ERRORS, generarImportErrorsMd(errores, alertas));
  writeFileSync(RUTA_PRICE_DIFF, generarPriceDiffMd(diffPrecios, !huboCatalogoAnterior));

  console.log(
    `Importación completa: ${productosValidos.length} válido(s), ${errores.length} rechazado(s), ${alertas.length} alerta(s).`,
  );
  console.log(
    `Fotos: ${productosConFotos} producto(s) con foto(s), ${resultadoFotos.ignorados.length} archivo(s) de public/productos/ ignorado(s).`,
  );
}

function abortar(motivos: string[]): void {
  console.error("✘ Importación abortada. No se escribió ningún archivo de salida.\n");
  motivos.forEach((motivo) => console.error(`  - ${motivo}`));
  process.exitCode = 1;
}

type ResultadoNormalizacion =
  { ok: true; candidato: Record<string, unknown> } | { ok: false; motivo: string };

function normalizarFila(fila: FilaCsv): ResultadoNormalizacion {
  const sku = (fila.sku ?? "").trim();
  const slug = (fila.slug ?? "").trim();
  const nombre = (fila.nombre ?? "").trim();
  const marca = (fila.marca ?? "").trim();
  const categoria = (fila.categoria ?? "").trim();
  const descripcionCorta = (fila.descripcion_corta ?? "").trim();

  const precioTexto = (fila.precio ?? "").trim();
  if (precioTexto === "") {
    return { ok: false, motivo: "precio vacío" };
  }
  const precioCents = precioACents(precioTexto);

  const precioAntesTexto = (fila.precio_antes ?? "").trim();
  const precioAntesCents = precioAntesTexto === "" ? undefined : precioACents(precioAntesTexto);

  const destacado = parseBooleanoEspanol(fila.destacado);
  if (destacado === null) {
    return { ok: false, motivo: `destacado "${fila.destacado ?? ""}" no es VERDADERO/FALSO` };
  }
  const activo = parseBooleanoEspanol(fila.activo);
  if (activo === null) {
    return { ok: false, motivo: `activo "${fila.activo ?? ""}" no es VERDADERO/FALSO` };
  }

  const disponibilidad = (fila.disponibilidad ?? "").trim();

  const garantiaTexto = (fila.garantia_meses ?? "").trim();
  let garantiaMeses: number | undefined;
  if (garantiaTexto !== "") {
    if (!/^\d+$/.test(garantiaTexto)) {
      return { ok: false, motivo: `garantia_meses "${garantiaTexto}" no es un entero` };
    }
    garantiaMeses = parseInt(garantiaTexto, 10);
  }

  const specsDestacadas = ensamblarSpecs(fila, "spec_destacada", 3);
  if (!specsDestacadas.ok) return specsDestacadas;

  const specsFicha = ensamblarSpecs(fila, "spec_ficha", 10);
  if (!specsFicha.ok) return specsFicha;

  const candidato: Record<string, unknown> = {
    sku,
    slug,
    nombre,
    marca,
    categoria,
    descripcionCorta,
    specsDestacadas: specsDestacadas.specs,
    specsFicha: specsFicha.specs,
    precioCents,
    moneda: "GTQ",
    disponibilidad,
    imagenes: [],
    destacado,
    activo,
  };
  if (precioAntesCents !== undefined) candidato.precioAntesCents = precioAntesCents;
  if (garantiaMeses !== undefined) candidato.garantiaMeses = garantiaMeses;

  return { ok: true, candidato };
}

function parseBooleanoEspanol(valor: string | undefined): boolean | null {
  const v = (valor ?? "").trim().toUpperCase();
  if (v === "VERDADERO") return true;
  if (v === "FALSO") return false;
  return null;
}

type ResultadoSpecs =
  { ok: true; specs: { etiqueta: string; valor: string }[] } | { ok: false; motivo: string };

function ensamblarSpecs(
  fila: FilaCsv,
  prefijo: "spec_destacada" | "spec_ficha",
  maxIndice: number,
): ResultadoSpecs {
  const specs: { etiqueta: string; valor: string }[] = [];
  for (let n = 1; n <= maxIndice; n++) {
    const etiqueta = (fila[`${prefijo}_${n}_etiqueta`] ?? "").trim();
    const valor = (fila[`${prefijo}_${n}_valor`] ?? "").trim();
    if (etiqueta === "" && valor === "") continue;
    if (etiqueta === "" || valor === "") {
      return {
        ok: false,
        motivo: `${prefijo}_${n} tiene solo etiqueta o solo valor (etiqueta="${etiqueta}", valor="${valor}")`,
      };
    }
    specs.push({ etiqueta, valor });
  }
  return { ok: true, specs };
}

function normalizarNombre(nombre: string): string {
  return nombre.trim().toLowerCase().replace(/\s+/g, " ");
}

// "0450" → "450": quita ceros a la izquierda de cada grupo numérico que
// arranca al inicio del sku o justo después de un separador.
function sinCerosIniciales(sku: string): string {
  return sku.replace(/(^|[ .-])0+(?=\d)/g, "$1");
}

function detectarAlertas(anteriores: Producto[], nuevos: Producto[]): string[] {
  const alertas: string[] = [];

  const porSlugAnterior = new Map(anteriores.map((p) => [p.slug, p]));
  const porNombreAnterior = new Map(anteriores.map((p) => [normalizarNombre(p.nombre), p]));
  const porSkuAnterior = new Map(anteriores.map((p) => [p.sku, p]));

  for (const nuevo of nuevos) {
    // Ceros iniciales perdidos: match por slug O por nombre normalizado —
    // si solo se empareja por slug, un producto donde slug y sku cambiaron
    // a la vez nunca se detecta.
    const viejo =
      porSlugAnterior.get(nuevo.slug) ?? porNombreAnterior.get(normalizarNombre(nuevo.nombre));
    if (viejo && viejo.sku !== nuevo.sku && sinCerosIniciales(viejo.sku) === nuevo.sku) {
      alertas.push(
        `sku perdió ceros iniciales: "${viejo.sku}" → "${nuevo.sku}" (producto "${nuevo.nombre}")`,
      );
    }

    // Slug cambiado: match por sku estable.
    const viejoPorSku = porSkuAnterior.get(nuevo.sku);
    if (viejoPorSku && viejoPorSku.slug !== nuevo.slug) {
      alertas.push(`slug cambió para sku "${nuevo.sku}": "${viejoPorSku.slug}" → "${nuevo.slug}"`);
    }
  }

  return alertas;
}

function calcularDiffPrecios(anteriores: Producto[], nuevos: Producto[]): DiffPrecio[] {
  const porSkuAnterior = new Map(anteriores.map((p) => [p.sku, p]));
  const diffs: DiffPrecio[] = [];
  for (const nuevo of nuevos) {
    const viejo = porSkuAnterior.get(nuevo.sku);
    if (viejo && viejo.precioCents !== nuevo.precioCents) {
      diffs.push({
        sku: nuevo.sku,
        nombre: nuevo.nombre,
        antesCents: viejo.precioCents,
        despuesCents: nuevo.precioCents,
      });
    }
  }
  return diffs;
}

function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function agruparPor(productos: Producto[], selector: (p: Producto) => string): Grupo[] {
  const conteo = new Map<string, number>();
  for (const producto of productos) {
    const valor = selector(producto);
    conteo.set(valor, (conteo.get(valor) ?? 0) + 1);
  }
  return [...conteo.entries()]
    .map(([nombre, cantidadProductos]) => ({
      nombre,
      slug: slugificar(nombre),
      cantidadProductos,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function generarImportErrorsMd(errores: ErrorFila[], alertas: string[]): string {
  const lineas: string[] = ["# Errores de importación", ""];
  if (errores.length === 0) {
    lineas.push("Sin filas rechazadas en esta corrida.");
  } else {
    lineas.push(`${errores.length} fila(s) rechazada(s):`, "");
    for (const error of errores) {
      lineas.push(`- Fila ${error.fila} (sku "${error.sku}"): ${error.motivo}`);
    }
  }
  lineas.push("", "## Alertas", "");
  if (alertas.length === 0) {
    lineas.push("Sin alertas en esta corrida.");
  } else {
    for (const alerta of alertas) {
      lineas.push(`- ${alerta}`);
    }
  }
  lineas.push("");
  return lineas.join("\n");
}

function generarPriceDiffMd(diffs: DiffPrecio[], sinCatalogoAnterior: boolean): string {
  const lineas: string[] = ["# Cambios de precio", ""];
  if (sinCatalogoAnterior) {
    lineas.push("Sin catálogo anterior para comparar (primera importación).");
  } else if (diffs.length === 0) {
    lineas.push("Sin cambios de precio respecto al import anterior.");
  } else {
    for (const diff of diffs) {
      lineas.push(
        `- ${diff.sku} (${diff.nombre}): ${formatQ(diff.antesCents)} → ${formatQ(diff.despuesCents)}`,
      );
    }
  }
  lineas.push("");
  return lineas.join("\n");
}

main();
