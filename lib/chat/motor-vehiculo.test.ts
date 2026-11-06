// El motor con «¿qué le queda a mi carro?» (2026-11-06-chat-compatibilidad-design.md).
// Aparte de motor.test.ts, que ya es largo; los bloques en sí se prueban en
// respuestaVehiculo.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";

import type { DatosVehiculos, Vehiculo } from "../vehiculos/types.ts";
import { ERROR_CARGA, TEXTO_PEDIR_VEHICULO } from "../vehiculos/textos.ts";
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
  assert.deepEqual(r.estado, { ultimaConsulta: "Prueba Uno 2010", ultimoTema: null });
});

test("la frase sola pide el carro, sin evento", () => {
  const r = responder(ESTADO_INICIAL, escrito("¿qué le queda a mi carro?"), CON_VEHICULOS);
  assert.deepEqual(textos(r.bloques), [TEXTO_PEDIR_VEHICULO]);
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
