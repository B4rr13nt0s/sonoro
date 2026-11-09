// Los bloques de «¿qué le queda a mi carro?» en el chat: lo que falta
// preguntar, el resumen de lo que cabe y los productos de un grupo
// (docs/superpowers/specs/2026-11-06-chat-compatibilidad-design.md).
//
// Las reglas son las del selector de /buscar —resolverSeleccion y
// compatibilidad—, no una copia: el chat y la página no pueden contestar
// distinto. Regla 2: nada ranquea; el orden es el de compatibilidad().
import { hrefPestana } from "../busqueda/pestana.ts";
import { INSTALACION } from "../politicas.ts";
import { compatibilidad, hayResultados, type Compatibilidad } from "../vehiculos/compatibilidad.ts";
import {
  ERROR_CARGA,
  ETIQUETA_WHATSAPP_VEHICULO,
  NO_ESTA_VEHICULO,
  SIN_RESULTADOS,
  TEXTO_PEDIR_VEHICULO,
  VER_TODO_BUSCAR,
  lineaConsultar,
  lineaReceptores,
  lineaUbicacion,
  lineaUbicacionVacia,
  notaReceptor,
  textoFueraDeLista,
  textoPedirAnio,
  textoPedirModelo,
  textoPedirVersion,
  tituloConRango,
  tituloGrupo,
  tituloVehiculo,
} from "../vehiculos/textos.ts";
import type { DatosVehiculos } from "../vehiculos/types.ts";
import {
  escribirSeleccion,
  hrefVehiculo,
  leerSeleccion,
  resolverSeleccion,
  type Seleccion,
} from "../vehiculos/url.ts";
import { buildVehicleInquiryMessage } from "../whatsapp/message.ts";
import { MAX_PRODUCTOS_CHAT, type Bloque, type OpcionId } from "./tipos.ts";
import { etiquetaGeneracion, generaciones } from "./vehiculo.ts";

/** Qué grupo del resumen se quiere ver: los receptores o una ubicación (por su índice). */
export type Ver = { tipo: "receptores" } | { tipo: "ubicacion"; indice: number };

export interface PedidoVehiculo {
  sel: Seleccion;
  /** El año salió de un botón de generación o se eligió solo: el título lleva el rango. */
  rango: boolean;
  ver: Ver | null;
}

export interface RespuestaVehiculo {
  bloques: Bloque[];
  /** El título del vehículo, cuando la respuesta ya sabe cuál es. */
  titulo: string | null;
  /** Solo en el resumen: receptores más bocinas, para el registro. */
  resultados: number | null;
}

const PREFIJO = "vehiculo:";

/** El botón lleva la dirección de /buscar sin el «?», más `rango` y `ver`. */
export function idOpcionVehiculo(pedido: PedidoVehiculo): OpcionId {
  const params = new URLSearchParams(escribirSeleccion(pedido.sel));
  if (pedido.rango) params.set("rango", "1");
  if (pedido.ver) {
    params.set(
      "ver",
      pedido.ver.tipo === "receptores" ? "receptores" : `ubicacion-${pedido.ver.indice}`,
    );
  }
  return `vehiculo:${params.toString()}`;
}

export function leerOpcionVehiculo(id: string): PedidoVehiculo | null {
  if (!id.startsWith(PREFIJO)) return null;
  const consulta = id.slice(PREFIJO.length);
  const params = new URLSearchParams(consulta);
  const verTexto = params.get("ver");
  const ubicacion = verTexto ? /^ubicacion-(\d+)$/.exec(verTexto) : null;
  const ver: Ver | null =
    verTexto === "receptores"
      ? { tipo: "receptores" }
      : ubicacion
        ? { tipo: "ubicacion", indice: Number(ubicacion[1]) }
        : null;
  return { sel: leerSeleccion(consulta), rango: params.get("rango") === "1", ver };
}

function texto(t: string): Bloque {
  return { tipo: "texto", texto: t };
}

function botones(opciones: { id: OpcionId; etiqueta: string }[]): Bloque {
  return { tipo: "opciones", opciones };
}

function whatsapp(): Bloque {
  return {
    tipo: "whatsapp",
    etiqueta: ETIQUETA_WHATSAPP_VEHICULO,
    motivo: "hablar",
    mensaje: buildVehicleInquiryMessage(),
  };
}

function pregunta(bloques: Bloque[]): RespuestaVehiculo {
  return { bloques, titulo: null, resultados: null };
}

/** Sin los datos del selector: el error de /buscar y el enlace a la pestaña. */
export function bloquesSinVehiculos(): Bloque[] {
  return [
    {
      tipo: "texto",
      texto: ERROR_CARGA,
      enlace: { etiqueta: "Buscar por vehículo", href: hrefPestana("vehiculo"), despues: "." },
    },
  ];
}

/** Los botones de los grupos con productos, menos el que se está viendo. */
function botonesDeGrupos(
  compat: Compatibilidad,
  sel: Seleccion,
  rango: boolean,
  actual: Ver | null,
): Bloque | null {
  const opciones: { id: OpcionId; etiqueta: string }[] = [];
  if (compat.receptores.length > 0 && actual?.tipo !== "receptores") {
    opciones.push({
      id: idOpcionVehiculo({ sel, rango, ver: { tipo: "receptores" } }),
      etiqueta: "Receptores",
    });
  }
  compat.grupos.forEach((grupo, indice) => {
    if (grupo.bocinas.length === 0) return;
    if (actual?.tipo === "ubicacion" && actual.indice === indice) return;
    opciones.push({
      id: idOpcionVehiculo({ sel, rango, ver: { tipo: "ubicacion", indice } }),
      etiqueta: tituloGrupo(grupo),
    });
  });
  return opciones.length > 0 ? botones(opciones) : null;
}

function resumen(
  compat: Compatibilidad,
  titulo: string,
  sel: Seleccion,
  rango: boolean,
): RespuestaVehiculo {
  const bloques: Bloque[] = [texto(titulo)];
  if (!hayResultados(compat)) {
    bloques.push(texto(SIN_RESULTADOS), whatsapp());
    return { bloques, titulo, resultados: 0 };
  }

  const cabe = compat.receptores.filter((r) => r.estado.tipo === "cabe").length;
  const conAccesorios = compat.receptores.filter((r) => r.estado.tipo === "con_accesorios").length;
  if (cabe + conAccesorios > 0) bloques.push(texto(lineaReceptores({ cabe, conAccesorios })));
  for (const r of compat.receptores) {
    if (r.estado.tipo === "consultar") bloques.push(texto(lineaConsultar(r.producto.nombre)));
  }

  for (const grupo of compat.grupos) {
    if (grupo.bocinas.length === 0) {
      bloques.push(texto(lineaUbicacionVacia(grupo)));
      continue;
    }
    const linea = lineaUbicacion(grupo, grupo.bocinas.length, grupo.bocinas[0].estado);
    bloques.push(linea.enlace ? { tipo: "texto", ...linea } : texto(linea.texto));
  }

  bloques.push(texto(INSTALACION));
  const grupos = botonesDeGrupos(compat, sel, rango, null);
  if (grupos) bloques.push(grupos);
  bloques.push({
    tipo: "texto",
    texto: "",
    enlace: { etiqueta: VER_TODO_BUSCAR, href: hrefVehiculo(sel) },
  });

  const resultados =
    compat.receptores.length + compat.grupos.reduce((n, g) => n + g.bocinas.length, 0);
  return { bloques, titulo, resultados };
}

function grupo(
  compat: Compatibilidad,
  ver: Ver,
  titulo: string,
  sel: Seleccion,
  rango: boolean,
): RespuestaVehiculo | null {
  const elegido =
    ver.tipo === "receptores"
      ? compat.receptores.length > 0
        ? { nombre: "Receptores", items: compat.receptores }
        : null
      : (() => {
          const g = compat.grupos[ver.indice];
          return g && g.bocinas.length > 0 ? { nombre: tituloGrupo(g), items: g.bocinas } : null;
        })();
  if (!elegido) return null;

  const skus = elegido.items.slice(0, MAX_PRODUCTOS_CHAT).map((i) => i.producto.sku);
  const notas: Record<string, string> = {};
  for (const sku of skus) {
    const nota = notaReceptor(sku);
    if (nota) notas[sku] = nota;
  }
  const bloques: Bloque[] = [
    texto(`${elegido.nombre} · ${titulo}`),
    {
      tipo: "productos",
      skus,
      total: elegido.items.length,
      verTodosHref: hrefVehiculo(sel),
      ...(Object.keys(notas).length > 0 ? { notas } : {}),
    },
  ];
  const otros = botonesDeGrupos(compat, sel, rango, ver);
  if (otros) bloques.push(otros);
  return { bloques, titulo, resultados: null };
}

export function responderVehiculo(
  pedido: PedidoVehiculo,
  datos: DatosVehiculos,
): RespuestaVehiculo {
  const { sel, rango } = pedido;
  const r = resolverSeleccion(datos.vehiculos, sel);

  if (!r.marca) {
    return pregunta([
      texto(TEXTO_PEDIR_VEHICULO),
      botones(
        r.opciones.marcas.map((m) => ({
          id: idOpcionVehiculo({ sel: { marca: m.slug }, rango: false, ver: null }),
          etiqueta: m.nombre,
        })),
      ),
      // Una lancha, un UTV o un carro que la lista no trae: la salida de /buscar.
      texto(NO_ESTA_VEHICULO),
      whatsapp(),
    ]);
  }
  const marca = r.marca;

  if (!r.modelo) {
    return pregunta([
      texto(textoPedirModelo(marca.nombre)),
      botones(
        r.opciones.modelos.map((m) => ({
          // El año escrito («toyota 2010») viaja con el modelo.
          id: idOpcionVehiculo({
            sel: { marca: marca.slug, modelo: m.slug, ...(sel.anio ? { anio: sel.anio } : {}) },
            rango: false,
            ver: null,
          }),
          etiqueta: m.nombre,
        })),
      ),
    ]);
  }
  const modelo = r.modelo;
  const base = { marca: marca.slug, modelo: modelo.slug };
  const gens = generaciones(datos.vehiculos, marca.slug, modelo.slug);

  if (r.anio === null) {
    const botonesAnio = botones(
      gens.map((g) => ({
        id: idOpcionVehiculo({ sel: { ...base, anio: g.desde }, rango: true, ver: null }),
        etiqueta: etiquetaGeneracion(g),
      })),
    );
    if (sel.anio !== undefined) {
      return pregunta([
        texto(textoFueraDeLista(marca.nombre, modelo.nombre, sel.anio)),
        botonesAnio,
        texto(NO_ESTA_VEHICULO),
        whatsapp(),
      ]);
    }
    if (gens.length === 1) {
      return responderVehiculo(
        { sel: { ...base, anio: gens[0].desde }, rango: true, ver: pedido.ver },
        datos,
      );
    }
    return pregunta([texto(textoPedirAnio(marca.nombre, modelo.nombre)), botonesAnio]);
  }
  const anio = r.anio;

  if (!r.vehiculo) {
    const gen = gens.find((g) => g.desde <= anio && anio <= g.hasta);
    const cuando = rango && gen ? etiquetaGeneracion(gen) : String(anio);
    return pregunta([
      texto(textoPedirVersion(`${marca.nombre} ${modelo.nombre} ${cuando}`)),
      botones(
        r.opciones.versiones.map((v) => ({
          id: idOpcionVehiculo({ sel: { ...base, anio, version: v.slug }, rango, ver: null }),
          etiqueta: v.nombre,
        })),
      ),
    ]);
  }

  const vehiculo = r.vehiculo;
  const titulo = rango
    ? tituloConRango(vehiculo, etiquetaGeneracion({ desde: vehiculo.desde, hasta: vehiculo.hasta }))
    : tituloVehiculo(vehiculo, anio);
  const elegida: Seleccion = { ...base, anio, ...(r.version ? { version: r.version.slug } : {}) };
  const compat = compatibilidad(vehiculo, datos);
  if (pedido.ver) {
    const respuesta = grupo(compat, pedido.ver, titulo, elegida, rango);
    if (respuesta) return respuesta;
  }
  return resumen(compat, titulo, elegida, rango);
}
