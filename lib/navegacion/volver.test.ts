import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { hayPaginaAnterior, type EstadoNavegacion } from "./volver.ts";

const base: EstadoNavegacion = {
  canGoBack: undefined,
  paginasVistas: 1,
  longitudHistorial: 1,
  referrerMismoOrigen: false,
};

describe("hayPaginaAnterior — con la Navigation API", () => {
  it("manda lo que ella diga, sin mirar lo demás", () => {
    assert.equal(hayPaginaAnterior({ ...base, canGoBack: true }), true);
    assert.equal(
      hayPaginaAnterior({ ...base, canGoBack: false, paginasVistas: 5, longitudHistorial: 9 }),
      false,
    );
  });
});

describe("hayPaginaAnterior — sin la Navigation API", () => {
  it("un enlace abierto de cero (WhatsApp, Google) no tiene a dónde volver", () => {
    assert.equal(hayPaginaAnterior(base), false);
    // Historial con entradas de OTROS sitios: volver sacaría al visitante.
    assert.equal(hayPaginaAnterior({ ...base, longitudHistorial: 4 }), false);
  });

  it("después de navegar dentro del sitio sí", () => {
    assert.equal(hayPaginaAnterior({ ...base, paginasVistas: 2, longitudHistorial: 2 }), true);
  });

  it("una recarga que llegó desde otra página del sitio sí", () => {
    assert.equal(
      hayPaginaAnterior({ ...base, longitudHistorial: 3, referrerMismoOrigen: true }),
      true,
    );
  });

  it("un referrer propio sin historial detrás no alcanza", () => {
    assert.equal(hayPaginaAnterior({ ...base, referrerMismoOrigen: true }), false);
  });
});
