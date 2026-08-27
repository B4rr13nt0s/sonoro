import test from "node:test";
import assert from "node:assert/strict";

import { construirImagenes, emparejarFotosConSkus } from "./photos.ts";

test("emparejarFotosConSkus: sku simple sin espacios", () => {
  const { porSku, ignorados } = emparejarFotosConSkus(["SRX62_frontal.jpg"], new Set(["SRX62"]));
  assert.deepEqual(ignorados, []);
  assert.deepEqual(porSku.get("SRX62"), [
    { sku: "SRX62", vista: "frontal", archivo: "SRX62_frontal.jpg" },
  ]);
});

test("emparejarFotosConSkus: sku con espacio interno (ACX 165) no se confunde con la vista", () => {
  const { porSku, ignorados } = emparejarFotosConSkus(
    ["ACX 165_frontal.jpg"],
    new Set(["ACX 165"]),
  );
  assert.deepEqual(ignorados, []);
  assert.equal(porSku.get("ACX 165")?.[0].sku, "ACX 165");
  assert.equal(porSku.get("ACX 165")?.[0].vista, "frontal");
});

test("emparejarFotosConSkus: la vista puede traer sus propios guiones bajos", () => {
  const { porSku } = emparejarFotosConSkus(["SRX62_tres_cuartos.jpg"], new Set(["SRX62"]));
  assert.equal(porSku.get("SRX62")?.[0].vista, "tres_cuartos");
});

test("emparejarFotosConSkus: varias vistas del mismo sku quedan ordenadas alfabéticamente", () => {
  const { porSku } = emparejarFotosConSkus(
    ["SRX62_trasera.jpg", "SRX62_frontal.jpg", "SRX62_lateral.jpg"],
    new Set(["SRX62"]),
  );
  assert.deepEqual(
    porSku.get("SRX62")?.map((a) => a.vista),
    ["frontal", "lateral", "trasera"],
  );
});

test("emparejarFotosConSkus: sku que no existe en el catálogo se ignora y se reporta", () => {
  const { porSku, ignorados } = emparejarFotosConSkus(["NOEXISTE_frontal.jpg"], new Set(["SRX62"]));
  assert.equal(porSku.size, 0);
  assert.match(ignorados[0], /NOEXISTE_frontal\.jpg/);
  assert.match(ignorados[0], /no coincide con ningún sku/);
});

test("emparejarFotosConSkus: sin guion bajo se ignora y se reporta", () => {
  const { ignorados } = emparejarFotosConSkus(["SRX62.jpg"], new Set(["SRX62"]));
  assert.match(ignorados[0], /formato "SKU_vista"/);
});

test("emparejarFotosConSkus: guion bajo al inicio o al final se ignora", () => {
  const { ignorados } = emparejarFotosConSkus(["_frontal.jpg", "SRX62_.jpg"], new Set(["SRX62"]));
  assert.equal(ignorados.length, 2);
});

test("emparejarFotosConSkus: sin extensión se ignora y se reporta", () => {
  const { ignorados } = emparejarFotosConSkus(["SRX62_frontal"], new Set(["SRX62"]));
  assert.match(ignorados[0], /sin extensión/);
});

test("emparejarFotosConSkus: extensión no soportada (p. ej. .heic) se ignora y se reporta", () => {
  const { ignorados } = emparejarFotosConSkus(["SRX62_frontal.heic"], new Set(["SRX62"]));
  assert.match(ignorados[0], /\.heic.*no soportada/);
});

test("emparejarFotosConSkus: extensión es case-insensitive (.JPG)", () => {
  const { porSku, ignorados } = emparejarFotosConSkus(["SRX62_frontal.JPG"], new Set(["SRX62"]));
  assert.deepEqual(ignorados, []);
  assert.equal(porSku.get("SRX62")?.length, 1);
});

test("emparejarFotosConSkus: archivos de distintos sku no se mezclan", () => {
  const { porSku } = emparejarFotosConSkus(
    ["SRX62_frontal.jpg", "MJP800.4_frontal.jpg"],
    new Set(["SRX62", "MJP800.4"]),
  );
  assert.equal(porSku.get("SRX62")?.length, 1);
  assert.equal(porSku.get("MJP800.4")?.length, 1);
});

test("construirImagenes: arma url absoluta desde la raíz y alt con nombre — vista", () => {
  const imagenes = construirImagenes(
    [{ sku: "SRX62", vista: "frontal", archivo: "SRX62_frontal.jpg" }],
    "Subwoofer SRX 12",
    "/productos",
  );
  assert.deepEqual(imagenes, [
    { url: "/productos/SRX62_frontal.jpg", alt: "Subwoofer SRX 12 — frontal" },
  ]);
});

test("construirImagenes: preserva el orden que le pasen (ya viene ordenado de emparejarFotosConSkus)", () => {
  const imagenes = construirImagenes(
    [
      { sku: "SRX62", vista: "frontal", archivo: "SRX62_frontal.jpg" },
      { sku: "SRX62", vista: "lateral", archivo: "SRX62_lateral.jpg" },
    ],
    "Subwoofer SRX 12",
    "/productos",
  );
  assert.equal(imagenes[0].url, "/productos/SRX62_frontal.jpg");
  assert.equal(imagenes[1].url, "/productos/SRX62_lateral.jpg");
});
