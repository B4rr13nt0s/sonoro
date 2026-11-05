// La descarga de los datos del selector de vehículos, en el navegador. Solo
// `fetch` y un chequeo de forma liviano, sin zod: este módulo va en el bundle
// de /buscar.
//
// Nunca rechaza: cualquier fallo (red, respuesta no OK, JSON ajeno o una
// conexión trabada más allá del plazo) es `null`, y el selector muestra el
// error con «Reintentar». Sin plazo, una conexión detenida dejaba el selector
// cargando para siempre.
import type { DatosVehiculos } from "./types.ts";

export const RUTA_DATOS_VEHICULOS = "/buscar/vehiculos.json";
export const PLAZO_DATOS_MS = 8000;

function esDatos(valor: unknown): valor is DatosVehiculos {
  if (typeof valor !== "object" || valor === null) return false;
  const { vehiculos, receptores, bocinas, piezas } = valor as Record<string, unknown>;
  return [vehiculos, receptores, bocinas, piezas].every(Array.isArray);
}

export async function descargarDatosVehiculos(
  fetchImpl: typeof fetch = fetch,
  plazoMs: number = PLAZO_DATOS_MS,
): Promise<DatosVehiculos | null> {
  try {
    const respuesta = await fetchImpl(RUTA_DATOS_VEHICULOS, {
      signal: AbortSignal.timeout(plazoMs),
    });
    if (!respuesta.ok) return null;
    const cuerpo: unknown = await respuesta.json();
    return esDatos(cuerpo) ? cuerpo : null;
  } catch {
    return null;
  }
}
