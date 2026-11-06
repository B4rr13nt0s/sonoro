// El motor del chat: una función pura que convierte lo que el cliente escribe
// o elige en bloques tipados. Sin React, sin DOM y sin variables de entorno
// (el contacto llega por `Contexto`), para probarlo con `node --test`.
// Spec: docs/superpowers/specs/2026-11-02-chatbot-design.md § Conversación.

import {
  acoteDeId,
  aplicarAcotes,
  describirAcote,
  gruposDeAcote,
  hrefAcotado,
  idDeAcote,
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
  valorDisponibilidad,
  valoresDeCampo,
  type Campo,
  type CampoSpec,
} from "./datos.ts";
import { consultaVisible, detectarIntencion } from "./intencion.ts";
import {
  bloquesSinVehiculos,
  leerOpcionVehiculo,
  responderVehiculo,
  type PedidoVehiculo,
} from "./respuestaVehiculo.ts";
import { excluyeVehiculo, leerVehiculo, tieneFraseVehiculo } from "./vehiculo.ts";
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
  const acotar = acotable ? bloqueAcotar(resultado.productos, contexto, []) : null;
  if (acotar) bloques.push(acotar);
  bloques.push(opcionTema ? opcionesTemaYHablar(opcionTema) : opcionesHablar());
  return {
    // La búsqueda se recuerda solo si hay botones que la acoten.
    estado: acotar
      ? { ...estado, busqueda: { base: { tipo: "texto", consulta, visible }, acotes: [] } }
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
): Bloque {
  const primeros = lista.slice(0, MAX_PRODUCTOS_CHAT);
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
): Bloque | null {
  if (lista.length <= MAX_PRODUCTOS_CHAT) return null;
  const grupos = gruposDeAcote(lista, contexto.marcas, elegidos);
  if (grupos.length === 0) return null;
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

/**
 * Un botón de «acotar»: vuelve a correr la última búsqueda con lo que ya se
 * había acotado más lo nuevo (un mismo campo se reemplaza, no se suma). Sin
 * búsqueda anterior, o si con eso no queda nada, el menú de inicio.
 */
function responderAcote(estado: Estado, acote: Acote, contexto: Contexto): Respuesta {
  const busqueda = estado.busqueda;
  const { productos } = contexto;
  if (!busqueda) return saludo(estado);
  if (productos === null) return sinCatalogo(estado);

  const acotes = [...busqueda.acotes.filter((a) => a.campo !== acote.campo), acote];
  const { lista, resultado } = productosDeBase(busqueda.base, productos);
  const acotada = aplicarAcotes(lista, acotes, contexto.marcas);
  if (acotada.length === 0) return saludo(estado);

  const base = busqueda.base;
  const visible =
    base.tipo === "texto"
      ? base.visible
      : (CATEGORIAS_SITIO.find((c) => c.slug === base.slug)?.nombre ?? "");
  const descritos = acotes.map((a) => describirAcote(a, contexto.marcas));
  const bloques: Bloque[] = [
    {
      tipo: "filtros",
      aplicados: [...(resultado?.aplicados ?? []), ...descritos],
      correccion: resultado?.correccion ?? null,
      modo: resultado?.modo ?? "exacta",
      cercania: resultado?.cercania ?? null,
    },
    bloqueProductos(
      acotada,
      hrefAcotado(visible, acotes, contexto.marcas),
      base.tipo === "texto" ? base.consulta : null,
    ),
  ];
  const elegidos: Acote["campo"][] = acotes.map((a) => a.campo);
  if (base.tipo === "categoria") elegidos.push("categoria");
  const acotar = bloqueAcotar(acotada, contexto, elegidos);
  if (acotar) bloques.push(acotar);
  bloques.push(opcionesHablar());
  return {
    estado: { ultimaConsulta: visible, ultimoTema: null, busqueda: { base, acotes } },
    bloques,
    evento: {
      evento: "busqueda",
      consulta: [base.tipo === "texto" ? base.consulta : visible, ...descritos].join(" · "),
      modo: resultado?.modo ?? "exacta",
      resultados: acotada.length,
    },
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
  const mostrados = nombrado ? [nombrado] : resultado.productos.slice(0, MAX_PRODUCTOS_CHAT);
  const specs = campos.filter((c): c is CampoSpec => c.tipo === "spec");
  const disponibilidad = campos.some((c) => c.tipo === "disponibilidad");
  // Sin la ficha (un catálogo bajado antes del deploy que la agregó) no se
  // sabe qué publica el fabricante: decir que «no publica» sería falso, así
  // que esos productos no llevan fila y, si no queda nada que contestar, va la
  // búsqueda de siempre.
  const ficha = (p: ProductoBuscable) => contexto.fichas?.[p.sku];
  if (!disponibilidad && !mostrados.some(ficha)) {
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

  const acotar = bloqueAcotar(lista, contexto, ["categoria"]);
  return {
    estado: acotar
      ? { ...estado, busqueda: { base: { tipo: "categoria", slug: categoria.slug }, acotes: [] } }
      : estado,
    bloques: [bloqueProductos(lista, href, null), ...(acotar ? [acotar] : []), opcionesHablar()],
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
  const { bloques, titulo, resultados } = responderVehiculo(pedido, contexto.vehiculos.datos);
  return {
    estado: { ultimaConsulta: titulo ?? consulta, ultimoTema: null },
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
    if (categoria) return responderCategoria(categoria, contexto);
  }
  if (id.startsWith("acotar:")) {
    const acote = acoteDeId(id);
    if (acote) return responderAcote(estado, acote, contexto);
  }
  if (id.startsWith("vehiculo:")) {
    const pedido = leerOpcionVehiculo(id);
    if (pedido) return responderPedidoVehiculo(pedido, estado.ultimaConsulta, contexto);
  }
  if (id.startsWith("marca:")) {
    const slug = id.slice("marca:".length);
    const marca = contexto.marcas.find((m) => m.slug === slug);
    if (marca) return responderBusqueda(marca.nombre, marca.nombre, contexto, `/marcas/${slug}`);
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
  if (entrada.tipo === "opcion") return responderOpcion(estado, entrada.id, contexto);

  // Lo escrito se corta antes de cualquier otra cosa: nada de lo que sigue
  // (intención, búsqueda, evento, mensaje de WhatsApp) ve más de MAX_CONSULTA.
  const texto = cortar(entrada.texto.trim()).trimEnd();
  if (texto === "") return saludo(estado);

  const intencion = detectarIntencion(texto);
  // El carro se prueba solo en lo que hoy es recomendación o búsqueda: un
  // tema («¿instalan en un Corolla?») o un dato siguen como antes.
  if (
    intencion.tipo === "recomendacion" ||
    (intencion.tipo === "dato" && tieneFraseVehiculo(texto)) ||
    intencion.tipo === "busqueda" ||
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
      return responderBusqueda(intencion.consulta, consultaVisible(texto), contexto);
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
export function necesitaCatalogo(entrada: Entrada): boolean {
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
  const intencion = detectarIntencion(texto);
  // Un tema de palabra ambigua prueba la búsqueda antes de contestar.
  // La recomendación también: «¿qué me recomiendan para mi Corolla?» puede
  // nombrar un carro, y los vehículos bajan junto con el catálogo.
  return (
    intencion.tipo === "busqueda" ||
    intencion.tipo === "recomendacion" ||
    (intencion.tipo === "dato" && intencion.consulta !== "") ||
    (intencion.tipo === "tema" && !!intencion.ambigua)
  );
}
