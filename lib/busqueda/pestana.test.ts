import test from "node:test";
import assert from "node:assert/strict";

import { hrefPestana, leerPestana } from "./pestana.ts";

test("leerPestana: vehiculo o por=vehiculo abren «Por vehículo»; q gana", () => {
  assert.equal(leerPestana(""), "producto");
  assert.equal(leerPestana("q=memphis"), "producto");
  assert.equal(leerPestana("por=vehiculo"), "vehiculo");
  assert.equal(leerPestana("vehiculo=toyota&modelo=corolla"), "vehiculo");
  assert.equal(leerPestana("q=memphis&vehiculo=toyota"), "producto");
  assert.equal(leerPestana("q=memphis&por=vehiculo"), "producto");
  assert.equal(leerPestana("por=otro"), "producto");
  assert.equal(leerPestana("modelo=corolla&anio=2010"), "producto");
});

test("hrefPestana: cada pestaña empieza vacía", () => {
  assert.equal(hrefPestana("producto"), "/buscar");
  assert.equal(hrefPestana("vehiculo"), "/buscar?por=vehiculo");
});
