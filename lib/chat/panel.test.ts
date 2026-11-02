import test from "node:test";
import assert from "node:assert/strict";

import type { CatalogoChat } from "./catalogo.ts";
import { ESTADO_INICIAL, bloquesDeInicio } from "./motor.ts";
import {
  conMensaje,
  conversacionInicial,
  crearContexto,
  etiquetaVerTodos,
  mensajeAgregado,
  prepararTexto,
  responderEnConversacion,
  textoAgregado,
} from "./panel.ts";
import { MAX_CONSULTA, type Conversacion } from "./tipos.ts";

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

test("textoAgregado: el mismo texto de la ficha, en singular y plural", () => {
  assert.equal(textoAgregado(1), "Has añadido 1 ítem al carrito.");
  assert.equal(textoAgregado(3), "Has añadido 3 ítems al carrito.");
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
