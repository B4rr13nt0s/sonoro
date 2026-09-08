"""
Sonoro — categoría "cables RCA" (rca-cable).
Par estereo de 2 canales, tendido en curva S. No enrollado, no recto.

    blender --background --python scripts/models3d/rca-cable.py

Referencia de medidas (metros):
    extension  0.420 (X) x 0.180 (Y) x 0.060 (Z)
    cables     2 en paralelo a 0.014, seccion 0.006 de diametro
    trenzado   tramo central de 0.120 por cable, bandas de 0.002
    conectores 4 machos RCA, 0.022 de largo x 0.013 de diametro maximo
    alivio     0.018 de goma acanalada entre conector y cable
    fleje      0.020 x 0.005 alrededor del par

Decisiones de construccion:
  - los dos cables siguen la MISMA Bezier, desplazados 7 mm a cada lado sobre
    la perpendicular horizontal de la curva; el segundo lleva sus puntos de
    control corridos 4 mm para que no se lean clonados;
  - el trenzado es geometria real (bandas helicoidales cruzadas barridas
    sobre el eje del cable) y existe SOLO en el tramo central: 8 bandas por
    cable, 4 en cada sentido;
  - los conectores se orientan con la tangente del extremo de la curva, asi
    que quedan coaxiales con el cable y no pegados a ojo.

Materiales: cuerpo textured-black, conectores brushed-alu, aros cable-red y
cable-white (codigo de canal), pin copper, alivio rubber, fleje accent-orange.
"""

import importlib
import math
import os
import sys


def _locate_common():
    cands = []
    try:
        import bpy
        cands.append(os.path.dirname(os.path.abspath(bpy.path.abspath(__file__))))
        for t in bpy.data.texts:
            if t.filepath:
                cands.append(os.path.dirname(
                    os.path.abspath(bpy.path.abspath(t.filepath))))
    except Exception:
        pass
    cands.append(os.path.dirname(os.path.abspath(__file__)))
    cands.append(os.getcwd())
    cands.append(os.path.join(os.getcwd(), "scripts", "models3d"))
    for d in cands:
        if d and os.path.isfile(os.path.join(d, "_common.py")):
            return d
    raise RuntimeError(
        "no encuentro _common.py. Agrega su carpeta a mano en la Python "
        "Console de Blender:\n"
        "    import sys; sys.path.append(r'C:\\ruta\\al\\repo\\scripts\\models3d')")


sys.path.insert(0, _locate_common())
import _common                                             # noqa: E402
importlib.reload(_common)   # Blender cachea los modulos entre corridas
from _common import *  # noqa: F401,F403,E402

CABLE_R = 0.0030                        # 6 mm de diametro
PAIR_HALF = 0.0070                      # separacion 14 mm
SIDES = 8
STEPS = 96

BRAID_BANDS = 4                         # por sentido (8 en total por cable)
BRAID_R = 0.0010
BRAID_TURNS = 3.0
BRAID_SPAN = (0.40, 0.60)               # fraccion del recorrido: tramo central

CONN_LEN = 0.0220
CONN_R = 0.0065
RELIEF_LEN = 0.0180

# Bezier de la S: arranca abajo a la izquierda, sube al centro, baja a la
# derecha. Rango Y 0.165 y Z 0.055, dentro de la envolvente pedida.
BEZ = ((-0.2000, -0.0700, 0.0120),
       (-0.0700, -0.0950, 0.0560),
       (0.0700, 0.0800, 0.0560),
       (0.2000, 0.0620, 0.0120))
BEZ_SHIFT = 0.0040                      # corrimiento del segundo cable


def bezier_point(ctrl, t):
    p0, p1, p2, p3 = ctrl
    mt = 1.0 - t
    return Vector((
        mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0]
        + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
        mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1]
        + 3 * mt * t * t * p2[1] + t ** 3 * p3[1],
        mt ** 3 * p0[2] + 3 * mt * mt * t * p1[2]
        + 3 * mt * t * t * p2[2] + t ** 3 * p3[2]))


def sample_curve(ctrl, steps=STEPS):
    return [bezier_point(ctrl, i / steps) for i in range(steps + 1)]


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


def offset_path(fr, lateral):
    return [tuple(p + side * lateral) for (p, _, side, _) in fr]


def build_cables():
    """Los dos cables del par, sobre la misma curva con desplazamiento lateral."""
    ctrl_a = BEZ
    ctrl_b = (BEZ[0],
              (BEZ[1][0] + BEZ_SHIFT, BEZ[1][1] - BEZ_SHIFT, BEZ[1][2] + 0.0030),
              (BEZ[2][0] - BEZ_SHIFT, BEZ[2][1] + BEZ_SHIFT, BEZ[2][2] - 0.0030),
              BEZ[3])

    out = []
    for tag, ctrl, lateral in (("left", ctrl_a, -PAIR_HALF),
                               ("right", ctrl_b, PAIR_HALF)):
        fr = frames(sample_curve(ctrl))
        path = offset_path(fr, lateral)
        cable = swept_tube("cable-%s" % tag, path, CABLE_R, sides=SIDES,
                           material=textured_black())
        out.append((tag, fr, path, cable))
    return out


def build_braid(tag, path):
    """
    Trenzado del tramo central: bandas helicoidales en dos sentidos, barridas
    sobre el eje del cable. Solo entre el 40 y el 60 por ciento del recorrido.
    """
    parts = []
    i0 = int(len(path) * BRAID_SPAN[0])
    i1 = int(len(path) * BRAID_SPAN[1])
    seg = [Vector(p) for p in path[i0:i1 + 1]]
    fr = frames(seg)
    n = len(fr) - 1

    for sense in (1, -1):
        for b in range(BRAID_BANDS):
            phase = 2 * math.pi * b / BRAID_BANDS
            strand = []
            for k, (p, _, side, up) in enumerate(fr):
                a = phase + sense * 2 * math.pi * BRAID_TURNS * (k / n)
                r = CABLE_R + BRAID_R * 0.8
                strand.append(tuple(p + side * (r * math.cos(a))
                                    + up * (r * math.sin(a))))
            parts.append(swept_tube(
                "braid-%s-%s-%d" % (tag, "cw" if sense > 0 else "ccw", b + 1),
                strand, BRAID_R, sides=4, material=brushed_alu()))
    return parts


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


def build_connector(tag, origin, direction, ring_mat):
    """
    Macho RCA coaxial con el extremo del cable: alivio acanalado, cuerpo con
    6 ranuras longitudinales, aro de color, falda conica y pin de cobre.
    """
    parts = []
    d = Vector(direction).normalized()
    rot = d.to_track_quat("Z", "Y").to_euler()

    # alivio de tension: 5 anillos de goma de diametro creciente
    for i in range(5):
        t = i / 4.0
        parts.append(_along("relief-ring-%s-%d" % (tag, i + 1), origin, d,
                            0.0010 + i * 0.0040, 0.0030,
                            CABLE_R + 0.0012 + 0.0016 * t, rubber(),
                            segments=16))

    base = RELIEF_LEN
    parts.append(_along("connector-body-%s" % tag, origin, d,
                        base, 0.0110, CONN_R, brushed_alu(), segments=24))

    # 6 ranuras longitudinales sobre la falda
    for k in range(6):
        a = 2 * math.pi * k / 6.0
        side = Vector((-d.y, d.x, 0.0))
        if side.length < 1e-6:
            side = Vector((1.0, 0.0, 0.0))
        side.normalize()
        up = side.cross(d).normalized()
        c = (Vector(origin) + d * (base + 0.0055)
             + (side * math.cos(a) + up * math.sin(a)) * (CONN_R - 0.0004))
        parts.append(cylinder("connector-groove-%s-%d" % (tag, k + 1),
                              0.0010, 0.0090, segments=6,
                              location=tuple(c), rotation=(rot.x, rot.y, rot.z),
                              material=textured_black()))

    parts.append(_along("connector-ring-%s" % tag, origin, d,
                        base + 0.0110, 0.0035, CONN_R - 0.0002, ring_mat,
                        segments=24))
    parts.append(_along("connector-skirt-%s" % tag, origin, d,
                        base + 0.0145, 0.0060, CONN_R - 0.0004, brushed_alu(),
                        segments=24, taper=0.0044))
    parts.append(_along("connector-pin-%s" % tag, origin, d,
                        base + 0.0140, 0.0130, 0.0015, copper(), segments=14))
    return parts


def build_strap(fr, path_left, path_right):
    """Fleje organizador alrededor del par, a un tercio del recorrido."""
    i = int(len(fr) * 0.30)
    p, tan, side, up = fr[i]
    center = (Vector(path_left[i]) + Vector(path_right[i])) / 2.0
    rot = tan.to_track_quat("Z", "Y").to_euler()
    strap = tube("cable-strap", 0.0135, 0.0100, 0.0050, segments=28,
                 location=tuple(center), rotation=(rot.x, rot.y, rot.z),
                 material=accent_orange())
    return [strap]


def main():
    reset_scene()
    parts = []
    cables = build_cables()

    for tag, fr, path, cable in cables:
        parts.append(cable)
        parts += build_braid(tag, path)

        # conectores en los dos extremos, orientados con la tangente
        start_dir = -(Vector(path[1]) - Vector(path[0]))
        end_dir = Vector(path[-1]) - Vector(path[-2])
        ring_a = cable_white() if tag == "left" else cable_red()
        parts += build_connector("%s-a" % tag, path[0], start_dir, ring_a)
        parts += build_connector("%s-b" % tag, path[-1], end_dir, ring_a)

    fr_left, path_left = cables[0][1], cables[0][2]
    path_right = cables[1][2]
    parts += build_strap(fr_left, path_left, path_right)

    lo, hi = world_bounds(parts)
    print("\nenvolvente: %.3f x %.3f x %.3f m (pedida 0.420 x 0.180 x 0.060)"
          % (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z))
    print("trenzado   : %d bandas por cable, tramo %.0f-%.0f%% del recorrido"
          % (BRAID_BANDS * 2, BRAID_SPAN[0] * 100, BRAID_SPAN[1] * 100))
    print("piezas: %d" % len(parts))

    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huerfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    obj = join_objects(parts, "rca-cable")
    finalize(obj, "rca-cable", expected_dims=(None, None, None))


if __name__ == "__main__":
    main()
