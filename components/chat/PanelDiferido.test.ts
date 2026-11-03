// El panel diferido con un DOM simulado: un import() que se rechaza no tira la
// página ni se repite sin fin, el límite de error cierra el panel, y el
// SIGUIENTE clic baja el panel de nuevo.
import test from "node:test";
import assert from "node:assert/strict";
import { act, createElement, useState, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

import { crearPanelDiferido } from "./PanelDiferido.ts";
import type { PanelChatProps } from "./PanelChat";

function PanelFalso() {
  return createElement("div", { id: "panel-chat", role: "dialog" });
}

async function conLanzador(
  importar: () => Promise<{ default: ComponentType<PanelChatProps> }>,
  cuerpo: (ctx: {
    clic: () => Promise<void>;
    precargar: () => void;
    soltar: () => Promise<void>;
    panel: () => Element | null;
    abierto: () => boolean;
    fallos: () => number;
  }) => Promise<void>,
) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
  const g = globalThis as Record<string, unknown>;
  const anteriores = {
    window: g.window,
    document: g.document,
    IS_REACT_ACT_ENVIRONMENT: g.IS_REACT_ACT_ENVIRONMENT,
  };
  g.window = dom.window;
  g.document = dom.window.document;
  g.IS_REACT_ACT_ENVIRONMENT = true;
  // React informa por console.error los errores que un límite atrapa.
  const consoleError = console.error;
  console.error = () => {};

  const PanelDiferido = crearPanelDiferido(importar);
  const visto = { abierto: false, fallos: 0 };
  function Lanzador({ alVer, alFallo }: { alVer: (a: boolean) => void; alFallo: () => void }) {
    const [estaAbierto, setAbierto] = useState(false);
    alVer(estaAbierto);
    return createElement(
      "div",
      null,
      createElement("button", { id: "lanzador", onClick: () => setAbierto(!estaAbierto) }),
      estaAbierto
        ? createElement(PanelDiferido, {
            conversacion: null,
            setConversacion: () => {},
            contacto: {},
            cargarCatalogo: async () => null,
            alCerrar: () => setAbierto(false),
            alFallar: () => {
              alFallo();
              setAbierto(false);
            },
            lanzadorRef: { current: null },
          })
        : null,
    );
  }

  const raiz = createRoot(dom.window.document.getElementById("root")!);
  try {
    await act(async () => {
      raiz.render(
        createElement(Lanzador, {
          alVer: (a: boolean) => {
            visto.abierto = a;
          },
          alFallo: () => {
            visto.fallos += 1;
          },
        }),
      );
    });
    await cuerpo({
      clic: async () => {
        await act(async () => {
          dom.window.document
            .getElementById("lanzador")!
            .dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
        });
      },
      precargar: () => PanelDiferido.precargar(),
      // Deja correr las promesas pendientes (el rechazo del import, el re-render).
      soltar: async () => {
        for (let i = 0; i < 5; i++) {
          await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
          });
        }
      },
      panel: () => dom.window.document.getElementById("panel-chat"),
      abierto: () => visto.abierto,
      fallos: () => visto.fallos,
    });
  } finally {
    await act(async () => raiz.unmount());
    console.error = consoleError;
    g.window = anteriores.window;
    g.document = anteriores.document;
    g.IS_REACT_ACT_ENVIRONMENT = anteriores.IS_REACT_ACT_ENVIRONMENT;
    dom.window.close();
  }
}

test("un import que se rechaza se contiene: un solo intento, el panel se cierra y el siguiente clic reintenta", async () => {
  let intentos = 0;
  let hayRed = false;
  await conLanzador(
    async () => {
      intentos += 1;
      // Tope contra un bucle de reintentos: sin él, un error de cableado cuelga
      // la prueba en vez de hacerla fallar.
      if (intentos > 3) return new Promise<never>(() => {});
      if (!hayRed) throw new TypeError("sin red");
      return { default: PanelFalso };
    },
    async ({ clic, soltar, panel, abierto, fallos }) => {
      await clic();
      await soltar();
      assert.equal(intentos, 1, "el rechazo no debe provocar import() en bucle");
      assert.equal(fallos(), 1, "el límite de error atrapó una sola vez");
      assert.equal(abierto(), false);
      assert.equal(panel(), null);

      // Vuelve la red: el siguiente clic baja el panel y lo dibuja.
      hayRed = true;
      await clic();
      await soltar();
      assert.equal(intentos, 2);
      assert.equal(fallos(), 1);
      assert.equal(abierto(), true);
      assert.ok(panel(), "el panel debe dibujarse");
    },
  );
});

test("con red el panel se dibuja y reabrirlo no vuelve a importar", async () => {
  let intentos = 0;
  await conLanzador(
    async () => {
      intentos += 1;
      return { default: PanelFalso };
    },
    async ({ clic, soltar, panel, fallos }) => {
      await clic();
      await soltar();
      assert.ok(panel());
      await clic(); // cierra
      await clic(); // reabre
      await soltar();
      assert.ok(panel());
      assert.equal(intentos, 1);
      assert.equal(fallos(), 0);
    },
  );
});

test("precargar y luego abrir importa una sola vez", async () => {
  let intentos = 0;
  await conLanzador(
    async () => {
      intentos += 1;
      return { default: PanelFalso };
    },
    async ({ clic, precargar, soltar, panel, fallos }) => {
      // Entrar con el puntero y luego enfocar disparan la precarga dos veces.
      precargar();
      precargar();
      await soltar();
      assert.equal(intentos, 1);
      assert.equal(panel(), null, "precargar no abre el panel");

      await clic();
      await soltar();
      assert.ok(panel());
      assert.equal(intentos, 1, "abrir reutiliza la precarga");
      assert.equal(fallos(), 0);
    },
  );
});

test("una precarga que falla no cuesta un clic: abrir vuelve a importar y dibuja", async () => {
  let intentos = 0;
  let hayRed = false;
  await conLanzador(
    async () => {
      intentos += 1;
      if (intentos > 3) return new Promise<never>(() => {});
      if (!hayRed) throw new TypeError("sin red");
      return { default: PanelFalso };
    },
    async ({ clic, precargar, soltar, panel, fallos }) => {
      precargar();
      await soltar();
      assert.equal(intentos, 1);

      hayRed = true;
      await clic();
      await soltar();
      assert.equal(intentos, 2);
      assert.ok(panel(), "el primer clic debe abrir el panel");
      assert.equal(fallos(), 0);
    },
  );
});

test("un fallo al abrir después de precargar se contiene y el siguiente clic reintenta", async () => {
  let intentos = 0;
  let hayRed = false;
  await conLanzador(
    async () => {
      intentos += 1;
      if (intentos > 4) return new Promise<never>(() => {});
      if (!hayRed) {
        // Tarda en fallar: el clic llega mientras la precarga sigue en vuelo.
        await new Promise((r) => setTimeout(r, 5));
        throw new TypeError("sin red");
      }
      return { default: PanelFalso };
    },
    async ({ clic, precargar, soltar, panel, abierto, fallos }) => {
      precargar();
      await clic();
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      await soltar();
      assert.equal(intentos, 1, "el clic comparte la precarga en vuelo");
      assert.equal(fallos(), 1);
      assert.equal(abierto(), false);

      hayRed = true;
      await clic();
      await soltar();
      assert.equal(intentos, 2);
      assert.ok(panel());
    },
  );
});
