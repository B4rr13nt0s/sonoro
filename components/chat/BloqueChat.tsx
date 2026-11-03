"use client";

// Un bloque de la respuesta del bot (lib/chat/tipos.ts → Bloque), dibujado.
// Los textos de `filtros` son los de /buscar (SearchExperience.tsx), tal
// cual: la búsqueda del chat es la misma y avisa lo mismo.
import Link from "next/link";

import { ProductoChat } from "@/components/chat/ProductoChat";
import { claseBoton } from "@/components/ui/boton.ts";
import type { ProductoBuscable } from "@/lib/busqueda/busqueda.ts";
import { productosDeSkus } from "@/lib/chat/catalogo.ts";
import { etiquetaVerTodos, textoFiltros, textoModo } from "@/lib/chat/panel.ts";
import type { Bloque, OpcionId } from "@/lib/chat/tipos.ts";
import { WHATSAPP_NUMBER, buildWhatsAppUrl } from "@/lib/whatsapp/index.ts";

export type BloqueChatProps = {
  bloque: Bloque;
  porSku: ReadonlyMap<string, ProductoBuscable>;
  alOpcion: (id: OpcionId, etiqueta: string) => void;
  /** Enviar un texto como si el cliente lo hubiera escrito (la corrección). */
  alEnviarTexto: (texto: string) => void;
  alWhatsapp: (motivo: "hablar" | "disponibilidad") => void;
  alAgregar: (agregadas: number, sku: string) => void;
  /** Al seguir un enlace interno (en móvil, cierra la hoja). */
  alNavegar?: () => void;
};

export function BloqueChat({
  bloque,
  porSku,
  alOpcion,
  alEnviarTexto,
  alWhatsapp,
  alAgregar,
  alNavegar,
}: BloqueChatProps) {
  switch (bloque.tipo) {
    case "texto":
      return (
        <p className="text-[14px] leading-relaxed">
          {bloque.texto}
          {bloque.enlace ? (
            <>
              {" "}
              <Link href={bloque.enlace.href} onNavigate={alNavegar} className="underline">
                {bloque.enlace.etiqueta}
              </Link>
              {bloque.enlace.despues}
            </>
          ) : null}
        </p>
      );

    case "filtros": {
      const filtros = textoFiltros(bloque.aplicados);
      const modo = textoModo(bloque.modo);
      return (
        <div className="text-texto-secundario flex flex-col gap-1 text-[14px] leading-relaxed">
          {filtros ? <p>{filtros}</p> : null}
          {modo ? (
            <p>
              {modo}
              {bloque.correccion ? (
                <>
                  {" "}
                  Quizá quisiste decir{" "}
                  <button
                    type="button"
                    onClick={() => alEnviarTexto(bloque.correccion ?? "")}
                    className="text-negro underline"
                  >
                    «{bloque.correccion}»
                  </button>
                  .
                </>
              ) : null}
            </p>
          ) : null}
        </div>
      );
    }

    case "productos": {
      const productos = productosDeSkus(bloque.skus, porSku);
      return (
        <div className="flex flex-col">
          {productos.map((producto) => (
            <ProductoChat
              key={producto.sku}
              producto={producto}
              datos={bloque.datos?.[producto.sku]}
              alAgregar={alAgregar}
              alNavegar={alNavegar}
            />
          ))}
          <div className="border-borde-tarjeta border-t pt-3">
            <Link
              href={bloque.verTodosHref}
              onNavigate={alNavegar}
              className="text-[14px] underline"
            >
              {etiquetaVerTodos(bloque.total)}
            </Link>
          </div>
        </div>
      );
    }

    case "opciones":
      return (
        <div className="flex flex-wrap gap-2">
          {bloque.opciones.map((opcion) => (
            <button
              key={opcion.id}
              type="button"
              onClick={() => alOpcion(opcion.id, opcion.etiqueta)}
              className="border-borde-pildora rounded-full border px-3 py-1.5 text-[13px]"
            >
              {opcion.etiqueta}
            </button>
          ))}
        </div>
      );

    case "whatsapp":
      return (
        <div className="flex">
          <a
            href={buildWhatsAppUrl(WHATSAPP_NUMBER, bloque.mensaje)}
            target="_blank"
            rel="noopener"
            onClick={() => alWhatsapp(bloque.motivo)}
            className={claseBoton("principal", "compacto")}
          >
            {bloque.etiqueta}
          </a>
        </div>
      );
  }
}
