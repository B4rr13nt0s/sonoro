import test from "node:test";
import assert from "node:assert/strict";

import { envioGratis, UMBRAL_ENVIO_GRATIS_CENTS } from "./envio.ts";

test("envío gratis solo si el total es mayor a Q 500.00", () => {
  assert.equal(UMBRAL_ENVIO_GRATIS_CENTS, 50000);
  assert.equal(envioGratis(50001), true);
  assert.equal(envioGratis(250000), true);
  // Exactamente Q 500.00 no es «mayor a»: paga envío.
  assert.equal(envioGratis(50000), false);
  assert.equal(envioGratis(0), false);
});
