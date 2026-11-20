import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { escalaFotoCatalogo, pulgadasEquivalentes } from "./escala-foto.ts";

describe("escalaFotoCatalogo — bocinas", () => {
  const bocina = (medida: string) => escalaFotoCatalogo("Bocinas", medida);

  it("da los valores del negocio en cada medida", () => {
    assert.equal(bocina('4"'), 0.8);
    assert.equal(bocina('4x6"'), 0.8);
    assert.equal(bocina('5.25"'), 0.85);
    assert.equal(bocina('5x7"'), 0.85);
    assert.equal(bocina('6.5"'), 0.95);
    assert.equal(bocina('6x9"'), 0.95);
    assert.equal(bocina('8"'), 1);
  });

  it('los tweeters y las menores de 4" van entre 65 % y 75 %, y crecen con la medida', () => {
    assert.equal(bocina('3/4"'), 0.65);
    assert.equal(bocina('7/8"'), 0.65);
    assert.equal(bocina('1"'), 0.65);
    assert.equal(bocina('3.5"'), 0.75);
    const mm = bocina("40 mm");
    const medias = [bocina('1.5"'), bocina('2.5"'), bocina('2.75"'), bocina("50 mm"), mm];
    for (const escala of medias) {
      assert.ok(escala !== undefined && escala >= 0.65 && escala <= 0.75, String(escala));
    }
    assert.ok(bocina('2.5"')! < bocina('2.75"')!);
    assert.ok(bocina('1.5"')! < bocina('2.5"')!);
  });

  it('una medida entre dos del negocio queda entre sus escalas (6.75")', () => {
    const escala = bocina('6.75"')!;
    assert.ok(escala > 0.95 && escala < 1, String(escala));
  });

  it('nunca agranda: pasada la de 8" se queda en 1', () => {
    assert.equal(bocina('10"'), 1);
  });
});

describe("escalaFotoCatalogo — subwoofers", () => {
  const sub = (medida: string) => escalaFotoCatalogo("Subwoofers", medida);

  it("da los valores del negocio en cada medida", () => {
    assert.equal(sub('6.5"'), 0.8);
    assert.equal(sub('8"'), 0.85);
    assert.equal(sub('10"'), 0.9);
    assert.equal(sub('12"'), 0.95);
    assert.equal(sub('15"'), 1);
  });
});

describe("escalaFotoCatalogo — lo que no lleva escala", () => {
  it("otras categorías", () => {
    assert.equal(escalaFotoCatalogo("Amplificadores", '12"'), undefined);
    assert.equal(escalaFotoCatalogo("Accesorios", undefined), undefined);
    // Una categoría escrita como propiedad heredada no se toma por un tramo.
    assert.equal(escalaFotoCatalogo("constructor", '12"'), undefined);
  });

  it("una medida ausente o ilegible", () => {
    assert.equal(escalaFotoCatalogo("Bocinas", undefined), undefined);
    assert.equal(escalaFotoCatalogo("Bocinas", "ancha"), undefined);
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
