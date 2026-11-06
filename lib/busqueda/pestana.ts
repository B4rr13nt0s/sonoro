// Las dos pestañas de /buscar: «Por producto» (el campo y sus resultados) y
// «Por vehículo» (el selector). La pestaña sale de la dirección, como todo lo
// demás de la búsqueda (docs/superpowers/specs/2026-11-05-buscar-interfaz-design.md):
//
//   - con `vehiculo` (la marca del vehículo) o con `por=vehiculo`, «Por vehículo»;
//   - en cualquier otro caso, «Por producto»;
//   - una consulta escrita gana: es lo mismo que cuando escribir una búsqueda
//     borra el vehículo.
//
// `por` solo acepta `vehiculo`. Con un vehículo elegido no hace falta: lo dice
// `vehiculo`. `modelo`, `anio` o `version` sin `vehiculo` no forman un
// vehículo (leerSeleccion, lib/vehiculos/url.ts).
//
// Lógica pura: la usan SearchExperience y hrefVehiculo.
export type Pestana = "producto" | "vehiculo";

export function leerPestana(busqueda: string): Pestana {
  const params = new URLSearchParams(busqueda);
  if ((params.get("q") ?? "").trim()) return "producto";
  return params.get("vehiculo") || params.get("por") === "vehiculo" ? "vehiculo" : "producto";
}

/** La dirección con que empieza cada pestaña: al cambiar, lo de la otra se pierde. */
export function hrefPestana(pestana: Pestana): string {
  return pestana === "vehiculo" ? "/buscar?por=vehiculo" : "/buscar";
}
