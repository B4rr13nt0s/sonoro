import { defineConfig, devices } from "@playwright/test";

// e2e del flujo crítico (docs/PLAN.md § Fase 8). Corre contra el build de
// producción, no `next dev` — es lo que recomiendan los propios docs de
// Next.js para e2e (node_modules/next/dist/docs/.../testing/playwright.md).
//
// SITE_URL explícito: el build corre con NODE_ENV=production, y
// lib/seo/site.ts exige SITE_URL en ese caso (falla el build si falta).
//
// NEXT_PUBLIC_WHATSAPP_NUMBER es un número FALSO, solo para este servidor
// de pruebas — el e2e nunca depende del número real del negocio ni de
// .env.local (que ni existe en CI, está en .gitignore).
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  // Tope de workers: por defecto Playwright usa la mitad de los núcleos (8 en
  // una máquina de 16), y desde que hay más pruebas que eso corren TODAS a la
  // vez. Cada una abre su Chromium, y el carrusel 3D de la portada se dibuja
  // en software (sin GPU): con tantos a la vez, al test del carrusel de
  // menu-y-carrusel.spec.ts no le llega el procesador para crear su canvas en
  // los 20 s que se da, y el panel del chat tarda en bajar. Con 4 sobra
  // holgura y la suite sigue en ~30 s, casi todo el build.
  workers: 4,
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  // Un solo navegador — el pedido es "un test e2e", no una matriz de
  // navegadores. Se puede ampliar agregando firefox/webkit después.
  //
  // Son dos proyectos por una sola razón: carrusel-3d.spec.ts mira los
  // píxeles del canvas, que acá se dibuja por software, y graba los cuadros
  // de la entrada. Corriendo al lado de las demás les quitaba el procesador:
  // la prueba del flujo crítico —que ni pasa por la portada— fallaba una de
  // cada dos veces esperando los resultados de /buscar. `dependencies` hace
  // que esas pruebas corran DESPUÉS de todas las otras, y solo si pasaron.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: "**/carrusel-3d.spec.ts",
    },
    {
      name: "carrusel-3d",
      use: { ...devices["Desktop Chrome"] },
      testMatch: "**/carrusel-3d.spec.ts",
      dependencies: ["chromium"],
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- -p ${PORT}`,
    url: BASE_URL,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    env: {
      SITE_URL: BASE_URL,
      NEXT_PUBLIC_WHATSAPP_NUMBER: "50200000000",
      // El chat va tras esta bandera, que se lee al compilar: sin ella el
      // build no trae el lanzador y e2e/chat.spec.ts no tiene qué probar.
      NEXT_PUBLIC_CHAT_ENABLED: "true",
    },
  },
});
