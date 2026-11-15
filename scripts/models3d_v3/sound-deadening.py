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

sound-deadening-4 (noviembre de 2026)
-------------------------------------
Pedido del negocio: mejorar la textura de la parte plateada, y que el rollo
se vea como una lámina enrollada y no como un cilindro.

  - ALUMINIO GOFRADO CON MAPA DE NORMALES. La lámina de verdad lleva un
    relieve de rombos de pocos milímetros. En la v3 solo lo tenía la lámina
    suelta de arriba, como geometría (rejilla de 4 mm, 3,400 triángulos), y
    la lengüeta y el rollo iban lisos: «con la rejilla que admite el
    presupuesto el patrón salía como ruido». Ahora TODAS las caras de
    aluminio de la lámina usan `foil_material` (_common.py): los valores de
    brushed-alu más un mapa de normales de 64 x 64 en mosaico, dibujado acá
    con numpy (`foil_normal_map`). Es la segunda textura del carrusel, junto
    con las pantallas encendidas, y la única que no es emisiva. Las láminas
    sueltas vuelven a ser cajas de cara plana.
  - EL ROLLO ES UNA LÁMINA ENROLLADA. Las dos caras eran discos negros
    macizos: de costado se leía un cilindro. Ahora cada cara muestra la
    ESPIRAL de las capas —el butilo negro y, entre vuelta y vuelta, el filo
    de aluminio— alrededor del hueco del centro. La espiral termina donde
    empieza la vuelta de afuera, que es la lengüeta. Las vueltas se dibujan
    de 3.4 mm, no de los 2 mm de la lámina: a tamaño de carrusel 2 mm es
    poco más de un píxel y las líneas se empastaban.
  - No cambian las medidas exteriores (el radio y la altura de este modelo
    son los que fijan el encuadre de los nueve), la lengüeta, la pila ni el
    rodillo.

sound-deadening-5 (noviembre de 2026): sin la orilla negra del rollo
--------------------------------------------------------------------
En sound-deadening-4 se había conservado, en el canto de cada cara del
rollo, el aro del disco macizo de la v3: sus vértices eran los más lejanos
del eje y de ellos salía el radio del modelo, que fija el encuadre y el
displayScale de los nueve. Pero ese aro mide 54.7 mm de radio y la vuelta de
afuera de la lámina, en espiral, va de 53 a 55: en media vuelta el aro
asomaba por encima del aluminio como una orilla negra. El negocio pidió
quitarla.

  - Sale el aro. En el canto de cada cara queda lo que hay de verdad: el
    filo de la vuelta de afuera de la lámina.
  - Para que el radio del modelo siga en 0.2480 sin el aro, el rollo va
    0.5 mm más atrás (ROLL_CY 0.1050 -> 0.1055). Sin eso bajaba a 0.2478 y
    había que recalcular el displayScale de los nueve y regenerar todas las
    imágenes estáticas. Si se toca el rollo, la lengüeta o la pila, hay que
    volver a comprobar que `finalize` siga dando radio 0.2480.
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

ARCHIVO = "sound-deadening-5"

SHEET_T = 0.0020                        # espesor de lámina
FOIL_TILE = 0.0200                      # lado del mosaico del relieve: dos
                                        # rombos por mosaico, 14 mm de rombo
FOIL_PX = 64

ROLL_R = 0.0550
ROLL_W = 0.3000
ROLL_CX = -0.0500
ROLL_CY = 0.1055                        # 0.5 mm más atrás que en la v3: ver
                                        # «sound-deadening-5» en el encabezado
ROLL_CORE_R = ROLL_R - SHEET_T          # la capa exterior es la lengüeta
ROLL_HOLE_R = 0.0160                    # hueco del centro del rollo
ROLL_TURNS = 11                         # vueltas que se ven en cada cara
ROLL_FOIL_EDGE = 0.0010                 # filo de aluminio entre vuelta y vuelta

TONGUE_W = ROLL_W
TONGUE_CX = ROLL_CX
TONGUE_COLS = 16                        # solo lleva el pandeo transversal

LOOSE_W = 0.2500
LOOSE_D = 0.1100


def smoothstep(e0, e1, x):
    t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
    return t * t * (3.0 - 2.0 * t)


def foil_normal_map():
    """
    Mapa de normales del aluminio gofrado, en mosaico: una red de rombos
    abombados separados por ranuras. Devuelve (alto, ancho, 3) en 0..1 con la
    fila 0 arriba, como lo pide image_from_array.

    Con g = |sin πa| · |sin πb|, a = u + v y b = u − v, la altura es
    h = 1 − (1 − g)^2.5: vale 0 en las ranuras, sube rápido al salir de ellas
    y se aplana en el centro del rombo, como una almohadilla. (La primera
    versión, g^0.7 con 38° de pendiente, daba pirámides de canto vivo: se
    leía como chapa tachonada, no como aluminio gofrado.) La normal sale del
    gradiente, con v creciendo hacia ARRIBA (la convención de glTF: el verde
    es +V).
    """
    import numpy as np
    n = FOIL_PX
    u = (np.arange(n) + 0.5) / n
    uu, vv = np.meshgrid(u, u)               # fila i -> v creciente
    g = np.abs(np.sin(np.pi * (uu + vv))) * np.abs(np.sin(np.pi * (uu - vv)))
    h = 1.0 - (1.0 - g) ** 2.5
    du = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) / 2.0
    dv = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) / 2.0
    gain = math.tan(math.radians(30.0)) / np.percentile(np.hypot(du, dv), 95)
    nx, ny, nz = -du * gain, -dv * gain, np.ones_like(h)
    norm = np.sqrt(nx * nx + ny * ny + nz * nz)
    rgb = np.stack([nx / norm, ny / norm, nz / norm], axis=-1) * 0.5 + 0.5
    return rgb[::-1].astype(np.float32)      # fila 0 arriba


_FOIL = {}


def foil():
    """El material de aluminio gofrado, creado una sola vez."""
    if "mat" not in _FOIL:
        image = image_from_array("foil-normal", foil_normal_map(), colorspace="Non-Color")
        _FOIL["mat"] = foil_material("embossed-foil", image)
    return _FOIL["mat"]


def set_uv(obj, fn):
    """UV por vértice: fn(índice del vértice) -> (u, v), o None para dejarlo en 0."""
    me = obj.data
    layer = me.uv_layers.get("uv") or me.uv_layers.new(name="uv")
    for loop in me.loops:
        uv = fn(loop.vertex_index)
        layer.data[loop.index].uv = uv if uv is not None else (0.0, 0.0)
    return obj


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

    top = _grid("deadening-sheet-top", rows, cols, lambda i, j: surface(i, j, 1), foil())
    # el relieve corre a lo largo de la lámina: u a lo ancho, v sobre el arco
    set_uv(top, lambda k: ((k % cols) / (cols - 1) * TONGUE_W / FOIL_TILE,
                           frames[k // cols][2] / FOIL_TILE))
    pieces = [top,
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


def spiral_face(name, side):
    """
    Cara del rollo: la espiral de las capas de la lámina enrollada, plana, en
    dos materiales. Cada vuelta es una banda de butilo y, por fuera, el filo
    del aluminio. La primera vuelta nace con ancho cero en el borde del hueco;
    la última termina donde empieza la vuelta de afuera (la lengüeta), en el
    mismo ángulo, así que la espiral sigue de largo en ella.

    `side` es +1 para la cara de +X y −1 para la de −X: las caras miran
    hacia afuera del rollo.
    """
    pitch = (ROLL_CORE_R - 0.0005 - ROLL_HOLE_R) / ROLL_TURNS
    end = math.radians(WRAP_START_DEG + 90.0)    # ángulo donde nace la lengüeta
    x = ROLL_CX + side * (ROLL_W / 2.0 - 0.0004)
    bm = bmesh.new()
    rows = []
    for turn in range(ROLL_TURNS):
        steps = 28 if turn < ROLL_TURNS // 2 else 40
        for k in range(steps + (1 if turn == ROLL_TURNS - 1 else 0)):
            t = turn + k / steps                 # vueltas desde el hueco
            th = end - 2.0 * math.pi * (ROLL_TURNS - t)
            outer = ROLL_HOLE_R + pitch * t
            inner = max(ROLL_HOLE_R, outer - pitch)
            mid = max(inner, outer - ROLL_FOIL_EDGE)
            rows.append([bm.verts.new((x, ROLL_CY + r * math.cos(th), ROLL_R + r * math.sin(th)))
                         for r in (inner, mid, outer)])
    for a, b in zip(rows[:-1], rows[1:]):
        for band in (0, 1):
            quad = [a[band], a[band + 1], b[band + 1], b[band]]
            if side < 0:
                quad.reverse()
            try:
                face = bm.faces.new(quad)
            except ValueError:
                continue
            face.material_index = band
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(matte_black())
    obj.data.materials.append(brushed_alu())
    return obj


def build_roll():
    """
    El rollo por dentro de la vuelta de afuera: un tubo de butilo con el
    hueco del centro y, en cada cara, la espiral de las capas. La vuelta de
    afuera es la lengüeta (build_tongue).
    """
    half = ROLL_W / 2.0 - 0.0010
    core = lathe("deadening-roll", [
        (ROLL_HOLE_R, -half), (ROLL_CORE_R, -half), (ROLL_CORE_R, half),
        (ROLL_HOLE_R, half), (ROLL_HOLE_R, -half),
    ], segments=64, location=(ROLL_CX, ROLL_CY, ROLL_R),
        rotation=(0.0, math.pi / 2.0, 0.0), material=matte_black())
    return [core, spiral_face("deadening-roll-face-1", -1.0),
            spiral_face("deadening-roll-face-2", 1.0)]


# ------------------------------------------------------- láminas sueltas ----

def slab(name, cx, cy, yaw, w, d, z_base, t):
    """
    Lámina suelta como sólido CERRADO: una caja con la cara de arriba en
    aluminio gofrado (con su UV) y los cantos y el fondo en butilo. Sin piezas
    superpuestas: no hay nada que atravesar.
    """
    c, s = math.cos(yaw), math.sin(yaw)
    corners = [(-w / 2.0, -d / 2.0), (w / 2.0, -d / 2.0), (w / 2.0, d / 2.0), (-w / 2.0, d / 2.0)]

    def place(u, v, z):
        return Vector((cx + u * c - v * s, cy + u * s + v * c, z))

    bm = bmesh.new()
    top = [bm.verts.new(place(u, v, z_base + t)) for (u, v) in corners]
    bottom = [bm.verts.new(place(u, v, z_base)) for (u, v) in corners]
    bm.faces.new(top)
    others = [bm.faces.new(list(reversed(bottom)))]
    for k in range(4):
        n = (k + 1) % 4
        others.append(bm.faces.new([top[k], bottom[k], bottom[n], top[n]]))
    for f in others:
        f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))

    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(foil())
    obj.data.materials.append(matte_black())
    set_uv(obj, lambda k: ((corners[k][0] / FOIL_TILE, corners[k][1] / FOIL_TILE)
                           if k < 4 else None))
    return obj


def build_loose_sheets():
    """Tres láminas apiladas al frente, con desfase y giro leve."""
    specs = ((-0.0500, -0.1720, 3.5), (-0.0470, -0.1750, -2.5), (-0.0530, -0.1690, 1.0))
    return [slab("loose-sheet-%d" % (k + 1), cx, cy, math.radians(deg),
                 LOOSE_W, LOOSE_D, k * SHEET_T, SHEET_T)
            for k, (cx, cy, deg) in enumerate(specs)]


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
    finalize(obj, ARCHIVO, front="-Y", ao="--ao" in sys.argv, texture=True)


if __name__ == "__main__":
    main()
