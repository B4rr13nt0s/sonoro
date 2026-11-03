import test from "node:test";
import assert from "node:assert/strict";

import {
  TEXTOS_CHARLA,
  detectarCharla,
  esVago,
  fraseResultados,
  preguntaVaga,
  type ClaseCharla,
} from "./charla.ts";

const FRASES: Record<ClaseCharla, string[]> = {
  gracias: ["gracias", "¡Muchas gracias!", "mil gracias", "te agradezco", "gracias por la info"],
  como_estas: ["¿cómo estás?", "como esta", "qué tal estás", "cómo te va"],
  quien_eres: [
    "¿eres un bot?",
    "eres una persona",
    "eres humano?",
    "¿con quién hablo?",
    "quién eres",
    "eres real",
  ],
  adios: ["adiós", "bye", "chao", "hasta luego", "eso es todo", "nada más", "es todo"],
  confirmacion: [
    "ok",
    "okay",
    "sí",
    "si",
    "dale",
    "va",
    "listo",
    "perfecto",
    "entendido",
    "está bien",
  ],
  negacion: ["no", "no gracias", "ninguno"],
  groseria: ["idiota", "eres un idiota"],
};

for (const [clase, frases] of Object.entries(FRASES)) {
  test(`charla: ${clase}`, () => {
    for (const frase of frases) assert.equal(detectarCharla(frase), clase, frase);
  });
}

test("charla: con saludo delante", () => {
  assert.equal(detectarCharla("hola, ¿cómo estás?"), "como_estas");
  assert.equal(detectarCharla("Buenas tardes, muchas gracias"), "gracias");
});

test("charla: no se come una búsqueda", () => {
  assert.equal(detectarCharla("gracias, y de 10?"), null);
  assert.equal(detectarCharla("nada más memphis"), null);
  assert.equal(detectarCharla("si tienen memphis"), null);
  // «hola» sola sigue siendo saludo.
  assert.equal(detectarCharla("hola"), null);
});

test("charla: las respuestas son las de la spec", () => {
  assert.equal(TEXTOS_CHARLA.gracias, "Con gusto. ¿Te ayudo con algo más?");
  assert.equal(TEXTOS_CHARLA.como_estas, "Bien, gracias. ¿Qué producto buscas?");
  assert.equal(
    TEXTOS_CHARLA.quien_eres,
    "Soy el asistente automático de Sonoro: busco productos y respondo dudas de envíos, garantía y pagos.",
  );
  assert.equal(TEXTOS_CHARLA.adios, "Gracias por escribir. Aquí estoy si necesitas algo más.");
  assert.equal(TEXTOS_CHARLA.negacion, "Está bien. Aquí estoy si necesitas algo más.");
  assert.equal(
    TEXTOS_CHARLA.groseria,
    "Estoy para ayudarte a buscar productos y resolver dudas de la tienda.",
  );
});

test("vago: pide equipo sin decir cuál", () => {
  for (const frase of [
    "algo para mi carro",
    "quiero mejorar el sonido",
    "quiero mejorar el sonido de mi carro",
    "quiero más bajo",
    "que suene más fuerte",
    "busco equipo",
    "quiero armar mi sistema",
  ]) {
    assert.equal(esVago(frase), true, frase);
  }
  assert.equal(esVago("bajo de 12"), false);
  assert.equal(esVago("subwoofer para mi carro"), false);
});

test("fraseResultados: rota con el turno y no pluraliza 1", () => {
  assert.equal(fraseResultados(1, 0), "Encontré 1 resultado.");
  assert.equal(fraseResultados(1, 1), "Encontré 1 resultado.");
  assert.equal(fraseResultados(28, 0), "Encontré 28 resultados.");
  assert.equal(fraseResultados(28, 1), "Estos son los 28 resultados.");
});

test("preguntaVaga", () => {
  assert.equal(preguntaVaga(118, "medida"), "Hay 118 resultados. ¿Qué medida buscas?");
  assert.equal(preguntaVaga(59, "canales"), "Hay 59 resultados. ¿De cuántos canales?");
  assert.equal(preguntaVaga(110, "categoria"), "Hay 110 resultados. ¿Qué tipo de equipo buscas?");
});
