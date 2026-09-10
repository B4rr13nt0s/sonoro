// Mismo contrato que lib/cart/storage.test.ts: loadSeleccion() NUNCA lanza.
// Cada test simula un contenido que localStorage podría tener realmente
// (versión correcta, corrupto, versión futura desconocida, versión vieja con
// y sin migración) y verifica que el resultado siempre es una Seleccion
// válida.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

import type { Seleccion } from "./types.ts";

function conLocalStorageVacio<T>(run: () => T): T {
  const dom = new JSDOM("", { url: "http://localhost/" });
  const anterior = (globalThis as Record<string, unknown>).window;
  (globalThis as Record<string, unknown>).window = dom.window as unknown;
  try {
    return run();
  } finally {
    (globalThis as Record<string, unknown>).window = anterior;
  }
}

test("loadSeleccion: sin nada guardado devuelve una selección vacía válida", async () => {
  const { loadSeleccion } = await import("./storage.ts");
  const { SeleccionSchema } = await import("./types.ts");

  const seleccion = conLocalStorageVacio(() => loadSeleccion());
  assert.equal(SeleccionSchema.safeParse(seleccion).success, true);
  assert.deepEqual(seleccion.skus, []);
  assert.equal(seleccion.categoria, null);
});

test("loadSeleccion: schemaVersion actual con forma válida se carga tal cual", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  const guardada = {
    schemaVersion: SCHEMA_VERSION,
    categoria: "Subwoofers",
    skus: ["SQ12-D2", "COR-S124D"],
    updatedAt: "2026-09-10T10:00:00.000Z",
  };

  const seleccion = conLocalStorageVacio(() => {
    window.localStorage.setItem(COMPARADOR_STORAGE_KEY, JSON.stringify(guardada));
    return loadSeleccion();
  });

  assert.deepEqual(seleccion, guardada);
});

test("loadSeleccion: JSON corrupto no lanza y descarta limpiamente", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY } = await import("./storage.ts");

  const seleccion = conLocalStorageVacio(() => {
    window.localStorage.setItem(COMPARADOR_STORAGE_KEY, "{ esto no es json válido");
    return loadSeleccion();
  });

  assert.deepEqual(seleccion.skus, []);
});

test("loadSeleccion: JSON válido con forma inválida descarta limpiamente", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  const seleccion = conLocalStorageVacio(() => {
    window.localStorage.setItem(
      COMPARADOR_STORAGE_KEY,
      // skus debería ser un arreglo de strings.
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        categoria: "Subwoofers",
        skus: "SQ12-D2",
        updatedAt: "2026-09-10T10:00:00.000Z",
      }),
    );
    return loadSeleccion();
  });

  assert.deepEqual(seleccion.skus, []);
});

test("loadSeleccion: schemaVersion futura desconocida se descarta, no lanza", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  const seleccion = conLocalStorageVacio(() => {
    window.localStorage.setItem(
      COMPARADOR_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION + 1,
        categoria: "Subwoofers",
        skus: ["A"],
        updatedAt: "2026-09-10T10:00:00.000Z",
      }),
    );
    return loadSeleccion();
  });

  assert.deepEqual(seleccion.skus, []);
});

test("loadSeleccion: versión vieja CON migración registrada migra de verdad", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY, MIGRATIONS } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  try {
    // Migración de prueba: una v0 imaginaria que guardaba los skus sin
    // categoría. Verifica que loadSeleccion la USA, no solo que no revienta.
    MIGRATIONS[0] = (raw) => ({
      schemaVersion: SCHEMA_VERSION,
      categoria: "Subwoofers",
      skus: raw.skus as string[],
      updatedAt: raw.updatedAt as string,
    });

    const seleccion = conLocalStorageVacio(() => {
      window.localStorage.setItem(
        COMPARADOR_STORAGE_KEY,
        JSON.stringify({
          schemaVersion: 0,
          skus: ["SQ12-D2"],
          updatedAt: "2026-09-10T10:00:00.000Z",
        }),
      );
      return loadSeleccion();
    });

    assert.equal(seleccion.schemaVersion, SCHEMA_VERSION);
    assert.deepEqual(seleccion.skus, ["SQ12-D2"]);
    assert.equal(seleccion.categoria, "Subwoofers");
  } finally {
    delete MIGRATIONS[0];
  }
});

test("loadSeleccion: una migración que devuelve basura tampoco se cree", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY, MIGRATIONS } = await import("./storage.ts");

  try {
    // La salida de una migración pasa igual por safeParse.
    MIGRATIONS[0] = () =>
      ({ schemaVersion: 1, categoria: 5, skus: [], updatedAt: "ayer" }) as never;

    const seleccion = conLocalStorageVacio(() => {
      window.localStorage.setItem(
        COMPARADOR_STORAGE_KEY,
        JSON.stringify({ schemaVersion: 0, skus: ["A"] }),
      );
      return loadSeleccion();
    });

    assert.deepEqual(seleccion.skus, []);
  } finally {
    delete MIGRATIONS[0];
  }
});

test("loadSeleccion: versión vieja SIN migración registrada se descarta, no lanza", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY } = await import("./storage.ts");

  const seleccion = conLocalStorageVacio(() => {
    window.localStorage.setItem(
      COMPARADOR_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 0, skus: ["A"], updatedAt: "2026-09-10T10:00:00.000Z" }),
    );
    return loadSeleccion();
  });

  assert.deepEqual(seleccion.skus, []);
});

test("loadSeleccion: un valor que no es objeto se descarta, no lanza", async () => {
  const { loadSeleccion, COMPARADOR_STORAGE_KEY } = await import("./storage.ts");

  for (const crudo of ["[1,2,3]", '"hola"', "42", "null"]) {
    const seleccion = conLocalStorageVacio(() => {
      window.localStorage.setItem(COMPARADOR_STORAGE_KEY, crudo);
      return loadSeleccion();
    });
    assert.deepEqual(seleccion.skus, [], `no descartó limpiamente con ${crudo}`);
  }
});

test("saveSeleccion + loadSeleccion: ida y vuelta conserva la selección", async () => {
  const { loadSeleccion, saveSeleccion } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  const original: Seleccion = {
    schemaVersion: SCHEMA_VERSION,
    categoria: "Bocinas",
    // Sku con espacio y con punto, tal como los publica el fabricante.
    skus: ["ACX 165", "TNT-3000.1"],
    updatedAt: "2026-09-10T10:00:00.000Z",
  };

  const recuperada = conLocalStorageVacio(() => {
    saveSeleccion(original);
    return loadSeleccion();
  });

  assert.deepEqual(recuperada, original);
});
