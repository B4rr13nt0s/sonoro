"""
Sonoro — categoría "insonorización" (sound-deadening), versión 3.
Kit butílico: rollo parcialmente desenrollado, láminas sueltas y rodillo.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/sound-deadening.py

Geometría portada de scripts/models3d/sound-deadening.py (v1), que generó el
sound-deadening-2.glb publicado. Medidas sin cambios:

    área    0.400 (X) x 0.320 (Y), alto máximo 0.120
    rollo   0.110 de diámetro x 0.300 de ancho, eje sobre X
    lengüeta desplegada del ancho del rollo, cae del rollo y corre al frente
    láminas 0.250 x 0.110 x 0.002, tres apiladas con desfase
    rodillo mango 0.115, rueda 0.045 x 0.046

Decisiones de la v1 que se conservan:

  - la lámina TIENE EL ANCHO DEL ROLLO: es la misma pieza. La capa exterior
    del rollo no es piel del cilindro, es la propia lengüeta enrollada;
  - el tramo enrollado es una ESPIRAL (el radio crece un espesor por vuelta):
    la cola y el tramo que se despega nunca se cruzan;
  - la normal del tramo enrollado es el radio del rollo, no la perpendicular
    a la tangente (esa convención daba vuelta la piel por detrás);
  - el núcleo del rollo va liso y las tapas son discos macizos;
  - el rodillo vive sobre UN eje recto, con las piezas solapadas.

El script construye con el frente hacia −Y (rollo al fondo, lámina saliendo
hacia el observador, pila delante). `finalize` lo gira a +Y: ya no necesita
`giroBase`.

Qué cambia respecto de la v1
----------------------------
  - EL «TABLERO DE AJEDREZ» DE LAS LÁMINAS SUELTAS. La piel de aluminio iba
    0.4 mm sobre el núcleo negro y el relieve se HUNDÍA 0.6 mm: donde había
    rombo, el núcleo atravesaba la piel y se veía negro. Además el relieve era
    un escalón (0 o −0.6 mm) muestreado en una rejilla de 8 x 5 mm, así que
    los rombos salían como cuadros. Ahora cada lámina es UN sólido cerrado
    (cara superior de aluminio, cantos y fondo de butilo) y el relieve de la
    lámina de arriba SUBE, con pendiente suave y 4 mm de muestreo.
  - Sin relieve en la lengüeta: con la rejilla que admite el presupuesto de
    triángulos el patrón salía como ruido, no como rombos. Queda el aluminio
    liso, con el pandeo transversal del tramo suelto.
  - Normales: la v1 salía 100 % suavizada (ver _common.py, nota 1).
  - Mango del rodillo satinado.
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

ARCHIVO = "sound-deadening-3"

SHEET_T = 0.0020                        # espesor de lámina
EMB_PITCH = 0.0320                      # paso del patrón de rombos
EMB_DEPTH = 0.0006                      # alto del relieve, HACIA ARRIBA
EMB_GRID = 0.0040                       # muestreo del relieve

ROLL_R = 0.0550
ROLL_W = 0.3000
ROLL_CX = -0.0500
ROLL_CY = 0.1050
ROLL_CORE_R = ROLL_R - SHEET_T          # la capa exterior es la lengüeta

TONGUE_W = ROLL_W
TONGUE_CX = ROLL_CX
TONGUE_COLS = 16                        # solo lleva el pandeo transversal

LOOSE_W = 0.2500
LOOSE_D = 0.1100


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def emboss(u, v):
    """
    Relieve de rombos en coordenadas de la lámina (u, v), en metros, SIEMPRE
    >= 0: meseta en el centro del rombo, pendiente suave hacia la ranura. Una
    función continua, para que la rejilla la muestree sin escalones.
    """
    a = ((u + v) / EMB_PITCH) % 1.0 - 0.5
    b = ((u - v) / EMB_PITCH) % 1.0 - 0.5
    d = max(abs(a), abs(b))
    return EMB_DEPTH * (1.0 - smoothstep(0.26, 0.42, d))


def _grid(name, rows, cols, pos_fn, material_, flip=False):
    """Malla rejilla genérica: pos_fn(i, j) -> Vector."""
    bm = bmesh.new()
    verts = [[bm.verts.new(pos_fn(i, j)) for j in range(cols)] for i in range(rows)]
    for i in range(rows - 1):
        for j in range(cols - 1):
            quad = [verts[i][j], verts[i][j + 1], verts[i + 1][j + 1], verts[i + 1][j]]
            if flip:
                quad.reverse()
            try:
                bm.faces.new(quad)
            except ValueError:
                pass
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material_)
    return obj


# ------------------------------------------------------------- lengüeta -----

def _bezier(p0, p1, p2, p3, steps):
    out = []
    for i in range(steps + 1):
        t = i / steps
        mt = 1.0 - t
        out.append((mt ** 3 * p0[0] + 3 * mt * mt * t * p1[0]
                    + 3 * mt * t * t * p2[0] + t ** 3 * p3[0],
                    mt ** 3 * p0[1] + 3 * mt * mt * t * p1[1]
                    + 3 * mt * t * t * p2[1] + t ** 3 * p3[1]))
    return out


WRAP_START_DEG = -286.0                 # vuelta completa: 360 grados exactos
WRAP_END_DEG = 74.0                     # donde se despega, antes del ecuador
WRAP_STEPS = 100


def roll_surface_point(deg, lift=0.0):
    """Punto (y, z) de la lámina enrollada, en ESPIRAL."""
    a = math.radians(deg)
    r = ROLL_CORE_R + lift - SHEET_T * (WRAP_END_DEG - deg) / 360.0
    return (ROLL_CY - r * math.sin(a), ROLL_R + r * math.cos(a))


def roll_surface_tangent(deg):
    a = math.radians(deg)
    return (-math.cos(a), -math.sin(a))


def peel_path():
    """Perfil de la lámina completa: (puntos, normales). En el tramo enrollado
    la normal es el radio del rollo (siempre hacia afuera)."""
    lift = SHEET_T / 2.0
    pts, nrm = [], []
    for i in range(WRAP_STEPS + 1):
        deg = WRAP_START_DEG + (WRAP_END_DEG - WRAP_START_DEG) * (i / WRAP_STEPS)
        pts.append(roll_surface_point(deg, lift))
        a = math.radians(deg)
        nrm.append((-math.sin(a), math.cos(a)))

    p0 = pts[-1]
    ty, tz = roll_surface_tangent(WRAP_END_DEG)
    p1 = (p0[0] + ty * 0.0460, p0[1] + tz * 0.0460)
    p2 = (p0[0] - 0.0520, 0.0120)
    p3 = (p0[0] - 0.1080, SHEET_T / 2.0)
    curve = _bezier(p0, p1, p2, p3, 26)[1:]

    flat_end = -0.0750
    n = 12
    straight = [(curve[-1][0] + (flat_end - curve[-1][0]) * (i / n), SHEET_T / 2.0)
                for i in range(1, n + 1)]
    free = curve + straight
    return pts + free, nrm + [None] * len(free)


def _path_frames(path, normals=None):
    frames = []
    s = 0.0
    for i, (y, z) in enumerate(path):
        if i == 0:
            ty, tz = path[1][0] - y, path[1][1] - z
        elif i == len(path) - 1:
            ty, tz = y - path[-2][0], z - path[-2][1]
        else:
            ty, tz = path[i + 1][0] - path[i - 1][0], path[i + 1][1] - path[i - 1][1]
        ln = math.hypot(ty, tz) or 1.0
        ty, tz = ty / ln, tz / ln
        given = normals[i] if normals is not None else None
        if given is not None:
            ny, nz = given
        else:
            ny, nz = -tz, ty
            if nz < 0:
                ny, nz = -ny, -nz
        if i > 0:
            s += math.hypot(y - path[i - 1][0], z - path[i - 1][1])
        frames.append(((y, z), (ny, nz), s))
    return frames


def build_tongue():
    """
    La lámina entera (una vuelta enrollada + el tramo desplegado) como UN
    sólido cerrado: piel superior de aluminio, inferior de butilo y cuatro
    cantos, unidos antes de limpiar para que se suelden.
    """
    path, normals = peel_path()
    frames = _path_frames(path, normals)
    rows, cols = len(frames), TONGUE_COLS
    x0 = TONGUE_CX - TONGUE_W / 2.0
    half = SHEET_T / 2.0
    s_wrap = frames[WRAP_STEPS][2]
    s_flat = frames[-1][2]

    def surface(i, j, side):
        (y, z), (ny, nz), s = frames[i]
        u = j / (cols - 1)
        x = x0 + TONGUE_W * u
        off = half if side > 0 else -half
        # pandeo transversal solo en el tramo suelto
        if s > s_wrap:
            t = min(1.0, max(0.0, (s - s_wrap) / max(s_flat - s_wrap, 1e-6)))
            off += -0.0042 * math.sin(math.pi * u) * math.sin(math.pi * t) ** 0.7
        return Vector((x, y + ny * off, z + nz * off))

    pieces = [_grid("deadening-sheet-top", rows, cols, lambda i, j: surface(i, j, 1),
                    brushed_alu()),
              _grid("deadening-sheet-bottom", rows, cols, lambda i, j: surface(i, j, -1),
                    matte_black(), flip=True)]
    for j_edge, tag in ((0, "left"), (cols - 1, "right")):
        pieces.append(_grid("deadening-sheet-rim-%s" % tag, rows, 2,
                            lambda i, j, je=j_edge: surface(i, je, 1 - 2 * j), matte_black()))
    pieces.append(_grid("deadening-sheet-rim-front", 2, cols,
                        lambda i, j: surface(rows - 1, j, 1 - 2 * i), matte_black()))
    pieces.append(_grid("deadening-sheet-rim-back", 2, cols,
                        lambda i, j: surface(0, j, 1 - 2 * i), matte_black(), flip=True))
    return [join_objects(pieces, "deadening-sheet", prepare=False)]


def build_roll():
    """Núcleo liso de butilo, una lámina más chico que el radio nominal, y
    dos tapas MACIZAS (por el agujero de un anillo se veía la tapa interior)."""
    parts = [cylinder("deadening-roll", ROLL_CORE_R, ROLL_W, segments=64,
                      location=(ROLL_CX, ROLL_CY, ROLL_R),
                      rotation=(0.0, math.pi / 2.0, 0.0), material=matte_black())]
    for i, s in enumerate((-1.0, 1.0)):
        parts.append(cylinder("deadening-roll-face-%d" % (i + 1), ROLL_R - 0.0003, 0.0030,
                              segments=64,
                              location=(ROLL_CX + s * (ROLL_W / 2.0 - 0.0015), ROLL_CY, ROLL_R),
                              rotation=(0.0, math.pi / 2.0, 0.0), material=matte_black()))
    return parts


# ------------------------------------------------------- láminas sueltas ----

def slab(name, cx, cy, yaw, w, d, z_base, t, nu, nv, bump, top_mat, side_mat):
    """
    Lámina como sólido CERRADO: cara superior en rejilla nu x nv con relieve
    `bump(u, v)` (>= 0), cantos y fondo. Cara superior en `top_mat`, el resto
    en `side_mat`. Sin piezas superpuestas: no hay nada que atravesar.
    """
    c, s = math.cos(yaw), math.sin(yaw)

    def place(u, v, z):
        return Vector((cx + u * c - v * s, cy + u * s + v * c, z))

    us = [-w / 2.0 + w * j / (nu - 1) for j in range(nu)]
    vs = [-d / 2.0 + d * i / (nv - 1) for i in range(nv)]
    bm = bmesh.new()
    top = [[bm.verts.new(place(u, v, z_base + t + bump(u, v))) for u in us] for v in vs]
    for i in range(nv - 1):
        for j in range(nu - 1):
            bm.faces.new([top[i][j], top[i][j + 1], top[i + 1][j + 1], top[i + 1][j]])

    ring = ([(0, j) for j in range(nu)] + [(i, nu - 1) for i in range(1, nv)]
            + [(nv - 1, j) for j in range(nu - 2, -1, -1)]
            + [(i, 0) for i in range(nv - 2, 0, -1)])
    bottom = [bm.verts.new(place(us[j], vs[i], z_base)) for (i, j) in ring]
    n = len(ring)
    sides = []
    for k in range(n):
        a, b = ring[k], ring[(k + 1) % n]
        sides.append(bm.faces.new([top[a[0]][a[1]], bottom[k],
                                   bottom[(k + 1) % n], top[b[0]][b[1]]]))
    base = bm.faces.new(list(reversed(bottom)))
    for f in sides + [base]:
        f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(top_mat)
    obj.data.materials.append(side_mat)
    return obj


def build_loose_sheets():
    """Tres láminas apiladas al frente, con desfase y giro leve. Solo la de
    arriba lleva relieve: de las otras dos se ven los cantos."""
    parts = []
    specs = ((-0.0500, -0.1720, 3.5), (-0.0470, -0.1750, -2.5), (-0.0530, -0.1690, 1.0))
    nu = int(round(LOOSE_W / EMB_GRID)) + 1
    nv = int(round(LOOSE_D / EMB_GRID)) + 1
    for k, (cx, cy, deg) in enumerate(specs):
        top = k == len(specs) - 1
        parts.append(slab("loose-sheet-%d" % (k + 1), cx, cy, math.radians(deg),
                          LOOSE_W, LOOSE_D, k * SHEET_T, SHEET_T,
                          nu if top else 2, nv if top else 2,
                          emboss if top else (lambda u, v: 0.0),
                          brushed_alu(), matte_black()))
    return parts


def build_roller():
    """Rodillo tipo T: rueda, horquilla de chapa en U, virola y mango, sobre
    UN eje recto en el plano YZ (basta rotar sobre X, sin torsión)."""
    parts = []
    wheel_r = 0.0225
    wheel_w = 0.0460
    wheel_c = Vector((ROLL_CX + 0.0680, -0.0640, SHEET_T + wheel_r))

    deg = 26.0
    ang = math.radians(deg)
    axis = Vector((0.0, -math.cos(ang), math.sin(ang)))
    rot_box = (math.radians(180.0 - deg), 0.0, 0.0)   # +Y local -> axis
    rot_cyl = (math.radians(90.0 - deg), 0.0, 0.0)    # +Z local -> axis
    rot_x = (0.0, math.pi / 2.0, 0.0)                 # eje de la rueda

    parts.append(cylinder("roller-wheel", wheel_r, wheel_w, segments=40,
                          location=tuple(wheel_c), rotation=rot_x, material=rubber()))
    parts.append(cylinder("roller-axle", 0.0032, wheel_w + 0.0090, segments=16,
                          location=tuple(wheel_c), rotation=rot_x, material=brushed_alu()))

    plate_half = wheel_w / 2.0 + 0.0020
    plate_c = wheel_c + axis * 0.0140
    for i, s in enumerate((-1.0, 1.0)):
        plate = box("roller-yoke-plate-%d" % (i + 1), (0.0026, 0.0400, 0.0185),
                    location=(wheel_c.x + s * plate_half, plate_c.y, plate_c.z),
                    rotation=rot_box, material=brushed_alu())
        bevel(plate, 0.0008, segments=2)
        parts.append(plate)
        parts.append(cylinder("roller-hub-screw-%d" % (i + 1), 0.0034, 0.0026, segments=16,
                              location=(wheel_c.x + s * (plate_half + 0.0012),
                                        wheel_c.y, wheel_c.z),
                              rotation=rot_x, material=chrome()))

    web = box("roller-yoke-web", (2 * plate_half + 0.0026, 0.0190, 0.0090),
              location=tuple(wheel_c + axis * 0.0270), rotation=rot_box,
              material=brushed_alu())
    bevel(web, 0.0008, segments=2)
    parts.append(web)

    parts.append(cylinder("roller-ferrule", 0.0068, 0.0180, segments=24,
                          location=tuple(wheel_c + axis * 0.0350),
                          rotation=rot_cyl, material=chrome()))

    handle_len = 0.1150
    h_a = wheel_c + axis * 0.0410
    h_b = h_a + axis * handle_len
    parts.append(cone("roller-handle", 0.0062, 0.0098, handle_len, segments=24,
                      location=tuple((h_a + h_b) / 2.0), rotation=rot_cyl,
                      material=satin_black()))
    parts.append(sphere("roller-handle-cap", 0.0098, segments=24, rings=12,
                        location=tuple(h_b), material=satin_black()))
    return parts


def main():
    reset_scene()
    groups = {
        "roll": build_roll(),
        "tongue": build_tongue(),
        "loose-sheets": build_loose_sheets(),
        "roller": build_roller(),
    }
    print("\nhuellas XY por grupo (área útil 0.400 x 0.320):")
    for name, objs in groups.items():
        lo, hi = world_bounds(objs)
        print("  %-14s x %7.3f .. %7.3f   y %7.3f .. %7.3f   z max %6.3f"
              % (name, lo.x, hi.x, lo.y, hi.y, hi.z))

    parts = [o for objs in groups.values() for o in objs]
    print("\npiezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "sound-deadening")
    finalize(obj, ARCHIVO, front="-Y", ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
