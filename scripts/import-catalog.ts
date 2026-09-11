// Importador de catálogo 3.0 — docs/IMPORTADOR.md.
//
// Lee data/source/catalogo.xlsx —una hoja por categoría, más ESPECIALES para
// los productos multi-categoría—, valida, GENERA las specs legibles a partir
// de los campos normalizados y emite:
//   data/catalog.json · data/brands.json · data/taxonomy.json
//   data/inactive-slugs.json
//   data/source/catalogo.csv       el libro aplanado, solo para el diff de Git
//   reports/import-errors.md · reports/price-diff.md
//
// Dos niveles de fallo, deliberadamente distintos:
//   - ABORT (catalogo/contrato.ts): hojas que faltan o sobran, bloque común
//     distinto entre hojas, columnas específicas que no calzan, sku mangeado,
//     precio escrito como texto, sku o slug duplicado, categoría de
//     ESPECIALES inexistente. Se juntan TODOS los ofensores y no se escribe
//     ningún archivo: el catálogo anterior queda intacto.
//   - RECHAZO por fila (catalogo/filas.ts + ProductoSchema): obligatorio
//     vacío, valor fuera de lista, booleano ilegible, par etiqueta/valor
//     asimétrico, ficha fuera de 4–10. El import continúa y la fila queda
//     documentada en reports/import-errors.md.
//
// Las specs las arma catalogo/specs.ts con lib/catalog/labels.ts: este
// archivo no traduce ni formatea nada. El contrato de cada hoja (columnas,
// obligatorios, orden de destacadas) vive en catalogo/hojas.ts.
//
// Fotos (CLAUDE.md § Imágenes): public/productos/ se escanea buscando
// archivos "SKU_vista.ext" — lib/catalog/photos.ts hace el emparejamiento
// puro, este archivo solo aporta el filesystem.

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { CATEGORIAS_SITIO } from "../lib/catalog/categorias.ts";
import { construirImagenes, emparejarFotosConSkus } from "../lib/catalog/photos.ts";
import { ProductoSchema, type Producto } from "../lib/catalog/types.ts";
import { formatQ } from "../lib/format/precio.ts";
import { leerLibro, validarLibro, type LibroCrudo } from "./catalogo/contrato.ts";
import { serializarCsv } from "./catalogo/csv.ts";
import { normalizarFila } from "./catalogo/filas.ts";
import { defHoja } from "./catalogo/hojas.ts";
import { MAX_FICHA, construirSpecs, type Advertencia } from "./catalogo/specs.ts";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const RUTA_LIBRO = path.join(RAIZ, "data", "source", "catalogo.xlsx");
const RUTA_CSV_REGISTRO = path.join(RAIZ, "data", "source", "catalogo.csv");
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

type Grupo = { nombre: string; slug: string; cantidadProductos: number };

// Una fila con problema, ubicada como la ve quien edita el libro.
type AvisoFila = { donde: string; sku: string; detalle: string };

type Avisos = Record<Advertencia["tipo"], AvisoFila[]>;

type DiffPrecio = { sku: string; nombre: string; antesCents: number; despuesCents: number };

function main(): void {
  let libro: LibroCrudo;
  try {
    libro = leerLibro(readFileSync(RUTA_LIBRO));
  } catch (error) {
    abortar([`No se pudo leer ${path.relative(RAIZ, RUTA_LIBRO)}: ${(error as Error).message}`]);
    return;
  }

  const { ofensores, filas } = validarLibro(libro);
  if (ofensores.length > 0) {
    abortar(ofensores);
    return;
  }

  const productosValidos: Producto[] = [];
  const rechazos: AvisoFila[] = [];
  const avisos: Avisos = { contradiccion: [], recorte: [], marketing: [] };

  for (const fila of filas) {
    const def = defHoja(fila.hoja);
    const donde = `${fila.hoja} fila ${fila.numero}`;
    const sku = String(fila.celdas.sku ?? "").trim();

    const normalizada = normalizarFila(fila, def);
    if (!normalizada.ok) {
      rechazos.push({ donde, sku, detalle: normalizada.motivo });
      continue;
    }
    const { atributos, libres, categoriasSecundarias, ...base } = normalizada.fila;

    const specs = construirSpecs(def, atributos, libres);
    for (const advertencia of specs.advertencias) {
      avisos[advertencia.tipo].push({ donde, sku, detalle: advertencia.detalle });
    }

    const parseo = ProductoSchema.safeParse({
      ...base,
      categoria: def.categoria,
      specsDestacadas: specs.specsDestacadas,
      specsFicha: specs.specsFicha,
      moneda: "GTQ",
      imagenes: [],
      ...(categoriasSecundarias ? { categoriasSecundarias } : {}),
      ...(def.multicategoria ? {} : { atributos }),
    });
    if (!parseo.success) {
      const motivo = parseo.error.issues
        .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
        .join("; ");
      rechazos.push({ donde, sku, detalle: motivo });
      continue;
    }
    productosValidos.push(parseo.data);
  }

  // public/productos/ puede no existir aún (repo fresco, antes de la
  // primera foto) — se trata como carpeta vacía, no como error: es el
  // mismo estado que "todavía no hay fotos", ya cubierto por imagenes: [].
  // Archivos punto (.gitkeep, .DS_Store de macOS) son bookkeeping del
  // filesystem, no fotos con typo — se descartan antes de reportar nada.
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

  const huboCatalogoAnterior = existsSync(RUTA_CATALOG);
  const catalogoAnterior: Producto[] = huboCatalogoAnterior
    ? (JSON.parse(readFileSync(RUTA_CATALOG, "utf-8")) as Producto[])
    : [];

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
  // de cara al cliente, así que su conteo tampoco suma en brands.json ni en
  // taxonomy.json — si no, «N productos» no coincide con la rejilla.
  const productosActivos = productosValidos.filter((p) => p.activo);

  const brands = agruparPor(productosActivos, (p) => p.marca);
  // Categorías: lista fija de CATEGORIAS_SITIO, no agrupada dinámicamente
  // como las marcas — una categoría sin productos todavía sigue generando su
  // ruta estática con 0 productos en vez de devolver 404. El conteo suma los
  // productos que la traen como SECUNDARIA porque el listado también los
  // muestra (lib/catalog/adapters/static.ts); «Sistemas» no entra: no tiene
  // página propia.
  const taxonomy = CATEGORIAS_SITIO.map(({ nombre, slug }) => ({
    nombre,
    slug,
    cantidadProductos: productosActivos.filter(
      (p) => p.categoria === nombre || p.categoriasSecundarias?.includes(nombre),
    ).length,
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
  // Todas las filas del libro, rechazadas incluidas: es el registro de la
  // fuente, no del catálogo publicado.
  writeFileSync(RUTA_CSV_REGISTRO, serializarCsv(filas));
  writeFileSync(RUTA_IMPORT_ERRORS, generarImportErrorsMd(rechazos, avisos, alertas));
  writeFileSync(RUTA_PRICE_DIFF, generarPriceDiffMd(diffPrecios, !huboCatalogoAnterior));

  console.log(
    `Importación completa: ${productosValidos.length} válido(s), ${rechazos.length} rechazado(s), ` +
      `${avisos.contradiccion.length} contradicción(es), ${avisos.recorte.length} ficha(s) recortada(s), ` +
      `${alertas.length} alerta(s).`,
  );
  console.log(
    `Fotos: ${productosConFotos} producto(s) con foto(s), ${resultadoFotos.ignorados.length} archivo(s) de public/productos/ ignorado(s).`,
  );

  // Toda fila rechazada bloquea el build (npm run build = import:catalog &&
  // next build), no solo un ABORT total — "mejor no actualizar que publicar
  // un catálogo roto" aplica igual a una fila individual. Los archivos de
  // salida ya se escribieron (a diferencia de abortar()): con exitCode ≠ 0 el
  // deploy no llega a publicarse de todas formas, y dejarlos en el
  // filesystem local solo ayuda a diagnosticar qué falló.
  if (rechazos.length > 0) {
    console.error(
      `✘ ${rechazos.length} fila(s) rechazada(s) — ver reports/import-errors.md. El build no continúa.`,
    );
    process.exitCode = 1;
  }
}

function abortar(motivos: string[]): void {
  console.error("✘ Importación abortada. No se escribió ningún archivo de salida.\n");
  motivos.forEach((motivo) => console.error(`  - ${motivo}`));
  process.exitCode = 1;
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

function seccion(
  titulo: string,
  avisos: AvisoFila[],
  explicacion: string,
  vacio: string,
): string[] {
  const lineas = ["", `## ${titulo}`, ""];
  if (avisos.length === 0) return [...lineas, vacio];
  lineas.push(explicacion, "");
  for (const aviso of avisos) {
    lineas.push(`- ${aviso.donde} (sku "${aviso.sku}"): ${aviso.detalle}`);
  }
  return lineas;
}

function generarImportErrorsMd(rechazos: AvisoFila[], avisos: Avisos, alertas: string[]): string {
  const lineas: string[] = ["# Errores de importación", ""];
  if (rechazos.length === 0) {
    lineas.push("Sin filas rechazadas en esta corrida.");
  } else {
    lineas.push(`${rechazos.length} fila(s) rechazada(s) — no están en catalog.json:`, "");
    for (const rechazo of rechazos) {
      lineas.push(`- ${rechazo.donde} (sku "${rechazo.sku}"): ${rechazo.detalle}`);
    }
  }

  lineas.push(
    ...seccion(
      "Contradicciones",
      avisos.contradiccion,
      "Una spec libre usa la etiqueta de una spec generada y su primer número no coincide con el campo normalizado. Se publica la libre; revisa cuál de los dos está mal.",
      "Sin contradicciones en esta corrida.",
    ),
    ...seccion(
      "Fichas recortadas",
      avisos.recorte,
      `La ficha junta specs generadas y libres, y admite ${MAX_FICHA}. Lo que no entra no se publica.`,
      "Ninguna ficha pasó del máximo.",
    ),
    ...seccion(
      "Destacadas con etiquetas de marketing",
      avisos.marketing,
      "No había otra spec para completar las tres destacadas.",
      "Ninguna.",
    ),
    "",
    "## Alertas",
    "",
  );
  if (alertas.length === 0) {
    lineas.push("Sin alertas en esta corrida.");
  } else {
    for (const alerta of alertas) lineas.push(`- ${alerta}`);
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
