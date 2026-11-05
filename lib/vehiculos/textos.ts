// Los textos del selector de vehículos que dependen de los datos, en un solo
// lugar. Copy para el cliente con tú (CLAUDE.md).
import type { EstadoCompat, GrupoBocinas } from "./compatibilidad.ts";
import type { Vehiculo } from "./types.ts";

// «con_pieza» es solo el comienzo: el componente agrega el nombre de la pieza
// con un enlace a su ficha («Cabe con Alza para bocinas de 6.5"»).
// «Cabe con accesorios» y el aviso de la DMH-AP6650BT no se muestran
// (decisión del negocio, noviembre de 2026): esas tarjetas van sin línea de
// estado. Los estados siguen existiendo en compatibilidad.ts, que ordena por ellos.
export const TEXTOS_ESTADO: Record<EstadoCompat["tipo"], string | null> = {
  cabe: "Cabe",
  con_pieza: "Cabe con",
  con_accesorios: null,
  consultar: null,
};

// Una línea más bajo el estado de un receptor que la necesita, por su código.
// La DMH-A5650BT sigue con formato `1-din` en el libro (decisión del negocio,
// noviembre de 2026), pero su pantalla es de 2 DIN y el cliente tiene que
// saberlo antes de pedirla para un tablero de 1 DIN. especiales.test.ts
// comprueba contra el catálogo real que cada código existe.
export const NOTAS_RECEPTOR: Readonly<Record<string, string>> = {
  "DMH-A5650BT":
    "Utiliza un chasis trasero de 1-DIN, pero cuenta con una pantalla frontal de 2-DIN.",
};

export function notaReceptor(sku: string): string | null {
  return Object.hasOwn(NOTAS_RECEPTOR, sku) ? NOTAS_RECEPTOR[sku] : null;
}

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
