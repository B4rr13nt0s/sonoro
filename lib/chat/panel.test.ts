import test from "node:test";
import assert from "node:assert/strict";

import type { CatalogoChat } from "./catalogo.ts";
import { ESTADO_INICIAL, bloquesDeInicio } from "./motor.ts";
import {
  adoptar,
  colaDeRespuestas,
  conMensaje,
  conversacionInicial,
  crearContexto,
  etiquetaVerTodos,
  mensajeAgregado,
  prepararTexto,
  responderEnConversacion,
  resumenDeMensaje,
  textoFiltros,
  textoModo,
} from "./panel.ts";
import { MAX_CONSULTA, type Conversacion, type Mensaje } from "./tipos.ts";

const CATALOGO: CatalogoChat = {
  productos: [
    {
      sku: "SQ12-D2",
      slug: "sq12-d2",
      nombre: 'Serie SQ 12" D2',
      marca: "Sonoro",
      categoria: "Subwoofers",
      precioCents: 245000,
      disponibilidad: "disponible",
      destacado: false,
      imagenes: [],
      specsDestacadas: [{ etiqueta: "Impedancia", valor: "Doble 2 Ω" }],
    },
  ],
  marcas: [{ nombre: "Sonoro", slug: "sonoro" }],
};

test("etiquetaVerTodos: uno lleva a Buscar, varios dicen cuántos", () => {
  assert.equal(etiquetaVerTodos(1), "Ver en Buscar");
  assert.equal(etiquetaVerTodos(2), "Ver los 2 resultados");
  assert.equal(etiquetaVerTodos(37), "Ver los 37 resultados");
});

test("prepararTexto: vacío o solo espacios no se envía", () => {
  assert.equal(prepararTexto(""), null);
  assert.equal(prepararTexto("   \n\t "), null);
});

test("prepararTexto: recorta y corta a MAX_CONSULTA sin dejar medio emoji", () => {
  assert.equal(prepararTexto("  sub 12  "), "sub 12");
  assert.equal(prepararTexto("a".repeat(500))?.length, MAX_CONSULTA);
  // Un par sustituto partido en el corte: se quita la mitad suelta.
  const texto = prepararTexto("a".repeat(MAX_CONSULTA - 1) + "\u{1F50A}");
  assert.equal(texto, "a".repeat(MAX_CONSULTA - 1));
});

test("conversacionInicial: el saludo y el menú, con el estado inicial", () => {
  const c = conversacionInicial("abc12345");
  assert.equal(c.id, "abc12345");
  assert.deepEqual(c.estado, ESTADO_INICIAL);
  assert.deepEqual(c.mensajes, [{ id: 0, autor: "bot", bloques: bloquesDeInicio() }]);
});

test("crearContexto: sin catálogo, productos null y sin marcas", () => {
  const contacto = { telefono: "+502 5295 5555" };
  assert.deepEqual(crearContexto(null, contacto), { productos: null, marcas: [], contacto });
  assert.deepEqual(crearContexto(CATALOGO, contacto), {
    productos: CATALOGO.productos,
    marcas: CATALOGO.marcas,
    contacto,
  });
});

test("conMensaje: ids crecientes y sin mutar la conversación", () => {
  const c0 = conversacionInicial("x");
  const c1 = conMensaje(c0, { autor: "cliente", texto: "hola" });
  const c2 = conMensaje(c1, { autor: "cliente", texto: "otra" });
  assert.equal(c0.mensajes.length, 1);
  assert.deepEqual(
    c2.mensajes.map((m) => m.id),
    [0, 1, 2],
  );
});

test("mensajeAgregado: texto de la ficha con enlace a /carrito", () => {
  const c = mensajeAgregado(conversacionInicial("x"), 1);
  assert.deepEqual(c.mensajes.at(-1), {
    id: 1,
    autor: "bot",
    bloques: [
      {
        tipo: "texto",
        texto: "Has añadido 1 ítem al carrito.",
        enlace: { etiqueta: "Ver carrito", href: "/carrito" },
      },
    ],
  });
});

test("responderEnConversacion: agrega la respuesta, avanza el estado y devuelve el evento", () => {
  const inicial: Conversacion = conMensaje(conversacionInicial("x"), {
    autor: "cliente",
    texto: "sq12",
  });
  const { conversacion, evento } = responderEnConversacion(
    inicial,
    { tipo: "texto", texto: "sq12" },
    crearContexto(CATALOGO, {}),
  );
  assert.equal(conversacion.mensajes.length, 3);
  const ultimo = conversacion.mensajes.at(-1);
  assert.equal(ultimo?.autor, "bot");
  assert.ok(
    ultimo?.autor === "bot" &&
      ultimo.bloques.some((b) => b.tipo === "productos" && b.skus.includes("SQ12-D2")),
  );
  assert.equal(conversacion.estado.ultimaConsulta, "sq12");
  assert.equal(evento?.evento, "busqueda");
});

test("responderEnConversacion: sin catálogo responde la falla, sin evento", () => {
  const { conversacion, evento } = responderEnConversacion(
    conversacionInicial("x"),
    { tipo: "texto", texto: "sub 12" },
    crearContexto(null, {}),
  );
  const ultimo = conversacion.mensajes.at(-1);
  assert.ok(ultimo?.autor === "bot" && ultimo.bloques[0]?.tipo === "texto");
  assert.equal(evento, null);
});

test("textoFiltros y textoModo: los textos de /buscar", () => {
  assert.equal(textoFiltros([]), null);
  assert.equal(
    textoFiltros(["Marino", "menos de Q 1,000.00"]),
    "Filtros de tu búsqueda: Marino · menos de Q 1,000.00",
  );
  assert.equal(textoModo("exacta"), null);
  assert.equal(textoModo("aproximada"), "No hay coincidencias exactas; estos se le parecen.");
  assert.equal(
    textoModo("parcial"),
    "Ningún producto coincide con todo lo que escribiste; estos coinciden con alguna palabra.",
  );
});

function bot(bloques: Extract<Mensaje, { autor: "bot" }>["bloques"]): Mensaje {
  return { id: 1, autor: "bot", bloques };
}

test("resumenDeMensaje: lo del cliente no se anuncia", () => {
  assert.equal(resumenDeMensaje({ id: 1, autor: "cliente", texto: "sub 12" }), null);
});

test("resumenDeMensaje: los textos, con su enlace, y el botón de WhatsApp; sin las opciones", () => {
  assert.equal(
    resumenDeMensaje(
      bot([
        {
          tipo: "texto",
          texto: "Has añadido 1 ítem al carrito.",
          enlace: { etiqueta: "Ver carrito", href: "/carrito" },
        },
        { tipo: "opciones", opciones: [{ id: "buscar", etiqueta: "Buscar un producto" }] },
        {
          tipo: "whatsapp",
          etiqueta: "Hablar con Sonoro",
          mensaje: "Hola Sonoro, tengo una consulta",
          motivo: "hablar",
        },
      ]),
    ),
    "Has añadido 1 ítem al carrito. Ver carrito. Hablar con Sonoro.",
  );
});

test("resumenDeMensaje: una búsqueda dice cuántos resultados, no cada fila", () => {
  const productos = (skus: string[], total: number) =>
    bot([{ tipo: "productos", skus, total, verTodosHref: "/buscar?q=x" }]);
  assert.equal(resumenDeMensaje(productos(["A"], 1)), "1 resultado.");
  assert.equal(resumenDeMensaje(productos(["A", "B"], 2)), "2 resultados.");
  assert.equal(
    resumenDeMensaje(productos(["A", "B", "C", "D", "E"], 37)),
    "37 resultados; se muestran 5.",
  );
});

test("resumenDeMensaje: los avisos de filtros y la corrección", () => {
  assert.equal(
    resumenDeMensaje(
      bot([
        { tipo: "filtros", aplicados: ["Marino"], correccion: "memphis", modo: "aproximada" },
        { tipo: "productos", skus: ["A"], total: 1, verTodosHref: "/buscar?q=x" },
      ]),
    ),
    "Filtros de tu búsqueda: Marino. No hay coincidencias exactas; estos se le parecen. " +
      "Quizá quisiste decir «memphis». 1 resultado.",
  );
});

test("adoptar: la conversación guardada solo gana si es la misma y va más adelante", () => {
  const c0 = conversacionInicial("x");
  const c1 = conMensaje(c0, { autor: "cliente", texto: "hola" });
  // Sin nada guardado, la prop.
  assert.equal(adoptar(c0, null), c0);
  // La prop se quedó atrás (el render todavía no llegó): gana la guardada.
  assert.equal(adoptar(c0, c1), c1);
  // La prop va igual o más adelante: gana la prop.
  assert.equal(adoptar(c1, c1), c1);
  assert.equal(adoptar(c1, c0), c1);
  // Otra conversación: manda la del lanzador.
  const otra = conMensaje(conMensaje(conversacionInicial("y"), { autor: "cliente", texto: "a" }), {
    autor: "cliente",
    texto: "b",
  });
  assert.equal(adoptar(c0, otra), c0);
});

test("colaDeRespuestas: una respuesta rápida espera a la anterior lenta y el historial queda en orden", async () => {
  const cola = colaDeRespuestas();
  let conversacion = conversacionInicial("x");
  const escribir = (texto: string) => {
    conversacion = conMensaje(conversacion, { autor: "cliente", texto });
  };
  // Lo que hace el panel al responder: sobre la conversación MÁS RECIENTE.
  const responderCon =
    (entrada: Parameters<typeof responderEnConversacion>[1]) => (catalogo: CatalogoChat | null) => {
      conversacion = responderEnConversacion(
        conversacion,
        entrada,
        crearContexto(catalogo, {}),
      ).conversacion;
    };

  // Q1 espera al catálogo (llega tarde); Q2 es un tema y no espera nada.
  let llegaElCatalogo!: (c: CatalogoChat) => void;
  const catalogo = new Promise<CatalogoChat>((r) => (llegaElCatalogo = r));

  escribir("sq12");
  const r1 = cola.encolar(catalogo, responderCon({ tipo: "texto", texto: "sq12" }));
  escribir("Envíos");
  const r2 = cola.encolar(null, responderCon({ tipo: "opcion", id: "envios" }));

  // El tema está listo, pero no se adelanta a la respuesta pendiente.
  await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(
    conversacion.mensajes.map((m) => m.autor),
    ["bot", "cliente", "cliente"],
  );

  llegaElCatalogo(CATALOGO);
  await Promise.all([r1, r2]);

  // Ids crecientes, sin insertar respuestas en medio del historial.
  assert.deepEqual(
    conversacion.mensajes.map((m) => m.id),
    [0, 1, 2, 3, 4],
  );
  const respuestas = conversacion.mensajes.slice(3);
  assert.ok(
    respuestas[0].autor === "bot" && respuestas[0].bloques.some((b) => b.tipo === "productos"),
    "primero la respuesta a la búsqueda",
  );
  assert.ok(
    respuestas[1].autor === "bot" &&
      respuestas[1].bloques.some((b) => b.tipo === "texto" && b.texto.includes("Envío")),
    "después la del tema",
  );
  // El estado es el de la ÚLTIMA respuesta: «Hablar con Sonoro» nombra el tema.
  assert.deepEqual(conversacion.estado, { ultimaConsulta: null, ultimoTema: "envios" });
});

test("colaDeRespuestas: si una respuesta falla, las siguientes siguen saliendo", async () => {
  const cola = colaDeRespuestas();
  const salidas: string[] = [];
  const fallida = cola.encolar(Promise.reject(new Error("sin catálogo")), () => {
    salidas.push("A");
  });
  const siguiente = cola.encolar(null, () => {
    salidas.push("B");
  });
  await assert.rejects(fallida);
  await siguiente;
  assert.deepEqual(salidas, ["B"]);
});

test("resumenDeMensaje: lo que cierra el enlace se lee pegado a su etiqueta", () => {
  const mensaje: Mensaje = {
    id: 1,
    autor: "bot",
    bloques: [
      {
        tipo: "texto",
        texto: "La dirección completa está en",
        enlace: { etiqueta: "Nosotros", href: "/nosotros", despues: "." },
      },
    ],
  };
  assert.equal(resumenDeMensaje(mensaje), "La dirección completa está en Nosotros.");
});
