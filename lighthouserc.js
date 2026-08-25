// docs/PLAN.md § Fase 8: "Lighthouse en CI con presupuestos: Performance ≥
// 90 móvil, Accessibility ≥ 95". SITE_URL se pasa vía scripts/lhci-serve.js
// (no inline en el comando — lhci no tiene un equivalente a webServer.env
// de Playwright, y "SITE_URL=x comando" no funciona en cmd.exe). El build
// corre con NODE_ENV=production, y lib/seo/site.ts exige SITE_URL en ese
// caso.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

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
      assertions: {
        "categories:performance": ["error", { minScore: 0.9 }],
        "categories:accessibility": ["error", { minScore: 0.95 }],
      },
    },
    upload: {
      target: "temporary-public-storage",
    },
  },
};
