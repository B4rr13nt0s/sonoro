import Link from "next/link";

import { Monogram } from "./Monogram";

export function SiteFooter() {
  return (
    <footer className="border-borde-nav flex flex-col items-center gap-4 border-t px-6 py-10 text-center sm:flex-row sm:items-center sm:justify-between sm:px-12 sm:text-left">
      <Link href="/" className="flex items-center gap-[11px]">
        <Monogram className="rounded-footer-mark h-[34px] w-[34px]" />
        <span className="flex flex-col gap-0.5">
          <span className="font-display text-negro text-[21px] leading-[0.84] tracking-[-0.015em]">
            sonoro
          </span>
          <span className="text-texto-secundario font-mono text-[9px] leading-none tracking-[0.22em]">
            CAR AUDIO
          </span>
        </span>
      </Link>
      <span className="text-texto-terciario font-mono text-[11px]">
        Ciudad de Guatemala · Envíos a todo el país · +502 0000 0000
      </span>
    </footer>
  );
}
