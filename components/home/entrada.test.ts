import test from "node:test";
import assert from "node:assert/strict";

import {
  ENTRADA_HECHA,
  ENTRADA_INICIAL,
  ENTRADA_MS,
  PASO_MAX_ENTRADA_S,
  pasoEntrada,
  type Entrada,
  type ObservacionEntrada,
} from "./entrada.ts";

const obs = (parcial: Partial<ObservacionEntrada> = {}): ObservacionEntrada => ({
  animar: true,
  modeloMontado: true,
  compilado: false,
  deltaS: 1 / 60,
  ...parcial,
});

test("sin animación (movimiento reducido) el producto ya está en su lugar", () => {
  const paso = pasoEntrada(ENTRADA_INICIAL, obs({ animar: false }));
  assert.deepEqual(paso, { entrada: ENTRADA_HECHA, falta: 0, compilar: false });
});

test("espera fuera de cuadro mientras el .glb no está montado", () => {
  const paso = pasoEntrada(ENTRADA_INICIAL, obs({ modeloMontado: false }));
  assert.equal(paso.entrada.estado, "pendiente");
  assert.equal(paso.falta, 1);
  assert.equal(paso.compilar, false);
});

test("al montarse el modelo se pide UNA compilación y no se repite", () => {
  const primero = pasoEntrada(ENTRADA_INICIAL, obs());
  assert.equal(primero.entrada.estado, "compilando");
  assert.equal(primero.compilar, true);
  assert.equal(primero.falta, 1);

  const segundo = pasoEntrada(primero.entrada, obs());
  assert.equal(segundo.entrada.estado, "compilando");
  assert.equal(segundo.compilar, false);
  assert.equal(segundo.falta, 1);
});

test("terminada la compilación arranca la entrada desde cero", () => {
  const paso = pasoEntrada({ estado: "compilando", avanceMs: 0 }, obs({ compilado: true }));
  assert.deepEqual(paso.entrada, { estado: "corriendo", avanceMs: 0 });
  assert.equal(paso.falta, 1);
});

test("corriendo: avanza con el delta de cada frame y frena al llegar", () => {
  let entrada: Entrada = { estado: "corriendo", avanceMs: 0 };
  let anterior = 1;
  let frames = 0;
  while (entrada.estado === "corriendo") {
    const paso = pasoEntrada(entrada, obs({ compilado: true }));
    assert.ok(paso.falta <= anterior, "la distancia que falta nunca aumenta");
    anterior = paso.falta;
    entrada = paso.entrada;
    frames += 1;
    assert.ok(frames < 1000, "la entrada termina");
  }
  assert.equal(entrada.estado, "hecha");
  // A 60 fps son ~54 frames de 16.7 ms; con un frame trabado serían más, nunca menos.
  assert.ok(frames >= Math.floor(ENTRADA_MS / (1000 / 60)) - 1);
});

test("un frame trabado no se salta la entrada: el avance por frame tiene tope", () => {
  const paso = pasoEntrada({ estado: "corriendo", avanceMs: 0 }, obs({ deltaS: 5 }));
  assert.equal(paso.entrada.estado, "corriendo");
  assert.equal(paso.entrada.avanceMs, PASO_MAX_ENTRADA_S * 1000);
  assert.ok(paso.falta > 0.5, "casi todo el recorrido sigue por hacer");
});

test("hecha se queda hecha, aunque el modelo vuelva a desmontarse", () => {
  const paso = pasoEntrada(ENTRADA_HECHA, obs({ modeloMontado: false }));
  assert.deepEqual(paso, { entrada: ENTRADA_HECHA, falta: 0, compilar: false });
});
