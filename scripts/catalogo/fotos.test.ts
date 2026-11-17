import test from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  hashDeFoto,
  leerHashesDeFotos,
  leerManifiesto,
  pendientesDeSubir,
  subirEnLotes,
} from "./fotos.ts";

const carpetaTemporal = () => mkdtempSync(path.join(tmpdir(), "fotos-"));
const entrada = (hash: string) => ({
  url: "https://x.public.blob.vercel-storage.com/a",
  hash,
  bytes: 1,
});

test("hashDeFoto: los 12 primeros hex del sha-256 del contenido", () => {
  assert.equal(hashDeFoto(Buffer.from("abc")), "ba7816bf8f01");
});

test("leerHashesDeFotos: hash por archivo, sin archivos punto ni subcarpetas", () => {
  const dir = carpetaTemporal();
  writeFileSync(path.join(dir, "A_frontal.webp"), "abc");
  writeFileSync(path.join(dir, ".gitkeep"), "");
  mkdirSync(path.join(dir, "sub"));
  writeFileSync(path.join(dir, "sub", "B_frontal.webp"), "abc");
  assert.deepEqual([...leerHashesDeFotos(dir)], [["A_frontal.webp", "ba7816bf8f01"]]);
});

test("leerHashesDeFotos: una carpeta que no existe es una carpeta vacía", () => {
  assert.equal(leerHashesDeFotos(path.join(tmpdir(), "no-existe-fotos-xyz")).size, 0);
});

test("leerManifiesto: una ruta inexistente es un manifiesto vacío", () => {
  assert.deepEqual(leerManifiesto(path.join(tmpdir(), "no-existe-fotos-xyz.json")), {});
});

test("leerManifiesto: lee el JSON escrito", () => {
  const dir = carpetaTemporal();
  const ruta = path.join(dir, "m.json");
  writeFileSync(ruta, JSON.stringify({ "A.webp": entrada("h1") }));
  assert.deepEqual(leerManifiesto(ruta), { "A.webp": entrada("h1") });
});

test("pendientesDeSubir: sin entrada o con hash distinto, por puntos de código", () => {
  const enDisco = new Map([
    ["B.webp", "h2"],
    ["A.webp", "h1"],
  ]);
  assert.deepEqual(pendientesDeSubir(enDisco, { "A.webp": entrada("h1") }), ["B.webp"]);
  assert.deepEqual(pendientesDeSubir(enDisco, { "A.webp": entrada("x") }), ["A.webp", "B.webp"]);
});

test("pendientesDeSubir: tras una subida interrumpida solo faltan las que no se guardaron", () => {
  const enDisco = new Map([
    ["A.webp", "h1"],
    ["B.webp", "h2"],
    ["C.webp", "h3"],
  ]);
  const guardado = { "A.webp": entrada("h1"), "B.webp": entrada("h2") };
  assert.deepEqual(pendientesDeSubir(enDisco, guardado), ["C.webp"]);
  assert.deepEqual(pendientesDeSubir(enDisco, { ...guardado, "C.webp": entrada("h3") }), []);
});

test("subirEnLotes: si una falla, las demás del lote terminan y el error se relanza", async () => {
  const hechas: string[] = [];
  const hacer = async (archivo: string) => {
    if (archivo === "B") throw new Error("falló B");
    await new Promise((resolver) => setTimeout(resolver, 20));
    hechas.push(archivo);
  };
  await assert.rejects(subirEnLotes(["A", "B", "C", "D"], hacer, 4), /falló B/);
  assert.deepEqual(hechas.sort(), ["A", "C", "D"]);
});

test("subirEnLotes: sin errores recorre todo y no pasa del tamaño del lote", async () => {
  let enVuelo = 0;
  let maximo = 0;
  const hacer = async () => {
    enVuelo += 1;
    maximo = Math.max(maximo, enVuelo);
    await new Promise((resolver) => setTimeout(resolver, 5));
    enVuelo -= 1;
  };
  await subirEnLotes(["1", "2", "3", "4", "5", "6", "7"], hacer, 3);
  assert.equal(maximo, 3);
});
