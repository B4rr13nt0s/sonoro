# Sonoro

Tienda en línea de equipo de audio para carro, marino y motorsports en Guatemala: <https://sonoro-gules.vercel.app>.

Es un catálogo con carrito. No hay pago en línea: el pedido se cierra por WhatsApp con un mensaje ya redactado.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · three.js / React Three Fiber para el carrusel 3D de la portada · Playwright para e2e · Vercel.

## Arrancar

Requiere Node 22 o más nuevo.

```bash
npm ci
cp .env.example .env.local   # completar los valores; una variable ausente solo oculta su dato
npm run dev
```

## Comandos

| Comando                   | Qué hace                                                                   |
| ------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`             | Servidor de desarrollo                                                     |
| `npm run build`           | Importa el catálogo y compila el sitio                                     |
| `npm run import:catalog`  | Lee `data/source/catalogo.xlsx` y regenera `data/` (errores en `reports/`) |
| `npm run typecheck`       | Tipos                                                                      |
| `npm run lint`            | ESLint                                                                     |
| `npm run test`            | Tests unitarios (`node --test`)                                            |
| `npm run test:e2e`        | Tests e2e con Playwright                                                   |
| `npm run fotos:sin-fondo` | Genera las fotos de la portada desde `assets/fotos_pagina_de_inicio/`      |
| `npm run fotos:logos`     | Genera los logos de marca desde `assets/logos_marcas/`                     |

El CI (`.github/workflows/ci.yml`) corre typecheck, lint, tests, e2e y Lighthouse en cada push y PR.

## Estructura

```
app/          rutas
components/   componentes de interfaz
lib/          lógica: catálogo, carrito, búsqueda, chat, formato de precios
scripts/      importador del catálogo, fotos y modelos 3D (Blender)
data/         catálogo publicado (generado por el importador) y su fuente
public/       fotos de producto, logos, modelos .glb
assets/       originales que no se sirven
design/       handoff de diseño, solo como referencia
docs/         especificaciones y planes
```

## Documentación

- [`CLAUDE.md`](CLAUDE.md): reglas del negocio, modelo de datos, sistema visual y decisiones abiertas. Es la referencia principal.
- [`docs/IMPORTADOR.md`](docs/IMPORTADOR.md): el importador del catálogo.
- [`docs/superpowers/specs/2026-11-02-chatbot-design.md`](docs/superpowers/specs/2026-11-02-chatbot-design.md): el chatbot.
