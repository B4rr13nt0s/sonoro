// Lo que se ofrece mientras se teclea en /buscar: marcas, categorías y los
// primeros productos. Presentacional: el foco se queda en el campo (patrón
// combobox con aria-activedescendant) y quien manda sobre el teclado y la
// selección es SearchExperience.

export interface ItemSugerencia {
  id: string;
  tipo: "marca" | "categoria" | "producto" | "buscar";
  texto: string;
  /** Segunda línea: marca y código del producto. */
  detalle?: string;
  precio?: string;
  /** Sin `href`, elegirlo ejecuta la búsqueda. */
  href?: string;
}

const ETIQUETA_TIPO: Record<ItemSugerencia["tipo"], string> = {
  marca: "Marca",
  categoria: "Categoría",
  producto: "",
  buscar: "",
};

export function SugerenciasBusqueda({
  id,
  items,
  activo,
  alElegir,
}: {
  id: string;
  items: ItemSugerencia[];
  /** Posición de la opción marcada con las flechas; -1 si ninguna. */
  activo: number;
  alElegir: (item: ItemSugerencia) => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="Sugerencias de búsqueda"
      className="border-borde-tarjeta rounded-card absolute inset-x-0 top-full z-20 mt-2 overflow-hidden border bg-white"
    >
      {items.map((item, indice) => (
        <li
          key={item.id}
          id={`${id}-${indice}`}
          role="option"
          aria-selected={indice === activo}
          // El mousedown le quitaría el foco al campo antes del clic y la
          // lista se cerraría sin elegir nada.
          onMouseDown={(evento) => evento.preventDefault()}
          onClick={() => alElegir(item)}
          className={`hover:bg-fondo-alt flex cursor-pointer items-center justify-between gap-4 px-5 py-3 ${
            indice === activo ? "bg-fondo-alt" : ""
          } ${item.tipo === "buscar" ? "border-borde-tarjeta border-t" : ""}`}
        >
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15px]">{item.texto}</span>
            {item.detalle ? (
              <span className="text-texto-terciario truncate font-mono text-[11px]">
                {item.detalle}
              </span>
            ) : null}
          </span>
          {item.precio ? (
            <span className="flex-none text-[14px] font-semibold">{item.precio}</span>
          ) : ETIQUETA_TIPO[item.tipo] ? (
            <span className="text-texto-terciario flex-none font-mono text-[11px] tracking-[0.14em] uppercase">
              {ETIQUETA_TIPO[item.tipo]}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
