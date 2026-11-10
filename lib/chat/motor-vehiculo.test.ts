// El motor con «¿qué le queda a mi carro?» (2026-11-06-chat-compatibilidad-design.md).
// Aparte de motor.test.ts, que ya es largo; los bloques en sí se prueban en
// respuestaVehiculo.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";

import type { DatosVehiculos, Vehiculo } from "../vehiculos/types.ts";
import { ERROR_CARGA, NO_ESTA_VEHICULO, TEXTO_PEDIR_VEHICULO } from "../vehiculos/textos.ts";
import { ESTADO_INICIAL, necesitaCatalogo, responder } from "./motor.ts";
import { idOpcionVehiculo } from "./respuestaVehiculo.ts";
import type { Bloque, Contexto, Entrada, Estado, OpcionId } from "./tipos.ts";

function vehiculo(extra: Partial<Vehiculo>): Vehiculo {
  return {
    marca: "Prueba",
    marcaSlug: "prueba",
    modelo: "Uno",
    modeloSlug: "uno",
    version: null,
    versionSlug: null,
    desde: 2008,
    hasta: 2012,
    radio1din: null,
    radio2din: "directo",
    ubicaciones: [],
    ...extra,
  };
}

const DATOS: DatosVehiculos = {
  vehiculos: [
    vehiculo({}),
    vehiculo({ desde: 2016, hasta: 2016, version: "A", versionSlug: "a" }),
    vehiculo({ desde: 2016, hasta: 2016, version: "B", versionSlug: "b" }),
  ],
  receptores: [
    {
      sku: "R2",
      slug: "r2",
      nombre: "Pantalla R2",
      marca: "Pioneer",
      categoria: "Receptores",
      precioCents: 300000,
      disponibilidad: "disponible",
      destacado: false,
      imagenes: [],
      specsDestacadas: [],
      formato: "2-din",
    },
  ],
  bocinas: [],
  piezas: [],
};

const SIN_VEHICULOS: Contexto = { productos: [], marcas: [], contacto: {} };
const CON_VEHICULOS: Contexto = {
  ...SIN_VEHICULOS,
  vehiculos: { datos: DATOS, ambiguos: new Set() },
};

function textos(bloques: Bloque[]): string[] {
  return bloques.flatMap((b) => (b.tipo === "texto" ? [b.texto] : []));
}

function opcion(bloques: Bloque[], etiqueta: string): OpcionId {
  for (const b of bloques) {
    if (b.tipo !== "opciones") continue;
    const o = b.opciones.find((x) => x.etiqueta === etiqueta);
    if (o) return o.id;
  }
  throw new Error(`sin la opción ${etiqueta}`);
}

function escrito(texto: string): Entrada {
  return { tipo: "texto", texto };
}

test("el carro escrito da el resumen, con su evento y su consulta", () => {
  const r = responder(
    ESTADO_INICIAL,
    escrito("¿Qué le queda a mi prueba uno 2010?"),
    CON_VEHICULOS,
  );
  assert.equal(textos(r.bloques)[0], "Prueba Uno 2010");
  assert.equal(textos(r.bloques)[1], "Receptores: 1 cabe.");
  assert.deepEqual(r.evento, { evento: "vehiculo", consulta: "Prueba Uno 2010", resultados: 1 });
  assert.equal(r.estado.ultimaConsulta, "Prueba Uno 2010");
  assert.equal(r.estado.ultimoTema, null);
});

test("la frase sola pide el carro, sin evento", () => {
  const r = responder(ESTADO_INICIAL, escrito("¿qué le queda a mi carro?"), CON_VEHICULOS);
  assert.deepEqual(textos(r.bloques), [TEXTO_PEDIR_VEHICULO, NO_ESTA_VEHICULO]);
  assert.equal(r.evento, null);
  assert.equal(r.estado.ultimaConsulta, "¿qué le queda a mi carro?");
});

test("por botones: modelo, generación, versión, resumen y grupo", () => {
  let estado: Estado = ESTADO_INICIAL;
  let r = responder(estado, escrito("prueba"), CON_VEHICULOS);
  assert.deepEqual(textos(r.bloques), ["¿Qué modelo de Prueba?"]);

  const paso = (etiqueta: string) => {
    estado = r.estado;
    r = responder(estado, { tipo: "opcion", id: opcion(r.bloques, etiqueta) }, CON_VEHICULOS);
  };
  paso("Uno");
  assert.deepEqual(textos(r.bloques), ["¿De qué año es tu Prueba Uno?"]);
  paso("2016");
  assert.deepEqual(textos(r.bloques), ["¿Cuál es tu Prueba Uno 2016?"]);
  paso("B");
  assert.equal(textos(r.bloques)[0], "Prueba Uno 2016 · B");
  assert.equal(r.evento?.evento, "vehiculo");
  paso("Receptores");
  assert.equal(textos(r.bloques)[0], "Receptores · Prueba Uno 2016 · B");
  assert.equal(r.evento, null);
  assert.equal(r.estado.ultimaConsulta, "Prueba Uno 2016 · B");
});

test("sin los datos de vehículos", () => {
  const frase = responder(ESTADO_INICIAL, escrito("qué le queda a mi carro"), SIN_VEHICULOS);
  assert.equal(textos(frase.bloques)[0], ERROR_CARGA);

  const boton = responder(
    ESTADO_INICIAL,
    { tipo: "opcion", id: idOpcionVehiculo({ sel: { marca: "prueba" }, rango: false, ver: null }) },
    SIN_VEHICULOS,
  );
  assert.equal(textos(boton.bloques)[0], ERROR_CARGA);

  // Sin frase, el carro escrito sigue como una búsqueda cualquiera.
  const carro = responder(ESTADO_INICIAL, escrito("prueba uno 2010"), SIN_VEHICULOS);
  assert.ok(
    ["busqueda", "sin_resultados"].includes(carro.evento?.evento ?? ""),
    carro.evento?.evento,
  );
});

test("lo que no es un carro sigue como antes", () => {
  const mejor = responder(ESTADO_INICIAL, escrito("¿cuál es mejor?"), CON_VEHICULOS);
  assert.equal(mejor.evento?.evento, "recomendacion");

  const radio = responder(ESTADO_INICIAL, escrito("radio para mi carro"), CON_VEHICULOS);
  assert.ok(
    ["busqueda", "sin_resultados"].includes(radio.evento?.evento ?? ""),
    radio.evento?.evento,
  );

  const instalan = responder(
    ESTADO_INICIAL,
    escrito("¿instalan en un prueba uno 2010?"),
    CON_VEHICULOS,
  );
  assert.deepEqual(instalan.evento, { evento: "tema", tema: "instalacion" });
});

test("necesitaCatalogo: los botones de vehículo y la recomendación también", () => {
  assert.equal(necesitaCatalogo({ tipo: "opcion", id: "vehiculo:vehiculo=prueba" }), true);
  assert.equal(necesitaCatalogo(escrito("¿qué me recomiendan?")), true);
  assert.equal(necesitaCatalogo(escrito("¿qué le queda a mi carro?")), true);
  assert.equal(necesitaCatalogo(escrito("envíos")), false);
});

test("una pregunta de carro con una palabra de dato da el resumen", () => {
  const r = responder(
    ESTADO_INICIAL,
    escrito("¿qué tamaño de bocina le cabe a mi prueba uno 2010?"),
    CON_VEHICULOS,
  );
  assert.equal(textos(r.bloques)[0], "Prueba Uno 2010");
  assert.equal(r.evento?.evento, "vehiculo");
  assert.equal(
    necesitaCatalogo(escrito("¿qué tamaño de bocina le cabe a mi prueba uno 2010?")),
    true,
  );
});

test("otra categoría o un vehículo que no es carro siguen como búsqueda", () => {
  for (const texto of ["amplificador para mi prueba uno 2010", "¿qué le queda a mi lancha?"]) {
    const r = responder(ESTADO_INICIAL, escrito(texto), CON_VEHICULOS);
    assert.ok(["busqueda", "sin_resultados"].includes(r.evento?.evento ?? ""), texto);
  }
});

test("tras «¿de qué año es?», un año escrito contesta la pregunta", () => {
  let r = responder(ESTADO_INICIAL, escrito("¿qué le queda a mi uno?"), CON_VEHICULOS);
  assert.match(textos(r.bloques)[0], /¿De qué año es tu Prueba Uno\?/);
  assert.deepEqual(r.estado.vehiculoPendiente, { marca: "prueba", modelo: "uno" });

  for (const respuesta of ["2010", "del 2010", "año 2010"]) {
    const siguiente = responder(r.estado, escrito(respuesta), CON_VEHICULOS);
    assert.equal(textos(siguiente.bloques)[0], "Prueba Uno 2010", respuesta);
    // Ya contestó: la pregunta no queda pendiente.
    assert.equal(siguiente.estado.vehiculoPendiente, undefined, respuesta);
  }

  // Un año con más de una versión sigue preguntando, y la versión es otra pregunta.
  r = responder(r.estado, escrito("2016"), CON_VEHICULOS);
  assert.match(textos(r.bloques)[0], /Prueba Uno 2016/);
  assert.equal(r.estado.vehiculoPendiente, undefined);
});

test("sin la pregunta pendiente, un año suelto sigue siendo una búsqueda", () => {
  const r = responder(ESTADO_INICIAL, escrito("2010"), CON_VEHICULOS);
  assert.notEqual(textos(r.bloques)[0], "Prueba Uno 2010");
  assert.equal(r.estado.vehiculoPendiente, undefined);
});

test("un año fuera de la lista tras la pregunta lo dice, no lo ignora", () => {
  const p = responder(ESTADO_INICIAL, escrito("¿qué le queda a mi uno?"), CON_VEHICULOS);
  const r = responder(p.estado, escrito("1999"), CON_VEHICULOS);
  assert.match(textos(r.bloques)[0], /1999/);
});

test("la pregunta «¿de qué año es?» solo espera el mensaje que sigue: «hola», «gracias» y las opciones la olvidan", () => {
  const preguntado = responder(ESTADO_INICIAL, escrito("¿qué le queda a mi uno?"), CON_VEHICULOS);
  assert.ok(preguntado.estado.vehiculoPendiente);

  const entradas: Entrada[] = [
    escrito("hola"),
    escrito("gracias"),
    { tipo: "opcion", id: "buscar" },
    { tipo: "opcion", id: "hablar" },
  ];
  for (const entrada of entradas) {
    const r = responder(preguntado.estado, entrada, CON_VEHICULOS);
    assert.equal(r.estado.vehiculoPendiente, undefined, JSON.stringify(entrada));
    // Y un año suelto después ya no es el año de ese carro.
    const despues = responder(r.estado, escrito("2010"), CON_VEHICULOS);
    assert.notEqual(textos(despues.bloques)[0], "Prueba Uno 2010", JSON.stringify(entrada));
  }
});
