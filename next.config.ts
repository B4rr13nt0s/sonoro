import type { NextConfig } from "next";

// docs/PLAN.md § Fase 0 nombra exactamente estos dominios: sonoro.gt
// canónico (apex, sin www), sonoro.com.gt y sonoro.com defensivos. No son
// secretos ni varían por entorno — son literales acá igual que cualquier
// regla de redirect, no variables de entorno.
//
// Esta regla por sí sola no hace nada hasta que el dominio esté agregado en
// Vercel (Settings → Domains): next.config.ts decide qué pasa con una
// petición una vez que ya llegó a esta app, no enruta el dominio.
const DOMINIOS_NO_CANONICOS = [
  "www.sonoro.gt",
  "sonoro.com",
  "www.sonoro.com",
  "sonoro.com.gt",
  "www.sonoro.com.gt",
];

const nextConfig: NextConfig = {
  // lib/catalog/adapters/static.ts lee data/*.json con fs.readFile, en una
  // ruta calculada en tiempo de ejecución (path.join(fileURLToPath(...),
  // "..", "..", "..")) — el rastreador de archivos de Vercel
  // (@vercel/nft) no logra seguir esa construcción dinámica y no empaqueta
  // esos JSON en las funciones serverless. No falla local (next start
  // corre contra el repo completo, no un paquete mínimo) ni en rutas
  // estáticas (se leen en build time, cuando sí hay filesystem completo) —
  // solo en rutas dinámicas (ƒ) desplegadas, en runtime real. `/*` cubre
  // cualquier ruta dinámica actual o futura que use lib/catalog.
  outputFileTracingIncludes: {
    "/*": ["data/*.json"],
  },
  async redirects() {
    return DOMINIOS_NO_CANONICOS.map((host) => ({
      source: "/:path*",
      has: [{ type: "host" as const, value: host }],
      destination: "https://sonoro.gt/:path*",
      permanent: true,
    }));
  },
};

export default nextConfig;
