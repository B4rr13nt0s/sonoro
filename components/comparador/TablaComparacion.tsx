import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { ConsultarWhatsAppButton } from "@/components/product/ConsultarWhatsAppButton";
import { etiquetaDisponibilidad } from "@/lib/catalog/disponibilidad.ts";
import type { Producto } from "@/lib/catalog/index.ts";
import { construirFilas, SIN_DATO } from "@/lib/comparador/index.ts";
import { formatQ } from "@/lib/format/precio.ts";
import { absoluteUrl } from "@/lib/seo/site.ts";

// Tabla comparativa. Server Component: lo único interactivo son los dos
// botones de cada columna, que ya son islas cliente por su cuenta.
//
// SEÑALA DIFERENCIAS, NUNCA RECOMIENDA (CLAUDE.md § reglas 2). Acá no hay
// ganador, ni orden por «mejor valor», ni insignias: marcar que dos valores
// diferen es un hecho; decir cuál conviene es asesoría.
//
// Cuatro decisiones de CSS que no son opcionales, porque el repo no tenía
// ninguna <table> y cada una falla de forma distinta:
//
//  1. `border-separate border-spacing-0`. Tailwind pone
//     `border-collapse: collapse` en preflight, y con bordes colapsados los
//     pinta la TABLA, no la celda: la columna pegada se mueve y sus bordes se
//     quedan atrás. Con border-separate cada celda pinta el suyo y viaja con
//     ella — y así se resuelve sin sombras, que CLAUDE.md prohíbe.
//  2. La columna de etiquetas va `sticky left-0` CON fondo propio, o se
//     transparenta el contenido que pasa por debajo.
//  3. El snap va en cada celda, no en <col>: un <col> no genera una caja que
//     sirva de destino de scroll-snap.
//  4. `scroll-padding-left` igual al ancho de la columna pegada, o cada
//     columna aterriza justo debajo de ella.
//
// No hay fila de encabezado pegada arriba: un contenedor con overflow-x
// se vuelve contenedor de scroll en los DOS ejes, así que un `sticky top`
// dentro se resuelve contra él —que nunca scrollea en vertical— y no contra
// la ventana. La columna sí funciona porque el eje horizontal sí lo scrollea
// ese contenedor. No son simétricas.

// En móvil los anchos son EXACTOS y con max-w: una celda de tabla trata
// `width` como sugerencia, así que sin el tope el reparto automático estiraba
// la columna de etiquetas a 113px y dejaba la segunda columna cortada.
// 104 + 2×128 = 360, o sea dos columnas completas por pantalla.
const ANCHO_ETIQUETAS = "w-26 max-w-26 min-w-26 sm:w-50 sm:max-w-none sm:min-w-50";
const ANCHO_COLUMNA = "w-32 min-w-32 sm:w-auto sm:min-w-45";
// Igual al ancho de la columna pegada, o cada columna aterriza justo debajo
// de ella al hacer snap.
const SCROLL_PADDING_MOVIL = "6.5rem";

export function TablaComparacion({ productos }: { productos: Producto[] }) {
  const filas = construirFilas(productos);

  return (
    <div className="flex flex-col gap-4">
      {/* A sangre en móvil para ganar el ancho que hace entrar dos columnas
          completas en 360px. SIN padding horizontal: con `px-6` el padding
          entra en el contenido scrolleable, la columna pegada queda a x=24 en
          vez de x=0 y el snap deja cada columna 24px por debajo de ella. */}
      <div
        className="-mx-6 overflow-x-auto sm:mx-0"
        style={{ scrollSnapType: "x proximity", scrollPaddingLeft: SCROLL_PADDING_MOVIL }}
      >
        <table className="w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">
            Comparación de especificaciones. Las filas resaltadas son aquellas donde los valores
            difieren entre todos los productos comparados.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className={`border-borde-tarjeta sticky left-0 z-10 border-r border-b bg-white p-3 align-bottom ${ANCHO_ETIQUETAS}`}
              >
                <span className="sr-only">Especificación</span>
              </th>
              {productos.map((producto) => (
                <th
                  key={producto.sku}
                  scope="col"
                  style={{ scrollSnapAlign: "start" }}
                  className={`border-borde-tarjeta border-b p-3 align-bottom ${ANCHO_COLUMNA}`}
                >
                  <span className="flex flex-col gap-1">
                    <span className="text-texto-terciario font-mono text-[10px] tracking-[0.14em] uppercase">
                      {producto.marca}
                    </span>
                    <span className="text-[15px] leading-tight font-semibold tracking-[-0.01em]">
                      {producto.nombre}
                    </span>
                    <span className="pt-1 text-[15px] font-semibold">
                      {formatQ(producto.precioCents)}
                    </span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            <FilaDisponibilidad productos={productos} />
            {filas.map((fila) => (
              <tr key={fila.etiqueta} className={fila.difieren ? "bg-fondo-alt" : undefined}>
                <th
                  scope="row"
                  className={`border-borde-tarjeta sticky left-0 z-10 border-r border-b p-3 align-top text-[13px] ${
                    fila.difieren ? "bg-fondo-alt font-medium" : "text-texto-secundario bg-white"
                  } ${ANCHO_ETIQUETAS}`}
                >
                  {fila.etiqueta}
                </th>
                {fila.valores.map((valor, indice) => (
                  <td
                    key={productos[indice].sku}
                    style={{ scrollSnapAlign: "start" }}
                    className={`border-borde-tarjeta border-b p-3 align-top text-[14px] ${
                      valor === SIN_DATO ? "text-texto-terciario" : ""
                    } ${ANCHO_COLUMNA}`}
                  >
                    {valor}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <th
                scope="row"
                className={`sticky left-0 z-10 border-r border-transparent bg-white p-3 ${ANCHO_ETIQUETAS}`}
              >
                <span className="sr-only">Acciones</span>
              </th>
              {productos.map((producto) => (
                <td
                  key={producto.sku}
                  style={{ scrollSnapAlign: "start" }}
                  className={`p-3 align-top ${ANCHO_COLUMNA}`}
                >
                  {/* `flex-1` de claseBoton no hace nada dentro de un <td>:
                      la celda no es contenedor flex. Este envoltorio lo es. */}
                  <span className="flex flex-col gap-2">
                    <AddToCartButton producto={producto} tamano="compacto" />
                    <ConsultarWhatsAppButton
                      producto={producto}
                      url={absoluteUrl(`/producto/${producto.slug}`)}
                      variante="secundario"
                      tamano="compacto"
                    />
                  </span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="text-texto-terciario flex flex-col gap-1 font-mono text-[11px] tracking-[0.06em]">
        <span>Filas resaltadas: los valores difieren.</span>
        <span>
          «{SIN_DATO}»: el fabricante no publica ese dato para ese producto, así que la fila no se
          compara.
        </span>
        {/* CLAUDE.md § Esquema de producto: la ficha técnica cierra SIEMPRE
            con esta línea, y esto es una superficie de ficha técnica. */}
        <span>Datos publicados por el fabricante.</span>
      </div>
    </div>
  );
}

// Disponibilidad va como primera fila y no dentro de construirFilas() porque
// no viene de specsFicha: es un campo propio del producto.
function FilaDisponibilidad({ productos }: { productos: Producto[] }) {
  const etiquetas = productos.map((p) => etiquetaDisponibilidad(p.disponibilidad));
  // etiquetaDisponibilidad devuelve null para «disponible» a propósito
  // (etiquetar lo normal es copy de relleno). Si ninguno tiene excepción, la
  // fila entera sobra.
  if (etiquetas.every((e) => e === null)) return null;

  return (
    <tr>
      <th
        scope="row"
        className="border-borde-tarjeta text-texto-secundario sticky left-0 z-10 w-24 min-w-24 border-r border-b bg-white p-3 align-top text-[13px] sm:w-50 sm:min-w-50"
      >
        Disponibilidad
      </th>
      {productos.map((producto, indice) => (
        <td
          key={producto.sku}
          style={{ scrollSnapAlign: "start" }}
          className={`border-borde-tarjeta border-b p-3 align-top text-[14px] ${
            etiquetas[indice] === null ? "text-texto-terciario" : ""
          } ${ANCHO_COLUMNA}`}
        >
          {etiquetas[indice] ?? SIN_DATO}
        </td>
      ))}
    </tr>
  );
}
