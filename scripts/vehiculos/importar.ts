// La importación del libro de vehículos, de punta a punta y sin disco:
// recibe el libro ya leído y devuelve qué escribir. scripts/import-vehiculos.ts
// solo hace la entrada y salida.
//
// Tres niveles, como el catálogo:
//   - ABORTAR sin escribir nada: el contrato del libro está roto, o no queda
//     ninguna fila publicable (sin esta regla /buscar mostraría un selector
//     sin vehículos). En este caso no hay reporte, así que los motivos llevan
//     también los rechazos y los problemas del borrador.
//   - RECHAZAR la fila: queda en el reporte, el build no pasa y
//     data/vehiculos.json se queda en la última importación buena
//     (`archivo: null`).
//   - SIN REVISAR (`revisado = no`): se valida igual, pero no se publica, y
//     sus problemas van a su propia sección sin frenar el build.
import { compararTexto } from "../../lib/catalog/orden.ts";
import {
  SCHEMA_VERSION_VEHICULOS,
  type Vehiculo,
  type VehiculosArchivo,
} from "../../lib/vehiculos/types.ts";
import type { LibroCrudo } from "../catalogo/contrato.ts";
import { HOJA_VEHICULOS, validarLibroVehiculos } from "./contrato.ts";
import { normalizarFilaVehiculo } from "./filas.ts";
import { problemasEntreFilas } from "./validaciones.ts";

export type ResultadoImportacion =
  | { tipo: "abortar"; motivos: string[] }
  | {
      tipo: "listo";
      archivo: VehiculosArchivo | null;
      reporte: string;
      publicadas: number;
      rechazadas: number;
      sinRevisar: number;
    };

type AvisoFila = { numero: number; motivos: string[] };

function linea(aviso: AvisoFila): string {
  return `${HOJA_VEHICULOS} fila ${aviso.numero}: ${aviso.motivos.join("; ")}`;
}

// Por puntos de código, no con localeCompare: el archivo está versionado y
// tiene que salir igual en cualquier máquina.
export function ordenarVehiculos(vehiculos: readonly Vehiculo[]): Vehiculo[] {
  return [...vehiculos].sort(
    (a, b) =>
      compararTexto(a.marcaSlug, b.marcaSlug) ||
      compararTexto(a.modeloSlug, b.modeloSlug) ||
      (a.versionSlug === b.versionSlug
        ? 0
        : a.versionSlug === null
          ? -1
          : b.versionSlug === null
            ? 1
            : compararTexto(a.versionSlug, b.versionSlug)) ||
      a.desde - b.desde,
  );
}

function generarReporte(
  publicadas: number,
  rechazos: AvisoFila[],
  sinRevisar: AvisoFila[],
  totalSinRevisar: number,
): string {
  return [
    "# Importación de vehículos",
    "",
    `${publicadas} publicada(s), ${rechazos.length} rechazada(s), ${totalSinRevisar} sin revisar.`,
    "",
    "## Filas rechazadas",
    "",
    ...(rechazos.length > 0 ? rechazos.map((r) => `- ${linea(r)}`) : ["Ninguna."]),
    "",
    "## Filas sin revisar",
    "",
    "No se publican hasta marcarlas con «sí». Sus problemas no frenan el build.",
    "",
    ...(sinRevisar.length > 0
      ? sinRevisar.map((r) => `- ${linea(r)}`)
      : ["Ninguna con problemas."]),
    "",
  ].join("\n");
}

export function importarVehiculos(
  libro: LibroCrudo,
  ctx: { skusCatalogo: ReadonlySet<string>; anioActual: number },
): ResultadoImportacion {
  const { ofensores, filas, listas } = validarLibroVehiculos(libro);
  if (ofensores.length > 0) return { tipo: "abortar", motivos: ofensores };

  const resultados = filas.map((fila) => normalizarFilaVehiculo(fila, { listas, ...ctx }));
  const entreFilas = problemasEntreFilas(resultados.flatMap((r) => (r.ok ? [r.fila] : [])));

  const rechazos: AvisoFila[] = [];
  const sinRevisar: AvisoFila[] = [];
  const publicables: Vehiculo[] = [];
  let totalSinRevisar = 0;
  for (const r of resultados) {
    const numero = r.ok ? r.fila.numero : r.numero;
    const revisado = r.ok ? r.fila.revisado : r.revisado;
    if (revisado === false) totalSinRevisar += 1;
    const motivos = [...(r.ok ? [] : r.motivos), ...(entreFilas.get(numero) ?? [])];
    if (motivos.length > 0) {
      (revisado === false ? sinRevisar : rechazos).push({ numero, motivos });
    } else if (r.ok && r.fila.revisado) {
      publicables.push(r.fila.vehiculo);
    }
  }

  if (publicables.length === 0) {
    return {
      tipo: "abortar",
      motivos: [
        "Ninguna fila quedó publicable: el sitio no tendría vehículos. Marcá con «sí» las filas " +
          "revisadas.",
        ...rechazos.map(linea),
        ...sinRevisar.map((aviso) => `(sin revisar) ${linea(aviso)}`),
      ],
    };
  }

  return {
    tipo: "listo",
    archivo:
      rechazos.length === 0
        ? { schemaVersion: SCHEMA_VERSION_VEHICULOS, vehiculos: ordenarVehiculos(publicables) }
        : null,
    reporte: generarReporte(publicables.length, rechazos, sinRevisar, totalSinRevisar),
    publicadas: publicables.length,
    rechazadas: rechazos.length,
    sinRevisar: totalSinRevisar,
  };
}
