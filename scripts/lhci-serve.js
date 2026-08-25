// lighthouserc.js's startServerCommand corre a través de un shell, y la
// sintaxis "SITE_URL=x comando" para pasar variables de entorno inline no
// funciona en cmd.exe (sí en bash) — a diferencia de playwright.config.ts,
// que pasa SITE_URL vía la opción `env` estructurada de Playwright, lhci no
// tiene un equivalente. Este script hace lo mismo con child_process puro,
// sin depender de sintaxis de shell — funciona igual en Windows y en Linux
// (CI).
// Este archivo corre directo con `node scripts/lhci-serve.js` (invocado por
// lighthouserc.js), sin paso de build; el proyecto no declara
// "type": "module", así que CommonJS es lo que Node ejecuta sin más.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { execSync } = require("node:child_process");

const PORT = 3100;
const env = { ...process.env, SITE_URL: `http://localhost:${PORT}` };

execSync("npm run build", { stdio: "inherit", env });
execSync(`npm run start -- -p ${PORT}`, { stdio: "inherit", env });
