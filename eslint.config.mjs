import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

const MENSAJE_CATALOG_JSON =
  "No importes data/catalog.json directamente. Es un archivo generado por scripts/import-catalog.ts " +
  "y su forma o su fuente (hoy JSON local, mañana quizás una API) puede cambiar sin aviso. " +
  "Usa las funciones de lib/catalog/ (getProduct, listProducts, listBrands) — son la única puerta " +
  'de entrada al catálogo (CLAUDE.md § Fuente de verdad: "Ningún componente lee catalog.json directamente. Nunca.").';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettierConfig,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/data/catalog.json", "@/data/catalog.json", "data/catalog.json"],
              message: MENSAJE_CATALOG_JSON,
            },
          ],
        },
      ],
    },
  },
  {
    // lib/catalog/ es la única costura autorizada a conocer data/catalog.json.
    files: ["lib/catalog/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "data/catalog.json",
    "data/brands.json",
    "data/taxonomy.json",
    "reports/**",
  ]),
]);

export default eslintConfig;
