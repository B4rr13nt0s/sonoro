// Misma carrera de hidratación que cubre lib/cart/context.test.ts, para el
// provider del comparador: sin el flag `hydrated`, el primer efecto de
// guardado correría con la selección vacía inicial ANTES de leer
// localStorage, pisando la selección de una sesión anterior. Mirar solo el
// estado final no detectaría la regresión (React la corrige en el commit
// siguiente dentro de act()), así que este test espía CADA escritura y
// verifica que ninguna, ni siquiera transitoria, guardó una selección vacía.
import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

import { ComparadorProvider, useComparador } from "./context.ts";
import { COMPARADOR_STORAGE_KEY } from "./storage.ts";
import { SCHEMA_VERSION, type CatalogoComparable } from "./types.ts";

test("ComparadorProvider: montar con una selección guardada no la pisa con el estado vacío", async () => {
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

  // `Storage` es un "legacy platform object": asignarle una propiedad a la
  // instancia se interpreta como escribir una clave, así que el espía va en
  // el PROTOTIPO.
  const storageProto = Object.getPrototypeOf(dom.window.localStorage) as {
    setItem: (key: string, value: string) => void;
  };
  const setItemOriginal = storageProto.setItem;

  try {
    const guardada = {
      schemaVersion: SCHEMA_VERSION,
      categoria: "Subwoofers",
      skus: ["SQ12-D2", "COR-S124D"],
      updatedAt: "2026-09-09T10:00:00.000Z",
    };
    window.localStorage.setItem(COMPARADOR_STORAGE_KEY, JSON.stringify(guardada));

    // El catálogo coincide con lo guardado — así este test aísla la carrera
    // de hidratación de la lógica de reconciliación, que ya tiene su propia
    // cobertura en reconcile.test.ts.
    const catalogo: CatalogoComparable[] = [
      { sku: "SQ12-D2", categoria: "Subwoofers", activo: true },
      { sku: "COR-S124D", categoria: "Subwoofers", activo: true },
    ];

    const escrituras: string[] = [];
    storageProto.setItem = function (this: Storage, key: string, value: string) {
      if (key === COMPARADOR_STORAGE_KEY) escrituras.push(value);
      return setItemOriginal.call(this, key, value);
    };

    const probeState: { valor: ReturnType<typeof useComparador> | null } = { valor: null };
    function Probe() {
      probeState.valor = useComparador();
      return null;
    }

    const contenedor = document.getElementById("root");
    if (!contenedor) throw new Error("no se encontró #root en el DOM de prueba");
    const root = createRoot(contenedor);

    await act(async () => {
      // eslint-disable-next-line react/no-children-prop
      root.render(createElement(ComparadorProvider, { catalogo, children: createElement(Probe) }));
    });

    for (const escritura of escrituras) {
      const parseado = JSON.parse(escritura);
      assert.notEqual(
        parseado.skus.length,
        0,
        `se guardó una selección vacía durante el montaje: ${escritura}`,
      );
    }

    assert.ok(escrituras.length >= 1, "se esperaba al menos una escritura (la ya hidratada)");
    assert.equal(probeState.valor?.cantidad, 2);
    assert.equal(probeState.valor?.categoria, "Subwoofers");
    assert.equal(probeState.valor?.hydrated, true);
    assert.equal(probeState.valor?.tiene("SQ12-D2"), true);

    const final = window.localStorage.getItem(COMPARADOR_STORAGE_KEY);
    assert.ok(final);
    assert.equal(JSON.parse(final).skus.length, 2);

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
