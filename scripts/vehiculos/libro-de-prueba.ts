// Libros de vehículos sintéticos, en memoria, para las pruebas del
// importador: fijan el CONTRATO, no el libro real. Sin `.test` en el nombre,
// así `npm test` no lo corre como prueba.
import type { Celda, LibroCrudo } from "../catalogo/contrato.ts";
import { COLUMNAS_LISTAS, COLUMNAS_VEHICULOS, HOJA_LISTAS, HOJA_VEHICULOS } from "./contrato.ts";

/** Una fila de VEHICULOS en el orden de COLUMNAS_VEHICULOS; lo que no se pasa queda en null. */
export function filaVehiculo(valores: Record<string, Celda>): Celda[] {
  return COLUMNAS_VEHICULOS.map((columna) => valores[columna] ?? null);
}

export const FILA_VALIDA: Record<string, Celda> = {
  marca: "Toyota",
  modelo: "Corolla",
  desde: 2009,
  hasta: 2013,
  radio_2din: "directo",
  ubicacion_1: "Puertas delanteras",
  medida_1: '6.5"',
  revisado: "sí",
};

export const LISTAS_DE_PRUEBA: Celda[][] = [
  ["Puertas delanteras", '6.5"'],
  ["Bandeja trasera", '5.25"'],
  [null, '6x9"'],
  [null, '7/8"'],
  [null, '6x8"'],
];

export function libroVehiculos(
  opciones: {
    vehiculos?: Celda[][];
    listas?: Celda[][];
    encabezados?: string[];
    encabezadosListas?: string[];
    hojas?: string[];
  } = {},
): LibroCrudo {
  const contenido = new Map<string, Celda[][]>([
    [
      HOJA_VEHICULOS,
      [
        opciones.encabezados ?? [...COLUMNAS_VEHICULOS],
        ...(opciones.vehiculos ?? [filaVehiculo(FILA_VALIDA)]),
      ],
    ],
    [
      HOJA_LISTAS,
      [
        opciones.encabezadosListas ?? [...COLUMNAS_LISTAS],
        ...(opciones.listas ?? LISTAS_DE_PRUEBA),
      ],
    ],
  ]);
  const nombres = opciones.hojas ?? [HOJA_VEHICULOS, HOJA_LISTAS];
  const hojas = new Map<string, Celda[][]>();
  for (const nombre of nombres) hojas.set(nombre, contenido.get(nombre) ?? [["nota"]]);
  return { nombresHojas: nombres, hojas };
}
