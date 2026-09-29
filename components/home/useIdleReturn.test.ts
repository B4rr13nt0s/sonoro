// El ciclo del carrusel con el reloj controlado: setTimeout y Date con los
// temporizadores simulados de node:test, y performance.now() leyendo ese
// mismo Date — así cada temporizador ve el reloj en su hora exacta. ciclo.test.ts fija el plan; esto fija cómo lo
// recorre el hook, en particular la pausa del avance con el foco del teclado
// adentro (WCAG 2.2.2): el giro sigue, el paso al producto siguiente no, y
// al soltar el foco la espera final se cumple entera.
import test, { mock } from "node:test";
import assert from "node:assert/strict";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { JSDOM } from "jsdom";

import { ESPERA_MS, GIRO_MS } from "./ciclo.ts";
import { useCicloCarrusel, type CicloCarrusel } from "./useIdleReturn.ts";

type Props = { activo: boolean; pausarAvance: boolean };

async function conCarrusel(
  cuerpo: (ctx: {
    estado: () => CicloCarrusel;
    avances: () => number;
    pasar: (ms: number) => Promise<void>;
    props: (p: Props) => Promise<void>;
    /** Los plazos (ms) de cada setTimeout armado desde la última llamada. */
    armados: () => number[];
  }) => Promise<void>,
) {
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>");
  const globalAny = globalThis as Record<string, unknown>;
  const anteriores = {
    window: globalAny.window,
    document: globalAny.document,
    IS_REACT_ACT_ENVIRONMENT: globalAny.IS_REACT_ACT_ENVIRONMENT,
  };
  globalAny.window = dom.window;
  globalAny.document = dom.window.document;
  globalAny.IS_REACT_ACT_ENVIRONMENT = true;

  const nowOriginal = performance.now;
  mock.timers.enable({ apis: ["setTimeout", "Date"], now: 1000 });
  performance.now = () => Date.now();
  // Cada plazo que el hook arma, aunque después lo limpie: act() procesa el
  // re-render antes de que corra cualquier timer, así que un setTimeout(0)
  // armado por error no llegaría a disparar acá — en el navegador sí puede.
  let plazos: number[] = [];
  const setTimeoutSimulado = globalThis.setTimeout;
  globalThis.setTimeout = ((fn: () => void, ms?: number) => {
    plazos.push(ms ?? 0);
    return setTimeoutSimulado(fn, ms);
  }) as typeof setTimeout;

  let root: Root | null = null;
  try {
    const estado: { valor: CicloCarrusel | null } = { valor: null };
    let avances = 0;
    const onAvanzar = () => {
      avances += 1;
    };
    function Probe(props: Props) {
      estado.valor = useCicloCarrusel({ ...props, reducedMotion: false, onAvanzar });
      return null;
    }
    const contenedor = dom.window.document.getElementById("root");
    if (!contenedor) throw new Error("no se encontró #root en el DOM de prueba");
    const raiz = createRoot(contenedor);
    root = raiz;
    const props = async (p: Props) => {
      await act(async () => {
        raiz.render(createElement(Probe, p));
      });
    };
    await props({ activo: true, pausarAvance: false });

    await cuerpo({
      estado: () => {
        if (!estado.valor) throw new Error("el hook no se montó");
        return estado.valor;
      },
      avances: () => avances,
      // En pasos cortos: un temporizador que el hook rearma tras un cambio de
      // fase se agenda al terminar el paso, y tiene que alcanzar a correr en
      // el siguiente.
      pasar: async (ms) => {
        for (let resto = ms; resto > 0; resto -= 100) {
          await act(async () => mock.timers.tick(Math.min(100, resto)));
        }
      },
      props,
      armados: () => {
        const vistos = plazos;
        plazos = [];
        return vistos;
      },
    });
  } finally {
    if (root) {
      const raiz = root;
      await act(async () => raiz.unmount());
    }
    mock.timers.reset();
    performance.now = nowOriginal;
    globalAny.window = anteriores.window;
    globalAny.document = anteriores.document;
    globalAny.IS_REACT_ACT_ENVIRONMENT = anteriores.IS_REACT_ACT_ENVIRONMENT;
  }
}

test("useCicloCarrusel: espera, gira, espera y pasa al siguiente", async () => {
  await conCarrusel(async ({ estado, avances, pasar }) => {
    assert.equal(estado().fase, "espera-previa");
    await pasar(ESPERA_MS);
    assert.equal(estado().fase, "girando");
    await pasar(GIRO_MS);
    assert.equal(estado().fase, "espera-final");
    assert.equal(avances(), 0);
    await pasar(ESPERA_MS);
    assert.equal(avances(), 1);
    assert.equal(estado().fase, "espera-previa");
  });
});

test("useCicloCarrusel: con el avance en pausa sigue girando pero no pasa al siguiente", async () => {
  await conCarrusel(async ({ estado, avances, pasar, props, armados }) => {
    await props({ activo: true, pausarAvance: true });
    // El giro no se detiene: esa era la regresión de pausar con cualquier foco.
    await pasar(ESPERA_MS);
    assert.equal(estado().fase, "girando");
    await pasar(GIRO_MS);
    assert.equal(estado().fase, "espera-final");

    await pasar(20_000);
    assert.equal(avances(), 0, "no avanza mientras el foco está adentro");

    // Al salir el foco, la espera final se cumple ENTERA: sin correr el
    // origen de la fase, el plazo ya estaba vencido y cambiaba al instante.
    armados();
    await props({ activo: true, pausarAvance: false });
    // Ni siquiera un timer transitorio con el plazo vencido: el efecto de
    // plazos del mismo commit ya usa el origen corrido.
    const alSoltar = armados();
    assert.ok(alSoltar.length > 0, "se arma el plazo de la espera final");
    assert.deepEqual(
      alSoltar.filter((ms) => ms !== ESPERA_MS),
      [],
      `plazos armados al soltar el foco: ${alSoltar.join(", ")}`,
    );
    await pasar(ESPERA_MS - 1);
    assert.equal(avances(), 0);
    await pasar(1);
    assert.equal(avances(), 1);
  });
});

test("useCicloCarrusel: una flecha durante la pausa arranca la fase nueva sin arrastrar la pausa", async () => {
  await conCarrusel(async ({ estado, avances, pasar, props }) => {
    await props({ activo: true, pausarAvance: true });
    await pasar(ESPERA_MS + GIRO_MS + 5_000);
    assert.equal(estado().fase, "espera-final");

    // La flecha: el carrusel avanza por su cuenta y reinicia el ciclo.
    await act(async () => estado().reiniciar());
    await pasar(ESPERA_MS);
    assert.equal(estado().fase, "girando", "la espera previa dura lo de siempre");
    assert.equal(avances(), 0);
  });
});
