"use client";

import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useRef } from "react";
import { MathUtils, Vector3, type Group } from "three";

import { FRAME_HEIGHT, FRAME_RADIUS, MODEL_IDS, type ModelId } from "@/lib/models3d.ts";

import { anguloDelCiclo, type FaseCarrusel } from "./ciclo.ts";
import { ProductModel3D, preloadModel } from "./ProductModel3D";
import { RETURN_DURATION_MS, RETURN_EPSILON } from "./useIdleReturn";
import {
  AZIMUT_REPOSO,
  POLAR_MAX,
  POLAR_MIN,
  POLAR_REPOSO,
  SIN_PENDIENTE,
  ZOOM_DEFECTO,
  ZOOM_MAX,
  ZOOM_MIN,
  type GestoPendiente,
} from "./useRotateGesture";

const FOV = 32;
/** Margen alrededor del modelo más grande: 10%. */
const MARGEN = 1.1;
/** Duración del deslizamiento entre modelos. */
const TRANSICION_MS = 600;

/**
 * Constante del suavizado del zoom, en 1/s. La cámara no salta a la
 * distancia nueva: la persigue con un decaimiento exponencial, así que
 * cada muesca de la rueda se ve como un movimiento continuo y no como un
 * escalón. ~12 da una constante de tiempo de 80 ms: suave pero sin
 * sensación de retardo.
 */
const SUAVIZADO_ZOOM = 12;

/** Aire mínimo contra el borde redondeado del cuadro, en píxeles CSS. */
const MARGEN_BORDE_PX = 16;

const easeOutCubic = (k: number) => 1 - Math.pow(1 - k, 3);
const easeInOutCubic = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export interface CarouselCanvasProps {
  index: number;
  /** Dirección del último cambio de índice: +1 siguiente, −1 anterior. */
  direction: number;
  fase: FaseCarrusel;
  /** `performance.now()` de cuando empezó la fase actual. */
  faseInicio: number;
  /**
   * Espacio que ocupa el chrome del carrusel, en píxeles CSS: `v` es el
   * alto de las bandas de arriba y abajo (etiqueta, contador, flechas) y
   * `h` el ancho de los bloques de las esquinas. El encuadre los respeta
   * para que ningún modelo los roce.
   */
  chrome: { v: number; h: number };
  /** Incrementos del gesto, producidos por useRotateGesture. */
  pendienteRef: React.RefObject<GestoPendiente>;
  /** La cámara avisa que terminó de volver a la vista predeterminada. */
  alVolver: () => void;
  frameloop: "always" | "never";
}

/**
 * Un solo `<Canvas>` para todo el carrusel. No un Canvas por slide: el
 * navegador limita los contextos WebGL simultáneos y Safari es el más
 * restrictivo. La transición entre modelos ocurre dentro de la escena.
 */
export function CarouselCanvas(props: CarouselCanvasProps) {
  return (
    <Canvas
      frameloop={props.frameloop}
      // Techo en 2: en pantallas de DPR 3 el costo se triplica sin
      // ganancia perceptible a este tamaño de modelo.
      dpr={[1, 2]}
      camera={{ fov: FOV, near: 0.02, far: 20, position: [0, 0, 1] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      <Escena {...props} />
    </Canvas>
  );
}

/**
 * Encuadre del carrusel: distancia de reposo, topes de zoom y separación
 * entre slides.
 *
 * `FRAME_RADIUS` es el radio del CILINDRO que barre el modelo más grande
 * al girar sobre Y — medido sobre los vértices de los nueve .glb, no sobre
 * su caja. (`Box3.setFromObject` NO sirve: transforma la caja de cada
 * geometría en vez de sus vértices, así que sobre un modelo girado
 * devuelve una caja inflada por la diagonal, hasta √2 de más.)
 *
 * La distancia de encuadre depende de la pose, porque la órbita es libre
 * en los dos ejes: de canto hay que encuadrar la altura del modelo, pero
 * desde arriba hay que encuadrar su diámetro, dos veces y media más.
 *
 *   media altura en pantalla = R·|cos θ| + (H/2)·|sen θ|
 *   distancia ≥ media altura · margen / sen(fov vertical / 2)
 *
 * Se usa `sen` y no `tan` a propósito: es la tangente a la envolvente, no
 * su ancho en el plano del centro. Con `tan` el flanco queda fuera del
 * frustum.
 *
 * `gap` se calcula contra la distancia MÁXIMA a la que la cámara puede
 * llegar —la del polo o la del zoom más lejano, la que sea mayor— y contra
 * el lado más lejano del vecino, que es donde el frustum es más ancho. Si
 * solo contempla la pose de reposo, al alejarse con la rueda aparecen los
 * productos vecinos por los costados.
 *
 * Deliberadamente NO se usa `useThree().viewport`: r3f lo recalcula cuando
 * cambia el tamaño o el objeto cámara, no cuando la cámara se mueve.
 */
function useEncuadre(chrome: { v: number; h: number }) {
  const { size } = useThree();
  // En el PRIMER frame el canvas todavía mide 0×0. Sin este piso el
  // aspecto da 0, `sen(atan(0))` da 0 y la distancia sale infinita.
  const ancho = Math.max(size.width, 1);
  const alto = Math.max(size.height, 1);
  const aspecto = ancho / alto;
  const tanV = Math.tan(MathUtils.degToRad(FOV) / 2);
  const tanH = tanV * aspecto;
  const senV = Math.sin(Math.atan(tanV));
  const senH = Math.sin(Math.atan(tanH));

  const distanciaPara = (polar: number) => {
    const mediaAltura =
      FRAME_RADIUS * Math.abs(Math.cos(polar)) + (FRAME_HEIGHT / 2) * Math.abs(Math.sin(polar));
    return Math.max((mediaAltura * MARGEN) / senV, (FRAME_RADIUS * MARGEN) / senH);
  };

  /**
   * Distancia a la que el modelo más grande entra en un rectángulo dado,
   * expresado en píxeles CSS del canvas. Lo proyectado escala con 1/d, así
   * que reducir el área útil es multiplicar la distancia por cuánto se
   * redujo.
   */
  const encuadrarEn = (anchoUtil: number, altoUtil: number) => {
    const mediaAltura =
      FRAME_RADIUS * Math.abs(Math.cos(POLAR_REPOSO)) +
      (FRAME_HEIGHT / 2) * Math.abs(Math.sin(POLAR_REPOSO));
    const dV = ((mediaAltura * MARGEN) / senV) * (alto / Math.max(altoUtil, 1));
    const dH = ((FRAME_RADIUS * MARGEN) / senH) * (ancho / Math.max(anchoUtil, 1));
    return Math.max(dV, dH);
  };

  /**
   * El chrome vive en las ESQUINAS, no en barras completas, así que hay
   * dos maneras de no tocarlo y basta con cumplir una:
   *
   *   A. usar todo el ancho y quedarse fuera de las bandas de arriba y
   *      abajo — lo que manda en pantallas angostas, donde la etiqueta se
   *      come casi todo el ancho;
   *   B. usar todo el alto y quedarse en la columna central libre entre
   *      los bloques de las esquinas — lo que manda en escritorio, donde
   *      el cuadro es muy ancho y el producto nunca llega a las esquinas.
   *
   * Se toma la menos exigente de las dos. Con una sola regla, la A dejaría
   * el producto ridículamente chico en escritorio y la B sería imposible
   * de cumplir en móvil.
   */
  const rutaBandas = encuadrarEn(ancho - 2 * MARGEN_BORDE_PX, alto - 2 * chrome.v);
  const anchoColumna = ancho - 2 * chrome.h;
  const rutaColumna =
    anchoColumna > 40 ? encuadrarEn(anchoColumna, alto - 2 * MARGEN_BORDE_PX) : Infinity;
  const distanciaEncuadre = Math.min(rutaBandas, rutaColumna);
  // Acercarse más que el radio del modelo metería la cámara adentro.
  const distanciaMin = Math.max(FRAME_RADIUS * 1.05, distanciaEncuadre * ZOOM_MIN);
  const distanciaMax = distanciaEncuadre * ZOOM_MAX;
  // La vista predeterminada no es el encuadre justo sino el 85% del
  // acercamiento máximo: el producto entra más grande.
  const distanciaReposo = Math.min(
    Math.max(distanciaEncuadre * ZOOM_DEFECTO, distanciaMin),
    distanciaMax,
  );
  const distanciaTope = Math.max(distanciaPara(0), distanciaMax);
  const gap = tanH * (distanciaTope + FRAME_RADIUS) + FRAME_RADIUS + 0.05;

  return { distanciaReposo, distanciaMin, distanciaMax, gap, tanV, alto };
}

function Escena({
  index,
  direction,
  fase,
  faseInicio,
  chrome,
  pendienteRef,
  alVolver,
}: CarouselCanvasProps) {
  const total = MODEL_IDS.length;
  // Montaje: solo tres modelos (anterior, actual, siguiente). Los otros
  // seis quedan desmontados. El ancho de banda no es el límite; el límite
  // es memoria de GPU y draw calls.
  const anterior = MODEL_IDS[(index - 1 + total) % total];
  const actual = MODEL_IDS[index];
  const siguiente = MODEL_IDS[(index + 1) % total];

  // El azimut de la cámara, escrito por el rig y leído por el riel de
  // slides. Es un ref y no estado: cambia en cada frame.
  const azimutCamaraRef = useRef(0);

  // Precarga: los nueve, pero recién cuando el navegador está ocioso —
  // después de que el hero es interactivo. Asimetría deliberada frente al
  // montaje de tres.
  useEffect(() => {
    const precargar = () => MODEL_IDS.forEach(preloadModel);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(precargar, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(precargar, 1500);
    return () => clearTimeout(id);
  }, []);

  return (
    <>
      {/* Estudio construido con Lightformers, NO `preset="studio"`.
          El preset baja un HDR de ~1 MB desde raw.githack.com: un tercero
          en el critical path del home, justo lo que evitamos sirviendo el
          decoder de Draco en local. Acá el entorno se genera en la GPU con
          cuatro planos emisivos, sin una sola petición de red.

          `frames={1}` lo cocina una vez: la escena de luces no se mueve,
          así que no hay nada que recalcular después del primer frame. */}
      <Environment resolution={256} frames={1}>
        {/* Ciclorama. Es la perilla que más manda en cómo se ven los
            metales: un material metálico no tiene color difuso propio,
            devuelve el entorno, así que este gris ES el gris del aluminio.
            Demasiado oscuro y el producto se empasta en negro; demasiado
            claro —estaba en #bcbcc2— y el aluminio sale lavado y plano,
            casi sin contraste contra el fondo claro del cuadro.
            El contraste lo ponen los focos de abajo, no este gris: por eso
            conviene bajarlo y dejarlos brillantes, que es como se ilumina
            metal en un estudio de verdad. */}
        <color attach="background" args={["#8e8e94"]} />
        {/* Cenital ancha: el brillo largo que recorre las tapas metálicas. */}
        <Lightformer intensity={3.4} form="rect" position={[0, 6, 1]} scale={[12, 8, 1]} />
        {/* Principal, del lado de la cámara en la pose predeterminada
            (azimut 150° = cámara en +X/−Z). Si se pone en +Z el producto
            queda a contraluz y la cara que se ve cae en sombra. */}
        <Lightformer intensity={2.4} form="rect" position={[6, 3, -5]} scale={[9, 9, 1]} />
        {/* Relleno opuesto, para que el lado en sombra no se cierre. */}
        <Lightformer intensity={1.2} form="rect" position={[-7, 2, 4]} scale={[9, 9, 1]} />
        {/* Contra: despega el contorno del fondo claro del cuadro. */}
        <Lightformer intensity={1.5} form="ring" position={[-3, 4, 6]} scale={4} />
        {/* Piso oscuro. Sin él el metal refleja el mismo gris por arriba y
            por abajo y sale plano y lavado; con el piso aparece el
            degradado —claro arriba, oscuro abajo— que es lo que hace que
            se lea como metal y no como plástico gris. También baja el
            brillo general del producto, que era el pedido. */}
        <Lightformer
          intensity={1}
          color="#33333a"
          form="rect"
          position={[0, -5, 0]}
          scale={[14, 14, 1]}
        />
      </Environment>
      <directionalLight position={[1.6, 2, -1.2]} intensity={0.9} />
      <ambientLight intensity={0.15} />

      <Deslizador
        index={index}
        direction={direction}
        anterior={anterior}
        actual={actual}
        siguiente={siguiente}
        fase={fase}
        faseInicio={faseInicio}
        chrome={chrome}
        azimutCamaraRef={azimutCamaraRef}
      />

      {/* Sin shadow maps en tiempo real: una sombra de contacto sobre el
          plano de apoyo cuesta un render de baja resolución y alcanza. */}
      <ContactShadows
        position={[0, -FRAME_HEIGHT / 2, 0]}
        scale={FRAME_RADIUS * 6}
        blur={2.6}
        far={FRAME_HEIGHT}
        opacity={0.35}
        resolution={512}
      />

      <Camara
        fase={fase}
        index={index}
        chrome={chrome}
        pendienteRef={pendienteRef}
        azimutCamaraRef={azimutCamaraRef}
        alVolver={alVolver}
      />
    </>
  );
}

function Deslizador({
  index,
  direction,
  anterior,
  actual,
  siguiente,
  fase,
  faseInicio,
  chrome,
  azimutCamaraRef,
}: {
  index: number;
  direction: number;
  anterior: ModelId;
  actual: ModelId;
  siguiente: ModelId;
  fase: FaseCarrusel;
  faseInicio: number;
  chrome: { v: number; h: number };
  azimutCamaraRef: React.RefObject<number>;
}) {
  const { gap } = useEncuadre(chrome);

  // `t` va de 1 a 0 durante la transición. En 0 el modelo actual está
  // centrado y los vecinos, a un `gap` de distancia a cada lado.
  const t = useRef(0);
  const anguloRef = useRef(0);
  const grupoAnterior = useRef<Group>(null);
  const grupoActual = useRef<Group>(null);
  const grupoSiguiente = useRef<Group>(null);
  const inicio = useRef(0);

  useEffect(() => {
    t.current = 1;
    inicio.current = performance.now();
    // Solo depende del índice: cada cambio arranca una transición nueva.
  }, [index]);

  useFrame(() => {
    if (t.current > 0) {
      const k = Math.min((performance.now() - inicio.current) / TRANSICION_MS, 1);
      t.current = 1 - easeInOutCubic(k);
    }
    const d = t.current * direction;

    // Los vecinos van sobre el eje HORIZONTAL DE LA CÁMARA, no sobre el X
    // del mundo: así quedan siempre fuera de cuadro por los costados sea
    // cual sea el azimut.
    //
    // Antes esto se hacía rotando un grupo "riel" que contenía a los tres,
    // y era un error grave: al girar la cámara θ, el riel giraba θ y EL
    // MODELO GIRABA CON ELLA. Los dos giros se cancelaban y el producto
    // parecía inmóvil en horizontal, aunque la cámara sí estuviera
    // orbitando. Solo se notaba el eje vertical, que el riel no tocaba.
    // Colocando cada grupo por posición —sin rotar nada— el modelo
    // conserva su orientación en el mundo y el giro se ve.
    const az = azimutCamaraRef.current;
    const derechaX = Math.cos(az);
    const derechaZ = -Math.sin(az);
    const colocar = (g: Group | null, ranura: number) => {
      if (!g) return;
      const o = (ranura + d) * gap;
      g.position.set(derechaX * o, 0, derechaZ * o);
    };
    colocar(grupoAnterior.current, -1);
    colocar(grupoActual.current, 0);
    colocar(grupoSiguiente.current, 1);

    // Solo gira el modelo que está en cuadro; los vecinos esperan su turno
    // en la pose predeterminada.
    anguloRef.current = anguloDelCiclo(fase, performance.now() - faseInicio);
  });

  return (
    <>
      <group ref={grupoAnterior}>
        <Suspense fallback={null}>
          <ProductModel3D id={anterior} />
        </Suspense>
      </group>
      <group ref={grupoActual}>
        <Suspense fallback={null}>
          <ProductModel3D id={actual} anguloRef={anguloRef} />
        </Suspense>
      </group>
      <group ref={grupoSiguiente}>
        <Suspense fallback={null}>
          <ProductModel3D id={siguiente} />
        </Suspense>
      </group>
    </>
  );
}

/**
 * Rig de cámara. No usa `OrbitControls`.
 *
 * Toda la vista son cinco números —azimut, polar, distancia y el punto al
 * que mira— y la cámara se recoloca desde ellos en CADA frame. No hay
 * segunda autoridad sobre la cámara ni defaults de librería que puedan
 * pelearse con esto: los incrementos del gesto entran por `pendienteRef`,
 * se suman a la vista, se limitan, y se dibuja. El eje horizontal mueve el
 * azimut y el vertical el polar, sin ninguna rama que descarte uno de los
 * dos.
 *
 * La vuelta a reposo interpola los mismos cinco números.
 */
function Camara({
  fase,
  index,
  chrome,
  pendienteRef,
  azimutCamaraRef,
  alVolver,
}: {
  fase: FaseCarrusel;
  /** Cambiar de producto devuelve la vista a su pose predeterminada, de golpe. */
  index: number;
  chrome: { v: number; h: number };
  pendienteRef: React.RefObject<GestoPendiente>;
  azimutCamaraRef: React.RefObject<number>;
  alVolver: () => void;
}) {
  const { camera } = useThree();
  const { distanciaReposo, distanciaMin, distanciaMax, tanV, alto } = useEncuadre(chrome);

  const vista = useRef({
    azimut: AZIMUT_REPOSO,
    polar: POLAR_REPOSO,
    /** Distancia PEDIDA. La cámara la persigue suavizada. */
    distancia: distanciaReposo,
    /** Distancia con la que se dibuja: sigue a la pedida con inercia. */
    distanciaSuave: distanciaReposo,
    /** Punto al que mira la cámara. En reposo es el origen. */
    mira: new Vector3(),
  });
  const vuelta = useRef<{
    t0: number;
    azimut: number;
    polar: number;
    distancia: number;
    mira: Vector3;
  } | null>(null);
  /** La distancia de reposo depende del tamaño del canvas, que llega tarde. */
  const distanciaCalibrada = useRef(false);
  /**
   * Al cambiar de producto la vista vuelve a su pose predeterminada SIN
   * interpolar: el usuario pidió llegar al siguiente producto ya encuadrado,
   * y además la transición de deslizamiento ya está ocurriendo, así que un
   * segundo movimiento encima se leería como un tirón.
   */
  const indiceColocado = useRef(index);

  const derecha = useRef(new Vector3());
  const arriba = useRef(new Vector3());
  const aux = useRef(new Vector3());

  useFrame((_estado, delta) => {
    const v = vista.current;

    // El primer frame trae el canvas en 0×0 y una distancia de reposo que
    // no sirve: se adopta la buena en cuanto hay medidas reales.
    if (!distanciaCalibrada.current && alto > 1) {
      distanciaCalibrada.current = true;
      v.distancia = distanciaReposo;
      v.distanciaSuave = distanciaReposo;
    }

    if (indiceColocado.current !== index) {
      indiceColocado.current = index;
      v.azimut = AZIMUT_REPOSO;
      v.polar = POLAR_REPOSO;
      v.distancia = distanciaReposo;
      v.distanciaSuave = distanciaReposo;
      v.mira.set(0, 0, 0);
      vuelta.current = null;
      Object.assign(pendienteRef.current, SIN_PENDIENTE);
    }

    // --- incrementos del gesto
    const pend = pendienteRef.current;
    if (pend.dAzimut !== 0 || pend.dPolar !== 0) {
      v.azimut += pend.dAzimut;
      v.polar = MathUtils.clamp(v.polar + pend.dPolar, POLAR_MIN, POLAR_MAX);
    }
    if (pend.factorZoom !== 1) {
      v.distancia = MathUtils.clamp(v.distancia * pend.factorZoom, distanciaMin, distanciaMax);
    }
    if (pend.dPanX !== 0 || pend.dPanY !== 0) {
      // Píxeles → metros a la distancia actual, sobre los ejes de la
      // cámara del frame anterior, para que arrastrar mueva exactamente
      // lo que se ve.
      const metrosPorPx = (2 * v.distanciaSuave * tanV) / alto;
      derecha.current.setFromMatrixColumn(camera.matrix, 0);
      arriba.current.setFromMatrixColumn(camera.matrix, 1);
      v.mira
        .addScaledVector(derecha.current, -pend.dPanX * metrosPorPx)
        .addScaledVector(arriba.current, pend.dPanY * metrosPorPx);
    }
    Object.assign(pend, SIN_PENDIENTE);

    // --- vuelta a la vista predeterminada: los mismos cinco números
    if (fase === "volviendo") {
      if (!vuelta.current) {
        vuelta.current = {
          t0: performance.now(),
          azimut: v.azimut,
          polar: v.polar,
          distancia: v.distancia,
          mira: v.mira.clone(),
        };
      }
      const desde = vuelta.current;
      const e = easeOutCubic(Math.min((performance.now() - desde.t0) / RETURN_DURATION_MS, 1));
      // El azimut puede llevar varias vueltas acumuladas: el destino es la
      // vuelta equivalente más cercana, para que no desenrolle tres giros
      // completos de golpe.
      const destinoAz =
        AZIMUT_REPOSO + Math.round((desde.azimut - AZIMUT_REPOSO) / (2 * Math.PI)) * 2 * Math.PI;

      v.azimut = MathUtils.lerp(desde.azimut, destinoAz, e);
      v.polar = MathUtils.lerp(desde.polar, POLAR_REPOSO, e);
      v.distancia = MathUtils.lerp(desde.distancia, distanciaReposo, e);
      v.mira.copy(desde.mira).multiplyScalar(1 - e);

      if (
        Math.abs(v.azimut - destinoAz) < RETURN_EPSILON &&
        Math.abs(v.polar - POLAR_REPOSO) < RETURN_EPSILON &&
        Math.abs(v.distancia - distanciaReposo) < RETURN_EPSILON &&
        v.mira.length() < RETURN_EPSILON
      ) {
        v.azimut = destinoAz;
        v.polar = POLAR_REPOSO;
        v.distancia = distanciaReposo;
        v.mira.set(0, 0, 0);
        vuelta.current = null;
        alVolver();
      }
    } else {
      vuelta.current = null;
    }

    // La distancia dibujada persigue a la pedida con decaimiento
    // exponencial, en función del delta real: a 120 Hz tiene que tardar lo
    // mismo que a 60 Hz.
    v.distanciaSuave +=
      (v.distancia - v.distanciaSuave) * (1 - Math.exp(-SUAVIZADO_ZOOM * Math.min(delta, 0.1)));

    // --- colocar la cámara: esférica → cartesiana, alrededor de la mira
    const sinPol = Math.sin(v.polar);
    aux.current.set(
      v.distanciaSuave * sinPol * Math.sin(v.azimut),
      v.distanciaSuave * Math.cos(v.polar),
      v.distanciaSuave * sinPol * Math.cos(v.azimut),
    );
    camera.position.copy(v.mira).add(aux.current);
    camera.up.set(0, 1, 0);
    camera.lookAt(v.mira);
    camera.updateMatrix();

    azimutCamaraRef.current = v.azimut;
  });

  return null;
}
