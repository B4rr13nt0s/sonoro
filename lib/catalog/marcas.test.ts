import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { LOGOS, ORDEN_MARCAS, ordenarMarcas } from "./marcas.ts";

const b = (slug: string, nombre = slug) => ({ slug, nombre });

test("ordenarMarcas: el orden del negocio, y las desconocidas al final por nombre", () => {
  const alfabetico = [
    "cerwin-vega",
    "focal",
    "jbl",
    "kbt",
    "memphis",
    "pioneer",
    "rockford-fosgate",
    "soundskins",
  ];
  assert.deepEqual(
    ordenarMarcas(alfabetico.map((s) => b(s))).map((m) => m.slug),
    [...ORDEN_MARCAS],
  );
  assert.deepEqual(
    ordenarMarcas([b("zeta", "Zeta"), b("memphis"), b("alfa", "Alfa")]).map((m) => m.slug),
    ["memphis", "alfa", "zeta"],
  );
});

test("hay logo para cada marca del catálogo, y su archivo existe", () => {
  const marcas: { slug: string }[] = JSON.parse(readFileSync("data/brands.json", "utf-8"));
  for (const { slug } of marcas) {
    assert.ok(LOGOS[slug], `falta el logo de ${slug}`);
    assert.ok(existsSync(`public${LOGOS[slug].src}`), `falta el archivo ${LOGOS[slug].src}`);
  }
});
