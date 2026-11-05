// Qué receptores y bocinas caben en un vehículo, y cómo.
//
// Es información de compatibilidad, no asesoría (CLAUDE.md, regla 2): que un
// receptor quepa en el tablero de un Corolla es un dato de la guía del
// fabricante de marcos. Nada acá ranquea ni recomienda; el único orden
// propio es el ESTADO (cabe, cabe con una pieza, cabe con accesorios,
// consultar), que también es un dato, y dentro de cada estado el mismo orden
// de los listados (compararRelevancia).
//
// Lógica pura, sin React ni DOM: corre en el navegador sobre lo que baja
// /buscar/vehiculos.json.
import { compararRelevancia } from "../catalog/orden.ts";
import { PANTALLAS_ESPECIALES } from "./especiales.ts";
import type {
  DatosVehiculos,
  EstadoRadio,
  PiezaVehiculo,
  ProductoVehiculo,
  UbicacionVehiculo,
  Vehiculo,
} from "./types.ts";

export type EstadoCompat =
  | { tipo: "cabe" }
  | { tipo: "con_pieza"; pieza: PiezaVehiculo }
  | { tipo: "con_accesorios" }
  | { tipo: "consultar" };

export interface ProductoCompatible {
  producto: ProductoVehiculo;
  estado: EstadoCompat;
}

export interface GrupoBocinas {
  ubicacion: string;
  medidas: string[];
  bocinas: ProductoCompatible[];
}

export interface Compatibilidad {
  receptores: ProductoCompatible[];
  grupos: GrupoBocinas[];
}

const RANGO: Record<EstadoCompat["tipo"], number> = {
  cabe: 0,
  con_pieza: 1,
  con_accesorios: 2,
  consultar: 3,
};

function ordenar(lista: ProductoCompatible[]): ProductoCompatible[] {
  return lista.sort(
    (a, b) =>
      RANGO[a.estado.tipo] - RANGO[b.estado.tipo] || compararRelevancia(a.producto, b.producto),
  );
}

function estadoDeRadio(radio: EstadoRadio | null): EstadoCompat | null {
  if (radio === "directo") return { tipo: "cabe" };
  if (radio === "con_marco") return { tipo: "con_accesorios" };
  return null;
}

function estadoDeReceptor(producto: ProductoVehiculo, vehiculo: Vehiculo): EstadoCompat | null {
  // Las dos pantallas especiales van primero, por su código: hoy su formato
  // dice «flotante» y mañana dirá «especifico», y la regla es la misma.
  const especial = PANTALLAS_ESPECIALES[producto.sku];
  if (especial === "consultar") return { tipo: "consultar" };
  if (especial === "1-o-2-din") {
    const columnas = [vehiculo.radio1din, vehiculo.radio2din];
    if (columnas.includes("directo")) return { tipo: "cabe" };
    if (columnas.includes("con_marco")) return { tipo: "con_accesorios" };
    return null;
  }
  // La guía solo tiene columnas de 1 y 2 DIN: cualquier otro formato
  // (específico, flotante o sin dato) no sale.
  if (producto.formato === "1-din") return estadoDeRadio(vehiculo.radio1din);
  if (producto.formato === "2-din") return estadoDeRadio(vehiculo.radio2din);
  return null;
}

function estadoDeUbicacion(
  ubicacion: UbicacionVehiculo,
  piezas: readonly PiezaVehiculo[],
): EstadoCompat {
  if (ubicacion.accesorio === null) return { tipo: "cabe" };
  if (ubicacion.accesorio === "otro") return { tipo: "con_accesorios" };
  // Una pieza que no viene en los datos (agotada o inactiva) no se puede
  // pedir: no se nombra, y la bocina queda «con accesorios».
  const pieza = piezas.find((p) => p.sku === ubicacion.accesorio);
  return pieza ? { tipo: "con_pieza", pieza } : { tipo: "con_accesorios" };
}

export function compatibilidad(
  vehiculo: Vehiculo,
  datos: Pick<DatosVehiculos, "receptores" | "bocinas" | "piezas">,
): Compatibilidad {
  const receptores = ordenar(
    datos.receptores.flatMap((producto) => {
      const estado = estadoDeReceptor(producto, vehiculo);
      return estado ? [{ producto, estado }] : [];
    }),
  );

  // Igualdad exacta de texto: 6.75" no entra en 6.5", ni 6x9" en 6".
  const grupos = vehiculo.ubicaciones.map((ubicacion) => {
    const estado = estadoDeUbicacion(ubicacion, datos.piezas);
    const bocinas = datos.bocinas
      .filter((b) => b.medida !== undefined && ubicacion.medidas.includes(b.medida))
      .map((producto) => ({ producto, estado }));
    return {
      ubicacion: ubicacion.ubicacion,
      medidas: ubicacion.medidas,
      bocinas: ordenar(bocinas),
    };
  });

  return { receptores, grupos };
}

export function hayResultados(c: Compatibilidad): boolean {
  return c.receptores.length > 0 || c.grupos.some((g) => g.bocinas.length > 0);
}
