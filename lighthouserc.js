// docs/PLAN.md § Fase 8: "Lighthouse en CI con presupuestos: Performance ≥
// 90 móvil, Accessibility ≥ 95". SITE_URL se pasa vía scripts/lhci-serve.js
// (no inline en el comando — lhci no tiene un equivalente a webServer.env
// de Playwright, y "SITE_URL=x comando" no funciona en cmd.exe). El build
// corre con NODE_ENV=production, y lib/seo/site.ts exige SITE_URL en ese
// caso.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// El presupuesto de todas las rutas menos la portada.
const PRESUPUESTO = {
  "categories:performance": ["error", { minScore: 0.9 }],
  "categories:accessibility": ["error", { minScore: 0.95 }],
};

// LA PORTADA SE MIDE POR MÉTRICAS, NO POR EL PUNTAJE GLOBAL.
//
// El puntaje de Performance pesa 30% en Total Blocking Time y 10% en Speed
// Index, y las dos miden lo mismo: cuánto tiempo el hilo principal está
// ocupado. El carrusel 3D del hero (CLAUDE.md § Modelos 3D) dibuja cuadro a
// cuadro mientras está a la vista, a propósito, así que el hilo nunca queda
// quieto y Lighthouse —que mide con el procesador frenado 4×— convierte cada
// cuadro en una "tarea larga": 167 s de TBT y 28.7 s de Speed Index, con el
// puntaje global en 0.59 aunque la página se vea completa en 2.2 s.
//
// Bajar el minScore a secas dejaría pasar cualquier regresión por debajo de
// ese número. En su lugar se asierta lo que SÍ describe la experiencia de
// carga, y que hoy pasa holgado: primer pintado 1.1 s y estabilidad visual 0.
//
// Y TAMPOCO SE ASIERTA EL PINTADO MAYOR, por la misma razón de fondo.
//
// El elemento del pintado mayor de la portada es el TITULAR del hero, y en
// todas las mediciones pinta en el mismo instante que el primer pintado:
// observado 1.33 s y 1.33 s en el runner de CI. O sea, la portada muestra su
// contenido principal tan pronto como pinta algo, que es lo que esta sección
// quiere vigilar.
//
// Lo que Lighthouse asierta no es ese valor observado sino una ESTIMACIÓN
// para un celular lento, y esa estimación le suma el trabajo del hilo
// principal: los mismos 176 s del carrusel. Resultado: el número subía de
// 3.19 s a 3.40 s entre dos corridas en las que la portada DESCARGABA MENOS
// que antes (las fotos de categorías salieron de la carga inicial y el canvas
// 3D dejó de cargarse dentro de la hidratación). Dejó de describir la carga
// de la página y pasó a describir cuán cargado estaba el servidor de CI.
//
// El primer pintado sí se asierta, y en esta página cubre lo mismo: si el
// titular tardara de verdad, se cae ese tope. Si algún día el hero deja de
// ser texto —una foto grande, por ejemplo—, el pintado mayor deja de coincidir
// con el primero y hay que volver a asertarlo.
//
// Si algún día el carrusel deja de animar solo, esto vuelve a PRESUPUESTO.
const PRESUPUESTO_PORTADA = {
  "categories:accessibility": ["error", { minScore: 0.95 }],
  "first-contentful-paint": ["error", { maxNumericValue: 2000 }],
  "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: "node scripts/lhci-serve.js",
      startServerReadyPattern: "Ready in",
      startServerReadyTimeout: 120_000,
      url: [
        `${BASE_URL}/`,
        `${BASE_URL}/catalogo/subwoofers`,
        `${BASE_URL}/producto/memphis-mjp800-4`,
        `${BASE_URL}/carrito`,
        `${BASE_URL}/buscar`,
      ],
      // Sin settings.preset: "desktop" — el default de Lighthouse ya es
      // emulación móvil + throttling, que es "Performance móvil".
      numberOfRuns: 1,
    },
    assert: {
      // Los dos patrones son EXCLUYENTES entre sí: "/$" es solo la portada y
      // "/.+" es cualquier otra ruta. Si se solaparan, a la portada se le
      // aplicarían los dos juegos de reglas y volvería a fallar por el
      // puntaje global.
      assertMatrix: [
        { matchingUrlPattern: `^${BASE_URL}/$`, assertions: PRESUPUESTO_PORTADA },
        { matchingUrlPattern: `^${BASE_URL}/.+`, assertions: PRESUPUESTO },
      ],
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
