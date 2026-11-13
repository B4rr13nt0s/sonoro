import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";

import { MODEL_IDS, MODELS, escalaDeVista, modelUrl, posterUrl } from "./models3d.ts";

const PUBLIC = path.join(import.meta.dirname, "..", "public");

test("cada modelo del carrusel tiene su .glb en public/models/", () => {
  for (const id of MODEL_IDS) {
    assert.ok(existsSync(path.join(PUBLIC, modelUrl(id))), `falta public${modelUrl(id)}`);
  }
});

// La imagen estática lleva el nombre del .glb, versión incluida. Si se
// regenera un modelo y no se corre scripts/carrusel/posters.mjs, este test es
// el que avisa: sin él, quien no tiene WebGL vería el cuadro vacío.
test("cada modelo tiene su imagen estática, con la versión de su .glb", () => {
  for (const id of MODEL_IDS) {
    const url = posterUrl(id);
    assert.equal(url, `/models/posters/${MODELS[id].archivo.replace(".glb", ".webp")}`);
    assert.ok(existsSync(path.join(PUBLIC, url)), `falta public${url}: correr posters.mjs`);
  }
});

// `ajusteVista` agranda un modelo chico sin tocar el encuadre. Si lo pasa del
// modelo más grande, se sale del cuadro al girar.
test("ningún modelo se dibuja más ancho que el más grande", () => {
  const mayor = Math.max(...MODEL_IDS.map((id) => MODELS[id].radius * MODELS[id].displayScale));
  for (const id of MODEL_IDS) {
    assert.ok(
      MODELS[id].radius * escalaDeVista(id) <= mayor + 1e-9,
      `${id}: su ajusteVista lo saca del encuadre`,
    );
  }
});
