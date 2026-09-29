// Cubre la carrera de hidratación que el flag `hydrated` de
// lib/cart/context.ts existe para evitar: sin él, el primer efecto de
// guardado correría con el carrito vacío inicial ANTES de leer localStorage,
// pisando un carrito real de una sesión anterior. Una aserción que solo mire
// el estado final de localStorage no detectaría esa regresión (React
// termina corrigiéndolo en el commit siguiente dentro de act()) — por eso
// este test espía cada escritura y verifica que NINGUNA, ni siquiera una
// transitoria, haya guardado un carrito vacío.
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

import { CartProvider, useCart } from "./context.ts";
import { CART_STORAGE_KEY, loadCart } from "./storage.ts";
import { SCHEMA_VERSION, type CatalogoSku } from "./types.ts";

test("CartProvider: montar con un carrito ya guardado no lo pisa con el estado vacío inicial", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  });
  const globalAny = globalThis as Record<string, unknown>;
  // `navigator` es un getter propio de Node (no un valor asignable) —
  // Object.defineProperty lo reemplaza igual, y guardamos el descriptor
  // original (no solo el valor) para poder restaurarlo tal cual al salir.
  const descriptorNavigatorOriginal = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const anteriores = {
    window: globalAny.window,
    document: globalAny.document,
    IS_REACT_ACT_ENVIRONMENT: globalAny.IS_REACT_ACT_ENVIRONMENT,
  };
  globalAny.window = dom.window;
  globalAny.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
  globalAny.IS_REACT_ACT_ENVIRONMENT = true;

  // `Storage` (jsdom, igual que el spec real) es un "legacy platform
  // object": sus instancias interceptan cualquier asignación de propiedad
  // como una escritura de storage-key, así que `localStorage.setItem = fn`
  // NO reemplaza el método — hay que parchear el método en el PROTOTIPO, y
  // declararlo fuera del try para poder restaurarlo en el finally pase lo
  // que pase.
  const storageProto = Object.getPrototypeOf(dom.window.localStorage) as {
    setItem: (key: string, value: string) => void;
  };
  const setItemOriginal = storageProto.setItem;

  try {
    const carritoGuardado = {
      schemaVersion: SCHEMA_VERSION,
      items: [
        {
          sku: "SQ12-D2",
          qty: 1,
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
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(carritoGuardado));

    // catalogo coincide exactamente con el ítem guardado — reconcile() no
    // debería tocarlo, así este test aísla el race de hidratación de la
    // lógica de reconciliación (que ya tiene su propia cobertura en
    // reconcile.test.ts).
    const catalogo: CatalogoSku[] = [
      { sku: "SQ12-D2", activo: true, disponibilidad: "disponible", precioCents: 245000 },
    ];

    const escrituras: string[] = [];
    storageProto.setItem = function (this: Storage, key: string, value: string) {
      if (key === CART_STORAGE_KEY) escrituras.push(value);
      return setItemOriginal.call(this, key, value);
    };

    // Objeto contenedor en vez de reasignar un `let` externo: TypeScript no
    // sigue de forma confiable la narrowing de una reasignación hecha
    // dentro de una función anidada (Probe) sobre una variable del scope
    // exterior.
    const probeState: { valor: ReturnType<typeof useCart> | null } = { valor: null };
    function Probe() {
      probeState.valor = useCart();
      return null;
    }

    const contenedor = document.getElementById("root");
    if (!contenedor) throw new Error("no se encontró #root en el DOM de prueba");
    const root = createRoot(contenedor);

    await act(async () => {
      // `children` va en las props (no como 3er argumento de createElement)
      // porque el tipo de CartProvider lo declara requerido — el overload
      // de createElement para componentes con props tipadas exige
      // `children` ahí mismo aunque también se pueda pasar como rest arg.
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(CartProvider, { catalogo, children: createElement(Probe) }));
    });

    for (const escritura of escrituras) {
      const parseado = JSON.parse(escritura);
      assert.notEqual(
        parseado.items.length,
        0,
        `se guardó un carrito vacío durante el montaje: ${escritura}`,
      );
    }

    assert.ok(
      escrituras.length >= 1,
      "se esperaba al menos una escritura (la del carrito hidratado)",
    );
    assert.equal(probeState.valor?.items.length, 1);
    assert.equal(probeState.valor?.items[0].sku, "SQ12-D2");

    const final = window.localStorage.getItem(CART_STORAGE_KEY);
    assert.ok(final);
    assert.equal(JSON.parse(final).items.length, 1);

    await act(async () => {
      root.unmount();
    });
  } finally {
    storageProto.setItem = setItemOriginal;
    globalAny.window = anteriores.window;
    globalAny.document = anteriores.document;
    if (descriptorNavigatorOriginal) {
      Object.defineProperty(globalThis, "navigator", descriptorNavigatorOriginal);
    }
    globalAny.IS_REACT_ACT_ENVIRONMENT = anteriores.IS_REACT_ACT_ENVIRONMENT;
  }
});

// Dos pestañas: la otra guardó un carrito distinto y el navegador avisa con
// `storage`. Antes nadie escuchaba ese evento, y la pestaña de acá pisaba lo
// de la otra en su siguiente escritura.
test("CartProvider: adopta lo que otra pestaña guardó, sin reescribirlo, y lo conserva al cambiar algo", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  });
  const globalAny = globalThis as Record<string, unknown>;
  const descriptorNavigatorOriginal = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const anteriores = {
    window: globalAny.window,
    document: globalAny.document,
    IS_REACT_ACT_ENVIRONMENT: globalAny.IS_REACT_ACT_ENVIRONMENT,
  };
  globalAny.window = dom.window;
  globalAny.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
  globalAny.IS_REACT_ACT_ENVIRONMENT = true;

  const storageProto = Object.getPrototypeOf(dom.window.localStorage) as {
    setItem: (key: string, value: string) => void;
  };
  const setItemOriginal = storageProto.setItem;

  try {
    const linea = (sku: string, unitPriceCents: number) => ({
      sku,
      qty: 1,
      unitPriceCents,
      currency: "GTQ" as const,
      nombreSnapshot: sku,
      imagenSnapshot: null,
      addedAt: "2026-09-25T10:00:00.000Z",
    });
    const catalogo: CatalogoSku[] = [
      { sku: "SQ12-D2", activo: true, disponibilidad: "disponible", precioCents: 245000 },
      { sku: "PRX60C", activo: true, disponibilidad: "disponible", precioCents: 118000 },
      { sku: "KSL-8B", activo: true, disponibilidad: "disponible", precioCents: 190000 },
    ];

    const escrituras: string[] = [];
    storageProto.setItem = function (this: Storage, key: string, value: string) {
      if (key === CART_STORAGE_KEY) escrituras.push(value);
      return setItemOriginal.call(this, key, value);
    };

    const probeState: { valor: ReturnType<typeof useCart> | null } = { valor: null };
    function Probe() {
      probeState.valor = useCart();
      return null;
    }

    const contenedor = document.getElementById("root");
    if (!contenedor) throw new Error("no se encontró #root en el DOM de prueba");
    const root = createRoot(contenedor);
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(CartProvider, { catalogo, children: createElement(Probe) }));
    });
    assert.equal(probeState.valor?.items.length, 0);

    // La otra pestaña guarda dos líneas. Una con un precio viejo: reconcile()
    // la corrige acá, y aun así esta pestaña no debe reescribir.
    const deLaOtraPestaña = {
      schemaVersion: SCHEMA_VERSION,
      items: [linea("SQ12-D2", 245000), linea("PRX60C", 100000)],
      createdAt: "2026-09-25T10:00:00.000Z",
      updatedAt: "2026-09-25T10:00:00.000Z",
    };
    setItemOriginal.call(
      dom.window.localStorage,
      CART_STORAGE_KEY,
      JSON.stringify(deLaOtraPestaña),
    );
    const antesDelEvento = escrituras.length;
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: CART_STORAGE_KEY }));
    });

    assert.deepEqual(
      probeState.valor?.items.map((i) => i.sku),
      ["SQ12-D2", "PRX60C"],
    );
    assert.equal(probeState.valor?.items[1].unitPriceCents, 118000, "precio corregido");
    assert.equal(
      probeState.valor?.createdAt,
      "2026-09-25T10:00:00.000Z",
      "mismo carrito, mismo Ref",
    );
    assert.equal(escrituras.length, antesDelEvento, "no reescribe lo que llegó de otra pestaña");

    // Un cambio propio guarda el carrito ENTERO, con lo de la otra pestaña.
    await act(async () => {
      probeState.valor?.addItem({
        sku: "KSL-8B",
        qty: 1,
        unitPriceCents: 190000,
        currency: "GTQ",
        nombreSnapshot: "KSL-8B",
        imagenSnapshot: null,
      });
    });
    const final = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "null");
    assert.deepEqual(
      final.items.map((i: { sku: string }) => i.sku),
      ["SQ12-D2", "PRX60C", "KSL-8B"],
    );

    // Otra clave de localStorage no toca el carrito.
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: "otra-cosa" }));
    });
    assert.equal(probeState.valor?.items.length, 3);

    await act(async () => {
      root.unmount();
    });
  } finally {
    storageProto.setItem = setItemOriginal;
    globalAny.window = anteriores.window;
    globalAny.document = anteriores.document;
    if (descriptorNavigatorOriginal) {
      Object.defineProperty(globalThis, "navigator", descriptorNavigatorOriginal);
    }
    globalAny.IS_REACT_ACT_ENVIRONMENT = anteriores.IS_REACT_ACT_ENVIRONMENT;
  }
});

// Guardado vs. mostrado (lib/cart/context.ts): lo guardado es el carrito tal
// como lo armó el cliente; lo mostrado y los avisos se DERIVAN contra el
// catálogo, y solo descartarCambios() guarda el carrito corregido.
test("CartProvider: deriva el carrito corregido y los avisos sin reescribir lo guardado", async () => {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", {
    url: "http://localhost/",
  });
  const globalAny = globalThis as Record<string, unknown>;
  const descriptorNavigatorOriginal = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const anteriores = {
    window: globalAny.window,
    document: globalAny.document,
    IS_REACT_ACT_ENVIRONMENT: globalAny.IS_REACT_ACT_ENVIRONMENT,
  };
  globalAny.window = dom.window;
  globalAny.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", {
    value: dom.window.navigator,
    configurable: true,
    writable: true,
  });
  globalAny.IS_REACT_ACT_ENVIRONMENT = true;

  try {
    const CREADO = "2026-09-20T10:00:00.000Z";
    const linea = (sku: string, unitPriceCents: number, qty = 1) => ({
      sku,
      qty,
      unitPriceCents,
      currency: "GTQ" as const,
      nombreSnapshot: sku,
      imagenSnapshot: null,
      addedAt: CREADO,
    });
    const carrito = (items: ReturnType<typeof linea>[], createdAt = CREADO) => ({
      schemaVersion: SCHEMA_VERSION,
      items,
      createdAt,
      updatedAt: createdAt,
    });
    // Un precio viejo y un producto que se agotó después de agregarlo.
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(carrito([linea("SQ12-D2", 200000), linea("P1T-S", 145000)])),
    );
    const catalogo: CatalogoSku[] = [
      { sku: "SQ12-D2", activo: true, disponibilidad: "disponible", precioCents: 245000 },
      { sku: "P1T-S", activo: true, disponibilidad: "agotado", precioCents: 145000 },
    ];
    const precio = {
      tipo: "precio_actualizado" as const,
      sku: "SQ12-D2",
      nombreSnapshot: "SQ12-D2",
      precioAnteriorCents: 200000,
      precioActualCents: 245000,
    };
    const agotado = { tipo: "eliminado_agotado" as const, sku: "P1T-S", nombreSnapshot: "P1T-S" };

    const probeState: { valor: ReturnType<typeof useCart> | null } = { valor: null };
    function Probe() {
      probeState.valor = useCart();
      return null;
    }
    const contenedor = document.getElementById("root");
    if (!contenedor) throw new Error("no se encontró #root en el DOM de prueba");
    const root = createRoot(contenedor);
    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(CartProvider, { catalogo, children: createElement(Probe) }));
    });

    // Lo mostrado ya está corregido, y los avisos son la diferencia...
    assert.deepEqual(
      probeState.valor?.items.map((i) => [i.sku, i.unitPriceCents]),
      [["SQ12-D2", 245000]],
    );
    assert.deepEqual(probeState.valor?.cambios, [precio, agotado]);
    // ...pero lo guardado sigue como lo armó el cliente: la evidencia queda.
    assert.deepEqual(
      loadCart().items.map((i) => [i.sku, i.unitPriceCents]),
      [
        ["SQ12-D2", 200000],
        ["P1T-S", 145000],
      ],
    );

    // /carrito los mostró: se guarda el corregido y no queda nada que avisar.
    await act(async () => {
      probeState.valor?.descartarCambios();
    });
    assert.deepEqual(probeState.valor?.cambios, []);
    assert.deepEqual(
      loadCart().items.map((i) => [i.sku, i.unitPriceCents]),
      [["SQ12-D2", 245000]],
    );

    // Lo que reconcile() quitaría no entra, y addItem() dice cuánto entró.
    const nuevo = (sku: string, qty = 1) => ({
      sku,
      qty,
      unitPriceCents: 245000,
      currency: "GTQ" as const,
      nombreSnapshot: sku,
      imagenSnapshot: null,
    });
    const entradas: (number | undefined)[] = [];
    for (const item of [nuevo("P1T-S"), nuevo("NO-EXISTE"), nuevo("SQ12-D2", 97)]) {
      await act(async () => {
        entradas.push(probeState.valor?.addItem(item));
      });
    }
    for (const item of [nuevo("SQ12-D2", 5), nuevo("SQ12-D2", 5)]) {
      await act(async () => {
        entradas.push(probeState.valor?.addItem(item));
      });
    }
    assert.deepEqual(entradas, [0, 0, 97, 1, 0]);
    assert.equal(probeState.valor?.items[0].qty, 99);

    // Otra pestaña (con un catálogo viejo) guardó el carrito con el agotado:
    // esta lo adopta, lo muestra corregido y lo avisa, sin reescribirlo.
    const deLaOtra = JSON.stringify(carrito([linea("SQ12-D2", 245000), linea("P1T-S", 145000)]));
    window.localStorage.setItem(CART_STORAGE_KEY, deLaOtra);
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: CART_STORAGE_KEY }));
    });
    assert.deepEqual(
      probeState.valor?.items.map((i) => i.sku),
      ["SQ12-D2"],
    );
    assert.deepEqual(probeState.valor?.cambios, [agotado]);
    assert.equal(window.localStorage.getItem(CART_STORAGE_KEY), deLaOtra, "no lo reescribe");

    // La otra pestaña pide: el carrito se vacía con otro createdAt, y el
    // aviso se va con el carrito que corregía.
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(carrito([], "2026-09-28T12:00:00.000Z")),
    );
    await act(async () => {
      dom.window.dispatchEvent(new dom.window.StorageEvent("storage", { key: CART_STORAGE_KEY }));
    });
    assert.deepEqual(probeState.valor?.cambios, []);
    assert.equal(probeState.valor?.createdAt, "2026-09-28T12:00:00.000Z");

    await act(async () => {
      root.unmount();
    });
  } finally {
    globalAny.window = anteriores.window;
    globalAny.document = anteriores.document;
    if (descriptorNavigatorOriginal) {
      Object.defineProperty(globalThis, "navigator", descriptorNavigatorOriginal);
    }
    globalAny.IS_REACT_ACT_ENVIRONMENT = anteriores.IS_REACT_ACT_ENVIRONMENT;
  }
});
