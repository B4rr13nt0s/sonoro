// Lo que baja el navegador para el selector de vehículos
// (app/buscar/vehiculos.json/route.ts). Lógica pura: recibe los vehículos
// publicados y el catálogo, y devuelve solo lo que puede salir.
//
// El filtro vive acá y no en el navegador: lo que no puede salir ni siquiera
// viaja.
//   - Receptores y bocinas por su categoría PRINCIPAL. Los Sistemas que listan
//     Bocinas como secundaria no traen atributos ni medida, así que no pueden
//     coincidir con ninguna ubicación.
//   - Activos, para carro (sin `uso` cuenta como carro, igual que en /buscar)
//     y que se puedan pedir: lo agotado no sale, lo bajo pedido sí.
//   - Las piezas que el selector nombra, si están activas y no agotadas: una
//     pieza que no viaja no se ofrece, y la bocina baja al estado «con accesorios».
import type { Producto, ProductoTarjeta } from "../catalog/types.ts";
import {
  PIEZAS_NOMBRADAS,
  type DatosVehiculos,
  type PiezaVehiculo,
  type ProductoVehiculo,
  type Vehiculo,
} from "./types.ts";

function sePuedePedir(producto: Producto): boolean {
  return producto.activo && producto.disponibilidad !== "agotado";
}

function esParaCarro(producto: Producto): boolean {
  return producto.uso === undefined || producto.uso.includes("carro");
}

function aTarjeta(producto: Producto): ProductoTarjeta {
  return {
    sku: producto.sku,
    slug: producto.slug,
    nombre: producto.nombre,
    marca: producto.marca,
    categoria: producto.categoria,
    precioCents: producto.precioCents,
    disponibilidad: producto.disponibilidad,
    destacado: producto.destacado,
    imagenes: producto.imagenes,
    specsDestacadas: producto.specsDestacadas,
  };
}

function deCategoria(productos: readonly Producto[], categoria: string): Producto[] {
  return productos.filter((p) => p.categoria === categoria && sePuedePedir(p) && esParaCarro(p));
}

export function armarDatosVehiculos(
  vehiculos: readonly Vehiculo[],
  productos: readonly Producto[],
): DatosVehiculos {
  const receptores: ProductoVehiculo[] = deCategoria(productos, "Receptores").map((p) => ({
    ...aTarjeta(p),
    ...(p.atributos?.formato ? { formato: p.atributos.formato } : {}),
  }));
  const bocinas: ProductoVehiculo[] = deCategoria(productos, "Bocinas").map((p) => ({
    ...aTarjeta(p),
    ...(p.atributos?.medida ? { medida: p.atributos.medida } : {}),
  }));
  const piezas: PiezaVehiculo[] = PIEZAS_NOMBRADAS.flatMap((sku) => {
    const pieza = productos.find((p) => p.sku === sku);
    return pieza && sePuedePedir(pieza) ? [{ sku, slug: pieza.slug, nombre: pieza.nombre }] : [];
  });
  return { vehiculos: [...vehiculos], receptores, bocinas, piezas };
}
