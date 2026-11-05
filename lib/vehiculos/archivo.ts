// data/vehiculos.json, del lado del servidor. Lo escribe
// scripts/import-vehiculos.ts y lo lee la ruta estática
// app/buscar/vehiculos.json en el build.
//
// Solo servidor: usa node:fs y zod. Ningún componente cliente lo importa; los
// tipos que necesita el navegador están en types.ts.
//
// Un archivo que no cumple el esquema LANZA: pasa en el build, y es mejor que
// el build falle a publicar un selector con datos que el importador no
// escribió.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

import {
  ESTADOS_RADIO,
  PIEZAS_NOMBRADAS,
  SCHEMA_VERSION_VEHICULOS,
  type Vehiculo,
} from "./types.ts";

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const RUTA_VEHICULOS = path.join(RAIZ, "data", "vehiculos.json");

const EstadoRadioSchema = z.enum(ESTADOS_RADIO).nullable();

const UbicacionSchema = z.strictObject({
  ubicacion: z.string().min(1),
  medidas: z.array(z.string().min(1)).min(1),
  accesorio: z.enum([...PIEZAS_NOMBRADAS, "otro"]).nullable(),
});

const VehiculoSchema = z.strictObject({
  marca: z.string().min(1),
  marcaSlug: z.string().min(1),
  modelo: z.string().min(1),
  modeloSlug: z.string().min(1),
  version: z.string().min(1).nullable(),
  versionSlug: z.string().min(1).nullable(),
  desde: z.number().int(),
  hasta: z.number().int(),
  radio1din: EstadoRadioSchema,
  radio2din: EstadoRadioSchema,
  ubicaciones: z.array(UbicacionSchema),
});

const VehiculosArchivoSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION_VEHICULOS),
  vehiculos: z.array(VehiculoSchema),
});

export function parsearVehiculosArchivo(json: unknown): Vehiculo[] {
  const resultado = VehiculosArchivoSchema.safeParse(json);
  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`data/vehiculos.json no es válido: ${problemas}`);
  }
  return resultado.data.vehiculos;
}

export async function leerVehiculos(): Promise<Vehiculo[]> {
  return parsearVehiculosArchivo(JSON.parse(await readFile(RUTA_VEHICULOS, "utf-8")));
}
