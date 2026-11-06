// Tipos del selector de vehículos (docs/superpowers/specs/2026-11-04-selector-vehiculos-design.md).
//
// TS puro y sin zod, a propósito: lo importan el bloque de /buscar y las
// reglas de compatibilidad, que van en el bundle del navegador. El esquema
// zod con que se valida data/vehiculos.json vive en archivo.ts, que solo
// corre en el servidor.
import type { Atributos, ProductoTarjeta } from "../catalog/types.ts";

// Lo que dice la guía para cada tamaño de radio: cabe directo, cabe con un
// marco (kit de tablero), o no hay solución. Sin dato, el campo es null.
export const ESTADOS_RADIO = ["directo", "con_marco", "no_cabe"] as const;
export type EstadoRadio = (typeof ESTADOS_RADIO)[number];

// Las únicas piezas que el selector nombra, con enlace a su ficha. Cualquier
// otro accesorio es «otro» y queda en estado «con accesorios», que en pantalla va sin texto.
export const PIEZAS_NOMBRADAS = ["OEMBKT60", "OEMBKT69", "KSM-8"] as const;
export type PiezaNombrada = (typeof PIEZAS_NOMBRADAS)[number];
export type Accesorio = PiezaNombrada | "otro";

export const SCHEMA_VERSION_VEHICULOS = 1;

export interface UbicacionVehiculo {
  ubicacion: string; // «Puertas delanteras», de la hoja LISTAS
  medidas: string[]; // escritas como la `medida` de las bocinas del catálogo
  accesorio: Accesorio | null;
}

export interface Vehiculo {
  marca: string;
  marcaSlug: string;
  modelo: string;
  modeloSlug: string;
  version: string | null;
  versionSlug: string | null;
  desde: number;
  hasta: number;
  radio1din: EstadoRadio | null;
  radio2din: EstadoRadio | null;
  ubicaciones: UbicacionVehiculo[];
}

export interface VehiculosArchivo {
  schemaVersion: typeof SCHEMA_VERSION_VEHICULOS;
  vehiculos: Vehiculo[];
}

/** Un receptor o una bocina tal como viaja al navegador: la tarjeta más el dato que se compara. */
export type ProductoVehiculo = ProductoTarjeta & {
  formato?: Atributos["formato"];
  medida?: Atributos["medida"];
};

export interface PiezaVehiculo {
  sku: PiezaNombrada;
  slug: string;
  nombre: string;
}

/** Lo que baja /buscar/vehiculos.json. */
export interface DatosVehiculos {
  vehiculos: Vehiculo[];
  receptores: ProductoVehiculo[];
  bocinas: ProductoVehiculo[];
  piezas: PiezaVehiculo[];
}
