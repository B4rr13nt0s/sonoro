import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { escalaFotoCatalogo, pulgadasEquivalentes } from "./escala-foto.ts";

const bocina = (medida: string, configuracion?: string) =>
  escalaFotoCatalogo({ categoria: "Bocinas", medida, configuracion });
const sub = (medida: string) => escalaFotoCatalogo({ categoria: "Subwoofers", medida });
// El redondeo a tres decimales de la escala deja el último dígito en el aire
// (0.5225 puede salir 0.522 o 0.523): se compara con esa tolerancia.
const casi = (real: number | undefined, esperado: number) =>
  assert.ok(real !== undefined && Math.abs(real - esperado) <= 0.001, `${real} vs ${esperado}`);

describe("escalaFotoCatalogo — una sola curva", () => {
  it("da el mismo valor a una bocina y a un subwoofer de la misma medida", () => {
    for (const medida of ['6.5"', '8"', '10"', '12"']) {
      assert.equal(bocina(medida), sub(medida), medida);
    }
  });

  it("da los valores de cada medida", () => {
    assert.equal(bocina('4"'), 0.7);
    assert.equal(bocina('5.25"'), 0.75);
    assert.equal(bocina('6.5"'), 0.8);
    assert.equal(bocina('8"'), 0.85);
    assert.equal(sub('6.5"'), 0.8);
    assert.equal(sub('8"'), 0.85);
    assert.equal(sub('10"'), 0.9);
    assert.equal(sub('12"'), 0.95);
    assert.equal(sub('15"'), 1);
  });

  it("crece con la medida", () => {
    const medidas = ['1"', '2.5"', '4"', '5.25"', '6.5"', '8"', '10"', '12"', '15"'];
    const escalas = medidas.map((m) => bocina(m)!);
    for (let i = 1; i < escalas.length; i += 1) {
      assert.ok(escalas[i] >= escalas[i - 1], `${medidas[i]} ${escalas[i]}`);
    }
  });

  it('los tweeters y las menores de 4" van entre 45 % y 65 %', () => {
    assert.equal(bocina('3/4"'), 0.45);
    assert.equal(bocina('7/8"'), 0.45);
    assert.equal(bocina('1"'), 0.45);
    assert.equal(bocina('3.5"'), 0.65);
    for (const medida of ['1.5"', '2.5"', '2.75"', "40 mm", "44.4 mm", "50 mm"]) {
      const escala = bocina(medida)!;
      assert.ok(escala >= 0.45 && escala <= 0.65, `${medida} ${escala}`);
    }
    casi(bocina('1.5"'), 0.45 + (0.2 * 0.5) / 2.5);
    casi(bocina('2.5"'), 0.45 + (0.2 * 1.5) / 2.5);
    casi(bocina("25.4 mm"), 0.45);
  });

  it('una medida entre dos de la curva queda entre sus escalas (6.75")', () => {
    const escala = bocina('6.75"')!;
    assert.ok(escala > 0.8 && escala < 0.85, String(escala));
  });

  it('nunca agranda: pasada la de 15" se queda en 1', () => {
    assert.equal(sub('18"'), 1);
  });
});

describe("escalaFotoCatalogo — ovaladas", () => {
  it("van 10 puntos más grandes que la redonda de su clase", () => {
    assert.equal(bocina('4x6"'), 0.8);
    assert.equal(bocina('5x7"'), 0.85);
    assert.equal(bocina('6x9"'), 0.9);
    for (const [ovalada, redonda] of [
      ['4x6"', '4"'],
      ['5x7"', '5.25"'],
      ['6x9"', '6.5"'],
    ]) {
      casi(bocina(ovalada), bocina(redonda)! + 0.1);
    }
  });

  it("nunca pasan de 1", () => {
    assert.equal(bocina('15x20"'), 1);
    assert.ok(bocina('8x10"')! <= 1);
  });

  it("el suplemento no toca a las redondas ni a los subwoofers", () => {
    assert.equal(sub('10"'), 0.9);
    assert.equal(bocina('4"'), 0.7);
    assert.equal(bocina('5.25"'), 0.75);
    assert.equal(bocina('6.5"'), 0.8);
  });
});

describe("escalaFotoCatalogo — lo que no lleva escala", () => {
  it("un componente, de dos o de tres vías", () => {
    assert.equal(bocina('6.5"', "componentes-2v"), undefined);
    assert.equal(bocina('6.5"', "componentes-3v"), undefined);
  });

  it("una bocina que no es componente sí", () => {
    assert.equal(bocina('6.5"', "coaxial-2v"), 0.8);
    assert.equal(bocina('1"', "tweeter"), 0.45);
  });

  it("otras categorías", () => {
    assert.equal(escalaFotoCatalogo({ categoria: "Amplificadores", medida: '12"' }), undefined);
    assert.equal(escalaFotoCatalogo({ categoria: "Accesorios" }), undefined);
    // Una categoría escrita como propiedad heredada no se toma por una de las dos.
    assert.equal(escalaFotoCatalogo({ categoria: "constructor", medida: '12"' }), undefined);
  });

  it("una medida ausente o ilegible", () => {
    assert.equal(escalaFotoCatalogo({ categoria: "Bocinas" }), undefined);
    assert.equal(bocina("ancha"), undefined);
  });
});

describe("pulgadasEquivalentes", () => {
  it("lee fracciones, milímetros y ovaladas", () => {
    assert.equal(pulgadasEquivalentes('3/4"'), 0.75);
    assert.ok(Math.abs(pulgadasEquivalentes("44.4 mm")! - 1.748) < 0.001);
    assert.equal(pulgadasEquivalentes('6x9"'), 6.5);
    assert.equal(pulgadasEquivalentes('4x10"'), 4);
  });
});
