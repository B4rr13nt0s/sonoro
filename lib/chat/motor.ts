// El motor del chat: una función pura que convierte lo que el cliente escribe
// o elige en bloques tipados. Sin React, sin DOM y sin variables de entorno
// (el contacto llega por `Contexto`), para probarlo con `node --test`.
// Spec: docs/superpowers/specs/2026-11-02-chatbot-design.md § Conversación.

import {
  acoteDeId,
  aplicarAcotes,
  canalesDe,
  cercanosEnLista,
  describirAcote,
  gruposDeAcote,
  hrefAcotado,
  idDeAcote,
  medidasDe,
  type Acote,
} from "../busqueda/acotar.ts";
import {
  buscar,
  normalizar,
  specsCoincidentes,
  sugerir,
  type ProductoBuscable,
  type ResultadoBusqueda,
} from "../busqueda/busqueda.ts";
import { CATEGORIAS_SITIO, perteneceACategoria } from "../catalog/categorias.ts";
import { compararRelevancia } from "../catalog/orden.ts";
import type { Spec } from "../catalog/types.ts";
import { buildAvailabilityInquiryMessage } from "../whatsapp/message.ts";
import {
  fraseDisponibilidad,
  frasePrecio,
  valorDisponibilidad,
  valoresDeCampo,
  type Campo,
  type CampoSpec,
} from "./datos.ts";
import {
  TEXTOS_CHARLA,
  TEXTO_QUE_MAS,
  TEXTO_TIPO_EQUIPO,
  fraseResultados,
  pregunta,
  preguntaVaga,
  type ClaseCharla,
} from "./charla.ts";
import { consultaVisible, detectarIntencion } from "./intencion.ts";
import { accionDe } from "./referencia.ts";
import { aplicarCambios, fraseCambios, type Cambio } from "./seguimiento.ts";
import {
  bloquesSinVehiculos,
  leerOpcionVehiculo,
  responderVehiculo,
  type PedidoVehiculo,
} from "./respuestaVehiculo.ts";
import { resolverSeleccion } from "../vehiculos/url.ts";
import { anioSolo, excluyeVehiculo, leerVehiculo, tieneFraseVehiculo } from "./vehiculo.ts";
import {
  TEXTO_DATOS_FABRICANTE,
  TEXTO_PEDIR_BUSQUEDA,
  TEXTO_PEDIR_PRODUCTO,
  TEXTO_SIN_CATALOGO,
  bloqueHablar,
  bloquesDeInicio,
  bloquesDeRecomendacion,
  TEMA_NOMBRE,
  bloquesDeTema,
  opcionesHablar,
  opcionesTemaYHablar,
} from "./respuestas.ts";
import {
  MAX_CONSULTA,
  MAX_PRODUCTOS_CHAT,
  type Bloque,
  type BusquedaAcotable,
  type Contexto,
  type Entrada,
  type Estado,
  type EventoChat,
  type Tema,
} from "./tipos.ts";

export { bloquesDeInicio };

export { MAX_PRODUCTOS_CHAT };

export const ESTADO_INICIAL: Estado = { ultimaConsulta: null, ultimoTema: null };

interface Respuesta {
  estado: Estado;
  bloques: Bloque[];
  evento: EventoChat | null;
}

function saludo(estado: Estado): Respuesta {
  return { estado, bloques: bloquesDeInicio(), evento: null };
}

function responderTema(tema: Tema, contexto: Contexto): Respuesta {
  return {
    estado: { ultimaConsulta: null, ultimoTema: tema },
    bloques: bloquesDeTema(tema, contexto.contacto),
    evento: { evento: "tema", tema },
  };
}

function sinCatalogo(estado: Estado): Respuesta {
  return {
    estado,
    bloques: [
      {
        tipo: "texto",
        texto: TEXTO_SIN_CATALOGO,
        enlace: { etiqueta: "Ir a Buscar", href: "/buscar" },
      },
      opcionesHablar(),
    ],
    evento: null,
  };
}

/**
 * Busca `consulta` (normalizada) en el catálogo. `visible` es la misma
 * consulta como la escribió el cliente: es la que se muestra, se enlaza y se
 * manda por WhatsApp (el mensaje promete «tal cual la escribió»). Solo la
 * búsqueda usa la normalizada. `verTodosHref` es el destino de «ver todos»:
 * por defecto la misma búsqueda en /buscar; una categoría o una marca lleva
 * al suyo.
 */
function responderBusqueda(
  consulta: string,
  visible: string,
  contexto: Contexto,
  verTodosHref?: string,
  opcionTema?: Tema,
  turno = 0,
): Respuesta {
  // Con un tema de palabra ambigua que quedó de lado, el estado lo conserva
  // junto a la consulta: «Hablar con Sonoro» lleva las dos cosas.
  const estado: Estado = { ultimaConsulta: visible, ultimoTema: opcionTema ?? null };
  const { productos } = contexto;

  if (productos === null) return sinCatalogo(estado);

  const resultado = buscar(productos, consulta, compararRelevancia);

  if (resultado.productos.length === 0) {
    const sugerencias = sugerir(
      productos,
      contexto.marcas,
      CATEGORIAS_SITIO,
      consulta,
      compararRelevancia,
    );
    const opciones = [
      ...sugerencias.categorias.map((c) => ({
        id: `categoria:${c.slug}` as const,
        etiqueta: c.nombre,
      })),
      ...sugerencias.marcas.map((m) => ({ id: `marca:${m.slug}` as const, etiqueta: m.nombre })),
    ];
    const bloques: Bloque[] = [
      { tipo: "texto", texto: `No encontramos productos para «${visible}».` },
    ];
    if (opciones.length > 0) bloques.push({ tipo: "opciones", opciones });
    bloques.push({
      tipo: "whatsapp",
      etiqueta: "Consultar disponibilidad por WhatsApp",
      motivo: "disponibilidad",
      mensaje: buildAvailabilityInquiryMessage(visible),
    });
    return { estado, bloques, evento: { evento: "sin_resultados", consulta } };
  }

  const bloques: Bloque[] = [];
  if (opcionTema) {
    bloques.push({
      tipo: "texto",
      texto: `Esto encontramos para «${visible}». Si preguntabas por ${TEMA_NOMBRE[opcionTema]}, está abajo.`,
    });
  }
  // Muchos resultados y nada que los acote en lo escrito: se pregunta lo que
  // falta (sin números en la consulta, que ya serían una medida o un rango).
  const pendiente =
    !opcionTema && resultado.modo === "exacta" && !/\d/.test(consulta)
      ? preguntaPendiente(resultado.productos)
      : null;
  if (!opcionTema && resultado.modo === "exacta") {
    // Lo aproximado, lo cercano y lo parcial ya traen su línea de avisos.
    bloques.push({
      tipo: "texto",
      texto: pendiente
        ? preguntaVaga(resultado.productos.length, pendiente)
        : fraseResultados(resultado.productos.length, turno),
    });
  }
  const filtros = bloqueFiltros(resultado);
  if (filtros) bloques.push(filtros);
  bloques.push(
    bloqueProductos(
      resultado.productos,
      verTodosHref ?? `/buscar?${new URLSearchParams({ q: visible })}`,
      consulta,
    ),
  );
  // Lo que coincide solo con alguna palabra no se acota: los botones
  // partirían productos que no son lo que se buscó.
  const acotable = resultado.modo !== "parcial";
  const acotar = acotable ? bloqueAcotar(resultado.productos, contexto, [], pendiente) : null;
  if (acotar) bloques.push(acotar);
  bloques.push(opcionTema ? opcionesTemaYHablar(opcionTema) : opcionesHablar());
  return {
    // La búsqueda se recuerda para acotarla, con botones o escribiendo («y de
    // 10?»). La parcial no: no es lo que se buscó.
    estado: acotable
      ? {
          ...estado,
          busqueda: { base: { tipo: "texto", consulta, visible }, acotes: [] },
          ...(pendiente ? { pendiente } : {}),
        }
      : estado,
    bloques,
    evento: {
      evento: "busqueda",
      consulta,
      modo: resultado.modo,
      resultados: resultado.productos.length,
    },
  };
}

/**
 * Los primeros productos, con el enlace a todos. Si la consulta pidió un dato
 * («2 ohm», «más de 500 W»), cada fila muestra la spec que lo trae.
 */
function bloqueProductos(
  lista: readonly ProductoBuscable[],
  verTodosHref: string,
  consulta: string | null,
  desde = 0,
): Bloque {
  const primeros = lista.slice(desde, desde + MAX_PRODUCTOS_CHAT);
  const datos: Record<string, Spec[]> = {};
  if (consulta) {
    for (const p of primeros) {
      const specs = specsCoincidentes(p, consulta);
      if (specs.length > 0) datos[p.sku] = specs;
    }
  }
  return {
    tipo: "productos",
    skus: primeros.map((p) => p.sku),
    total: lista.length,
    verTodosHref,
    ...(Object.keys(datos).length > 0 ? { datos } : {}),
  };
}

/**
 * Los botones para acotar, solo si hay más resultados de los que caben en el
 * chat. Los campos de `elegidos` ya se eligieron y no vuelven.
 */
function bloqueAcotar(
  lista: readonly ProductoBuscable[],
  contexto: Contexto,
  elegidos: readonly Acote["campo"][],
  primero?: Acote["campo"] | null,
): Bloque | null {
  if (lista.length <= MAX_PRODUCTOS_CHAT) return null;
  const grupos = gruposDeAcote(lista, contexto.marcas, elegidos);
  if (grupos.length === 0) return null;
  // El grupo de la pregunta pendiente va primero («¿Qué medida buscas?»).
  if (primero) grupos.sort((a, b) => Number(b.campo === primero) - Number(a.campo === primero));
  return {
    tipo: "acotar",
    grupos: grupos.map((g) => ({
      titulo: g.titulo,
      opciones: g.opciones.map((o) => ({ id: idDeAcote(o.acote), etiqueta: o.etiqueta })),
    })),
  };
}

/** Los productos de la búsqueda a acotar, antes de acotarla. */
function productosDeBase(
  base: BusquedaAcotable["base"],
  productos: readonly ProductoBuscable[],
): { lista: ProductoBuscable[]; resultado: ResultadoBusqueda | null } {
  if (base.tipo === "texto") {
    const resultado = buscar(productos, base.consulta, compararRelevancia);
    return { lista: resultado.productos, resultado };
  }
  const categoria = CATEGORIAS_SITIO.find((c) => c.slug === base.slug);
  const lista = categoria
    ? productos.filter((p) => perteneceACategoria(p, categoria.nombre)).sort(compararRelevancia)
    : [];
  return { lista, resultado: null };
}

/** Más que esto, y sin nada que lo acote en lo escrito, el chat pregunta. */
const UMBRAL_PREGUNTA = 20;

/**
 * Qué preguntar ante una búsqueda de muchos resultados: la medida si traen
 * dos o más, si no los canales, si no la categoría. `null` con pocos
 * resultados o sin nada que preguntar.
 */
function preguntaPendiente(
  lista: readonly ProductoBuscable[],
  conCategoria = true,
): "medida" | "canales" | "categoria" | null {
  if (lista.length <= UMBRAL_PREGUNTA) return null;
  if (medidasDe(lista).length >= 2) return "medida";
  if (canalesDe(lista).length >= 2) return "canales";
  const categorias = CATEGORIAS_SITIO.filter((c) =>
    lista.some((p) => perteneceACategoria(p, c.nombre)),
  );
  return conCategoria && categorias.length >= 2 ? "categoria" : null;
}

/** Las categorías del sitio como botones, más «Hablar con Sonoro». */
function opcionesDeCategorias(): Bloque {
  const hablar = opcionesHablar();
  return {
    tipo: "opciones",
    opciones: [
      ...CATEGORIAS_SITIO.map((c) => ({ id: `categoria:${c.slug}` as const, etiqueta: c.nombre })),
      ...(hablar.tipo === "opciones" ? hablar.opciones : []),
    ],
  };
}

/**
 * La charla (spec 2026-11-03 § Charla): no registra evento y no toca la
 * memoria, salvo «adiós», que la borra. Un «ok» con una pregunta pendiente
 * la repite, con sus botones.
 */
function responderCharla(estado: Estado, clase: ClaseCharla, contexto: Contexto): Respuesta {
  const texto = (t: string): Bloque => ({ tipo: "texto", texto: t });
  switch (clase) {
    case "adios":
      return { estado: ESTADO_INICIAL, bloques: [texto(TEXTOS_CHARLA.adios)], evento: null };
    case "quien_eres":
      return {
        estado,
        bloques: [texto(TEXTOS_CHARLA.quien_eres), opcionesHablar()],
        evento: null,
      };
    case "groseria": {
      const menu = bloquesDeInicio().filter((b) => b.tipo === "opciones");
      return { estado, bloques: [texto(TEXTOS_CHARLA.groseria), ...menu], evento: null };
    }
    case "confirmacion": {
      const { pendiente, busqueda } = estado;
      if (pendiente === "categoria" && !busqueda) {
        return {
          estado,
          bloques: [texto(TEXTO_TIPO_EQUIPO), opcionesDeCategorias()],
          evento: null,
        };
      }
      if (pendiente && busqueda && contexto.productos !== null) {
        const { acotada } = listaDe(busqueda, contexto.productos, contexto.marcas);
        const acotar = bloqueAcotar(acotada, contexto, elegidosDe(busqueda), pendiente);
        return {
          estado,
          bloques: [texto(pregunta(pendiente)), ...(acotar ? [acotar] : [])],
          evento: null,
        };
      }
      return { estado, bloques: [texto(TEXTO_QUE_MAS)], evento: null };
    }
    default:
      return { estado, bloques: [texto(TEXTOS_CHARLA[clase])], evento: null };
  }
}

/** Un pedido de equipo sin decir cuál: se pregunta el tipo, con las categorías. */
function responderVago(texto: string): Respuesta {
  return {
    estado: { ultimaConsulta: texto, ultimoTema: null, pendiente: "categoria" },
    bloques: [{ tipo: "texto", texto: TEXTO_TIPO_EQUIPO }, opcionesDeCategorias()],
    evento: null,
  };
}

/** Lo que se muestra como búsqueda base: lo escrito, o el nombre de la categoría. */
function visibleDe(base: BusquedaAcotable["base"]): string {
  return base.tipo === "texto"
    ? base.visible
    : (CATEGORIAS_SITIO.find((c) => c.slug === base.slug)?.nombre ?? "");
}

/** Los productos de una búsqueda guardada, acotados y en su orden. */
function listaDe(
  busqueda: BusquedaAcotable,
  productos: readonly ProductoBuscable[],
  marcas: Contexto["marcas"],
) {
  const { lista, resultado } = productosDeBase(busqueda.base, productos);
  const acotada = aplicarAcotes(lista, busqueda.acotes, marcas);
  const { orden } = busqueda;
  // Por precio, y a igual precio lo que ya traía la búsqueda (sort es estable).
  if (orden) {
    acotada.sort((a, b) =>
      orden === "precio_asc" ? a.precioCents - b.precioCents : b.precioCents - a.precioCents,
    );
  }
  return { lista, acotada, resultado };
}

/** A qué campo va un número suelto escrito sobre esta búsqueda: el que traen sus productos. */
export function numeroSueltoDe(estado: Estado, contexto: Contexto): "medida" | "canales" | null {
  if (!estado.busqueda || contexto.productos === null) return null;
  const { lista } = productosDeBase(estado.busqueda.base, contexto.productos);
  if (medidasDe(lista).length > 0) return "medida";
  if (canalesDe(lista).length > 0) return "canales";
  return null;
}

/** «No hay Pioneer en esta búsqueda.», «No hay productos de 15" en esta búsqueda.» */
function fraseSinResultados(cambios: readonly Cambio[], marcas: Contexto["marcas"]): string {
  const acotes = cambios.flatMap((c) => (c.tipo === "acote" ? [c.acote] : []));
  const marca = acotes.find((a) => a.campo === "marca");
  const resto = acotes
    .filter((a) => a.campo !== "marca")
    .map((a) =>
      a.campo === "disponibilidad"
        ? "disponibles"
        : a.campo === "precio"
          ? describirAcote(a, marcas).replace(/^Precio /, "")
          : `de ${describirAcote(a, marcas)}`,
    );
  const sujeto = marca ? describirAcote(marca, marcas) : "productos";
  return `No hay ${[sujeto, ...resto].join(" ")} en esta búsqueda.`;
}

/**
 * Un seguimiento escrito («y de 10?», «solo Memphis», «más baratos», «más»)
 * o un botón de acotar: la búsqueda guardada con los cambios. Siempre dice qué
 * entendió. Un cambio que deja cero no se aplica: con una medida o canales,
 * muestra los valores más cercanos de esa misma búsqueda; con lo demás, dice
 * que no hay y la memoria queda como estaba.
 */
function responderSeguimiento(
  estado: Estado,
  cambios: readonly Cambio[],
  contexto: Contexto,
): Respuesta {
  const busqueda = estado.busqueda;
  const { productos, marcas } = contexto;
  if (!busqueda) return saludo(estado);
  if (productos === null) return sinCatalogo(estado);

  const nueva = aplicarCambios(busqueda, cambios);
  const { lista, acotada, resultado } = listaDe(nueva, productos, marcas);
  const visible = visibleDe(nueva.base);
  const consultaBase = nueva.base.tipo === "texto" ? nueva.base.consulta : null;

  if (acotada.length === 0) {
    const medida = cambios.flatMap((c) =>
      c.tipo === "acote" && (c.acote.campo === "medida" || c.acote.campo === "canales")
        ? [c.acote]
        : [],
    )[0];
    if (medida && (medida.campo === "medida" || medida.campo === "canales")) {
      const sinEsa = aplicarAcotes(
        lista,
        nueva.acotes.filter((a) => a.campo !== medida.campo),
        marcas,
      );
      const valor = medida.campo === "medida" ? medida.pulgadas : medida.canales;
      const cercanos = cercanosEnLista(sinEsa, medida.campo, valor);
      if (cercanos) {
        const dicho = (v: number) =>
          describirAcote(
            medida.campo === "medida"
              ? { campo: "medida", pulgadas: v }
              : { campo: "canales", canales: v },
            marcas,
          );
        const valores = cercanos.valores.map(dicho);
        const frase =
          `Ninguno es de ${dicho(valor)}. ` +
          (valores.length === 1
            ? `El más cercano es de ${valores[0]}.`
            : `Los más cercanos son de ${valores.join(" y ")}.`);
        const bloque = bloqueProductos(
          cercanos.productos,
          hrefAcotado(visible, busqueda.acotes, marcas),
          consultaBase,
        );
        return {
          estado: { ...estado, mostrados: bloque.tipo === "productos" ? bloque.skus : [] },
          bloques: [{ tipo: "texto", texto: frase }, bloque, opcionesHablar()],
          evento: null,
        };
      }
    }
    const anterior = listaDe(busqueda, productos, marcas).acotada;
    const acotar = bloqueAcotar(anterior, contexto, elegidosDe(busqueda));
    return {
      estado,
      bloques: [
        { tipo: "texto", texto: fraseSinResultados(cambios, marcas) },
        ...(acotar ? [acotar] : []),
        opcionesHablar(),
      ],
      evento: null,
    };
  }

  const pagina = nueva.pagina ?? 0;
  const desde = pagina * MAX_PRODUCTOS_CHAT;
  if (desde >= acotada.length) {
    return {
      estado,
      bloques: [{ tipo: "texto", texto: `Ya te mostré los ${acotada.length}.` }, opcionesHablar()],
      evento: null,
    };
  }

  const cuenta = acotada.length === 1 ? "Queda 1." : `Quedan ${acotada.length}.`;
  const frase = cambios.some((c) => c.tipo === "mas")
    ? `Del ${desde + 1} al ${Math.min(desde + MAX_PRODUCTOS_CHAT, acotada.length)} de ${acotada.length}.`
    : [fraseCambios(busqueda, cambios, marcas), cuenta].filter(Boolean).join(" ");
  const descritos = nueva.acotes.map((a) => describirAcote(a, marcas));
  const productosBloque = bloqueProductos(
    acotada,
    hrefAcotado(visible, nueva.acotes, marcas, nueva.orden),
    consultaBase,
    desde,
  );
  const bloques: Bloque[] = [{ tipo: "texto", texto: frase }];
  if (descritos.length > 0 || (resultado && resultado.modo !== "exacta")) {
    bloques.push({
      tipo: "filtros",
      aplicados: [...(resultado?.aplicados ?? []), ...descritos],
      correccion: resultado?.correccion ?? null,
      modo: resultado?.modo ?? "exacta",
      cercania: resultado?.cercania ?? null,
    });
  }
  bloques.push(productosBloque);
  const acotar = bloqueAcotar(acotada, contexto, elegidosDe(nueva));
  if (acotar) bloques.push(acotar);
  bloques.push(opcionesHablar());
  const combinada = [visible, ...descritos].join(" · ");
  return {
    estado: {
      ultimaConsulta: combinada,
      ultimoTema: null,
      busqueda: nueva,
      mostrados: productosBloque.tipo === "productos" ? productosBloque.skus : [],
    },
    bloques,
    evento: {
      evento: "busqueda",
      consulta: [consultaBase ?? visible, ...descritos].join(" · "),
      modo: resultado?.modo ?? "exacta",
      resultados: acotada.length,
    },
  };
}

/** Los campos ya acotados de una búsqueda, que no vuelven como botón. */
function elegidosDe(busqueda: BusquedaAcotable): Acote["campo"][] {
  const elegidos: Acote["campo"][] = busqueda.acotes.map((a) => a.campo);
  if (busqueda.base.tipo === "categoria") elegidos.push("categoria");
  return elegidos;
}

/**
 * «¿cuánto cuesta el primero?», «agrégalo», «¿y el segundo?»: un producto de
 * los que se mostraron. Con un dato que preguntar, el de su ficha; con un
 * pedido de carrito, su fila con el botón (el chat no agrega solo); con nada
 * más, el mismo dato de antes o su fila. No toca la búsqueda ni lo mostrado.
 */
function responderReferencia(
  estado: Estado,
  sku: string,
  resto: string,
  texto: string,
  contexto: Contexto,
): Respuesta {
  const { productos } = contexto;
  if (productos === null) return sinCatalogo(estado);
  const producto = productos.find((p) => p.sku === sku);
  // Otro deploy entre mensajes: el sku ya no está. Lo escrito, como búsqueda.
  if (!producto) return responderBusqueda(normalizar(texto), consultaVisible(texto), contexto);

  const memoria: Estado = {
    ...estado,
    ultimaConsulta: producto.nombre,
    ultimoTema: null,
    enfoque: sku,
    pendiente: null,
  };
  if (accionDe(resto) === "carrito") {
    return {
      estado: memoria,
      bloques: [
        { tipo: "texto", texto: `Aquí está ${producto.nombre} para agregarlo al carrito.` },
        bloqueProductos([producto], `/producto/${producto.slug}`, null),
        opcionesHablar(),
      ],
      evento: null,
    };
  }
  const pregunta = detectarIntencion(resto);
  const campos =
    pregunta.tipo === "dato" ? pregunta.campos : resto === "" ? (estado.ultimosCampos ?? []) : [];
  if (campos.length > 0) {
    const codigo = normalizar(producto.sku);
    const r = responderDato(campos, codigo, producto.sku, producto.nombre, contexto);
    return {
      ...r,
      estado: { ...memoria, ultimosCampos: [...campos] },
    };
  }
  return {
    estado: memoria,
    bloques: [bloqueProductos([producto], `/producto/${producto.slug}`, null), opcionesHablar()],
    evento: null,
  };
}

/** Los avisos de /buscar (filtros, corrección, búsqueda no exacta), si hay alguno. */
function bloqueFiltros(resultado: ResultadoBusqueda): Bloque | null {
  if (resultado.aplicados.length === 0 && !resultado.correccion && resultado.modo === "exacta") {
    return null;
  }
  return {
    tipo: "filtros",
    aplicados: resultado.aplicados,
    correccion: resultado.correccion,
    modo: resultado.modo,
    cercania: resultado.cercania,
  };
}

/** El producto que la consulta nombra por su código (con o sin separadores), o el único resultado. */
function productoNombrado(
  productos: readonly ProductoBuscable[],
  consulta: string,
): ProductoBuscable | null {
  const palabras = ` ${consulta} `;
  const porCodigo = productos.find((p) => {
    const sku = normalizar(p.sku);
    return palabras.includes(` ${sku} `) || palabras.includes(` ${sku.replace(/[\s.-]+/g, "")} `);
  });
  return porCodigo ?? (productos.length === 1 ? productos[0] : null);
}

/**
 * «¿Cuántos watts tiene el MJP1244?», «¿está disponible el SQ12-D2?»: el
 * producto se busca con la misma búsqueda y lo preguntado sale de su ficha.
 * Un producto nombrado por su código (o el único resultado) responde en
 * frases; varios, con una fila del dato bajo cada uno. `textoVisible` es la
 * pregunta entera, para el mensaje de «Hablar con Sonoro».
 */
function responderDato(
  campos: readonly Campo[],
  consulta: string,
  visible: string,
  textoVisible: string,
  contexto: Contexto,
): Respuesta {
  const estado: Estado = { ultimaConsulta: textoVisible, ultimoTema: null };
  if (consulta === "") {
    return { estado, bloques: [{ tipo: "texto", texto: TEXTO_PEDIR_PRODUCTO }], evento: null };
  }
  const { productos } = contexto;
  if (productos === null) return sinCatalogo(estado);

  const resultado = buscar(productos, consulta, compararRelevancia);
  if (resultado.productos.length === 0) return responderBusqueda(consulta, visible, contexto);

  const nombrado = productoNombrado(resultado.productos, consulta);
  const precio = campos.some((c) => c.tipo === "precio");
  // Solo el precio, de una lista: cada fila ya lo lleva. Es la búsqueda.
  if (!nombrado && campos.every((c) => c.tipo === "precio")) {
    return responderBusqueda(consulta, visible, contexto);
  }
  const mostrados = nombrado ? [nombrado] : resultado.productos.slice(0, MAX_PRODUCTOS_CHAT);
  const specs = campos.filter((c): c is CampoSpec => c.tipo === "spec");
  const disponibilidad = campos.some((c) => c.tipo === "disponibilidad");
  // Sin la ficha (un catálogo bajado antes del deploy que la agregó) no se
  // sabe qué publica el fabricante: decir que «no publica» sería falso, así
  // que esos productos no llevan fila y, si no queda nada que contestar, va la
  // búsqueda de siempre.
  const ficha = (p: ProductoBuscable) => contexto.fichas?.[p.sku];
  if (!disponibilidad && !(precio && nombrado) && !mostrados.some(ficha)) {
    return responderBusqueda(consulta, visible, contexto);
  }

  const avisos: Bloque[] = [];
  const datos: Record<string, Spec[]> = {};
  let publicados = false;
  for (const p of mostrados) {
    const filas: Spec[] = [];
    const publicada = ficha(p);
    for (const campo of publicada ? specs : []) {
      const valores = valoresDeCampo(publicada ?? [], campo);
      if (valores.length === 0) {
        if (nombrado) {
          avisos.push({
            tipo: "texto",
            texto: `${p.nombre}: el fabricante no publica ${campo.frase}.`,
          });
        } else {
          filas.push({ etiqueta: campo.nombre, valor: "sin dato del fabricante" });
        }
        continue;
      }
      publicados = true;
      // «medida» y «profundidad» comparten «Profundidad de montaje»: una vez.
      filas.push(...valores.filter((v) => !filas.some((f) => f.etiqueta === v.etiqueta)));
    }
    if (precio && nombrado) {
      avisos.push({ tipo: "texto", texto: frasePrecio(p.nombre, p.precioCents) });
    }
    if (disponibilidad) {
      if (nombrado) {
        avisos.push({ tipo: "texto", texto: fraseDisponibilidad(p.nombre, p.disponibilidad) });
      } else {
        filas.push({ etiqueta: "Disponibilidad", valor: valorDisponibilidad(p.disponibilidad) });
      }
    }
    if (filas.length > 0) datos[p.sku] = filas;
  }

  const bloques: Bloque[] = [];
  const filtros = bloqueFiltros(resultado);
  if (filtros) bloques.push(filtros);
  bloques.push(...avisos, {
    tipo: "productos",
    skus: mostrados.map((p) => p.sku),
    total: nombrado ? 1 : resultado.productos.length,
    verTodosHref: `/buscar?${new URLSearchParams({ q: visible })}`,
    ...(Object.keys(datos).length > 0 ? { datos } : {}),
  });
  if (publicados) bloques.push({ tipo: "texto", texto: TEXTO_DATOS_FABRICANTE });
  if (disponibilidad && nombrado && nombrado.disponibilidad !== "disponible") {
    bloques.push({
      tipo: "whatsapp",
      etiqueta: "Consultar disponibilidad por WhatsApp",
      motivo: "disponibilidad",
      mensaje: buildAvailabilityInquiryMessage(nombrado.nombre),
    });
  }
  bloques.push(opcionesHablar());
  return {
    estado,
    bloques,
    evento: {
      evento: "busqueda",
      consulta,
      modo: resultado.modo,
      resultados: resultado.productos.length,
    },
  };
}

/**
 * Una categoría del sitio se elige por la categoría del producto, no buscando
 * su nombre como texto: «Kits» traía una pieza de Insonorización que dice «kit»
 * y «Amplificadores» dejaba fuera los sistemas completos que el listado sí
 * agrupa. Es la misma regla (`perteneceACategoria`) y el mismo orden que
 * /catalogo/[categoria], así que «Ver los N» cuenta lo que el listado tiene.
 */
function responderCategoria(
  categoria: { slug: string; nombre: string },
  contexto: Contexto,
  turno = 0,
): Respuesta {
  const href = `/catalogo/${categoria.slug}`;
  const { productos } = contexto;
  const estado: Estado = { ultimaConsulta: categoria.nombre, ultimoTema: null };
  if (productos === null) return sinCatalogo(estado);

  const lista = productos
    .filter((p) => perteneceACategoria(p, categoria.nombre))
    .sort(compararRelevancia);
  // Una categoría sin productos activos: el aviso de «sin resultados».
  if (lista.length === 0)
    return responderBusqueda(categoria.nombre, categoria.nombre, contexto, href);

  const pendiente = preguntaPendiente(lista, false);
  const acotar = bloqueAcotar(lista, contexto, ["categoria"], pendiente);
  return {
    estado: {
      ...estado,
      busqueda: { base: { tipo: "categoria", slug: categoria.slug }, acotes: [] },
      ...(pendiente ? { pendiente } : {}),
    },
    bloques: [
      {
        tipo: "texto",
        texto: pendiente
          ? preguntaVaga(lista.length, pendiente)
          : fraseResultados(lista.length, turno),
      },
      bloqueProductos(lista, href, null),
      ...(acotar ? [acotar] : []),
      opcionesHablar(),
    ],
    evento: {
      evento: "busqueda",
      consulta: categoria.nombre,
      modo: "exacta",
      resultados: lista.length,
    },
  };
}

/**
 * Un tema que salió de una palabra ambigua («radio con carplay para el
 * teléfono»): se prueba la búsqueda con cada consulta candidata y, solo si da
 * resultados EXACTOS, se responde con los productos y el tema queda como
 * botón, para que no se pierda en silencio. Con resultados aproximados o
 * parciales, sin resultados o sin catálogo, se responde el tema como siempre.
 */
function responderTemaAmbiguo(
  tema: Tema,
  candidatas: readonly { consulta: string; visible: string }[],
  contexto: Contexto,
): Respuesta {
  const { productos } = contexto;
  if (productos !== null) {
    for (const { consulta, visible } of candidatas) {
      const resultado = buscar(productos, consulta, compararRelevancia);
      if (resultado.modo === "exacta" && resultado.productos.length > 0) {
        return responderBusqueda(consulta, visible, contexto, undefined, tema);
      }
    }
  }
  return responderTema(tema, contexto);
}

/**
 * Un paso de «¿qué le queda a mi carro?». `consulta` es lo que queda como
 * `ultimaConsulta` si la respuesta todavía no sabe qué vehículo es.
 */
function responderPedidoVehiculo(
  pedido: PedidoVehiculo,
  consulta: string | null,
  contexto: Contexto,
): Respuesta {
  if (!contexto.vehiculos) {
    return {
      estado: { ultimaConsulta: consulta, ultimoTema: null },
      bloques: bloquesSinVehiculos(),
      evento: null,
    };
  }
  const datos = contexto.vehiculos.datos;
  const { bloques, titulo, resultados } = responderVehiculo(pedido, datos);
  // Si lo que falta es el año, el próximo «2010» escrito lo contesta.
  const r = resolverSeleccion(datos.vehiculos, pedido.sel);
  const vehiculoPendiente =
    titulo === null && r.marca && r.modelo && r.anio === null && pedido.sel.anio === undefined
      ? { marca: r.marca.slug, modelo: r.modelo.slug }
      : null;
  return {
    estado: {
      ultimaConsulta: titulo ?? consulta,
      ultimoTema: null,
      ...(vehiculoPendiente ? { vehiculoPendiente } : {}),
    },
    bloques,
    evento:
      titulo !== null && resultados !== null
        ? { evento: "vehiculo", consulta: titulo, resultados }
        : null,
  };
}

/**
 * Lo escrito, si nombra un carro de la lista o pregunta qué le queda a uno
 * (spec § Cómo entiende el carro). `null` para seguir como siempre. Sin los
 * datos de vehículos, solo la frase se contesta (con el error de carga): un
 * carro escrito sin frase sigue como búsqueda.
 */
function intentarVehiculo(texto: string, contexto: Contexto, esDato: boolean): Respuesta | null {
  if (excluyeVehiculo(texto)) return null;
  const frase = tieneFraseVehiculo(texto);
  const vehiculos = contexto.vehiculos;
  const sel = vehiculos ? leerVehiculo(texto, vehiculos.datos.vehiculos, vehiculos.ambiguos) : null;
  // Una pregunta de dato («qué tamaño de bocina le cabe a mi Civic 2010») solo
  // es de compatibilidad con la frase Y un modelo: «cuántos watts tiene el
  // corolla» sigue siendo un dato.
  if (esDato) {
    if (!frase || !sel?.modelo) return null;
  } else if (!sel && !frase) {
    return null;
  }
  return responderPedidoVehiculo({ sel: sel ?? {}, rango: false, ver: null }, texto, contexto);
}

function responderOpcion(estado: Estado, id: string, contexto: Contexto): Respuesta {
  if (id === "buscar") {
    return { estado, bloques: [{ tipo: "texto", texto: TEXTO_PEDIR_BUSQUEDA }], evento: null };
  }
  if (id === "hablar") return { estado, bloques: [bloqueHablar(estado)], evento: null };
  if (Object.hasOwn(TEMA_NOMBRE, id)) return responderTema(id as Tema, contexto);

  if (id.startsWith("categoria:")) {
    const slug = id.slice("categoria:".length);
    const categoria = CATEGORIAS_SITIO.find((c) => c.slug === slug);
    if (categoria) return responderCategoria(categoria, contexto, estado.turno);
  }
  if (id.startsWith("acotar:")) {
    const acote = acoteDeId(id);
    if (acote) return responderSeguimiento(estado, [{ tipo: "acote", acote }], contexto);
  }
  if (id.startsWith("vehiculo:")) {
    const pedido = leerOpcionVehiculo(id);
    if (pedido) return responderPedidoVehiculo(pedido, estado.ultimaConsulta, contexto);
  }
  if (id.startsWith("marca:")) {
    const slug = id.slice("marca:".length);
    const marca = contexto.marcas.find((m) => m.slug === slug);
    if (marca) {
      return responderBusqueda(
        marca.nombre,
        marca.nombre,
        contexto,
        `/marcas/${slug}`,
        undefined,
        estado.turno,
      );
    }
  }
  return saludo(estado);
}

/**
 * Corta a MAX_CONSULTA unidades UTF-16 sin dejar medio emoji: un surrogate
 * alto suelto en el último lugar haría fallar `encodeURIComponent` (URIError)
 * al armar el enlace de WhatsApp.
 */
export function cortar(texto: string): string {
  const corte = texto.slice(0, MAX_CONSULTA);
  const ultimo = corte.charCodeAt(corte.length - 1);
  return ultimo >= 0xd800 && ultimo <= 0xdbff ? corte.slice(0, -1) : corte;
}

export function responder(estado: Estado, entrada: Entrada, contexto: Contexto): Respuesta {
  const r = responderSinMemoria(estado, entrada, contexto);
  // Lo que se mostró, para «el primero» del próximo mensaje: si la respuesta
  // no lo fijó, sus productos. Y el turno, para rotar las frases.
  const productos = r.bloques.find((b) => b.tipo === "productos");
  const mostrados =
    r.estado.mostrados ?? (productos?.tipo === "productos" ? productos.skus : undefined);
  const siguiente: Estado = {
    ...r.estado,
    ...(mostrados ? { mostrados } : {}),
    turno: (estado.turno ?? 0) + 1,
  };
  // «¿De qué año es tu Toyota Corolla?» solo espera la respuesta que sigue: si
  // esta no lo volvió a preguntar (la respuesta trae el MISMO objeto, no uno
  // nuevo), cualquier otra cosa —«hola», «gracias», «Buscar un producto»— lo
  // olvida, como dice tipos.ts. Si no, un «2010» tres mensajes después se
  // contestaba como el año de ese carro.
  if (estado.vehiculoPendiente && siguiente.vehiculoPendiente === estado.vehiculoPendiente) {
    delete siguiente.vehiculoPendiente;
  }
  return { ...r, estado: siguiente };
}

function responderSinMemoria(estado: Estado, entrada: Entrada, contexto: Contexto): Respuesta {
  if (entrada.tipo === "opcion") return responderOpcion(estado, entrada.id, contexto);

  // Lo escrito se corta antes de cualquier otra cosa: nada de lo que sigue
  // (intención, búsqueda, evento, mensaje de WhatsApp) ve más de MAX_CONSULTA.
  const texto = cortar(entrada.texto.trim()).trimEnd();
  if (texto === "") return saludo(estado);

  // «¿De qué año es tu Toyota Corolla?» → «2010».
  if (estado.vehiculoPendiente && contexto.vehiculos) {
    const anio = anioSolo(texto);
    if (anio !== undefined) {
      const { marca, modelo } = estado.vehiculoPendiente;
      return responderPedidoVehiculo(
        { sel: { marca, modelo, anio }, rango: false, ver: null },
        estado.ultimaConsulta,
        contexto,
      );
    }
  }

  const intencion = detectarIntencion(texto, estado, {
    marcas: contexto.marcas,
    numeroSuelto: numeroSueltoDe(estado, contexto),
  });
  // El carro se prueba en lo que sería recomendación, búsqueda o una
  // pregunta vaga; en un dato, solo con frase de vehículo y modelo
  // (intentarVehiculo). Un tema («¿instalan en un Corolla?»), un seguimiento
  // o una referencia siguen como antes.
  if (
    intencion.tipo === "recomendacion" ||
    intencion.tipo === "busqueda" ||
    intencion.tipo === "vago" ||
    intencion.tipo === "dato"
  ) {
    const vehiculo = intentarVehiculo(texto, contexto, intencion.tipo === "dato");
    if (vehiculo) return vehiculo;
  }
  switch (intencion.tipo) {
    case "saludo":
      return saludo(estado);
    case "recomendacion":
      return {
        estado: { ultimaConsulta: texto, ultimoTema: null },
        bloques: bloquesDeRecomendacion(CATEGORIAS_SITIO),
        evento: { evento: "recomendacion", consulta: texto },
      };
    case "tema":
      return intencion.ambigua
        ? responderTemaAmbiguo(intencion.tema, intencion.ambigua, contexto)
        : responderTema(intencion.tema, contexto);
    case "dato":
      return responderDato(
        intencion.campos,
        intencion.consulta,
        intencion.visible,
        consultaVisible(texto),
        contexto,
      );
    case "busqueda":
      return responderBusqueda(
        intencion.consulta,
        consultaVisible(texto),
        contexto,
        undefined,
        undefined,
        estado.turno,
      );
    case "seguimiento":
      return responderSeguimiento(estado, intencion.cambios, contexto);
    case "referencia":
      return responderReferencia(estado, intencion.sku, intencion.resto, texto, contexto);
    case "charla":
      return responderCharla(estado, intencion.clase, contexto);
    case "vago":
      return responderVago(texto);
    case "respuesta_pendiente": {
      // Con una búsqueda guardada, la categoría la acota; sin ella (tras «algo
      // para mi carro»), es la categoría entera.
      if (estado.busqueda) {
        return responderSeguimiento(
          estado,
          [{ tipo: "acote", acote: { campo: "categoria", slug: intencion.categoria } }],
          contexto,
        );
      }
      const categoria = CATEGORIAS_SITIO.find((c) => c.slug === intencion.categoria);
      return categoria ? responderCategoria(categoria, contexto, estado.turno) : saludo(estado);
    }
  }
}

/**
 * ¿La respuesta a esta entrada puede usar productos? Solo la búsqueda de
 * texto (y un tema de palabra ambigua, que la prueba primero) y las opciones de
 * categoría y marca. Saludos, recomendaciones, temas
 * de política y «Hablar con Sonoro» responden igual con el catálogo cargado o
 * sin él, así que no hay por qué hacerlos esperar a la red (spec: los temas
 * siguen funcionando sin catálogo).
 */
export function necesitaCatalogo(entrada: Entrada, estado?: Estado): boolean {
  if (entrada.tipo === "opcion") {
    return (
      entrada.id.startsWith("categoria:") ||
      entrada.id.startsWith("marca:") ||
      entrada.id.startsWith("acotar:") ||
      entrada.id.startsWith("vehiculo:")
    );
  }
  const texto = cortar(entrada.texto.trim()).trimEnd();
  if (texto === "") return false;
  const intencion = detectarIntencion(texto, estado);
  // Un tema de palabra ambigua prueba la búsqueda antes de contestar.
  // La recomendación también: «¿qué me recomiendan para mi Corolla?» puede
  // nombrar un carro, y los vehículos bajan junto con el catálogo.
  return (
    intencion.tipo === "busqueda" ||
    intencion.tipo === "recomendacion" ||
    intencion.tipo === "vago" ||
    (intencion.tipo === "dato" && tieneFraseVehiculo(texto)) ||
    intencion.tipo === "referencia" ||
    intencion.tipo === "seguimiento" ||
    intencion.tipo === "respuesta_pendiente" ||
    (intencion.tipo === "dato" && intencion.consulta !== "") ||
    (intencion.tipo === "tema" && !!intencion.ambigua)
  );
}
