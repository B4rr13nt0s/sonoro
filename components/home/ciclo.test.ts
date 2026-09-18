import test from "node:test";
import assert from "node:assert/strict";

import {
  anguloDelCiclo,
  duracionProductoMs,
  ESPERA_MS,
  GIRO_MS,
  PLAN_CICLO,
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
    transcurrido += plan.esperaMs;
    if (plan.avanza) avances += 1;
    fase = plan.siguiente;
  }

  assert.deepEqual(recorrido, ["espera-previa", "girando", "espera-final"]);
  assert.equal(fase, "espera-previa", "tras avanzar vuelve al principio del ciclo");
  assert.equal(avances, 1, "se avanza de producto una sola vez por vuelta");
  assert.equal(transcurrido, duracionProductoMs());
  assert.equal(transcurrido, 16_000);
});

test("la espera antes y después del giro son iguales, y el giro dura 10 s", () => {
  assert.equal(PLAN_CICLO["espera-previa"]?.esperaMs, ESPERA_MS);
  assert.equal(PLAN_CICLO["espera-final"]?.esperaMs, ESPERA_MS);
  assert.equal(ESPERA_MS, 3_000);
  assert.equal(PLAN_CICLO.girando?.esperaMs, GIRO_MS);
  assert.equal(GIRO_MS, 10_000);
});

test("tras soltar el modelo se recupera la vista antes de girar", () => {
  // 3 s desde que se suelta, y recién ahí empieza a volver la cámara.
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

test("el ángulo se satura en una vuelta y es 0 fuera de la fase de giro", () => {
  assert.equal(anguloDelCiclo("girando", GIRO_MS * 3), -2 * Math.PI);
  assert.equal(anguloDelCiclo("girando", -500), 0);
  for (const fase of ["espera-previa", "espera-final", "interactuando", "volviendo"] as const) {
    assert.equal(anguloDelCiclo(fase, 9_999), 0, `${fase} no debería girar`);
  }
});
