// Los textos del selector de vehículos que dependen de los datos, en un solo
// lugar. Copy para el cliente con tú (CLAUDE.md).
import type { EstadoCompat, GrupoBocinas } from "./compatibilidad.ts";
import type { Vehiculo } from "./types.ts";

// «con_pieza» es solo el comienzo: el componente agrega el nombre de la pieza
// con un enlace a su ficha («Cabe con Alza para bocinas de 6.5"»).
export const TEXTOS_ESTADO: Record<EstadoCompat["tipo"], string> = {
  cabe: "Cabe",
  con_pieza: "Cabe con",
  con_accesorios: "Cabe con accesorios",
  consultar:
    "Requiere un marco que depende del año, marca y modelo del vehículo. Contacta a Sonoro para más información.",
};

export const SIN_RESULTADOS = "No hay receptores ni bocinas que quepan en este vehículo.";
export const ERROR_CARGA = "No se pudo cargar la lista de vehículos.";

export function tituloVehiculo(vehiculo: Vehiculo, anio: number): string {
  const base = `${vehiculo.marca} ${vehiculo.modelo} ${anio}`;
  return vehiculo.version ? `${base} · ${vehiculo.version}` : base;
}

export function tituloGrupo(grupo: Pick<GrupoBocinas, "ubicacion" | "medidas">): string {
  return `${grupo.ubicacion} · ${grupo.medidas.join(" o ")}`;
}

export function textoGrupoVacio(grupo: Pick<GrupoBocinas, "medidas">): string {
  return grupo.medidas.length === 1
    ? `No hay bocinas de ${grupo.medidas[0]} en el catálogo.`
    : "No hay bocinas de esas medidas en el catálogo.";
}
