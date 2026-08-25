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
