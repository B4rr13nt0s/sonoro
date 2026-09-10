import test from "node:test";
import assert from "node:assert/strict";

import { etiquetaDisponibilidad } from "./disponibilidad.ts";
import { DisponibilidadSchema } from "./types.ts";

test("disponibilidad: el estado normal no se etiqueta", () => {
  // 319 de los 320 productos activos están disponibles: etiquetarlos a
  // todos sería copy de relleno, y la etiqueta dejaría de significar
  // "ojo con este".
  assert.equal(etiquetaDisponibilidad("disponible"), null);
});

test("disponibilidad: los estados que sí son excepción tienen texto", () => {
  assert.equal(etiquetaDisponibilidad("agotado"), "Agotado");
  assert.equal(etiquetaDisponibilidad("bajo_pedido"), "Bajo pedido");
});

test("disponibilidad: cubre todos los valores del esquema", () => {
  // Si mañana se agrega un estado a DisponibilidadSchema y nadie le pone
  // texto, esto falla acá — no se descubre viendo un producto sin etiqueta
  // en producción.
  for (const valor of DisponibilidadSchema.options) {
    const etiqueta = etiquetaDisponibilidad(valor);
    if (valor === "disponible") continue;
    assert.equal(typeof etiqueta, "string", `${valor} no tiene texto`);
    assert.ok((etiqueta ?? "").length > 0, `${valor} tiene texto vacío`);
  }
});
