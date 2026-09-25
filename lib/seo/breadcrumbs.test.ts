import test from "node:test";
import assert from "node:assert/strict";

import { buildBreadcrumbJsonLd } from "./breadcrumbs.ts";

test("buildBreadcrumbJsonLd: posiciones desde 1 y URLs absolutas", () => {
  const jsonLd = buildBreadcrumbJsonLd([
    { label: "Inicio", href: "/" },
    { label: "Subwoofers", href: "/catalogo/subwoofers" },
    { label: "Pioneer", href: "/marcas/pioneer" },
  ]);
  assert.ok(jsonLd);
  assert.deepEqual(
    jsonLd.itemListElement.map((item) => item.position),
    [1, 2, 3],
  );
  assert.match(String(jsonLd.itemListElement[1].item), /^https?:\/\/[^/]+\/catalogo\/subwoofers$/);
});

test("buildBreadcrumbJsonLd: el último puede ir sin link (es la página actual)", () => {
  const jsonLd = buildBreadcrumbJsonLd([{ label: "Inicio", href: "/" }, { label: "Catálogo" }]);
  assert.ok(jsonLd);
  assert.equal("item" in jsonLd.itemListElement[1], false);
});

test("buildBreadcrumbJsonLd: un hueco en el medio no produce un bloque inválido", () => {
  const jsonLd = buildBreadcrumbJsonLd([
    { label: "Inicio", href: "/" },
    { label: "Sistemas" },
    { label: "Memphis", href: "/marcas/memphis" },
  ]);
  assert.equal(jsonLd, null);
});

test("buildBreadcrumbJsonLd: una sola miga no es una ruta", () => {
  assert.equal(buildBreadcrumbJsonLd([{ label: "Inicio", href: "/" }]), null);
});
