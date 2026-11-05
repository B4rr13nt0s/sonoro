// Chequeos que ABORTAN la importación de vehículos: problemas del libro
// completo, no de una fila. Puro, y todo ACUMULA: el reporte lista cada
// ofensor, no el primero que encuentra.
//
//   1. falta una hoja esperada (VEHICULOS, LISTAS) o sobra una desconocida
//   2. el encabezado de una hoja no trae exactamente sus columnas, en orden
//
// El libro se lee con el mismo leerLibro() del catálogo.
import { esVacia, type Celda, type LibroCrudo } from "../catalogo/contrato.ts";

export const HOJA_VEHICULOS = "VEHICULOS";
export const HOJA_LISTAS = "LISTAS";

const COLUMNAS_POR_UBICACION = [1, 2, 3, 4].flatMap((n) => [
  `ubicacion_${n}`,
  `medida_${n}`,
  `accesorio_${n}`,
]);

// Agrupadas por ubicación, para que quien edita lea cada una junta.
export const COLUMNAS_VEHICULOS: readonly string[] = [
  "marca",
  "modelo",
  "version",
  "desde",
  "hasta",
  "radio_1din",
  "radio_2din",
  ...COLUMNAS_POR_UBICACION,
  "revisado",
];

export const COLUMNAS_LISTAS = ["ubicacion", "medida"] as const;

export interface FilaVehiculoCruda {
  numero: number; // número de fila en la hoja, como lo ve quien la edita
  celdas: Readonly<Record<string, Celda>>; // por nombre de columna
}

export interface Listas {
  ubicaciones: ReadonlySet<string>;
  medidas: ReadonlySet<string>;
}

function encabezado(filas: readonly (readonly Celda[])[]): string[] {
  const primera = [...(filas[0] ?? [])];
  while (primera.length > 0 && esVacia(primera[primera.length - 1])) primera.pop();
  return primera.map((celda) => (celda === null ? "" : String(celda).trim()));
}

function revisarColumnas(hoja: string, vistas: string[], esperadas: readonly string[]): string[] {
  const faltan = esperadas.filter((c) => !vistas.includes(c));
  const sobran = vistas.filter((c) => !esperadas.includes(c));
  const ofensores = [
    ...faltan.map((c) => `${hoja}: falta la columna «${c}».`),
    ...sobran.map((c) => `${hoja}: sobra la columna «${c || "(sin nombre)"}».`),
  ];
  if (ofensores.length === 0 && vistas.join("|") !== esperadas.join("|")) {
    ofensores.push(
      `${hoja}: las columnas no vienen en el orden esperado: ${esperadas.join(", ")}.`,
    );
  }
  return ofensores;
}

export function validarLibroVehiculos(libro: LibroCrudo): {
  ofensores: string[];
  filas: FilaVehiculoCruda[];
  listas: Listas;
} {
  const ofensores: string[] = [];
  const esperadas = [HOJA_VEHICULOS, HOJA_LISTAS];
  for (const hoja of esperadas) {
    if (!libro.nombresHojas.includes(hoja)) ofensores.push(`Falta la hoja «${hoja}».`);
  }
  for (const hoja of libro.nombresHojas) {
    if (!esperadas.includes(hoja)) ofensores.push(`Sobra la hoja «${hoja}».`);
  }

  const vehiculos = libro.hojas.get(HOJA_VEHICULOS) ?? [];
  const listas = libro.hojas.get(HOJA_LISTAS) ?? [];
  if (libro.hojas.has(HOJA_VEHICULOS)) {
    ofensores.push(...revisarColumnas(HOJA_VEHICULOS, encabezado(vehiculos), COLUMNAS_VEHICULOS));
  }
  if (libro.hojas.has(HOJA_LISTAS)) {
    ofensores.push(...revisarColumnas(HOJA_LISTAS, encabezado(listas), COLUMNAS_LISTAS));
  }
  if (ofensores.length > 0) {
    return { ofensores, filas: [], listas: { ubicaciones: new Set(), medidas: new Set() } };
  }

  // Una fila cuenta si alguna celda trae algo: las filas en blanco del final
  // (Google Sheets las exporta con formato o con textos vacíos) se ignoran.
  const filas: FilaVehiculoCruda[] = [];
  vehiculos.slice(1).forEach((valores, indice) => {
    if (valores.every((celda) => esVacia(celda))) return;
    const celdas: Record<string, Celda> = {};
    COLUMNAS_VEHICULOS.forEach((columna, i) => {
      celdas[columna] = valores[i] ?? null;
    });
    filas.push({ numero: indice + 2, celdas });
  });

  // LISTAS se lee por columna: cada una es una lista hacia abajo, y pueden
  // tener largos distintos.
  const columna = (i: number) =>
    new Set(
      listas
        .slice(1)
        .map((valores) => valores[i])
        .filter((celda) => !esVacia(celda))
        .map((celda) => String(celda).trim()),
    );

  return { ofensores, filas, listas: { ubicaciones: columna(0), medidas: columna(1) } };
}
