"use client";

// El panel de conversación (spec § Interfaz y § Flujo en la web). Lo baja el
// lanzador con import() al primer clic (PanelDiferido.ts), y la conversación
// NO vive acá: es del lanzador, que sigue montado al navegar. Este panel se
// desmonta (en /carrito, al cerrar) y al volver se reconstruye entero desde
// `conversacion`; lo único propio es lo efímero —el borrador, el
// placeholder, el catálogo ya cargado—, que puede perderse sin daño.
//
// En escritorio es una ventana junto al lanzador y la página sigue usable
// detrás (sin aria-modal). En móvil es la hoja inferior de FiltroMarca, con
// fondo, aria-modal y el foco atrapado.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as KeyboardEventReact,
  type RefObject,
} from "react";

import { BloqueChat } from "@/components/chat/BloqueChat";
import { useMediaQuery } from "@/components/home/useMediaQuery";
import type { ProductoBuscable } from "@/lib/busqueda/busqueda.ts";
import type { CatalogoChat } from "@/lib/chat/catalogo.ts";
import { necesitaCatalogo } from "@/lib/chat/motor.ts";
import {
  PLACEHOLDER_BUSCAR,
  PLACEHOLDER_CAMPO,
  colaDeRespuestas,
  conMensaje,
  conversacionInicial,
  crearContexto,
  mensajeAgregado,
  adoptar,
  prepararTexto,
  responderEnConversacion,
  resumenDeMensaje,
} from "@/lib/chat/panel.ts";
import {
  MAX_CONSULTA,
  type Contexto,
  type Conversacion,
  type Entrada,
  type OpcionId,
} from "@/lib/chat/tipos.ts";
import { nuevaConversacion, sendChatLog } from "@/lib/chatLog/index.ts";
import type { DatosVehiculos } from "@/lib/vehiculos/types.ts";

export interface PanelChatProps {
  conversacion: Conversacion | null;
  setConversacion: (conversacion: Conversacion) => void;
  // El panel arma su Contexto con el catálogo que carga; el layout solo sabe
  // los datos de contacto (variables de servidor).
  contacto: Contexto["contacto"];
  cargarCatalogo: () => Promise<CatalogoChat | null>;
  // «¿Qué le queda a mi carro?»: baja junto con el catálogo, no al abrir.
  cargarVehiculos: () => Promise<DatosVehiculos | null>;
  alCerrar: () => void;
  lanzadorRef: RefObject<HTMLButtonElement | null>;
}

/** El mismo corte que `lg:` (y que la hoja de FiltroMarca). */
const MEDIA_ESCRITORIO = "(min-width: 1024px)";

const ENFOCABLES =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SIN_PRODUCTOS: ReadonlyMap<string, ProductoBuscable> = new Map();

// La última conversación que escribió un panel, de este montaje o de uno
// anterior. Hace falta afuera del componente porque un envío puede
// responder DESPUÉS de que su panel se desmontó (se cerró o se fue a
// /carrito mientras bajaba el catálogo): esa respuesta tiene que sumarse a lo
// último y no pisar lo que el panel nuevo agregó entretanto, y el panel nuevo
// tiene que partir de ella aunque su render todavía no la traiga. Ver
// `adoptar` (lib/chat/panel.ts). Hay un solo lanzador por página, así que
// hay a lo sumo un panel vivo.
let ultimaGuardada: Conversacion | null = null;

export default function PanelChat({
  conversacion,
  setConversacion,
  contacto,
  cargarCatalogo,
  cargarVehiculos,
  alCerrar,
  lanzadorRef,
}: PanelChatProps) {
  // Primera apertura: el saludo y el menú, que no necesitan el catálogo.
  const [inicial] = useState(() => conversacion ?? conversacionInicial(nuevaConversacion()));
  const vista = conversacion ?? inicial;

  // Cada cambio parte de la conversación más reciente, no de la del render
  // que lo disparó: una respuesta llega después de un `await` (espera al
  // catálogo) y, leída del render viejo, perdería lo que se sumó mientras
  // tanto (otro envío, un «Has añadido…»).
  const propRef = useRef(vista);
  useEffect(() => {
    propRef.current = vista;
  }, [vista]);
  const leer = useCallback(() => adoptar(propRef.current, ultimaGuardada), []);
  const guardar = useCallback(
    (nueva: Conversacion) => {
      ultimaGuardada = nueva;
      setConversacion(nueva);
    },
    [setConversacion],
  );

  const esNueva = useRef(conversacion === null);
  useEffect(() => {
    if (!esNueva.current) return;
    esNueva.current = false;
    guardar(propRef.current);
  }, [guardar]);

  // La región en vivo anuncia solo la respuesta nueva del bot, resumida
  // (resumenDeMensaje): ni lo que escribió el cliente, ni las filas de
  // producto una por una, ni lo que ya estaba al abrir el panel.
  const [ultimoAlMontar] = useState(() => vista.mensajes.at(-1)?.id ?? -1);
  const ultimoBot = vista.mensajes.filter((m) => m.autor === "bot").at(-1);
  const anuncio = ultimoBot && ultimoBot.id > ultimoAlMontar ? resumenDeMensaje(ultimoBot) : null;

  // Solo lo que cargó bien: un fallo no se guarda, y el envío siguiente
  // vuelve a llamar al cargador, que reintenta (lib/chat/catalogo.ts).
  const [catalogo, setCatalogo] = useState<CatalogoChat | null>(null);
  useEffect(() => {
    // Al volver a montar (después de /carrito), las filas de producto del
    // historial necesitan el catálogo; el cargador ya lo tiene memoizado.
    let vivo = true;
    void cargarCatalogo().then((cargado) => {
      if (vivo && cargado) setCatalogo(cargado);
    });
    return () => {
      vivo = false;
    };
  }, [cargarCatalogo]);
  // El catálogo que ya hay, leído al enviar: las respuestas que no lo usan
  // (temas, «Hablar con Sonoro») salen con esto en vez de esperar a la red.
  const catalogoRef = useRef(catalogo);
  useEffect(() => {
    catalogoRef.current = catalogo;
  }, [catalogo]);
  // Los vehículos, con el mismo trato: solo lo que cargó bien se guarda, y se
  // leen al enviar. No hace falta un estado: ninguna fila del historial los usa.
  const vehiculosRef = useRef<DatosVehiculos | null>(null);
  const porSku = useMemo(
    () => (catalogo ? new Map(catalogo.productos.map((p) => [p.sku, p])) : SIN_PRODUCTOS),
    [catalogo],
  );

  const [borrador, setBorrador] = useState("");
  const [placeholder, setPlaceholder] = useState(PLACEHOLDER_CAMPO);
  const campoRef = useRef<HTMLInputElement>(null);
  const historialRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const escritorio = useMediaQuery(MEDIA_ESCRITORIO);

  const cerrar = useCallback(() => {
    alCerrar();
    lanzadorRef.current?.focus();
  }, [alCerrar, lanzadorRef]);

  // Al abrir, el foco va al campo.
  useEffect(() => {
    campoRef.current?.focus();
  }, []);

  // Esc cierra (el patrón de FiltroMarca). En escritorio la página sigue
  // usable detrás, así que solo cuenta con el foco en el panel o en el
  // lanzador: en /buscar, Esc en el campo de búsqueda limpia la consulta, y
  // no debe además cerrar el chat y llevarse el foco a la píldora.
  useEffect(() => {
    function alPresionarEscape(evento: KeyboardEvent) {
      if (evento.key !== "Escape" || evento.defaultPrevented) return;
      const foco = document.activeElement;
      const enElChat = panelRef.current?.contains(foco) === true || foco === lanzadorRef.current;
      if (escritorio && !enElChat) return;
      cerrar();
    }
    document.addEventListener("keydown", alPresionarEscape);
    return () => document.removeEventListener("keydown", alPresionarEscape);
  }, [cerrar, escritorio, lanzadorRef]);

  // Con un mensaje nuevo (o cuando llega el catálogo y aparecen las filas),
  // el historial baja hasta el final.
  const totalMensajes = vista.mensajes.length;
  useEffect(() => {
    const historial = historialRef.current;
    if (historial) historial.scrollTop = historial.scrollHeight;
  }, [totalMensajes, catalogo]);

  // Las respuestas salen en el orden en que se envió cada cosa: un tema no se
  // adelanta a una búsqueda que sigue esperando el catálogo (lib/chat/panel.ts).
  const [cola] = useState(colaDeRespuestas);

  async function enviar(entrada: Entrada, textoCliente: string) {
    guardar(conMensaje(leer(), { autor: "cliente", texto: textoCliente }));
    // Solo lo que muestra productos espera al catálogo (la promesa memoizada,
    // con su plazo). Un tema o «Hablar con Sonoro» no lo espera: sale con lo
    // que haya cargado, o sin catálogo, en cuanto no quede una respuesta
    // anterior pendiente.
    // Los vehículos bajan junto con el catálogo, en paralelo: ninguno espera
    // al otro, y un fallo de uno no tumba al otro (los dos resuelven null).
    const listos = necesitaCatalogo(entrada, leer().estado)
      ? Promise.all([cargarCatalogo(), cargarVehiculos()])
      : Promise.resolve([catalogoRef.current, vehiculosRef.current] as const);
    await cola.encolar(listos, ([cargado, vehiculos]) => {
      if (cargado) setCatalogo(cargado);
      if (vehiculos) vehiculosRef.current = vehiculos;
      const { conversacion: nueva, evento } = responderEnConversacion(
        leer(),
        entrada,
        crearContexto(cargado, vehiculos ?? vehiculosRef.current, contacto),
      );
      guardar(nueva);
      if (evento) sendChatLog(nueva.id, evento);
    });
  }

  function alEnviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const texto = prepararTexto(borrador);
    if (texto === null) return;
    setBorrador("");
    void enviar({ tipo: "texto", texto }, texto);
  }

  function enviarTexto(texto: string) {
    const listo = prepararTexto(texto);
    if (listo !== null) void enviar({ tipo: "texto", texto: listo }, listo);
  }

  function alOpcion(id: OpcionId, etiqueta: string) {
    if (id === "buscar") {
      setPlaceholder(PLACEHOLDER_BUSCAR);
      campoRef.current?.focus();
    }
    void enviar({ tipo: "opcion", id }, etiqueta);
  }

  function alWhatsapp(motivo: "hablar" | "disponibilidad") {
    sendChatLog(leer().id, { evento: "whatsapp", motivo });
  }

  function alAgregar(agregadas: number, sku: string) {
    guardar(mensajeAgregado(leer(), agregadas));
    sendChatLog(leer().id, { evento: "agregar", sku });
  }

  // En móvil la hoja tapa la página: al seguir un enlace interno se cierra,
  // o la navegación pasaría detrás sin que se vea. En escritorio la página
  // queda a la vista y el panel sigue abierto.
  const alNavegar = escritorio ? undefined : alCerrar;

  function atraparFoco(evento: KeyboardEventReact<HTMLDivElement>) {
    if (escritorio || evento.key !== "Tab") return;
    const enfocables = Array.from(evento.currentTarget.querySelectorAll<HTMLElement>(ENFOCABLES));
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (!primero || !ultimo) return;
    if (evento.shiftKey && document.activeElement === primero) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primero.focus();
    }
  }

  return (
    <>
      {/* Fondo de la hoja, solo < lg. */}
      <div
        className="bg-negro/40 fixed inset-0 z-40 lg:hidden"
        onClick={cerrar}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        id="panel-chat"
        role="dialog"
        aria-label="Preguntas"
        aria-modal={escritorio ? undefined : true}
        onKeyDown={atraparFoco}
        className="border-borde-tarjeta rounded-t-card-lg lg:rounded-card-lg fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col border-t bg-white pb-[max(1.75rem,env(safe-area-inset-bottom))] lg:right-6 lg:bottom-20 lg:left-auto lg:z-40 lg:h-[560px] lg:max-h-[calc(100dvh-104px)] lg:w-[380px] lg:border lg:pb-0"
      >
        <div className="border-borde-tarjeta flex flex-none items-center justify-between border-b py-1 pr-2 pl-5">
          <div className="flex items-baseline gap-2.5">
            <span className="text-[15px] font-semibold">Sonoro</span>
            <span className="text-texto-terciario font-mono text-[11px] tracking-[0.14em] uppercase">
              Preguntas
            </span>
          </div>
          <button
            type="button"
            onClick={cerrar}
            aria-label="Cerrar"
            className="text-texto-secundario flex h-11 w-11 items-center justify-center text-[22px]"
          >
            ×
          </button>
        </div>

        <div
          ref={historialRef}
          // Enfocable: se recorre con las flechas y, en escritorio, un clic en
          // el texto deja el foco adentro del panel, así que Esc lo cierra.
          tabIndex={0}
          role="region"
          aria-label="Conversación"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
        >
          {vista.mensajes.map((mensaje) =>
            mensaje.autor === "cliente" ? (
              <p
                key={mensaje.id}
                className="bg-fondo-alt rounded-card max-w-[85%] self-end px-3 py-2 text-[14px] break-words"
              >
                {mensaje.texto}
              </p>
            ) : (
              <div key={mensaje.id} className="flex flex-col gap-3">
                {mensaje.bloques.map((bloque, i) => (
                  <BloqueChat
                    key={i}
                    bloque={bloque}
                    porSku={porSku}
                    alOpcion={alOpcion}
                    alEnviarTexto={enviarTexto}
                    alWhatsapp={alWhatsapp}
                    alAgregar={alAgregar}
                    alNavegar={alNavegar}
                  />
                ))}
              </div>
            ),
          )}
        </div>

        {/* Un nodo por respuesta (key): dos respuestas con el mismo texto
            seguidas («Has añadido 1 ítem…») se anuncian las dos. */}
        <div aria-live="polite" className="sr-only">
          {anuncio && ultimoBot ? <p key={ultimoBot.id}>{anuncio}</p> : null}
        </div>

        <form
          onSubmit={alEnviar}
          className="border-borde-tarjeta flex flex-none gap-2 border-t px-4 py-3"
        >
          <input
            ref={campoRef}
            type="text"
            value={borrador}
            onChange={(evento) => setBorrador(evento.target.value)}
            maxLength={MAX_CONSULTA}
            placeholder={placeholder}
            aria-label="Tu pregunta"
            autoComplete="off"
            enterKeyHint="send"
            className="border-borde-pildora rounded-field min-w-0 flex-1 border px-3 py-2.5 text-[16px] lg:text-[14px]"
          />
          <button
            type="submit"
            className="bg-negro flex-none rounded-full px-4 text-[14px] text-white"
          >
            Enviar
          </button>
        </form>
      </div>
    </>
  );
}
