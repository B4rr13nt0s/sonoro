import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { consultaVisible, detectarIntencion } from "./intencion.ts";

test("saludo: el texto entero es un saludo o agradecimiento", () => {
  for (const texto of ["Hola", "¡gracias!", "Buenos días", "muchas gracias", "OK", "adiós"]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "saludo" }, texto);
  }
});

test("saludo: varias fórmulas de saludo juntas siguen siendo saludo", () => {
  for (const texto of ["hola buenas", "Saludos", "Buen día", "¿Qué tal?", "hola, buenas tardes"]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "saludo" }, texto);
  }
});

test("saludo antes de la pregunta: se quita, con coma o signos, y se busca lo demás", () => {
  const esperada = detectarIntencion("tienen subwoofers memphis");
  assert.deepEqual(esperada, { tipo: "busqueda", consulta: "subwoofers memphis" });
  assert.deepEqual(detectarIntencion("hola, tienen subwoofers memphis?"), esperada);
  assert.deepEqual(detectarIntencion("Buenas tardes, ¿tienen subwoofers memphis?"), esperada);
  assert.deepEqual(detectarIntencion("buenas, cuánto cuesta el MJP800.4"), {
    tipo: "busqueda",
    consulta: "mjp800.4",
  });
  assert.deepEqual(detectarIntencion("Hola! busco un amplificador"), {
    tipo: "busqueda",
    consulta: "amplificador",
  });
  assert.deepEqual(detectarIntencion("hola buenas, que tal; quiero bocinas"), {
    tipo: "busqueda",
    consulta: "bocinas",
  });
});

test("saludo antes de un tema: el tema gana", () => {
  assert.deepEqual(detectarIntencion("hola, hacen envíos a Xela?"), {
    tipo: "tema",
    tema: "envios",
  });
});

test("la puntuación solo se quita cuando separa: 1,000 W y 6.5 se conservan", () => {
  assert.deepEqual(detectarIntencion("hola, amplificador 1,000 watts."), {
    tipo: "busqueda",
    consulta: "amplificador 1,000 watts",
  });
  assert.deepEqual(detectarIntencion('hola: bocinas 6.5"'), {
    tipo: "busqueda",
    consulta: 'bocinas 6.5"',
  });
});

test("consultaVisible: lo que escribió el cliente, sin saludo ni arranque, con sus acentos", () => {
  assert.equal(consultaVisible("Hola, ¿tienen Subwoofer Peñón?"), "Subwoofer Peñón");
  assert.equal(consultaVisible("precio del SQ12-D2"), "SQ12-D2");
  assert.equal(consultaVisible("  Sub 12 2 OHM "), "Sub 12 2 OHM");
});

test("recomendación: pide criterio", () => {
  for (const texto of [
    "¿Qué me recomiendan para mi carro?",
    "cuál es mejor",
    "¿cuál me conviene?",
  ]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "recomendacion" }, texto);
  }
});

// «¿Qué le queda a mi carro?» ya no es criterio: el motor la contesta con el
// selector de vehículos (2026-11-06-chat-compatibilidad-design.md).
test("«qué le queda» deja de ser recomendación", () => {
  for (const texto of ["¿qué le queda a mi carro?", "¿cuál le queda a mi corolla?"]) {
    assert.equal(detectarIntencion(texto).tipo, "busqueda", texto);
  }
});

test("tema: envios", () => {
  for (const texto of [
    "¿hacen envíos a Xela?",
    "¿entregan a domicilio?",
    "cuánto cuesta el flete",
  ]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema: "envios" }, texto);
  }
});

test("tema: garantia, y gana el tema sobre el producto", () => {
  for (const texto of [
    "¿el SQ12 trae garantía?",
    "llegó con defecto",
    "se arruinó",
    "se dañó mi sub",
  ]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema: "garantia" }, texto);
  }
});

test("tema: instalacion", () => {
  for (const texto of [
    "¿ustedes instalan?",
    "¿cuánto cuesta la instalación?",
    "¿lo colocan ustedes?",
  ]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema: "instalacion" }, texto);
  }
});

test("instalación con «kit» es una búsqueda, no el tema", () => {
  assert.deepEqual(detectarIntencion("kits de instalación 4 AWG"), {
    tipo: "busqueda",
    consulta: "kits de instalacion 4 awg",
  });
  assert.deepEqual(detectarIntencion("kit para instalar un amplificador"), {
    tipo: "busqueda",
    consulta: "kit para instalar un amplificador",
  });
});

test("tema: cuotas", () => {
  for (const texto of [
    "¿puedo pagar en cuotas?",
    "financiamiento",
    "aceptan tarjeta",
    "visacuotas",
  ]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema: "cuotas" }, texto);
  }
});

test("tema: como_pedir", () => {
  for (const texto of [
    "¿cómo compro?",
    "como pido",
    "¿cómo hago el pedido?",
    "puedo pagar en línea",
  ]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema: "como_pedir" }, texto);
  }
});

test("tema: contacto", () => {
  for (const texto of ["¿dónde están ubicados?", "su teléfono", "dirección", "tienen correo"]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema: "contacto" }, texto);
  }
});

test("los temas comparan palabras enteras, no pedazos de palabra", () => {
  // «pagos» dentro de «mapagos», «envio» dentro de «envioletado», «hay» no es tema.
  assert.deepEqual(detectarIntencion("mapagos"), { tipo: "busqueda", consulta: "mapagos" });
  assert.deepEqual(detectarIntencion("envioletado"), { tipo: "busqueda", consulta: "envioletado" });
  assert.deepEqual(detectarIntencion("entregando"), { tipo: "busqueda", consulta: "entregando" });
});

test("búsqueda: quita el arranque conversacional", () => {
  assert.deepEqual(detectarIntencion("¿tienen subwoofers de 12?"), {
    tipo: "busqueda",
    consulta: "subwoofers de 12",
  });
  assert.deepEqual(detectarIntencion("cuánto cuesta el SQ12"), {
    tipo: "busqueda",
    consulta: "sq12",
  });
  assert.deepEqual(detectarIntencion("precio del SQ12-D2"), {
    tipo: "busqueda",
    consulta: "sq12-d2",
  });
  assert.deepEqual(detectarIntencion("quiero un amplificador 4 canales"), {
    tipo: "busqueda",
    consulta: "amplificador 4 canales",
  });
});

test("búsqueda: los arranques se quitan repetidos y solo al inicio", () => {
  assert.deepEqual(detectarIntencion("busco tienen precio de las bocinas"), {
    tipo: "busqueda",
    consulta: "bocinas",
  });
  assert.deepEqual(detectarIntencion("memphis hay"), { tipo: "busqueda", consulta: "memphis hay" });
});

test("búsqueda: un texto sin arranque pasa tal cual, normalizado", () => {
  assert.deepEqual(detectarIntencion("Sub 12 2 OHM"), {
    tipo: "busqueda",
    consulta: "sub 12 2 ohm",
  });
  assert.deepEqual(detectarIntencion('bocinas 6.5"'), {
    tipo: "busqueda",
    consulta: 'bocinas 6.5"',
  });
});

test("sin nada que buscar tras el arranque es un saludo", () => {
  for (const texto of ["¿tienen?", "hay", "quiero", "  ", "", "¿cuánto cuesta?", "tienen un"]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "saludo" }, JSON.stringify(texto));
  }
});

test("palabra ambigua sola: sigue siendo el tema, sin pedir contexto", () => {
  for (const [texto, tema] of [
    ["teléfono", "contacto"],
    ["¿cuál es su correo?", "contacto"],
    ["cuál es su teléfono", "contacto"],
    ["hola, ¿cuál es la dirección?", "contacto"],
    ["número de teléfono", "contacto"],
    ["tarjeta", "cuotas"],
    ["¿aceptan tarjeta?", "cuotas"],
    ["pagos", "cuotas"],
  ] as const) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema }, texto);
  }
});

test("palabra ambigua con más contenido: el tema lleva la consulta para probarla primero", () => {
  assert.deepEqual(detectarIntencion("radio con carplay para el teléfono"), {
    tipo: "tema",
    tema: "contacto",
    ambigua: [
      {
        consulta: "radio con carplay para el telefono",
        visible: "radio con carplay para el teléfono",
      },
      { consulta: "radio con carplay", visible: "radio con carplay" },
    ],
  });
  assert.deepEqual(detectarIntencion("Tarjeta de sonido"), {
    tipo: "tema",
    tema: "cuotas",
    ambigua: [
      { consulta: "tarjeta de sonido", visible: "Tarjeta de sonido" },
      { consulta: "sonido", visible: "sonido" },
    ],
  });
  // Los saludos y arranques se quitan de la consulta.
  assert.deepEqual(detectarIntencion("hola, tienen radio con carplay y correo"), {
    tipo: "tema",
    tema: "contacto",
    ambigua: [
      { consulta: "radio con carplay y correo", visible: "radio con carplay y correo" },
      { consulta: "radio con carplay", visible: "radio con carplay" },
    ],
  });
});

test("palabra fuerte: el tema gana aunque haya más contenido y no pide contexto", () => {
  for (const [texto, tema] of [
    ["envío de amplificador", "envios"],
    ["garantía del subwoofer", "garantia"],
    ["instalan el radio con carplay", "instalacion"],
    ["cuotas para el teléfono", "cuotas"],
    ["como pago el radio con carplay", "como_pedir"],
    ["donde estan, cual es su telefono", "contacto"],
  ] as const) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "tema", tema }, texto);
  }
});

test("saludo + cortesía es un saludo, no una búsqueda", () => {
  for (const texto of [
    "hola gracias",
    "hola ok",
    "buenas, adiós",
    "Hola, muchas gracias",
    "vale",
  ]) {
    assert.deepEqual(detectarIntencion(texto), { tipo: "saludo" }, texto);
  }
  // Una cortesía dentro de una búsqueda real no la vuelve saludo.
  assert.equal(detectarIntencion("hola, busco un ok 12").tipo, "busqueda");
});

test("la puntuación se quita sin regex de lookbehind (Safari < 16.4 no la parsea)", () => {
  const fuente = readFileSync(new URL("./intencion.ts", import.meta.url), "utf8");
  assert.equal(fuente.includes("(?<"), false);
  // Mismo comportamiento que antes: entre letras, junto a espacios y bordes.
  assert.deepEqual(detectarIntencion("sub,memphis,kicker"), {
    tipo: "busqueda",
    consulta: "sub memphis kicker",
  });
  assert.deepEqual(detectarIntencion(" , .sub 12 ; ").tipo, "busqueda");
  assert.deepEqual(detectarIntencion('MJP800.4 1,000 W 6.5"'), {
    tipo: "busqueda",
    consulta: 'mjp800.4 1,000 w 6.5"',
  });
});

/** Solo lo que decide la intención: qué datos y qué producto. */
function dato(texto: string) {
  const r = detectarIntencion(texto);
  if (r.tipo !== "dato") return r.tipo;
  return {
    campos: r.campos.map((c) => (c.tipo === "spec" ? c.id : c.tipo)),
    consulta: r.consulta,
    visible: r.visible,
  };
}

test("dato: la pregunta por un dato del producto, sin las palabras de la pregunta", () => {
  assert.deepEqual(dato("¿Cuántos watts tiene el MJP1244?"), {
    campos: ["potencia"],
    consulta: "mjp1244",
    visible: "MJP1244",
  });
  assert.deepEqual(dato("cuantos canales tiene el XED4"), {
    campos: ["canales"],
    consulta: "xed4",
    visible: "XED4",
  });
  assert.deepEqual(dato("profundidad del PRXS1224"), {
    campos: ["profundidad"],
    consulta: "prxs1224",
    visible: "PRXS1224",
  });
  assert.deepEqual(dato("hola, ¿qué incluye el kit KIT4?"), {
    campos: ["contenido"],
    consulta: "kit kit4",
    visible: "kit KIT4",
  });
  assert.deepEqual(dato("impedancia y potencia del sub Memphis de 12"), {
    campos: ["potencia", "impedancia"],
    consulta: "sub memphis 12",
    visible: "sub Memphis 12",
  });
});

test("dato: la disponibilidad, también tras un arranque", () => {
  assert.deepEqual(dato("¿Está disponible el SQ12-D2?"), {
    campos: ["disponibilidad"],
    consulta: "sq12-d2",
    visible: "SQ12-D2",
  });
  assert.deepEqual(dato("hola, ¿tienen el MJP1244 en existencia?"), {
    campos: ["disponibilidad"],
    consulta: "mjp1244",
    visible: "MJP1244",
  });
});

test("dato: tras un número, la unidad es un filtro de la búsqueda, no una pregunta", () => {
  for (const texto of [
    "amplificador 1,000 watts",
    "sub 12 2 ohm",
    "amplificador de 1000 w rms",
    "quiero un amplificador 4 canales",
    "kit 4 awg",
  ]) {
    assert.equal(dato(texto), "busqueda", texto);
  }
});

test("dato: «que trae» suelto no pregunta por el contenido", () => {
  assert.equal(dato("radio que trae bluetooth"), "busqueda");
});

test("dato: sin producto, la consulta queda vacía", () => {
  assert.deepEqual(dato("¿cuántos watts?"), { campos: ["potencia"], consulta: "", visible: "" });
});

test("dato: los temas de política siguen ganando", () => {
  assert.equal(detectarIntencion("¿el envío está disponible a Petén?").tipo, "tema");
});

test("arranques de pregunta: «tendrán», «ando buscando», «me gustaría ver» se quitan", () => {
  assert.deepEqual(detectarIntencion("¿Tendrán amplificadores?"), {
    tipo: "busqueda",
    consulta: "amplificadores",
  });
  assert.deepEqual(detectarIntencion("ando buscando un radio con carplay"), {
    tipo: "busqueda",
    consulta: "radio con carplay",
  });
  assert.deepEqual(detectarIntencion("me gustaría ver subwoofers de 10"), {
    tipo: "busqueda",
    consulta: "subwoofers de 10",
  });
});
