import test from "node:test";
import assert from "node:assert/strict";

import { claseBoton, claseBotonInactivo, type VarianteBoton } from "./boton.ts";

const tieneBorde = (clases: string) => clases.split(" ").includes("border");

// Al pasar a gris (confirmación o agotado) el botón no puede cambiar de alto:
// empujaría lo que tiene debajo. Por eso el inactivo lleva el borde de la
// variante que reemplaza, ni más ni menos.
test("claseBotonInactivo: conserva el borde de la variante que reemplaza", () => {
  for (const variante of ["principal", "secundario"] as VarianteBoton[]) {
    for (const tamano of ["normal", "compacto"] as const) {
      assert.equal(
        tieneBorde(claseBotonInactivo(variante, tamano)),
        tieneBorde(claseBoton(variante, tamano)),
        `${variante} ${tamano}`,
      );
    }
  }
});
