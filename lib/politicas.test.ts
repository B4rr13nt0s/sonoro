import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { UMBRAL_ENVIO_GRATIS_CENTS } from "./cart/envio.ts";
import { formatQ } from "./format/precio.ts";
import { ENVIO_SALVEDAD, ENVIOS, INSTALACION } from "./politicas.ts";

test("ENVIOS nombra el umbral con formatQ", () => {
  assert.ok(ENVIOS.includes(formatQ(UMBRAL_ENVIO_GRATIS_CENTS)));
  assert.ok(ENVIOS.endsWith(ENVIO_SALVEDAD));
});

test("las páginas legales y llms.ts leen de politicas", () => {
  for (const ruta of [
    "app/legal/terminos/page.tsx",
    "app/legal/garantias/page.tsx",
    "lib/seo/llms.ts",
  ]) {
    const fuente = readFileSync(ruta, "utf8");
    assert.match(fuente, /import[^;]*politicas/, `${ruta} importa politicas`);
    assert.ok(!fuente.includes("Hasta 6 pagos precio contado."), `${ruta} repite CUOTAS`);
    assert.ok(
      !fuente.includes("cubre únicamente desperfectos de fábrica"),
      `${ruta} repite GARANTIA_ALCANCE`,
    );
  }
});

test("INSTALACION: la frase del negocio, palabra por palabra (noviembre de 2026)", () => {
  assert.equal(
    INSTALACION,
    "Incluye instalación básica. En caso de que se requiera una instalación más compleja, accesorios o componentes para llevar a cabo el trabajo, dicha instalación y artículos adicionales se cobran por aparte y tienen un costo añadido.",
  );
});
