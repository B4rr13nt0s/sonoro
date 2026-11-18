// Que las fotos fuente (assets/productos/) y el manifiesto de Blob
// (data/fotos-blob.json) digan lo mismo. Si no, el sitio mostraría una foto
// desactualizada —o ninguna— sin que nada avisara: el importador solo alerta.
// Arreglo: `npm run fotos:subir` y commitear el manifiesto.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { leerHashesDeFotos, leerManifiesto } from "../../scripts/catalogo/fotos.ts";
import { alertasDeFotos, compararConManifiesto } from "./fotos-blob.ts";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CARPETA = path.join(RAIZ, "assets", "productos");

test(
  "assets/productos y data/fotos-blob.json coinciden",
  { skip: !existsSync(CARPETA) && "no hay assets/productos/ en este checkout" },
  () => {
    const diferencias = compararConManifiesto(
      leerHashesDeFotos(CARPETA),
      leerManifiesto(path.join(RAIZ, "data", "fotos-blob.json")),
    );
    assert.deepEqual(alertasDeFotos(diferencias), []);
  },
);
