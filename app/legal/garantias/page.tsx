import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/LegalPage";

const TITULO = "Garantías — Sonoro";
const DESCRIPCION = "Alcance y exclusiones de la garantía de fábrica en Sonoro.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/legal/garantias" },
  openGraph: { title: TITULO, description: DESCRIPCION, url: "/legal/garantias" },
};

export default function GarantiasPage() {
  return (
    <LegalPage
      etiqueta="Legal"
      titulo="Garantías"
      actualizado="Última actualización: 24 de agosto de 2026"
      secciones={[
        {
          titulo: "Alcance",
          parrafos: [
            "La garantía de Sonoro cubre únicamente desperfectos de fábrica: fallas de fabricación del producto, no daños ocurridos después de la venta.",
          ],
        },
        // Plazo de garantía: SIN DEFINIR (CLAUDE.md § Decisiones abiertas —
        // probablemente varía por marca, según lo que otorgue cada
        // fabricante). Insertar aquí, como una nueva sección
        // { titulo: "Plazo", parrafos: [...] } entre "Alcance" y "Qué
        // anula la garantía", el texto de duración en cuanto el negocio lo
        // confirme. Hasta entonces esta página describe alcance y
        // exclusiones sin plazo, a propósito — no se inventa un rango ni
        // una fecha.
        {
          titulo: "Qué anula la garantía",
          parrafos: [
            "La garantía se pierde si hay evidencia de mal uso del producto, o de una instalación incorrecta.",
            "Sonoro vende únicamente equipo: no instala ni asesora sobre cómo instalarlo. La instalación la hace el taller de tu preferencia, bajo su responsabilidad.",
          ],
        },
        {
          titulo: "Cómo reclamar",
          parrafos: [
            "Escríbenos por WhatsApp con el código del producto (el que aparece como «Código» en la ficha) y tu comprobante de compra. Sonoro gestiona la solución con el fabricante o distribuidor correspondiente.",
          ],
        },
        {
          titulo: "Cambios a esta página",
          parrafos: [
            "Esta página puede actualizarse conforme se confirmen condiciones adicionales de garantía. La fecha de la última actualización aparece al inicio de esta página.",
          ],
        },
      ]}
    />
  );
}
