const COLORES = [
  { nombre: "negro", uso: "Negro / texto / botones", hex: "#0B0B0C" },
  { nombre: "blanco", uso: "Blanco", hex: "#FFFFFF" },
  { nombre: "fondo-alt", uso: "Fondo de sección alterna", hex: "#F5F5F3" },
  { nombre: "borde-tarjeta", uso: "Bordes de tarjeta", hex: "#ECECEA" },
  { nombre: "borde-pildora", uso: "Bordes de píldora", hex: "#E4E4E0" },
  { nombre: "texto-secundario", uso: "Texto secundario", hex: "#6B6B67" },
  { nombre: "texto-terciario", uso: "Texto terciario / etiquetas", hex: "#9C9C97" },
  { nombre: "texto-sobre-negro", uso: "Texto sobre negro", hex: "#A1A1A6" },
  { nombre: "borde-sobre-negro", uso: "Bordes sobre negro", hex: "#232326" },
] as const;

const ESCALA = [82, 64, 48, 44, 40, 38, 34, 26, 22] as const;

const RADIOS = [
  { nombre: "full", uso: "Botones y píldoras", valor: "999px", clase: "rounded-full" },
  { nombre: "card-lg", uso: "Tarjetas grandes", valor: "16px", clase: "rounded-card-lg" },
  { nombre: "card", uso: "Tarjetas de producto", valor: "14px", clase: "rounded-card" },
  { nombre: "field", uso: "Campos de formulario", valor: "12px", clase: "rounded-field" },
  { nombre: "nav-mark", uso: "Monograma del nav (28px)", valor: "8px", clase: "rounded-nav-mark" },
  {
    nombre: "footer-mark",
    uso: "Monograma del pie (24px)",
    valor: "7px",
    clase: "rounded-footer-mark",
  },
] as const;

function Etiqueta({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
      {children}
    </div>
  );
}

export default function StyleguidePage() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-24 px-12 py-24">
      <header className="flex flex-col gap-2">
        <Etiqueta>Sonoro — referencia interna</Etiqueta>
        <h1 className="text-48 font-semibold tracking-[-0.025em]">Styleguide</h1>
        <p className="text-texto-secundario max-w-[620px] text-[17px]">
          Tokens de Tailwind traducidos de CLAUDE.md § Sistema visual. Página temporal, no forma
          parte del sitio público.
        </p>
      </header>

      {/* Color */}
      <section className="flex flex-col gap-6">
        <h2 className="text-26 font-semibold tracking-[-0.02em]">Color</h2>
        <div className="grid grid-cols-3 gap-4">
          {COLORES.map((c) => (
            <div
              key={c.nombre}
              className="border-borde-tarjeta rounded-card-lg overflow-hidden border"
            >
              <div
                className={`h-24 ${c.hex === "#FFFFFF" ? "border-borde-tarjeta border-b" : ""}`}
                style={{ background: c.hex }}
              />
              <div className="flex flex-col gap-1 p-4">
                <div className="text-[15px] font-semibold">{c.uso}</div>
                <div className="font-mono text-[12px] tracking-[0.06em]">
                  <span className="text-texto-secundario">--color-{c.nombre}</span>{" "}
                  <span className="text-texto-terciario">{c.hex}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tipografía */}
      <section className="flex flex-col gap-6">
        <h2 className="text-26 font-semibold tracking-[-0.02em]">Tipografía</h2>

        <div className="flex flex-col gap-4">
          <Etiqueta>Familias</Etiqueta>
          <div className="border-borde-tarjeta divide-borde-tarjeta rounded-card-lg flex flex-col divide-y border">
            <div className="flex items-center justify-between gap-8 p-6">
              <span className="font-sans text-[22px]">Cuerpo e interfaz — sonoro</span>
              <span className="text-texto-terciario font-mono text-[12px]">
                &apos;Helvetica Neue&apos;, Helvetica, Arial, sans-serif
              </span>
            </div>
            <div className="flex items-center justify-between gap-8 p-6">
              <span className="font-display text-[22px]">sonoro</span>
              <span className="text-texto-terciario font-mono text-[12px]">
                Bakbak One — solo logotipo
              </span>
            </div>
            <div className="flex items-center justify-between gap-8 p-6">
              <span className="font-mono text-[16px] tracking-[0.06em] uppercase">
                Q 2,450.00 — SKU
              </span>
              <span className="text-texto-terciario font-mono text-[12px]">
                JetBrains Mono — etiquetas, códigos, datos
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Etiqueta>Escala (titulares) — peso 600</Etiqueta>
          <div className="border-borde-tarjeta divide-borde-tarjeta rounded-card-lg flex flex-col divide-y border">
            {ESCALA.map((size) => (
              <div key={size} className="flex items-baseline gap-8 p-6">
                <span className="text-texto-terciario w-16 shrink-0 font-mono text-[12px]">
                  {size}px
                </span>
                <span
                  className="truncate font-semibold"
                  style={{ fontSize: `${size}px`, lineHeight: 1.05 }}
                >
                  Sonoro
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Radios */}
      <section className="flex flex-col gap-6">
        <h2 className="text-26 font-semibold tracking-[-0.02em]">Radios</h2>
        <div className="grid grid-cols-3 gap-4">
          {RADIOS.map((r) => (
            <div
              key={r.nombre}
              className="border-borde-tarjeta rounded-card-lg flex flex-col items-center gap-4 border p-6"
            >
              <div className={`bg-negro h-16 w-16 ${r.clase}`} />
              <div className="flex flex-col items-center gap-1 text-center">
                <div className="text-[15px] font-semibold">{r.uso}</div>
                <div className="text-texto-terciario font-mono text-[12px]">
                  --radius-{r.nombre} · {r.valor}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
