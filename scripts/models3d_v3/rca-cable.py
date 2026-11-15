"""
Sonoro — categoría "accesorios" (rca-cable), versión 3.
Rollo redondo de par trenzado rojo/negro, apoyado en el piso, con las dos
puntas abiertas en Y y un macho RCA en cada conductor.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/rca-cable.py

    rollo      3.55 vueltas en dos capas: 2 en el piso (espiral plana, radio
               de la espina de 0.062 a 0.037) y 1.55 montadas encima
    cables     2 conductores de 0.006 de diámetro, trenzados entre sí
    trenzado   paso de 0.060 por vuelta completa, en todo el rollo
    puntas     0.085 fuera del rollo, en el piso: 0.010 trenzados, 0.035 en
               los que el trenzado se desarma y 0.040 en los que los dos
               conductores se separan a 0.022 entre ejes
    conectores 4 machos RCA de 0.0535 de largo x 0.0136 de diámetro

Decisiones que vienen de la v1 y se conservan:

  - los dos conductores son dos hélices alrededor de una espina común,
    desfasadas 180 grados y con radio de hélice igual al radio del cable:
    se tocan sin interpenetrarse;
  - el ángulo del trenzado se integra contra la LONGITUD DE ARCO, no contra
    el índice del paso (si no, el trenzado sale más apretado en las curvas);
  - en cada punta el trenzado se desarma y la fase se lleva al múltiplo de
    2*pi más cercano, para que los conductores se separen en HORIZONTAL y
    los conectores queden lado a lado.

Las puntas salen hacia −Y. `finalize(front="-Y")` las gira hacia la cámara.

Qué cambió en la v3 respecto de la v1
-------------------------------------
  - Normales: la v1 tenía TODAS las aristas duras, y los conductores de 8
    lados se veían octogonales. Ahora los tubos son suaves (ver
    `swept_tube` en _common.py).
  - Conductores en cable-red y cable-black, con el brillo de PVC de los
    cables del kit de instalación (antes rugosidad 0.9, casi sin brillo).
  - Sin cincho: el aro que rodeaba el haz se quitó a pedido.

Qué cambia en rca-cable-4 (noviembre de 2026)
---------------------------------------------
A pedido del negocio, la ESTRUCTURA se toma de la foto de un cable RCA real
(un rollo redondo sujeto con dos cinchos, las puntas abiertas en Y y los
cuatro machos acostados junto al rollo). Solo la estructura: los materiales
son los de la paleta y no lleva logo ni texto. Dos cosas de la foto NO se
tomaron, por decisión del negocio: los cinchos (ya se habían quitado) y las
~5 vueltas (quedó en 3: con más se leía como un rollo de varios metros, y
no entra en el presupuesto de peso).

  - ROLLO REDONDO Y EN DOS CAPAS. Hasta rca-cable-3 era una pista ovalada
    de 2 vueltas con 13 mm de aire entre una y otra. Ahora las vueltas se
    apoyan: dos en el piso, pegadas, y el resto montado encima, como las
    madejas del kit (mismo trazado que coil_path de install-kit.py; acá la
    «sección» que se apila es la envolvente del par trenzado, 12 mm).
  - NADA EN EL AIRE. Las dos puntas cruzaban el rollo a 30 mm de altura y
    los cuatro conectores quedaban flotando a esa altura. Ahora las puntas
    salen por el piso y los conectores descansan acostados. Donde el
    trenzado se desarma, la espina baja lo justo para que el conductor de
    abajo siga tocando el piso, y recién en los últimos 25 mm sube al eje
    del conector.
  - LAS DOS PUNTAS SALEN HACIA ADELANTE y terminan juntas, sin cruzarse:
    una baja por el costado del rollo y la otra sale por delante en
    diagonal. Es la composición de siempre («los cuatro machos saliendo
    juntos por un extremo»), ahora en el piso. La foto las deja en L, una
    cruzada por delante de la otra; con un rollo de este tamaño y puntas de
    este largo la L no entra sin que los conectores se toquen (se barrieron
    486 disposiciones; ver MIN_GAP y plug_clearances).
  - CONECTORES rehechos: bota lisa que se afina hacia el cable, cuerpo con
    la ventana ovalada de agarre, collar, casquillo y espiga con punta.
    Antes: bota de cinco anillos, cuerpo con seis nervaduras y falda cónica.
    La bota va ahora del color del cuerpo, no del conductor.
  - Verificaciones nuevas, que cortan el export: ningún tramo del rollo se
    atraviesa ni queda en el aire (como en el kit), ningún conductor se
    mete en otro, y los conectores guardan distancia entre sí y del rollo.
"""

import math
import os
import sys


def _locate_common():
    """Sirve headless (--python) y desde el Text Editor de Blender."""
    cands = [os.path.dirname(os.path.abspath(__file__)), os.getcwd(),
             os.path.join(os.getcwd(), "scripts", "models3d_v3")]
    try:
        import bpy
        for t in bpy.data.texts:
            if t.filepath:
                cands.append(os.path.dirname(os.path.abspath(bpy.path.abspath(t.filepath))))
    except Exception:
        pass
    for d in cands:
        if os.path.isfile(os.path.join(d, "_common.py")):
            return d
    raise RuntimeError("no encuentro _common.py de scripts/models3d_v3")


sys.path.insert(0, _locate_common())
import importlib                                            # noqa: E402
import _common                                              # noqa: E402
importlib.reload(_common)   # Blender cachea los módulos entre corridas
from _common import *       # noqa: F401,F403,E402
from mathutils.kdtree import KDTree                         # noqa: E402

ARCHIVO = "rca-cable-4"

# ------------------------------------------------------------ parametros ----

CABLE_R = 0.0030            # 6 mm de diametro por conductor
PAIR_R = 2.0 * CABLE_R      # radio de la envolvente del par trenzado
SIDES = 8                   # lados de la seccion barrida
STEP = 0.0055               # paso de muestreo sobre la espina, en metros

TWIST_PITCH = 0.0600        # avance por vuelta completa del trenzado

# Rollo: radio de la espina en la vuelta de afuera de la capa del piso,
# vueltas de la capa del piso (entero) y de la de arriba, y angulo (grados)
# donde entra la punta A. La punta B sale en THETA0 + 360 x la fraccion de
# COIL_TOP. Con 330 y 0.55, A sale por delante a la derecha y cruza en
# diagonal hacia la izquierda, y B baja por el costado izquierdo: las dos
# puntas terminan juntas adelante, sin cruzarse.
COIL_R = 0.0620
COIL_BOTTOM = 2
COIL_TOP = 1.55
COIL_THETA0 = 330.0

# Separacion entre dos vueltas vecinas del piso y distancia entre una vuelta
# y la que la sostiene, en diametros de la envolvente del par.
PITCH = 1.05
REST = 1.02
# Aire maximo bajo un tramo del rollo, en diametros de la envolvente.
SUPPORT_MAX = 0.12

# Puntas: tramo trenzado, tramo en que el trenzado se desarma, tramo en que
# los conductores se separan y, dentro de este, la subida final al conector.
TAIL_RUN = 0.0100
UNTWIST_LEN = 0.0350
SPREAD_LEN = 0.0400
RISE_LEN = 0.0250
SPLIT_R = 0.0110            # radio de helice en la punta -> 22 mm entre ejes
TAIL_LEN = TAIL_RUN + UNTWIST_LEN + SPREAD_LEN
SPLAY_A = 0.0               # cuanto se abre cada punta hacia afuera, grados
SPLAY_B = 0.0

PLUG_R = 0.0068             # radio del cuerpo del conector
PLUG_LEN = 0.0535
# giro de cada conector sobre su eje (grados): la ventana no mira igual en
# los cuatro, como quedan al soltarlos sobre una mesa
PLUG_ROLL = {"red-a": -16.0, "black-a": 12.0, "red-b": 20.0, "black-b": -9.0}
MIN_GAP = 0.0050            # aire minimo entre conectores, y entre conector y rollo


# ------------------------------------------------------------- utilidades ---

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def frames(points):
    """Tangente, perpendicular horizontal y normal para cada punto."""
    out = []
    for i, p in enumerate(points):
        if i == 0:
            tan = points[1] - points[0]
        elif i == len(points) - 1:
            tan = points[-1] - points[-2]
        else:
            tan = points[i + 1] - points[i - 1]
        tan.normalize()
        side = Vector((-tan.y, tan.x, 0.0))
        if side.length < 1e-6:
            side = Vector((1.0, 0.0, 0.0))
        side.normalize()
        up = side.cross(tan).normalized()
        out.append((p, tan, side, up))
    return out


def arc_lengths(points):
    out = [0.0]
    for i in range(1, len(points)):
        out.append(out[-1] + (points[i] - points[i - 1]).length)
    return out


def resample(points, step):
    """Remuestrea una polilinea densa a paso uniforme de arco (~step)."""
    arcs = arc_lengths(points)
    total = arcs[-1]
    n = max(2, int(round(total / step)))
    out, j = [], 0
    for k in range(n + 1):
        s = total * k / n
        while j < len(arcs) - 2 and arcs[j + 1] < s:
            j += 1
        seg = arcs[j + 1] - arcs[j]
        out.append(points[j].lerp(points[j + 1], 0.0 if seg < 1e-12 else (s - arcs[j]) / seg))
    return out


def round_up(values, sigma, where=None):
    """
    Redondea los picos hacia ARRIBA: el maximo entre la curva y su version
    suavizada (gaussiana de `sigma` muestras). Un cable no dobla en angulo,
    y asi nunca queda por debajo de donde tiene que apoyar.
    """
    half = int(3.0 * sigma) + 1
    kernel = [math.exp(-0.5 * (k / sigma) ** 2) for k in range(-half, half + 1)]
    norm = sum(kernel)
    n = len(values)
    out = []
    for i in range(n):
        if where is not None and not where[i]:
            out.append(values[i])
            continue
        acc = sum(kernel[k + half] * values[min(n - 1, max(0, i + k))]
                  for k in range(-half, half + 1))
        out.append(max(values[i], acc / norm))
    return out


# ---------------------------------------------------------------- espina ----

def build_spine():
    """
    Espina del par trenzado: punta A + rollo en dos capas + punta B, ya
    muestreada a paso ~STEP. El trazado es el de coil_path() de
    install-kit.py, con la envolvente del par (PAIR_R) como «cable»:

      punta A   en el piso; entra por afuera, tangente a la primera vuelta
      piso      COIL_BOTTOM vueltas en espiral plana hacia adentro
      arriba    COIL_TOP vueltas: el par sube por el costado de adentro,
                cruza la espiral en diagonal montado sobre las vueltas del
                piso y baja al piso por afuera
      punta B   en el piso, sale por afuera

    La capa de arriba se describe con una coordenada c, en vueltas del piso
    contadas desde la espiral prolongada hacia adentro (c entero = encima de
    una vuelta, c + 1/2 = en la ranura); su ALTURA no se dibuja, se calcula
    apoyándola sobre lo que tiene debajo. Ver el docstring de coil_path()
    en install-kit.py para el detalle y los límites.
    """
    bottom, top = COIL_BOTTOM, COIL_TOP
    whole = int(math.floor(top))
    frac = top - whole
    if whole < 1 or frac < 0.05:
        raise ModelError("build_spine: COIL_TOP necesita al menos una vuelta entera "
                         "y una fracción para bajar al piso")
    total = bottom + top
    D = 2.0 * PAIR_R * PITCH
    Dr = 2.0 * PAIR_R * REST
    c_seam = whole + bottom - 1 + 0.2       # encima de la vuelta de más afuera
    c_end = whole + bottom + 1              # en el piso, por afuera
    ease = 0.15
    rate = c_seam / (whole - ease / 2.0)
    th0 = math.radians(COIL_THETA0)

    def pack(g):
        if g <= ease:                       # arranca sin tirón
            return rate * g * g / (2.0 * ease)
        if g <= whole:
            return rate * (g - ease / 2.0)
        u = min(1.0, (g - whole) / frac)    # Hermite: llega al piso sin pendiente
        u2, u3 = u * u, u * u * u
        return ((2.0 * u3 - 3.0 * u2 + 1.0) * c_seam + (u3 - 2.0 * u2 + u) * frac * rate
                + (3.0 * u2 - 2.0 * u3) * c_end)

    def plan(t):
        th = th0 + 2.0 * math.pi * t
        c = pack(t - bottom) if t > bottom else 0.0
        # óvalo leve, igual para todas las vueltas: no cambia la separación
        rr = COIL_R * (1.0 + 0.03 * math.sin(2.0 * th + 0.7)) + D * (c - t)
        return rr * math.cos(th), rr * math.sin(th)

    def tail(t_end, sense, length, splay):
        """
        Cola en planta desde la punta del rollo (t_end), cada 0.25 mm.
        `sense` es +1 si sale hacia adelante (punta B) y −1 si sale hacia
        atrás (punta A). Continua en dirección y en curvatura con el rollo:
        la curvatura de la vuelta se apaga en el primer quinto y una campana
        de curvatura en sentido contrario la abre `splay` grados hacia afuera.
        """
        h = 0.002
        p0, p1, p2 = (Vector(plan(t_end - sense * k * h) + (0.0,)) for k in range(3))
        heading = math.atan2(p0.y - p1.y, p0.x - p1.x)
        a1, a2, chord = p1 - p2, p0 - p1, p0 - p2
        k_coil = 2.0 * (a1.x * a2.y - a1.y * a2.x) / (a1.length * a2.length * chord.length)
        fade = 0.20 * length
        bell = 0.75 * length
        turn = -math.copysign(math.radians(splay), k_coil) - k_coil * fade / 2.0
        k_out = 2.0 * turn / bell
        ds = 0.00025
        x, y = p0.x, p0.y
        pts = []
        for i in range(1, int(round(length / ds)) + 1):
            s = i * ds
            k = k_coil * (1.0 - smoothstep(s / fade))
            if s < bell:
                k += k_out * math.sin(math.pi * s / bell) ** 2
            heading += k * ds
            x += math.cos(heading) * ds
            y += math.sin(heading) * ds
            pts.append((x, y))
        return pts

    # --- lo que está en el piso: la punta A y la espiral de abajo ----------
    fine = 480
    tail_a = tail(0.0, -1.0, TAIL_LEN, SPLAY_A)
    lower = [(x, y, -(i + 1) * 0.00025 / (2.0 * math.pi * COIL_R))
             for i, (x, y) in enumerate(tail_a)]
    lower += [plan(i / fine) + (i / fine,) for i in range(bottom * fine + 1)]
    tree = KDTree(len(lower))
    for i, (x, y, _t) in enumerate(lower):
        tree.insert(Vector((x, y, 0.0)), i)
    tree.balance()

    # --- altura de la capa de arriba: apoyada en lo de abajo ---------------
    n_top = int(round(top * fine))
    env = []
    for i in range(n_top + 1):
        t = bottom + top * i / n_top
        x, y = plan(t)
        best = None
        for (_co, j, d) in tree.find_range(Vector((x, y, 0.0)), Dr):
            # media vuelta de recorrido para atrás es el mismo tramo, no apoyo
            if t - lower[j][2] > 0.5 and (best is None or d < best):
                best = d
        env.append(0.0 if best is None else math.sqrt(max(0.0, Dr * Dr - best * best)))
    step = 2.0 * math.pi * (COIL_R - D * bottom / 2.0) / fine
    lift = round_up(env, 0.8 * 2.0 * PAIR_R / step)

    dense = [Vector((x, y, PAIR_R)) for (x, y) in reversed(tail_a)]
    dense += [Vector(plan(i / fine) + (PAIR_R,)) for i in range(bottom * fine + 1)]
    dense += [Vector(plan(bottom + top * i / n_top) + (PAIR_R + lift[i],))
              for i in range(1, n_top + 1)]
    # la punta B termina de asentarse en el piso con un perfil coseno
    tail_b = tail(total, 1.0, TAIL_LEN, SPLAY_B)
    z0 = dense[-1].z
    for i, (x, y) in enumerate(tail_b, 1):
        u = min(1.0, i / (0.4 * len(tail_b)))
        dense.append(Vector((x, y, PAIR_R + (z0 - PAIR_R) * 0.5 * (1.0 + math.cos(math.pi * u)))))
    return resample(dense, STEP)


# -------------------------------------------------------------- trenzado ----

def twist_profile(spine):
    """
    Ángulo y radio de hélice a lo largo de la espina, y la espina con la
    altura corregida en las puntas.

    En el rollo el par va trenzado y su espina queda a PAIR_R del piso: el
    par descansa en el conductor que en cada medio paso queda abajo. En cada
    punta pasan tres cosas, de adentro hacia afuera:

      1. el trenzado se desarma (UNTWIST_LEN): la tasa de giro cae a cero y
         la fase se lleva al múltiplo de 2*pi más cercano, así los dos
         conductores quedan lado a lado. Mientras tanto la espina baja lo
         justo para que el conductor de abajo siga tocando el piso;
      2. los conductores se separan (SPREAD_LEN) hasta SPLIT_R, los dos
         acostados en el piso;
      3. en los últimos RISE_LEN suben al eje del conector, que descansa
         acostado sobre su cuerpo.
    """
    arcs = arc_lengths(spine)
    total = arcs[-1]
    rho1, rho2, rho3 = [], [], []
    for s in arcs:
        e = min(s, total - s)
        rho1.append(smoothstep((SPREAD_LEN + UNTWIST_LEN - e) / UNTWIST_LEN))
        rho2.append(smoothstep((SPREAD_LEN - e) / SPREAD_LEN))
        rho3.append(smoothstep((RISE_LEN - e) / RISE_LEN))

    rate = 2.0 * math.pi / TWIST_PITCH
    angles = [0.0]
    for i in range(1, len(arcs)):
        k = 1.0 - (rho1[i] + rho1[i - 1]) / 2.0
        angles.append(angles[-1] + rate * k * (arcs[i] - arcs[i - 1]))
    snap_b = 2.0 * math.pi * round(angles[-1] / (2.0 * math.pi))

    profile, target = [], []
    for i, ang in enumerate(angles):
        snap = 0.0 if arcs[i] < total / 2.0 else snap_b
        a = ang + rho1[i] * (snap - ang)
        rad = CABLE_R + (SPLIT_R - CABLE_R) * rho2[i]
        profile.append((a, rad))
        resting = CABLE_R + rad * abs(math.sin(a))   # conductor de abajo en el piso
        target.append(spine[i].z + rho1[i] * (resting - spine[i].z))
    z = round_up(target, 1.2, where=[r > 0.0 for r in rho1])
    fixed = [Vector((p.x, p.y, z[i] + (PLUG_R - CABLE_R) * rho3[i]))
             for i, p in enumerate(spine)]
    return fixed, arcs, profile


def build_strand(name, fr, profile, phase, material_):
    path = []
    for (p, _tan, side, up), (ang, rad) in zip(fr, profile):
        a = ang + phase
        q = p + side * (rad * math.cos(a)) + up * (rad * math.sin(a))
        q.z = max(q.z, CABLE_R)               # nunca bajo el piso
        path.append(q)
    obj = swept_tube(name, [tuple(q) for q in path], CABLE_R, sides=SIDES,
                     material=material_)
    return obj, path


# ------------------------------------------------------------ conectores ----

def build_plug(tag, origin, direction, body_mat):
    """
    Macho RCA acostado, coaxial con la punta del conductor. Se construye
    sobre el eje Z local (z = 0 es la punta del conductor) y después se
    lleva a su lugar:

      bota      lisa, se afina hacia el cable (z −2 a 14 mm)
      cuerpo    13.6 mm de diámetro x 22 mm, con la ventana ovalada de
                agarre hundida 1.8 mm arriba
      collar    cromado, 12 x 3 mm
      casquillo cromado, 8.4 x 8 mm
      espiga    3.2 mm de diámetro, asoma 4.5 mm del casquillo y termina
                en punta
    """
    d = Vector((direction.x, direction.y, 0.0)).normalized()   # acostado
    M = (Matrix.Translation(Vector(origin))
         @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
         @ Matrix.Rotation(math.radians(PLUG_ROLL[tag]), 4, "Z"))
    # arriba del mundo, en coordenadas locales del conector
    up = (M.to_3x3().inverted() @ Vector((0.0, 0.0, 1.0))).normalized()

    def lay(obj):
        obj.data.transform(M)
        obj.data.update()
        return obj

    boot = cone("plug-boot-%s" % tag, CABLE_R + 0.0006, 0.0058, 0.0160, segments=16,
                location=(0.0, 0.0, 0.0060), material=body_mat)
    body = cylinder("plug-body-%s" % tag, PLUG_R, 0.0220, segments=20,
                    location=(0.0, 0.0, 0.0250), material=body_mat)
    bevel(body, 0.0012, segments=2)
    # ventana: un elipsoide que muerde 1.8 mm el lado de arriba
    cutter = sphere("plug-window-cutter", 1.0, segments=14, rings=7)
    side = up.cross(Vector((0.0, 0.0, 1.0))).normalized()
    basis = Matrix((side * 0.0038, up * 0.0026, Vector((0.0, 0.0, 0.0076)))).transposed()
    cutter.data.transform(Matrix.Translation(up * (PLUG_R + 0.0008) + Vector((0.0, 0.0, 0.0250)))
                          @ basis.to_4x4())
    cutter.data.update()
    boolean(body, cutter)
    parts = [
        lay(boot),
        lay(body),
        lay(cylinder("plug-collar-%s" % tag, 0.0060, 0.0030, segments=20,
                     location=(0.0, 0.0, 0.0375), material=chrome())),
        lay(cylinder("plug-shell-%s" % tag, 0.0042, 0.0080, segments=16,
                     location=(0.0, 0.0, 0.0430), material=chrome())),
        lay(cylinder("plug-pin-%s" % tag, 0.0016, 0.0125, segments=12,
                     location=(0.0, 0.0, 0.04525), material=chrome())),
        lay(cone("plug-tip-%s" % tag, 0.0016, 0.0009, 0.0020, segments=12,
                 location=(0.0, 0.0, 0.0525), material=chrome())),
    ]
    axis = [Vector(origin) + d * (PLUG_LEN * k / 10.0) for k in range(11)]
    return parts, axis


# --------------------------------------------------------- verificaciones ---

def densify(path, step=0.001):
    pts, arcs = [path[0]], [0.0]
    for a, b in zip(path[:-1], path[1:]):
        seg = (b - a).length
        k = max(1, int(seg / step))
        for i in range(1, k + 1):
            pts.append(a.lerp(b, i / k))
            arcs.append(arcs[-1] + seg / k)
    return pts, arcs


def coil_checks(spine, arcs_total):
    """
    Sobre la espina, con la envolvente del par (PAIR_R) como cable y sin
    contar las puntas: separación mínima entre tramos no vecinos (tiene que
    ser al menos el diámetro) y aire bajo el tramo peor apoyado.
    """
    pts, arcs = densify(spine)
    keep = [i for i, s in enumerate(arcs) if TAIL_LEN <= s <= arcs_total - TAIL_LEN]
    tree = KDTree(len(keep))
    for k, i in enumerate(keep):
        tree.insert(pts[i], k)
    tree.balance()
    diam = 2.0 * PAIR_R
    closest, air = float("inf"), 0.0
    for i in keep:
        p = pts[i]
        gap = p.z - PAIR_R
        for (_co, k, d) in tree.find_range(p, diam * 1.5):
            j = keep[k]
            if abs(arcs[i] - arcs[j]) > 3.0 * diam:
                closest = min(closest, d)
                if pts[j].z < p.z - 1e-4:
                    gap = min(gap, d - diam)
        air = max(air, gap)
    return closest, air


def strand_clearance(paths):
    """
    Distancia mínima entre ejes de conductores que no son vecinos: ni el
    mismo conductor cerca, ni su gemelo en el mismo tramo del par.
    """
    pts, arcs, who = [], [], []
    for n, path in enumerate(paths):
        p, a = densify(path, 0.0015)
        pts += p
        arcs += a
        who += [n] * len(p)
    tree = KDTree(len(pts))
    for i, p in enumerate(pts):
        tree.insert(p, i)
    tree.balance()
    worst = float("inf")
    for i, p in enumerate(pts):
        for (_co, j, d) in tree.find_range(p, 2.0 * CABLE_R * 1.2):
            if abs(arcs[i] - arcs[j]) > 0.030 and d < worst:
                worst = d
    return worst


def plug_clearances(plugs, paths, total):
    """
    Aire entre conectores de puntas distintas, y entre cada conector y el
    cable que no es el suyo (todo lo que esté a más de 0.11 m de su punta).
    """
    between = float("inf")
    for ta, (end_a, axis_a) in plugs.items():
        for tb, (end_b, axis_b) in plugs.items():
            if end_a < end_b:
                between = min(between, min((p - q).length for p in axis_a for q in axis_b)
                              - 2.0 * PLUG_R)
    cable = []
    for path in paths:
        pts, arcs = densify(path, 0.002)
        cable.append((pts, arcs))
    to_cable = float("inf")
    for _tag, (end, axis) in plugs.items():
        for pts, arcs in cable:
            span = arcs[-1]
            for p, s in zip(pts, arcs):
                from_end = s if end == "a" else span - s
                if from_end > 0.110:
                    to_cable = min(to_cable, min((p - q).length for q in axis)
                                   - PLUG_R - CABLE_R)
    return between, to_cable


# ------------------------------------------------------------------ main ----

def main():
    reset_scene()

    spine, arcs, profile = twist_profile(build_spine())
    total = arcs[-1]
    closest, air = coil_checks(spine, total)
    diam = 2.0 * PAIR_R

    fr = frames(spine)
    parts, paths, plugs = [], [], {}
    for phase, tag, cond_mat, body_mat in (
            (0.0, "red", cable_red(), connector_red()),
            (math.pi, "black", cable_black(), connector_smoke())):
        obj, path = build_strand("cable-%s" % tag, fr, profile, phase, cond_mat)
        parts.append(obj)
        paths.append(path)
        for end, tip, before in (("a", path[0], path[1]), ("b", path[-1], path[-2])):
            name = "%s-%s" % (tag, end)
            plug, axis = build_plug(name, tip, tip - before, body_mat)
            parts += plug
            plugs[name] = (end, axis)

    wires = strand_clearance(paths)
    between, to_cable = plug_clearances(plugs, paths, total)
    floor = min(q.z for path in paths for q in path) - CABLE_R

    lo, hi = world_bounds(parts)
    print("")
    print("espina        : %d puntos, %.3f m de recorrido" % (len(spine), total))
    print("trenzado      : paso %.3f m -> %.1f vueltas en total" % (TWIST_PITCH, total / TWIST_PITCH))
    print("rollo         : %d + %.2f vueltas, radio de la espina %.3f m"
          % (COIL_BOTTOM, COIL_TOP, COIL_R))
    print("vueltas       : separación mínima %.2f mm (envolvente %.2f mm)%s"
          % (closest * 1000, diam * 1000, "" if closest >= diam * 0.99 else "  <-- SE CRUZA"))
    print("apoyo         : aire bajo el tramo peor apoyado %.2f mm (máximo %.2f)%s"
          % (air * 1000, SUPPORT_MAX * diam * 1000,
             "" if air <= SUPPORT_MAX * diam else "  <-- FLOTA"))
    print("conductores   : distancia mínima entre ejes %.2f mm (diámetro %.2f mm)%s"
          % (wires * 1000, CABLE_R * 2000, "" if wires >= CABLE_R * 2.0 * 0.97 else "  <-- SE MUERDEN"))
    print("conectores    : %.1f mm entre los de una punta y la otra, %.1f mm al rollo "
          "(mínimo %.1f)%s"
          % (between * 1000, to_cable * 1000, MIN_GAP * 1000,
             "" if min(between, to_cable) >= MIN_GAP else "  <-- MUY JUNTOS"))
    print("piso          : punto más bajo de los conductores a %.2f mm" % (floor * 1000))
    print("envolvente    : %.3f x %.3f x %.3f m" % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
    print("piezas        : %d" % len(parts))

    if closest < diam * 0.99:
        raise ModelError("el rollo se atraviesa a sí mismo (%.2f mm < %.2f mm)"
                         % (closest * 1000, diam * 1000))
    if air > SUPPORT_MAX * diam:
        raise ModelError("un tramo del rollo queda %.2f mm en el aire (máximo %.2f mm)"
                         % (air * 1000, SUPPORT_MAX * diam * 1000))
    if wires < CABLE_R * 2.0 * 0.97:
        raise ModelError("dos conductores se muerden (%.2f mm entre ejes)" % (wires * 1000))
    if min(between, to_cable) < MIN_GAP:
        raise ModelError("un conector queda a %.1f mm de otro o del rollo (mínimo %.1f mm)"
                         % (min(between, to_cable) * 1000, MIN_GAP * 1000))

    discard_orphans(parts)
    obj = join_objects(parts, "rca-cable")
    finalize(obj, ARCHIVO, front="-Y", ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
