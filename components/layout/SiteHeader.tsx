"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Monogram } from "./Monogram";

// CLAUDE.md § Rutas: "Las seis categorías del nav son: Bocinas, Subwoofers,
// Amplificadores, Receptores, Kits, Insonorización." — coincide con
// data/taxonomy.json y con las categorías reales del catálogo importado.
const CATEGORIAS = [
  { slug: "bocinas", nombre: "Bocinas" },
  { slug: "subwoofers", nombre: "Subwoofers" },
  { slug: "amplificadores", nombre: "Amplificadores" },
  { slug: "receptores", nombre: "Receptores" },
  { slug: "kits", nombre: "Kits" },
  { slug: "insonorizacion", nombre: "Insonorización" },
] as const;

const ENLACES_SECUNDARIOS = [
  { href: "/marcas", nombre: "Marcas" },
  { href: "/nosotros", nombre: "Nosotros" },
  { href: "/buscar", nombre: "Buscar" },
] as const;

// Sin carrito implementado todavía (lib/cart/ vacío) — 0 hasta que exista
// estado real. El contador solo se dibuja cuando hay artículos.
const CART_ITEM_COUNT = 0;

function esEnlaceActivo(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrarMenu = () => setMenuAbierto(false);

  return (
    <header className="border-borde-nav sticky top-0 z-40 border-b bg-white">
      <div className="mx-auto flex h-15 max-w-[1280px] items-center gap-10 px-6 sm:px-12">
        <Link href="/" className="flex flex-none items-center" onClick={cerrarMenu}>
          <Monogram className="rounded-nav-mark h-8 w-8" />
        </Link>

        <nav className="hidden items-center gap-[30px] text-[13px] lg:flex">
          {CATEGORIAS.map((categoria) => {
            const href = `/catalogo/${categoria.slug}`;
            const activo = esEnlaceActivo(pathname, href);
            return (
              <Link
                key={categoria.slug}
                href={href}
                className={
                  activo ? "text-negro font-medium" : "text-texto-nav hover:text-texto-secundario"
                }
              >
                {categoria.nombre}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto hidden items-center gap-[22px] text-[13px] lg:flex">
          {ENLACES_SECUNDARIOS.map((enlace) => {
            const activo = esEnlaceActivo(pathname, enlace.href);
            return (
              <Link
                key={enlace.href}
                href={enlace.href}
                className={
                  activo ? "text-negro font-medium" : "text-texto-nav hover:text-texto-secundario"
                }
              >
                {enlace.nombre}
              </Link>
            );
          })}
          <CartLink />
        </div>

        <div className="ml-auto flex items-center gap-4 lg:hidden">
          <CartLink />
          <button
            type="button"
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuAbierto}
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            className="flex h-8 w-8 flex-none items-center justify-center"
          >
            <MenuIcon abierto={menuAbierto} />
          </button>
        </div>
      </div>

      {menuAbierto ? (
        <div className="fixed inset-x-0 top-15 bottom-0 z-30 overflow-y-auto bg-white px-6 py-6 lg:hidden">
          <nav className="flex flex-col">
            {CATEGORIAS.map((categoria) => {
              const href = `/catalogo/${categoria.slug}`;
              const activo = esEnlaceActivo(pathname, href);
              return (
                <Link
                  key={categoria.slug}
                  href={href}
                  onClick={cerrarMenu}
                  className={`border-borde-tarjeta border-b py-4 text-[17px] ${
                    activo ? "text-negro font-medium" : "text-negro"
                  }`}
                >
                  {categoria.nombre}
                </Link>
              );
            })}
          </nav>
          <nav className="mt-6 flex flex-col">
            {ENLACES_SECUNDARIOS.map((enlace) => {
              const activo = esEnlaceActivo(pathname, enlace.href);
              return (
                <Link
                  key={enlace.href}
                  href={enlace.href}
                  onClick={cerrarMenu}
                  className={`border-borde-tarjeta border-b py-4 text-[15px] ${
                    activo ? "text-negro font-medium" : "text-texto-secundario"
                  }`}
                >
                  {enlace.nombre}
                </Link>
              );
            })}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

function CartLink() {
  return (
    <Link href="/carrito" className="bg-negro rounded-full px-4 py-[7px] text-[13px] text-white">
      Carrito
      {CART_ITEM_COUNT > 0 ? (
        <span className="text-texto-sobre-negro"> {CART_ITEM_COUNT}</span>
      ) : null}
    </Link>
  );
}

function MenuIcon({ abierto }: { abierto: boolean }) {
  if (abierto) {
    return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="M4 4L16 16M16 4L4 16" stroke="#0B0B0C" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 5H17M3 10H17M3 15H17" stroke="#0B0B0C" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
