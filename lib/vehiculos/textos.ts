// Los textos del selector de vehículos que dependen de los datos, en un solo
// lugar. Copy para el cliente con tú (CLAUDE.md).
import type { EstadoCompat, GrupoBocinas } from "./compatibilidad.ts";
import type { Vehiculo } from "./types.ts";

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

/** En el chat no hay título de grupo encima: la línea vacía lleva su ubicación. */
export function lineaUbicacionVacia(grupo: Pick<GrupoBocinas, "ubicacion" | "medidas">): string {
  const cual = grupo.medidas.length === 1 ? "esa medida" : "esas medidas";
  return `${tituloGrupo(grupo)}: no hay bocinas de ${cual} en el catálogo.`;
}

// --- El chat: «¿qué le queda a mi carro?» --------------------------------
// (docs/superpowers/specs/2026-11-06-chat-compatibilidad-design.md)

export const TEXTO_PEDIR_VEHICULO =
  "Escribe la marca, el modelo y el año de tu carro, por ejemplo «Toyota Corolla 2010».";
export const NO_ESTA_VEHICULO = "¿No está tu vehículo?";
export const ETIQUETA_WHATSAPP_VEHICULO = "Escríbenos por WhatsApp";
export const VER_TODO_BUSCAR = "Ver todo en Buscar";

export function textoPedirModelo(marca: string): string {
  return `¿Qué modelo de ${marca}?`;
}

export function textoPedirAnio(marca: string, modelo: string): string {
  return `¿De qué año es tu ${marca} ${modelo}?`;
}

export function textoFueraDeLista(marca: string, modelo: string, anio: number): string {
  return `No tengo el ${marca} ${modelo} ${anio} en la lista.`;
}

export function textoPedirVersion(titulo: string): string {
  return `¿Cuál es tu ${titulo}?`;
}

/** El título con el rango de la generación («2003–2018») en lugar de un año. */
export function tituloConRango(
  vehiculo: Pick<Vehiculo, "marca" | "modelo" | "version">,
  rango: string,
): string {
  const base = `${vehiculo.marca} ${vehiculo.modelo} ${rango}`;
  return vehiculo.version ? `${base} · ${vehiculo.version}` : base;
}

function verbo(cantidad: number): string {
  return cantidad === 1 ? "cabe" : "caben";
}

/** «Receptores: 4 caben y 6 caben con accesorios.» Sin ninguno, el resumen no la dibuja. */
export function lineaReceptores(conteo: { cabe: number; conAccesorios: number }): string {
  const partes: string[] = [];
  if (conteo.cabe > 0) partes.push(`${conteo.cabe} ${verbo(conteo.cabe)}`);
  if (conteo.conAccesorios > 0) {
    partes.push(`${conteo.conAccesorios} ${verbo(conteo.conAccesorios)} con accesorios`);
  }
  return `Receptores: ${partes.join(" y ")}.`;
}

/** Un receptor cuyo marco depende del vehículo (PANTALLAS_ESPECIALES, «consultar»). */
export function lineaConsultar(nombre: string): string {
  return `${nombre}: también puede ir, pero su marco depende del vehículo; escríbenos por WhatsApp.`;
}

/**
 * Una ubicación del resumen. Todas sus bocinas caben igual: el accesorio es de
 * la ubicación. La pieza va sin artículo, porque los nombres del catálogo
 * mezclan singular y plural («Adaptadores de bocina…»).
 */
export function lineaUbicacion(
  grupo: Pick<GrupoBocinas, "ubicacion" | "medidas">,
  cantidad: number,
  estado: EstadoCompat,
): { texto: string; enlace?: { etiqueta: string; href: string; despues: string } } {
  const inicio = `${tituloGrupo(grupo)}: ${cantidad} ${cantidad === 1 ? "bocina" : "bocinas"}, ${verbo(cantidad)}`;
  if (estado.tipo === "con_pieza") {
    return {
      texto: `${inicio} con`,
      enlace: {
        etiqueta: estado.pieza.nombre,
        href: `/producto/${estado.pieza.slug}`,
        despues: ".",
      },
    };
  }
  return { texto: estado.tipo === "con_accesorios" ? `${inicio} con accesorios.` : `${inicio}.` };
}
