"""
Sonoro — categoría "aislamiento acústico" (sound-deadening).
Kit butilico: rollo parcialmente desenrollado, laminas sueltas y rodillo.

    blender --background --python scripts/models3d/sound-deadening.py

Referencia de medidas (metros):
    area    0.400 (X) x 0.320 (Y), alto maximo 0.120
    rollo   0.110 de diametro x 0.300 de ancho, eje sobre X
    lengueta desplegada 0.140 de ancho, cae del rollo y corre 0.200 al frente
    laminas 0.250 x 0.180 x 0.002, tres apiladas con desfase
    rodillo mango 0.110, rueda 0.045 x 0.025

La firma visual del producto es el relieve embossed de la cara superior:
patron de rombos hundidos 0.6 mm. Se resuelve DESPLAZANDO los vertices de la
piel superior (no con parches pegados encima): la piel ya es una malla densa
porque tiene que seguir la curva, asi que el patron sale gratis en geometria
y no agrega piezas.

La lengueta se genera como malla curva lofteada sobre una Bezier (equivalente
al Curve modifier, pero parametrico y sin depender de un objeto curva en la
escena). Cara superior brushed-alu, cara inferior matte-black (el butilo).
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

import bmesh                                               # noqa: E402
from mathutils import Vector                               # noqa: E402

SHEET_T = 0.0020                        # espesor de lamina
EMB_PITCH = 0.0320                      # paso del patron de rombos
EMB_DEPTH = 0.0006                      # hundido del relieve
EMB_MARGIN = 0.34

ROLL_R = 0.0550
ROLL_W = 0.3000
ROLL_CX = -0.0500
ROLL_CY = 0.1050

TONGUE_W = 0.1200
TONGUE_CX = -0.1400


def emboss(u, v):
    """Desplazamiento del relieve en la coordenada de superficie (u, v)."""
    a = ((u + v) / EMB_PITCH) % 1.0 - 0.5
    b = ((u - v) / EMB_PITCH) % 1.0 - 0.5
    return -EMB_DEPTH if max(abs(a), abs(b)) < EMB_MARGIN else 0.0


def _grid(name, rows, cols, pos_fn, material_, flip=False):
    """Malla rejilla generica: pos_fn(i, j) -> Vector."""
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
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material_)
    return obj


# ------------------------------------------------------------- lengueta -----

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


def peel_path():
    """
    Perfil (y, z) de la lengueta: sale tangente al frente del rollo, cae con
    curva suave y sigue plana en el piso hasta el frente del area.
    """
    y_tan = ROLL_CY - ROLL_R
    z_tan = ROLL_R
    curve = _bezier((y_tan, z_tan), (y_tan - 0.0140, z_tan - 0.0180),
                    (y_tan - 0.0430, SHEET_T), (y_tan - 0.0850, SHEET_T / 2.0), 20)
    flat_end = -0.1500
    straight = []
    n = 12
    for i in range(1, n + 1):
        t = i / n
        straight.append((curve[-1][0] + (flat_end - curve[-1][0]) * t,
                         SHEET_T / 2.0))
    return curve + straight


def _path_frames(path):
    """Para cada punto del perfil: posicion, normal y arco acumulado."""
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
        ny, nz = -tz, ty              # normal hacia arriba
        if nz < 0:
            ny, nz = -ny, -nz
        if i > 0:
            s += math.hypot(y - path[i - 1][0], z - path[i - 1][1])
        frames.append(((y, z), (ny, nz), s))
    return frames


def build_tongue():
    """Lengueta desplegada: piel superior con relieve, piel inferior y cantos."""
    path = peel_path()
    frames = _path_frames(path)
    rows, cols = len(frames), 26
    x0 = TONGUE_CX - TONGUE_W / 2.0
    half = SHEET_T / 2.0

    def surface(i, j, side):
        (y, z), (ny, nz), s = frames[i]
        x = x0 + TONGUE_W * (j / (cols - 1))
        off = half if side > 0 else -half
        if side > 0:
            off += emboss(x, s)
        return Vector((x, y + ny * off, z + nz * off))

    top = _grid("deadening-sheet-top", rows, cols,
                lambda i, j: surface(i, j, 1), brushed_alu())
    bottom = _grid("deadening-sheet-bottom", rows, cols,
                   lambda i, j: surface(i, j, -1), matte_black(), flip=True)

    # cantos: bandas que cierran los dos lados largos y el borde del frente
    rims = []
    for j_edge, tag in ((0, "left"), (cols - 1, "right")):
        rims.append(_grid("deadening-sheet-rim-%s" % tag, rows, 2,
                          lambda i, j, je=j_edge: surface(i, je, 1 - 2 * j),
                          matte_black()))
    rims.append(_grid("deadening-sheet-rim-front", 2, cols,
                      lambda i, j: surface(rows - 1, j, 1 - 2 * i),
                      matte_black()))
    return [top, bottom] + rims


def _cyl_grid(name, radius, length, cx, cy, segments, steps, material_):
    """
    Piel cilindrica cerrada con el MISMO relieve que la lengueta: el patron se
    evalua en (u = posicion sobre el eje, v = arco sobre la circunferencia),
    asi que las espiras del rollo y la lamina desplegada comparten textura.
    Eje sobre X, apoyado en el piso (centro a z = radius).
    """
    bm = bmesh.new()
    verts = []
    for i in range(segments):
        a = 2 * math.pi * i / segments
        arc = radius * a
        col = []
        for j in range(steps + 1):
            u = -length / 2.0 + length * (j / steps)
            r = radius + emboss(u, arc)
            col.append(bm.verts.new((cx + u,
                                     cy + r * math.cos(a),
                                     radius + r * math.sin(a))))
        verts.append(col)

    for i in range(segments):
        n = (i + 1) % segments
        for j in range(steps):
            try:
                bm.faces.new([verts[i][j], verts[i][j + 1],
                              verts[n][j + 1], verts[n][j]])
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material_)
    return obj


def build_roll():
    """Rollo: piel con relieve, butilo visible en las tapas y nucleo hueco."""
    parts = []
    parts.append(_cyl_grid("deadening-roll", ROLL_R, ROLL_W, ROLL_CX, ROLL_CY,
                           segments=56, steps=30, material_=brushed_alu()))

    for i, s in enumerate((-1.0, 1.0)):
        parts.append(tube("deadening-roll-face-%d" % (i + 1), ROLL_R - 0.0008,
                          0.0180, 0.0030, segments=56,
                          location=(ROLL_CX + s * (ROLL_W / 2.0 - 0.0012),
                                    ROLL_CY, ROLL_R),
                          rotation=(0.0, math.pi / 2.0, 0.0),
                          material=matte_black()))
    parts.append(cylinder("deadening-roll-core", 0.0180, ROLL_W - 0.0060,
                          segments=32,
                          location=(ROLL_CX, ROLL_CY, ROLL_R),
                          rotation=(0.0, math.pi / 2.0, 0.0),
                          material=textured_black()))
    return parts


def build_loose_sheets():
    """Tres laminas 250 x 180 apiladas con desfase y giro leve."""
    parts = []
    # corridas a la derecha y con giros mas chicos: asi la huella no alcanza
    # ni la lengueta (max x -0.080) ni el rollo (min y 0.050)
    specs = ((0.0640, -0.0580, 4.0), (0.0660, -0.0610, -2.5), (0.0600, -0.0650, 1.0))
    for k, (cx, cy, deg) in enumerate(specs):
        yaw = math.radians(deg)
        z_base = k * SHEET_T
        core = box("loose-sheet-core-%d" % (k + 1), (0.2500, 0.1800, SHEET_T),
                   location=(cx, cy, z_base + SHEET_T / 2.0),
                   rotation=(0.0, 0.0, yaw), material=matte_black())
        parts.append(core)

        # piel superior con el mismo relieve, apoyada sobre el nucleo
        rows, cols = 24, 32
        c, s = math.cos(yaw), math.sin(yaw)

        def skin(i, j, cx=cx, cy=cy, c=c, s=s, z_base=z_base):
            u = -0.1250 + 0.2500 * (j / (cols - 1))
            v = -0.0900 + 0.1800 * (i / (rows - 1))
            z = z_base + SHEET_T + 0.0004 + emboss(u, v)
            return Vector((cx + u * c - v * s, cy + u * s + v * c, z))

        parts.append(_grid("loose-sheet-skin-%d" % (k + 1), rows, cols,
                           skin, brushed_alu()))
    return parts


def build_roller():
    """Rodillo de aplicacion apoyado sobre la lengueta desplegada."""
    parts = []
    wheel_r = 0.0225
    z_sheet = SHEET_T
    wheel_c = (TONGUE_CX + 0.0100, -0.0350, z_sheet + wheel_r)

    parts.append(cylinder("roller-wheel", wheel_r, 0.0250, segments=32,
                          location=wheel_c, rotation=(0.0, math.pi / 2.0, 0.0),
                          material=rubber()))
    parts.append(cylinder("roller-axle", 0.0035, 0.0400, segments=16,
                          location=wheel_c, rotation=(0.0, math.pi / 2.0, 0.0),
                          material=brushed_alu()))

    # horquilla: dos brazos que abrazan la rueda y se juntan hacia el FRENTE
    # (si se juntaran hacia atras, el mango terminaba dentro del rollo)
    fork_top = (wheel_c[0], wheel_c[1] - 0.0210, wheel_c[2] + 0.0180)
    for i, s in enumerate((-1.0, 1.0)):
        arm_x = wheel_c[0] + s * 0.0165
        a = Vector((arm_x, wheel_c[1], wheel_c[2]))
        b = Vector((fork_top[0] + s * 0.0045, fork_top[1], fork_top[2]))
        d = b - a
        rot = d.to_track_quat("Z", "Y").to_euler()
        parts.append(cylinder("roller-fork-arm-%d" % (i + 1), 0.0032, d.length,
                              segments=12, location=tuple((a + b) / 2.0),
                              rotation=(rot.x, rot.y, rot.z),
                              material=brushed_alu()))

    # mango: sube hacia el frente 28 grados, 110 mm, lejos del rollo
    ang = math.radians(28.0)
    handle_len = 0.1100
    h_dir = Vector((0.0, -math.cos(ang), math.sin(ang)))
    h_a = Vector(fork_top)
    h_b = h_a + h_dir * handle_len
    rot = (h_b - h_a).to_track_quat("Z", "Y").to_euler()
    parts.append(cylinder("roller-handle", 0.0090, handle_len, segments=20,
                          location=tuple((h_a + h_b) / 2.0),
                          rotation=(rot.x, rot.y, rot.z), material=matte_black()))
    parts.append(sphere("roller-handle-cap", 0.0090, segments=20, rings=10,
                        location=tuple(h_b), material=matte_black()))
    return parts


def main():
    reset_scene()
    groups = {
        "roll": build_roll(),
        "tongue": build_tongue(),
        "loose-sheets": build_loose_sheets(),
        "roller": build_roller(),
    }

    print("\nhuellas XY por grupo (area util 0.400 x 0.320):")
    for name, objs in groups.items():
        lo, hi = world_bounds(objs)
        print("  %-14s x %7.3f .. %7.3f   y %7.3f .. %7.3f   z max %6.3f"
              % (name, lo.x, hi.x, lo.y, hi.y, hi.z))

    parts = [o for objs in groups.values() for o in objs]
    print("\npiezas: %d" % len(parts))
    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huerfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    obj = join_objects(parts, "sound-deadening")
    finalize(obj, "sound-deadening", expected_dims=(None, None, None))


if __name__ == "__main__":
    main()
