import test from "node:test";
import assert from "node:assert/strict";

import {
  construirImagenes,
  emparejarFotosConSkus,
  esNombreDeFoto,
  vistaLegible,
} from "./photos.ts";

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

const BLOB = "https://x.public.blob.vercel-storage.com/productos";
const urlBlob = (archivo: string) => `${BLOB}/${archivo}`;

test("construirImagenes: toma la url de urlDe y arma el alt con nombre — vista", () => {
  const imagenes = construirImagenes(
    [{ sku: "SRX62", vista: "frontal", archivo: "SRX62_frontal.webp" }],
    "Subwoofer SRX 12",
    urlBlob,
  );
  assert.deepEqual(imagenes, [
    { url: `${BLOB}/SRX62_frontal.webp`, alt: "Subwoofer SRX 12 — frontal" },
  ]);
});

test("construirImagenes: preserva el orden que le pasen (ya viene ordenado de emparejarFotosConSkus)", () => {
  const imagenes = construirImagenes(
    [
      { sku: "SRX62", vista: "frontal", archivo: "SRX62_frontal.webp" },
      { sku: "SRX62", vista: "lateral", archivo: "SRX62_lateral.webp" },
    ],
    "Subwoofer SRX 12",
    urlBlob,
  );
  assert.equal(imagenes[0].url, `${BLOB}/SRX62_frontal.webp`);
  assert.equal(imagenes[1].url, `${BLOB}/SRX62_lateral.webp`);
});

test("construirImagenes: una foto sin url (sin subir) no entra", () => {
  const imagenes = construirImagenes(
    [
      { sku: "SRX62", vista: "frontal", archivo: "SRX62_frontal.webp" },
      { sku: "SRX62", vista: "lateral", archivo: "SRX62_lateral.webp" },
    ],
    "Subwoofer SRX 12",
    (archivo) => (archivo === "SRX62_lateral.webp" ? urlBlob(archivo) : undefined),
  );
  assert.deepEqual(
    imagenes.map((i) => i.url),
    [`${BLOB}/SRX62_lateral.webp`],
  );
});

test("construirImagenes: sin ninguna url devuelve [] (el placeholder es un estado de renderizado)", () => {
  const imagenes = construirImagenes(
    [{ sku: "SRX62", vista: "frontal", archivo: "SRX62_frontal.webp" }],
    "Subwoofer SRX 12",
    () => undefined,
  );
  assert.deepEqual(imagenes, []);
});

test("emparejarFotosConSkus: la vista frontal va primero aunque otra ordene antes", () => {
  const { porSku } = emparejarFotosConSkus(
    [
      "VPAS12_cenital.jpg",
      "VPAS12_frontal.jpg",
      "VR10_diagonalderecha.jpg",
      "VR10_frontal2.jpg",
      "VR10_frontal.jpg",
      "VR10_trasera.jpg",
    ],
    new Set(["VPAS12", "VR10"]),
  );
  assert.deepEqual(
    porSku.get("VPAS12")?.map((f) => f.vista),
    ["frontal", "cenital"],
  );
  assert.deepEqual(
    porSku.get("VR10")?.map((f) => f.vista),
    ["frontal", "frontal2", "diagonalderecha", "trasera"],
  );
});

test("emparejarFotosConSkus: la vista completo va antes que la frontal", () => {
  const { porSku } = emparejarFotosConSkus(
    ["165 AS_lateral.jpg", "165 AS_frontal.jpg", "165 AS_completo.jpg"],
    new Set(["165 AS"]),
  );
  assert.deepEqual(
    porSku.get("165 AS")?.map((f) => f.vista),
    ["completo", "frontal", "lateral"],
  );
});

test("esNombreDeFoto: solo «SKU_vista.ext» con extensión de imagen soportada", () => {
  for (const ok of ["SRX62_frontal.webp", "ACX 165_frontal.JPG", "A_b_c.png", "X_1.jpeg"]) {
    assert.equal(esNombreDeFoto(ok), true, ok);
  }
  for (const mal of [
    ".env",
    "SRX62.webp",
    "SRX62_frontal.psd",
    "SRX62_frontal.zip",
    "_frontal.webp",
    "SRX62_.webp",
    "notas.txt",
  ]) {
    assert.equal(esNombreDeFoto(mal), false, mal);
  }
});

test("vistaLegible: el alt no lleva identificadores de archivo", () => {
  assert.equal(vistaLegible("frontal"), "frontal");
  assert.equal(vistaLegible("frontal2"), "frontal 2");
  assert.equal(vistaLegible("lateral10"), "lateral 10");
  assert.equal(vistaLegible("tres_cuartos"), "tres cuartos");
  assert.equal(vistaLegible("frontalposterior"), "frontal y posterior");
  assert.equal(vistaLegible("instalado2"), "instalado 2");
  assert.equal(vistaLegible("diagonalderecha"), "diagonal derecha");
});

test("construirImagenes: el alt lleva la vista legible, con su número", () => {
  const imagenes = construirImagenes(
    [
      { sku: "VR10", vista: "frontal", archivo: "VR10_frontal.webp" },
      { sku: "VR10", vista: "lateral2", archivo: "VR10_lateral2.webp" },
    ],
    "Subwoofer VR10",
    urlBlob,
  );
  assert.deepEqual(
    imagenes.map((i) => i.alt),
    ["Subwoofer VR10 — frontal", "Subwoofer VR10 — lateral 2"],
  );
});
