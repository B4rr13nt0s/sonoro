import test from "node:test";
import assert from "node:assert/strict";

import { copiarTexto } from "./portapapeles.ts";

test("si el portapapeles moderno escribe, se copió y no se usa la alternativa", async () => {
  let escrito = "";
  let usoAlternativa = false;
  const ok = await copiarTexto("hola", {
    escribir: async (texto) => {
      escrito = texto;
    },
    copiarSeleccion: () => {
      usoAlternativa = true;
      return true;
    },
  });
  assert.equal(ok, true);
  assert.equal(escrito, "hola");
  assert.equal(usoAlternativa, false);
});

test("si el portapapeles moderno rechaza y la alternativa copia, se copió", async () => {
  const ok = await copiarTexto("hola", {
    escribir: async () => {
      throw new Error("NotAllowedError");
    },
    copiarSeleccion: () => true,
  });
  assert.equal(ok, true);
});

test("si no existe el portapapeles moderno, se usa la alternativa", async () => {
  assert.equal(
    await copiarTexto("hola", { escribir: undefined, copiarSeleccion: () => true }),
    true,
  );
});

test("si las dos vías fallan, NO se copió", async () => {
  const sinPermiso = async () => {
    throw new Error("NotAllowedError");
  };
  assert.equal(
    await copiarTexto("hola", { escribir: sinPermiso, copiarSeleccion: () => false }),
    false,
  );
  assert.equal(
    await copiarTexto("hola", { escribir: undefined, copiarSeleccion: () => false }),
    false,
  );
});

test("si la alternativa lanza, tampoco se copió y no se propaga el error", async () => {
  const ok = await copiarTexto("hola", {
    escribir: undefined,
    copiarSeleccion: () => {
      throw new Error("boom");
    },
  });
  assert.equal(ok, false);
});
