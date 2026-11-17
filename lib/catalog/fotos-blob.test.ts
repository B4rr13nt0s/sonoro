import test from "node:test";
import assert from "node:assert/strict";

import {
  alertasDeFotos,
  compararConManifiesto,
  hostsDeManifiesto,
  nombreBlob,
  opcionesDeSubida,
  serializarManifiesto,
  type EntradaFoto,
} from "./fotos-blob.ts";

const entrada = (
  hash: string,
  url = "https://a.public.blob.vercel-storage.com/x.webp",
): EntradaFoto => ({
  url,
  hash,
  bytes: 1,
});

test("nombreBlob: lleva el hash entre el nombre y la extensión", () => {
  assert.equal(
    nombreBlob("165 AC_frontal.webp", "0123456789ab"),
    "productos/165 AC_frontal.0123456789ab.webp",
  );
  assert.equal(
    nombreBlob("SRX62_tres_cuartos.jpg", "aaaaaaaaaaaa"),
    "productos/SRX62_tres_cuartos.aaaaaaaaaaaa.jpg",
  );
});

test("compararConManifiesto: separa sin subir, cambiadas y huérfanas", () => {
  const enDisco = new Map([
    ["A.webp", "h1"],
    ["B.webp", "h2"],
    ["C.webp", "h3"],
  ]);
  const manifiesto = {
    "A.webp": entrada("h1"),
    "B.webp": entrada("otro"),
    "D.webp": entrada("h4"),
  };
  assert.deepEqual(compararConManifiesto(enDisco, manifiesto), {
    sinSubir: ["C.webp"],
    cambiadas: ["B.webp"],
    huerfanas: ["D.webp"],
  });
});

test("compararConManifiesto: disco y manifiesto vacíos no dan diferencias", () => {
  assert.deepEqual(compararConManifiesto(new Map(), {}), {
    sinSubir: [],
    cambiadas: [],
    huerfanas: [],
  });
});

test("compararConManifiesto: con el manifiesto ausente todo el disco queda sin subir", () => {
  const enDisco = new Map([
    ["A.webp", "h1"],
    ["B.webp", "h2"],
  ]);
  assert.deepEqual(compararConManifiesto(enDisco, {}).sinSubir, ["A.webp", "B.webp"]);
});

test("alertasDeFotos: una frase por archivo, en el orden sin subir, cambiadas, huérfanas", () => {
  assert.deepEqual(
    alertasDeFotos({ sinSubir: ["C.webp"], cambiadas: ["B.webp"], huerfanas: ["D.webp"] }),
    [
      "C.webp: sin subir a Blob (corre npm run fotos:subir)",
      "B.webp: cambió desde la última subida (corre npm run fotos:subir)",
      "D.webp: está en data/fotos-blob.json pero no en assets/productos/",
    ],
  );
});

test("serializarManifiesto: claves por puntos de código, 2 espacios y salto de línea final", () => {
  const e = entrada("h");
  const texto = serializarManifiesto({ "b.webp": e, "B.webp": e, "a.webp": e });
  assert.ok(texto.endsWith("}\n"));
  assert.deepEqual(Object.keys(JSON.parse(texto)), ["B.webp", "a.webp", "b.webp"]);
  assert.match(texto, /^\{\n {2}"B\.webp": \{/);
});

test("hostsDeManifiesto: hostnames únicos y ordenados; una URL con %20 no rompe", () => {
  const m = {
    "A.webp": entrada("h", "https://zeta.public.blob.vercel-storage.com/productos/165%20AC.h.webp"),
    "B.webp": entrada("h", "https://zeta.public.blob.vercel-storage.com/productos/B.h.webp"),
    "C.webp": entrada("h", "https://alfa.public.blob.vercel-storage.com/productos/C.h.webp"),
  };
  assert.deepEqual(hostsDeManifiesto(m), [
    "alfa.public.blob.vercel-storage.com",
    "zeta.public.blob.vercel-storage.com",
  ]);
  assert.deepEqual(hostsDeManifiesto({}), []);
});

test("opcionesDeSubida: pública, sin sufijo y con sobrescritura (el nombre ya lleva el hash)", () => {
  const o = opcionesDeSubida("A_frontal.webp");
  assert.equal(o.access, "public");
  assert.equal(o.addRandomSuffix, false);
  // Con el hash en el nombre, sobrescribir es escribir lo mismo: así volver a
  // subir (manifiesto perdido, subida a medias) no falla con «ya existe».
  assert.equal(o.allowOverwrite, true);
  assert.equal(o.contentType, "image/webp");
  assert.equal(o.cacheControlMaxAge, 31_536_000);
  assert.equal(opcionesDeSubida("B.JPG").contentType, "image/jpeg");
  assert.equal(opcionesDeSubida("C.png").contentType, "image/png");
});
