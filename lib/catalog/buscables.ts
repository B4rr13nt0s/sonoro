import {
  clavesDeAtributos,
  numerosDeAtributos,
  type ProductoBuscable,
} from "../busqueda/busqueda.ts";
import type { Producto } from "./types.ts";

// Va acotado a ProductoTarjeta y no al producto entero: esto viaja a CADA
// visitante dentro del HTML, y `specsFicha` y `atributos` —ficha técnica y
// materia prima de los filtros— no se usan en la búsqueda. Con el producto
// completo eran 452 KB por visita.
export function tarjetasBuscables(productos: readonly Producto[]): ProductoBuscable[] {
  return productos.map((producto) => ({
    sku: producto.sku,
    slug: producto.slug,
    nombre: producto.nombre,
    marca: producto.marca,
    categoria: producto.categoria,
    // Para agrupar los Sistemas en sus categorías, como los listados.
    ...(producto.categoriasSecundarias
      ? { categoriasSecundarias: producto.categoriasSecundarias }
      : {}),
    precioCents: producto.precioCents,
    disponibilidad: producto.disponibilidad,
    destacado: producto.destacado,
    imagenes: producto.imagenes,
    specsDestacadas: producto.specsDestacadas,
    // Los atributos como palabras de búsqueda (`12"`, `4ohm`, `clase-d`…):
    // unas pocas por producto, en lugar de mandar `atributos` entero.
    claves: clavesDeAtributos(producto.atributos),
    // Para «más de 500 W», «de 8 a 10 pulgadas» y la categoría (carro, marino,
    // motorsports): los números ya sacados, no el objeto entero.
    ...numerosDeAtributos(producto.atributos),
    ...(producto.uso ? { uso: producto.uso } : {}),
  }));
}
