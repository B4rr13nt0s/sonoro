import test from "node:test";
import assert from "node:assert/strict";

import {
  anguloDelCiclo,
  duracionProductoMs,
  ESPERA_CORTA_MS,
  ESPERA_MS,
  esperaDeFaseMs,
  GIRO_MS,
  PLAN_CICLO,
  RelojFase,
  type FaseCarrusel,
  type PasoCiclo,
} from "./ciclo.ts";

test("el ciclo recorre espera → giro → espera → siguiente producto", () => {
  const recorrido: FaseCarrusel[] = [];
  let fase: FaseCarrusel = "espera-previa";
  let avances = 0;
  let transcurrido = 0;

  for (let paso = 0; paso < 3; paso++) {
    recorrido.push(fase);
    const plan: PasoCiclo | null = PLAN_CICLO[fase];
    assert.ok(plan, `la fase ${fase} debería tener plazo`);
    // Producto al que se llegó solo y que nadie tocó: las dos esperas cortas.
    transcurrido += esperaDeFaseMs(fase, { llegoSolo: true, interactuo: false });
    if (plan.avanza) avances += 1;
    fase = plan.siguiente;
  }

  assert.deepEqual(recorrido, ["espera-previa", "girando", "espera-final"]);
  assert.equal(fase, "espera-previa", "tras avanzar vuelve al principio del ciclo");
  assert.equal(avances, 1, "se avanza de producto una sola vez por vuelta");
  assert.equal(transcurrido, duracionProductoMs());
  assert.equal(transcurrido, 12_000);
});

test("las esperas: 2 s por defecto, 1 s cuando nadie intervino, y el giro dura 10 s", () => {
  assert.equal(ESPERA_MS, 2_000);
  assert.equal(ESPERA_CORTA_MS, 1_000);
  // Producto pedido por el usuario: espera larga antes de girar.
  assert.equal(esperaDeFaseMs("espera-previa", { llegoSolo: false, interactuo: false }), 2_000);
  // Producto al que se llegó solo: espera corta.
  assert.equal(esperaDeFaseMs("espera-previa", { llegoSolo: true, interactuo: false }), 1_000);
  // Vuelta sin tocar: 1 s antes de cambiar. Tocada: 2 s.
  assert.equal(esperaDeFaseMs("espera-final", { llegoSolo: true, interactuo: false }), 1_000);
  assert.equal(esperaDeFaseMs("espera-final", { llegoSolo: false, interactuo: true }), 2_000);
  // Soltar el modelo: 2 s, sin importar el contexto.
  assert.equal(esperaDeFaseMs("interactuando", { llegoSolo: true, interactuo: false }), 2_000);
  assert.equal(PLAN_CICLO.girando?.esperaMs, GIRO_MS);
  assert.equal(GIRO_MS, 10_000);
});

test("tras soltar el modelo se recupera la vista antes de girar", () => {
  // 2 s desde que se suelta, y recién ahí empieza a volver la cámara.
  assert.deepEqual(PLAN_CICLO.interactuando, { siguiente: "volviendo", esperaMs: ESPERA_MS });
  // 'volviendo' no termina por reloj: la corta el rig cuando llegó a destino.
  assert.equal(PLAN_CICLO.volviendo, null);
});

test("el giro va de derecha a izquierda y da exactamente una vuelta", () => {
  assert.equal(anguloDelCiclo("girando", 0), 0);
  // Signo negativo: una rotación positiva sobre +Y llevaría la cara
  // frontal hacia la derecha.
  assert.ok(anguloDelCiclo("girando", 1_000) < 0);
  assert.equal(anguloDelCiclo("girando", GIRO_MS), -2 * Math.PI);
  // A mitad de camino, media vuelta.
  assert.equal(anguloDelCiclo("girando", GIRO_MS / 2), -Math.PI);
});

test("RelojFase: la pausa no cuenta, ni siquiera antes de reanudar", () => {
  const reloj = new RelojFase("girando", 1_000);
  assert.equal(reloj.transcurrido("girando", 5_000), 4_000);

  reloj.pausar(5_000);
  // En pausa el tiempo queda clavado: esto es lo que ve el canvas en los
  // frames entre que el carrusel vuelve a la vista y React re-renderiza.
  assert.equal(reloj.transcurrido("girando", 35_000), 4_000);
  reloj.pausar(20_000); // pausar dos veces no mueve el inicio de la pausa
  assert.equal(reloj.transcurrido("girando", 35_000), 4_000);

  reloj.reanudar(35_000);
  assert.equal(reloj.transcurrido("girando", 35_000), 4_000, "sin salto al reanudar");
  assert.equal(reloj.transcurrido("girando", 36_000), 5_000);
  reloj.reanudar(40_000); // reanudar sin pausa no hace nada
  assert.equal(reloj.transcurrido("girando", 40_000), 9_000);
});

test("RelojFase: una fase nueva empieza en cero, también en plena pausa", () => {
  const reloj = new RelojFase("espera-final", 0);
  reloj.pausar(8_000);
  // Una flecha durante la pausa: la fase nueva no arrastra la pausa vieja.
  reloj.cambiar("espera-previa", 30_000);
  assert.equal(reloj.fase, "espera-previa");
  assert.equal(reloj.transcurrido("espera-previa", 30_000), 0);
  reloj.reanudar(30_000);
  assert.equal(reloj.transcurrido("espera-previa", 33_000), 3_000);
  // Y la fase que terminó en pausa guarda el tiempo clavado, no el de reloj.
  assert.equal(reloj.transcurrido("espera-final", 33_000), 8_000);
});

test("RelojFase: quien todavía dibuja una fase terminada ve el tiempo con el que terminó", () => {
  const reloj = new RelojFase("girando", 0);
  // A media vuelta llega una interacción: el reloj cambia de fase en el acto.
  reloj.cambiar("interactuando", 4_000);
  // El canvas, que todavía no recibió la fase nueva, pregunta por la suya:
  // 4 s, no 0 — si recibiera 0, dibujaría el modelo en el ángulo del inicio
  // de la vuelta.
  assert.equal(reloj.transcurrido("girando", 4_050), 4_000);
  assert.equal(reloj.transcurrido("interactuando", 4_050), 50);
});

test("RelojFase: varios cambios antes del render no pisan el final de la vuelta", () => {
  // El caso que rompía la versión con «solo la fase anterior»: una ráfaga de
  // rueda cambia de fase varias veces antes de que el canvas re-renderice.
  const reloj = new RelojFase("girando", 0);
  reloj.cambiar("interactuando", 4_000);
  reloj.cambiar("interactuando", 4_005);
  reloj.cambiar("interactuando", 4_010);
  assert.equal(reloj.transcurrido("girando", 4_050), 4_000, "sigue siendo el de la vuelta");
  assert.equal(reloj.transcurrido("interactuando", 4_050), 40, "la en curso, desde la última");

  // Terminado el regreso, la vuelta nueva cuenta desde cero, no desde 4 s.
  reloj.cambiar("volviendo", 7_010);
  reloj.cambiar("girando", 7_800);
  assert.equal(reloj.transcurrido("girando", 8_800), 1_000);
});

test("RelojFase: una fase que nunca corrió da 0", () => {
  const reloj = new RelojFase("espera-previa", 0);
  assert.equal(reloj.transcurrido("girando", 5_000), 0);
});

test("el ángulo se satura en una vuelta y es 0 fuera de la fase de giro", () => {
  assert.equal(anguloDelCiclo("girando", GIRO_MS * 3), -2 * Math.PI);
  assert.equal(anguloDelCiclo("girando", -500), 0);
  for (const fase of ["espera-previa", "espera-final", "interactuando", "volviendo"] as const) {
    assert.equal(anguloDelCiclo(fase, 9_999), 0, `${fase} no debería girar`);
  }
});
