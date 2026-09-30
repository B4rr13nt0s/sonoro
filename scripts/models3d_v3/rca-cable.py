"""
Sonoro — categoría "accesorios" (rca-cable), versión 3.
Rollo ovalado de par trenzado rojo/negro, con los cuatro machos RCA
saliendo juntos por un extremo.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/rca-cable.py

Geometría portada de scripts/models3d/rca-cable.py (v1), que generó el
rca-cable-2.glb publicado. Medidas sin cambios:

    rollo      pista ovalada de 0.070 de recta y radio inicial 0.042,
               2 vueltas, cada vuelta 0.013 hacia afuera y 0.002 en Z
               (la v1: 0.120 de recta y 3 vueltas; ver «Qué cambia»)
    cables     2 conductores de 0.006 de diámetro, trenzados entre sí
    trenzado   paso de 0.060 por vuelta completa, en TODO el recorrido
    apertura   los últimos 0.075 de cada punta desarman el trenzado y
               separan los conductores a 0.022 entre ejes
    conectores 4 machos RCA de ~0.050 de largo x 0.013 de diámetro

Decisiones de la v1 que se conservan:

  - la forma es un ROLLO: la espina recorre una pista tipo estadio y
    espiralea hacia afuera, como queda un cable enrollado de fábrica;
  - los dos conductores son dos hélices alrededor de una espina común,
    desfasadas 180 grados y con radio de hélice igual al radio del cable:
    se tocan sin interpenetrarse;
  - el ángulo del trenzado se integra contra la LONGITUD DE ARCO, no contra
    el índice del paso (si no, el trenzado sale más apretado en las curvas);
  - en los últimos 0.075 de cada punta el trenzado se desarma y la fase se
    lleva al múltiplo de 2*pi más cercano, para que los conductores se
    separen en HORIZONTAL y los conectores queden lado a lado;
  - el tramo de entrada cruza sobre el rollo alto y recién baja al final.

Las puntas salen hacia −Y. `finalize(front="-Y")` las gira hacia la cámara:
ya no necesita `giroBase`.

Qué cambia respecto de la v1
----------------------------
  - Normales: la v1 tenía TODAS las aristas duras, y los conductores de 8
    lados se veían octogonales. Ahora los tubos son suaves (ver
    `swept_tube` en _common.py).
  - Conductores en cable-red y cable-black, con el brillo de PVC de los
    cables del kit de instalación (antes rugosidad 0.9, casi sin brillo).
  - Más corto: 2 vueltas con rectas de 70 mm (antes 3 vueltas con rectas de
    120 mm). Se leía como un rollo de varios metros.
  - Sin cincho: el aro que rodeaba el haz se quitó a pedido.
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

ARCHIVO = "rca-cable-3"

# ------------------------------------------------------------ parametros ----

CABLE_R = 0.0030            # 6 mm de diametro por conductor
SIDES = 8                   # lados de la seccion barrida
STEP = 0.0055               # paso de muestreo sobre la espina, en metros

TWIST_PITCH = 0.0600        # avance por vuelta completa del trenzado
SPLIT_LEN = 0.0750          # tramo de apertura en cada punta
SPLIT_R = 0.0110            # radio de helice en la punta -> 22 mm entre ejes

COIL_L = 0.0700             # largo de las rectas de la pista (v1: 0.120)
COIL_R0 = 0.0420            # radio de los semicirculos, primera vuelta
COIL_DR = 0.0130            # crecimiento radial por vuelta
COIL_DZ = 0.0020            # apilado en Z por vuelta
COIL_TURNS = 2.0            # entera: entrada y salida quedan en el mismo lado
                            # (v1: 3)
COIL_Z0 = 0.0060            # altura del eje de la primera vuelta

TAIL_OUT = 0.0550           # cuanto sobresalen las puntas del rollo
TAIL_Z = 0.0300             # altura del tramo de entrada al cruzar el rollo

CONN_R = 0.0065             # radio del cuerpo del conector
BOOT_LEN = 0.0185           # bota acanalada

R_MAX = COIL_R0 + COIL_DR * COIL_TURNS


# ------------------------------------------------------------- utilidades ---

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def hermite(p0, m0, p1, m1, t):
    """Cubica de Hermite entre p0 y p1 con tangentes m0 y m1."""
    t2 = t * t
    t3 = t2 * t
    return (p0 * (2 * t3 - 3 * t2 + 1)
            + m0 * (t3 - 2 * t2 + t)
            + p1 * (-2 * t3 + 3 * t2)
            + m1 * (t3 - t2))


def racetrack_xy(length, radius, s):
    """
    Punto sobre una pista tipo estadio, parametrizada por arco.
    Arranca en el extremo izquierdo de la recta INFERIOR (y negativo) y
    avanza en +X: por eso las puntas del rollo salen hacia -Y, que es el
    lado por el que se ven los conectores en la vista frontal del QA.
    """
    p1 = length                       # recta inferior
    p2 = p1 + math.pi * radius        # semicirculo derecho
    p3 = p2 + length                  # recta superior
    if s < p1:
        return (-length / 2.0 + s, -radius)
    if s < p2:
        a = -math.pi / 2.0 + (s - p1) / radius
        return (length / 2.0 + radius * math.cos(a), radius * math.sin(a))
    if s < p3:
        return (length / 2.0 - (s - p2), radius)
    a = math.pi / 2.0 + (s - p3) / radius
    return (-length / 2.0 + radius * math.cos(a), radius * math.sin(a))


def coil_point(u):
    """Punto de la espiral para `u` vueltas acumuladas."""
    r = COIL_R0 + COIL_DR * u
    z = COIL_Z0 + COIL_DZ * u
    frac = u - math.floor(u)
    perim = 2.0 * COIL_L + 2.0 * math.pi * r
    x, y = racetrack_xy(COIL_L, r, frac * perim)
    return Vector((x, y, z))


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


# ---------------------------------------------------------------- espina ----

def build_spine():
    """
    Espina continua: tramo de entrada + rollo + tramo de salida.
    Devuelve la lista de puntos, ya muestreada a paso ~STEP.
    """
    r_avg = COIL_R0 + COIL_DR * COIL_TURNS / 2.0
    coil_arc = COIL_TURNS * (2.0 * COIL_L + 2.0 * math.pi * r_avg)
    n_coil = max(60, int(coil_arc / STEP))
    coil = [coil_point(COIL_TURNS * i / n_coil) for i in range(n_coil + 1)]

    c0, c1 = coil[0], coil[-1]
    t0 = (coil[1] - coil[0]).normalized()      # +X al entrar
    t1 = (coil[-1] - coil[-2]).normalized()    # +X al salir

    # --- tramo de entrada: baja desde la boca y llega a la vuelta interior.
    # Cruza sobre el rollo, asi que se mantiene alto y recien baja al final.
    m_in = Vector((-COIL_L / 2.0 - 0.012, -(R_MAX + TAIL_OUT), TAIL_Z))
    n_in = max(14, int(0.13 / STEP))
    tail_in = []
    for i in range(n_in):
        t = i / float(n_in)
        p = hermite(m_in, Vector((0.010, 0.115, 0.0)),
                    c0, t0 * 0.115, t)
        p.z = TAIL_Z + (c0.z - TAIL_Z) * smoothstep((t - 0.70) / 0.30)
        tail_in.append(p)

    # --- tramo de salida: arranca en la vuelta exterior y se abre hacia -Y.
    # No cruza nada, asi que sube directo.
    m_out = Vector((-COIL_L / 2.0 + 0.030, -(R_MAX + TAIL_OUT + 0.012),
                    TAIL_Z + 0.004))
    n_out = max(12, int(0.11 / STEP))
    tail_out = []
    for i in range(1, n_out + 1):
        t = i / float(n_out)
        tail_out.append(hermite(c1, t1 * 0.075,
                                m_out, Vector((0.030, -0.095, 0.0)), t))

    return tail_in + coil + tail_out


def arc_lengths(points):
    out = [0.0]
    for i in range(1, len(points)):
        out.append(out[-1] + (points[i] - points[i - 1]).length)
    return out


# -------------------------------------------------------------- trenzado ----

def twist_profile(arcs):
    """
    Angulo y radio de helice a lo largo de la espina.

    La tasa de giro se integra contra el arco y cae a cero en los tramos de
    apertura; el radio se abre de CABLE_R a SPLIT_R en esos mismos tramos.
    Al final la fase se lleva al multiplo de 2*pi mas cercano, para que los
    dos conductores se separen en horizontal.
    """
    total = arcs[-1]
    ramps = []
    for s in arcs:
        a = smoothstep((SPLIT_LEN - s) / SPLIT_LEN)
        b = smoothstep((s - (total - SPLIT_LEN)) / SPLIT_LEN)
        ramps.append(max(a, b))

    rate = 2.0 * math.pi / TWIST_PITCH
    angles = [0.0]
    for i in range(1, len(arcs)):
        ds = arcs[i] - arcs[i - 1]
        k = 1.0 - (ramps[i] + ramps[i - 1]) / 2.0
        angles.append(angles[-1] + rate * k * ds)

    out = []
    for ang, ramp in zip(angles, ramps):
        snap = 2.0 * math.pi * round(ang / (2.0 * math.pi))
        out.append((ang + ramp * (snap - ang),
                    CABLE_R + (SPLIT_R - CABLE_R) * ramp))
    return out


def build_strand(name, fr, profile, phase, material_):
    path = []
    for (p, _tan, side, up), (ang, rad) in zip(fr, profile):
        a = ang + phase
        path.append(tuple(p + side * (rad * math.cos(a))
                          + up * (rad * math.sin(a))))
    obj = swept_tube(name, path, CABLE_R, sides=SIDES, material=material_)
    return obj, path


# ------------------------------------------------------------ conectores ----

def _along(name, origin, direction, offset, length, radius, material_,
           segments=20, taper=None):
    """Pieza cilindrica o conica alineada con `direction`, a `offset` del origen."""
    d = Vector(direction).normalized()
    center = Vector(origin) + d * (offset + length / 2.0)
    rot = d.to_track_quat("Z", "Y").to_euler()
    if taper is None:
        return cylinder(name, radius, length, segments=segments,
                        location=tuple(center), rotation=(rot.x, rot.y, rot.z),
                        material=material_)
    return cone(name, radius, taper, length, segments=segments,
                location=tuple(center), rotation=(rot.x, rot.y, rot.z),
                material=material_)


def build_connector(tag, origin, direction, body_mat, boot_mat):
    """
    Macho RCA coaxial con la punta del conductor: bota acanalada del color
    del canal, cuerpo de plastico con nervaduras de agarre, ferrule, falda
    conica y pin, los tres en chrome.
    """
    parts = []
    d = Vector(direction).normalized()
    rot = d.to_track_quat("Z", "Y").to_euler()

    # bota: 5 anillos de diametro creciente
    for i in range(5):
        t = i / 4.0
        parts.append(_along("boot-ring-%s-%d" % (tag, i + 1), origin, d,
                            0.0010 + i * 0.0035, 0.0028,
                            CABLE_R + 0.0013 + 0.0016 * t, boot_mat,
                            segments=16))

    base = BOOT_LEN
    parts.append(_along("connector-body-%s" % tag, origin, d,
                        base, 0.0140, CONN_R, body_mat, segments=20))

    # 6 nervaduras longitudinales de agarre, moldeadas en el mismo plastico
    side = Vector((-d.y, d.x, 0.0))
    if side.length < 1e-6:
        side = Vector((1.0, 0.0, 0.0))
    side.normalize()
    up = side.cross(d).normalized()
    for k in range(6):
        a = 2.0 * math.pi * k / 6.0
        c = (Vector(origin) + d * (base + 0.0070)
             + (side * math.cos(a) + up * math.sin(a)) * (CONN_R - 0.0003))
        parts.append(cylinder("connector-rib-%s-%d" % (tag, k + 1),
                              0.0009, 0.0110, segments=6,
                              location=tuple(c), rotation=(rot.x, rot.y, rot.z),
                              material=body_mat))

    parts.append(_along("connector-ferrule-%s" % tag, origin, d,
                        base + 0.0140, 0.0060, 0.0058, chrome(), segments=20))
    parts.append(_along("connector-skirt-%s" % tag, origin, d,
                        base + 0.0200, 0.0055, 0.0058, chrome(),
                        segments=20, taper=0.0042))
    parts.append(_along("connector-pin-%s" % tag, origin, d,
                        base + 0.0195, 0.0125, 0.0015, chrome(), segments=12))
    return parts


# ------------------------------------------------------------------ main ----

def main():
    reset_scene()

    spine = build_spine()
    fr = frames(spine)
    arcs = arc_lengths(spine)
    profile = twist_profile(arcs)

    parts = []
    ends = {}
    for phase, tag, cond_mat, body_mat in (
            (0.0, "red", cable_red(), connector_red()),
            (math.pi, "black", cable_black(), connector_smoke())):
        obj, path = build_strand("cable-%s" % tag, fr, profile, phase, cond_mat)
        parts.append(obj)
        ends[tag] = (path, cond_mat, body_mat)

    for tag, (path, cond_mat, body_mat) in ends.items():
        start_dir = Vector(path[0]) - Vector(path[1])
        end_dir = Vector(path[-1]) - Vector(path[-2])
        parts += build_connector("%s-a" % tag, path[0], start_dir,
                                 body_mat, cond_mat)
        parts += build_connector("%s-b" % tag, path[-1], end_dir,
                                 body_mat, cond_mat)


    lo, hi = world_bounds(parts)
    print("")
    print("espina        : %d puntos, %.3f m de recorrido" % (len(spine), arcs[-1]))
    print("trenzado      : paso %.3f m -> %.1f vueltas en total"
          % (TWIST_PITCH, arcs[-1] / TWIST_PITCH))
    print("apertura      : %.3f m por punta, ejes a %.3f m" % (SPLIT_LEN, SPLIT_R * 2))
    print("rollo         : %.1f vueltas, radio %.3f -> %.3f m"
          % (COIL_TURNS, COIL_R0, R_MAX))
    print("envolvente    : %.3f x %.3f x %.3f m" % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
    print("piezas        : %d" % len(parts))

    discard_orphans(parts)
    obj = join_objects(parts, "rca-cable")
    finalize(obj, ARCHIVO, front="-Y", ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
