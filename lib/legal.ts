// Las tres páginas legales, en un solo lugar: las enlazan el pie del sitio
// (components/layout/SiteFooter.tsx) y el cierre de cada página legal
// (components/legal/LegalPage.tsx), y tienen que ser las mismas.
export const ENLACES_LEGALES = [
  { href: "/legal/terminos", nombre: "Términos" },
  { href: "/legal/privacidad", nombre: "Privacidad" },
  { href: "/legal/garantias", nombre: "Garantías" },
] as const;
