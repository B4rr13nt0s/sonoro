// El motor del chat: una función pura que convierte lo que el cliente escribe
// o elige en bloques tipados. Sin React, sin DOM y sin variables de entorno
// (el contacto llega por `Contexto`), para probarlo con `node --test`.
// Spec: docs/superpowers/specs/2026-11-02-chatbot-design.md § Conversación.

import {
  buscar,
  normalizar,
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
  type Bloque,
  type Contexto,
  type Entrada,
  type Estado,
  type EventoChat,
  type Tema,
} from "./tipos.ts";

export { bloquesDeInicio };

export const MAX_PRODUCTOS_CHAT = 5;

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
  bloques.push({
    tipo: "productos",
    skus: resultado.productos.slice(0, MAX_PRODUCTOS_CHAT).map((p) => p.sku),
    total: resultado.productos.length,
    verTodosHref: verTodosHref ?? `/buscar?${new URLSearchParams({ q: visible })}`,
  });
  bloques.push(opcionTema ? opcionesTemaYHablar(opcionTema) : opcionesHablar());
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

  return {
    estado,
    bloques: [
      {
        tipo: "productos",
        skus: lista.slice(0, MAX_PRODUCTOS_CHAT).map((p) => p.sku),
        total: lista.length,
        verTodosHref: href,
      },
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
    return entrada.id.startsWith("categoria:") || entrada.id.startsWith("marca:");
  }
  const texto = cortar(entrada.texto.trim()).trimEnd();
  if (texto === "") return false;
  const intencion = detectarIntencion(texto);
  // Un tema de palabra ambigua prueba la búsqueda antes de contestar.
  return (
    intencion.tipo === "busqueda" ||
    (intencion.tipo === "dato" && intencion.consulta !== "") ||
    (intencion.tipo === "tema" && !!intencion.ambigua)
  );
}
