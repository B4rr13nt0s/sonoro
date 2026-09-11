// Chequeos que ABORTAN el import: problemas del libro completo, no de una
// fila. Todo acá es puro salvo leerLibro(), y todo ACUMULA — el reporte lista
// cada ofensor del libro, no el primero que encuentra.
//
// Los ocho chequeos de docs/IMPORTADOR.md, en orden:
//   1. falta una hoja esperada o sobra una desconocida
//   2. el bloque común no es idéntico, en el mismo orden, en las nueve hojas
//   3. falta una columna específica o sobra una desconocida
//   4. un sku parece mangeado por la hoja de cálculo
//   5. un precio no vacío llegó como texto
//   6. sku duplicado (entre hojas o dentro de una)
//   7. slug duplicado
//   8. ESPECIALES.categorias nombra una categoría que no existe

import * as XLSX from "xlsx";

import { CATEGORIAS_SITIO } from "../../lib/catalog/categorias.ts";
import { pareceValorMangeado } from "../../lib/catalog/types.ts";
import {
  COMUN,
  HOJAS_IGNORADAS,
  NOMBRES_HOJAS,
  columnasEspecificas,
  defHoja,
  type NombreHoja,
} from "./hojas.ts";

// El valor de una celda con su tipo REAL (raw: true): un precio escrito como
// texto llega como string y uno numérico como number. Eso es lo que permite
// los chequeos 4 y 5 sin adivinar a partir del texto.
export type Celda = string | number | boolean | null;

export type LibroCrudo = {
  nombresHojas: readonly string[];
  hojas: ReadonlyMap<string, readonly (readonly Celda[])[]>;
};

export type FilaCruda = {
  hoja: NombreHoja;
  numero: number; // número de fila en la hoja, como lo ve quien la edita
  celdas: Readonly<Record<string, Celda>>; // por nombre de encabezado
};

export function leerLibro(buffer: Uint8Array): LibroCrudo {
  // Sin cellDates: una fecha llega como número, y un sku numérico o fecha es
  // justo lo que el chequeo 4 tiene que ver como no-texto.
  const libro = XLSX.read(buffer, { type: "buffer" });
  const hojas = new Map<string, Celda[][]>();
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    const ref = hoja["!ref"];
    if (!ref) {
      hojas.set(nombre, []);
      continue;
    }
    // Rango forzado desde A1: si la hoja empezara más abajo o más a la
    // derecha, los números de fila y las letras de columna del reporte no
    // coincidirían con lo que ve quien edita.
    const fin = XLSX.utils.decode_range(ref).e;
    const filas = XLSX.utils.sheet_to_json<Celda[]>(hoja, {
      header: 1,
      raw: true,
      defval: null,
      blankrows: true,
      range: { s: { r: 0, c: 0 }, e: fin },
    });
    hojas.set(nombre, filas);
  }
  return { nombresHojas: libro.SheetNames, hojas };
}

export function esVacia(celda: Celda | undefined): boolean {
  return (
    celda === null || celda === undefined || (typeof celda === "string" && celda.trim() === "")
  );
}

// «Subwoofers, Bocinas» → ["Subwoofers", "Bocinas"]. Las comas sobrantes no
// generan categorías vacías.
export function separarCategorias(celda: Celda | undefined): string[] {
  if (esVacia(celda)) return [];
  return String(celda)
    .split(",")
    .map((c) => c.trim())
    .filter((c) => c !== "");
}

const NOMBRES_CATEGORIAS = new Set<string>(CATEGORIAS_SITIO.map((c) => c.nombre));

function letra(indice: number): string {
  return XLSX.utils.encode_col(indice);
}

function leerEncabezados(fila: readonly Celda[] | undefined): string[] {
  const encabezados = (fila ?? []).map((c) => (c === null ? "" : String(c)));
  while (encabezados.length > 0 && encabezados[encabezados.length - 1] === "") encabezados.pop();
  return encabezados;
}

// Chequeos 2 y 3. El bloque común se compara POSICIÓN POR POSICIÓN contra la
// constante COMUN, con igualdad exacta de string —sin trim—: como las nueve
// hojas se comparan contra la misma referencia, «idénticas entre sí y en el
// mismo orden» sale por construcción. Un bloque corrido una columna se
// reporta como once diferencias, que es lo que es.
export function validarEncabezados(hoja: NombreHoja, encabezados: readonly string[]): string[] {
  const ofensores: string[] = [];

  COMUN.forEach((esperado, i) => {
    const real = encabezados[i];
    if (real === esperado) return;
    const dice = real === undefined || real === "" ? "está vacía" : `dice "${real}"`;
    const nota = real !== undefined && real.trim() === esperado ? " (espacio extra)" : "";
    ofensores.push(
      `${hoja}, columna ${letra(i)} (posición ${i + 1}): ${dice}, se esperaba "${esperado}"${nota}`,
    );
  });

  const esperadas = columnasEspecificas(defHoja(hoja));
  const resto = encabezados.slice(COMUN.length);
  const faltantes = esperadas.filter((c) => !resto.includes(c));
  if (faltantes.length > 0) {
    ofensores.push(`${hoja}: faltan columnas: ${faltantes.join(", ")}`);
  }
  resto.forEach((columna, j) => {
    const i = COMUN.length + j;
    if (columna === "") {
      ofensores.push(`${hoja}, columna ${letra(i)}: encabezado vacío entre columnas con nombre`);
    } else if (!esperadas.includes(columna)) {
      ofensores.push(`${hoja}, columna ${letra(i)}: columna desconocida "${columna}"`);
    } else if (resto.indexOf(columna) !== j) {
      ofensores.push(`${hoja}, columna ${letra(i)}: columna repetida "${columna}"`);
    }
  });

  return ofensores;
}

// Chequeos 4 a 8, sobre las filas de todas las hojas con encabezados sanos.
export function validarFilas(filas: readonly FilaCruda[]): string[] {
  const ofensores: string[] = [];
  const porSku = new Map<string, string[]>();
  const porSlug = new Map<string, string[]>();
  const anotar = (mapa: Map<string, string[]>, clave: string, donde: string) => {
    mapa.set(clave, [...(mapa.get(clave) ?? []), donde]);
  };

  for (const fila of filas) {
    const donde = `${fila.hoja} fila ${fila.numero}`;
    const { sku, slug } = fila.celdas;

    if (!esVacia(sku)) {
      if (typeof sku !== "string") {
        ofensores.push(
          `${donde}: el sku llegó como ${typeof sku === "number" ? "número" : "booleano"} (${String(sku)}), no como texto — la columna A tiene que estar en formato Texto sin formato`,
        );
      } else if (pareceValorMangeado(sku.trim())) {
        ofensores.push(
          `${donde}: sku "${sku}" parece un valor mangeado por la hoja de cálculo (fecha o notación científica)`,
        );
      }
      anotar(porSku, String(sku).trim(), donde);
    }

    for (const columna of ["precio", "precio_antes"] as const) {
      const valor = fila.celdas[columna];
      if (typeof valor === "string" && valor.trim() !== "") {
        ofensores.push(
          `${donde} (sku "${String(sku ?? "")}"): ${columna} "${valor}" llegó como texto, no como número`,
        );
      }
    }

    if (!esVacia(slug)) anotar(porSlug, String(slug).trim(), donde);

    if (defHoja(fila.hoja).multicategoria) {
      for (const categoria of separarCategorias(fila.celdas.categorias)) {
        if (!NOMBRES_CATEGORIAS.has(categoria)) {
          ofensores.push(
            `${donde}: la categoría "${categoria}" de la columna categorias no existe (válidas: ${[...NOMBRES_CATEGORIAS].join(", ")})`,
          );
        }
      }
    }
  }

  for (const [sku, lugares] of porSku) {
    if (lugares.length > 1) ofensores.push(`sku "${sku}" duplicado: ${lugares.join(", ")}`);
  }
  for (const [slug, lugares] of porSlug) {
    if (lugares.length > 1) ofensores.push(`slug "${slug}" duplicado: ${lugares.join(", ")}`);
  }
  return ofensores;
}

// Los ocho chequeos. Una hoja con encabezados rotos no aporta filas —no hay
// cómo leerlas con confianza—, pero las demás hojas SÍ se revisan con los
// chequeos de fila, para que el reporte salga completo en una sola corrida.
export function validarLibro(libro: LibroCrudo): { ofensores: string[]; filas: FilaCruda[] } {
  const ofensores: string[] = [];

  const esperadas = new Set<string>([...HOJAS_IGNORADAS, ...NOMBRES_HOJAS]);
  for (const hoja of esperadas) {
    if (!libro.hojas.has(hoja)) ofensores.push(`Falta la hoja ${hoja}`);
  }
  for (const hoja of libro.nombresHojas) {
    if (!esperadas.has(hoja)) ofensores.push(`Hoja desconocida: "${hoja}"`);
  }

  const filas: FilaCruda[] = [];
  for (const hoja of NOMBRES_HOJAS) {
    const datos = libro.hojas.get(hoja);
    if (!datos) continue;
    const encabezados = leerEncabezados(datos[0]);
    const problemas = validarEncabezados(hoja, encabezados);
    if (problemas.length > 0) {
      ofensores.push(...problemas);
      continue;
    }
    for (let i = 1; i < datos.length; i++) {
      const fila = datos[i];
      // Las hojas traen cientos de filas vacías por el formato y la
      // validación de datos: no son productos.
      if (encabezados.every((_, j) => esVacia(fila[j]))) continue;
      const celdas = Object.fromEntries(encabezados.map((h, j) => [h, fila[j] ?? null]));
      filas.push({ hoja, numero: i + 1, celdas });
    }
  }

  ofensores.push(...validarFilas(filas));
  return { ofensores, filas };
}
