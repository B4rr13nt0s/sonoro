// Cobertura de CLAUDE.md § Modelo de conversión: "Nunca crashear con un
// carrito viejo". Cada test simula un contenido de localStorage que loadCart
// podría encontrar realmente (versión correcta, corrupto, versión futura
// desconocida, versión vieja con y sin migración registrada) y verifica que
// nunca lanza y que el resultado es siempre un Cart válido.
import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";

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

test("loadCart: sin nada en localStorage devuelve un carrito vacío válido", async () => {
  const { loadCart } = await import("./storage.ts");
  const { CartSchema } = await import("./types.ts");

  const cart = conLocalStorageVacio(() => loadCart());
  assert.equal(CartSchema.safeParse(cart).success, true);
  assert.equal(cart.items.length, 0);
});

test("loadCart: schemaVersion actual con forma válida se carga tal cual", async () => {
  const { loadCart, CART_STORAGE_KEY } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  const guardado = {
    schemaVersion: SCHEMA_VERSION,
    items: [
      {
        sku: "SQ12-D2",
        qty: 2,
        unitPriceCents: 245000,
        currency: "GTQ",
        nombreSnapshot: 'Serie SQ 12" D2',
        imagenSnapshot: null,
        addedAt: "2026-08-20T10:00:00.000Z",
      },
    ],
    createdAt: "2026-08-20T10:00:00.000Z",
    updatedAt: "2026-08-20T10:00:00.000Z",
  };

  const cart = conLocalStorageVacio(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(guardado));
    return loadCart();
  });

  assert.equal(cart.items.length, 1);
  assert.equal(cart.items[0].sku, "SQ12-D2");
  assert.equal(cart.items[0].qty, 2);
});

test("loadCart: JSON corrupto en localStorage no lanza y devuelve carrito vacío", async () => {
  const { loadCart, CART_STORAGE_KEY } = await import("./storage.ts");

  const cart = conLocalStorageVacio(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, "{ esto no es json válido");
    return loadCart();
  });

  assert.equal(cart.items.length, 0);
});

test("loadCart: JSON válido pero con forma inválida (qty no numérico) descarta limpiamente", async () => {
  const { loadCart, CART_STORAGE_KEY } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  const cart = conLocalStorageVacio(() => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        items: [{ sku: "SQ12-D2", qty: "dos" }],
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T10:00:00.000Z",
      }),
    );
    return loadCart();
  });

  assert.equal(cart.items.length, 0);
});

test("loadCart: schemaVersion de una versión futura desconocida se descarta, no lanza", async () => {
  const { loadCart, CART_STORAGE_KEY } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  const cart = conLocalStorageVacio(() => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION + 1,
        items: [],
        createdAt: "2026-08-20T10:00:00.000Z",
        updatedAt: "2026-08-20T10:00:00.000Z",
      }),
    );
    return loadCart();
  });

  assert.equal(cart.items.length, 0);
});

test("loadCart: schemaVersion vieja CON migración registrada migra al esquema actual", async () => {
  const { loadCart, CART_STORAGE_KEY, MIGRATIONS } = await import("./storage.ts");
  const { SCHEMA_VERSION } = await import("./types.ts");

  // v0 (hipotética): mismos ítems, pero sin `currency` — el importador solo
  // vendía en quetzales, así que la migración simplemente la completa.
  const carritoV0 = {
    schemaVersion: 0,
    items: [
      {
        sku: "SQ12-D2",
        qty: 1,
        unitPriceCents: 245000,
        nombreSnapshot: 'Serie SQ 12" D2',
        imagenSnapshot: null,
        addedAt: "2026-08-19T10:00:00.000Z",
      },
    ],
    createdAt: "2026-08-19T10:00:00.000Z",
    updatedAt: "2026-08-19T10:00:00.000Z",
  };

  MIGRATIONS[0] = (raw) => {
    const items = (raw.items as Record<string, unknown>[]).map((item) => ({
      ...item,
      currency: "GTQ",
    }));
    return { ...raw, schemaVersion: SCHEMA_VERSION, items } as never;
  };

  try {
    const cart = conLocalStorageVacio(() => {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carritoV0));
      return loadCart();
    });

    assert.equal(cart.schemaVersion, SCHEMA_VERSION);
    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].currency, "GTQ");
    assert.equal(cart.items[0].sku, "SQ12-D2");
  } finally {
    delete MIGRATIONS[0];
  }
});

test("loadCart: schemaVersion vieja SIN migración registrada se descarta, no lanza", async () => {
  const { loadCart, CART_STORAGE_KEY } = await import("./storage.ts");

  const cart = conLocalStorageVacio(() => {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 0, items: [{ sku: "ALGO" }] }),
    );
    return loadCart();
  });

  assert.equal(cart.items.length, 0);
});

test("loadCart: valor que no es un objeto (array, string, número) se descarta, no lanza", async () => {
  const { loadCart, CART_STORAGE_KEY } = await import("./storage.ts");

  for (const valorCrudo of ["[1,2,3]", '"hola"', "42", "null"]) {
    const cart = conLocalStorageVacio(() => {
      window.localStorage.setItem(CART_STORAGE_KEY, valorCrudo);
      return loadCart();
    });
    assert.equal(
      cart.items.length,
      0,
      `valor crudo "${valorCrudo}" debería producir carrito vacío`,
    );
  }
});

test("saveCart + loadCart: round-trip conserva el carrito guardado", async () => {
  const { loadCart, saveCart } = await import("./storage.ts");
  const { crearCarritoVacio } = await import("./types.ts");

  const original = {
    ...crearCarritoVacio("2026-08-21T09:00:00.000Z"),
    items: [
      {
        sku: "PRX60C",
        qty: 3,
        unitPriceCents: 118000,
        currency: "GTQ" as const,
        nombreSnapshot: 'Memphis PRX 6.5"',
        imagenSnapshot: null,
        addedAt: "2026-08-21T09:00:00.000Z",
      },
    ],
  };

  const recuperado = conLocalStorageVacio(() => {
    saveCart(original);
    return loadCart();
  });

  assert.deepEqual(recuperado, original);
});
