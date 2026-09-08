"""
Sonoro — categoría "kits de instalación" (install-kit).
Bodegon de componentes agrupados sobre el piso, sin caja.

    blender --background --python scripts/models3d/install-kit.py

Referencia de medidas (metros):
    area    0.300 (X) x 0.220 (Y), alto maximo 0.090
    rollo de poder  0.180 exterior / 0.055 interior, 4 vueltas, seccion 11 mm
    rollo de tierra 0.110 exterior, 3 vueltas, apoyado plano en el piso
    rollo de remoto 0.050 exterior, 2.5 vueltas
    portafusible ANL 0.095 x 0.035 x 0.030

Tres reglas que el script hace cumplir por codigo, no a ojo:

1. NADA FLOTA NI SE APILA. Todos los grupos se apoyan planos en el piso con
   snap_group_to_floor(): su punto mas bajo queda exactamente en z = 0. Ya no
   hay rollo inclinado cabalgando sobre otro — eso era lo que leia flotando.
2. NADA SE TOCA. audit_layout() mide la separacion real entre las huellas XY
   de cada par de grupos y avisa si baja de 6 mm. El frente esta repartido
   como una fila con anchos calculados, no a ojo:
       abanico de ojos  -0.142 .. -0.066
       par de bananas   -0.055 .. -0.031
       ANL              -0.013 ..  0.083
       term. de bocina   0.095 ..  0.145
3. LO QUE SE CONECTA, PENETRA. Ojos unidos al barril por lengueta, postes
   metidos 4 mm en el cuerpo del ANL, tornillos metidos en los postes.

Los rollos rojo y negro van SIN terminal ni cola: son solo rollos.
El paso radial de cada rollo se calcula para que las vueltas no se
interpenetren (por eso el negro lleva 3 vueltas y el azul 2.5).
Rotaciones deterministas: semilla fija, no random en runtime.
"""

import importlib
import math
import os
import random
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

SEED = 20260903
RNG = random.Random(SEED)

CS_POWER = 0.0055                       # seccion del 4 AWG (11 mm de diametro)
CS_REMOTE = 0.0026
SIDES = 8
MIN_GAP = 0.0060

# rollos: centro y radio exterior. Los tres apoyan planos en el piso.
RED_C, RED_R, RED_TURNS = (-0.0580, 0.0160), 0.0900, 4.0
GND_C, GND_R, GND_TURNS = (0.0940, 0.0300), 0.0550, 3.0
BLUE_C, BLUE_R, BLUE_TURNS = (0.1200, -0.0580), 0.0250, 2.5


def jitter(deg=3.0):
    return math.radians(RNG.uniform(-deg, deg))


# --------------------------------------------------------- apoyo / audit ----

def snap_group_to_floor(objs, z=0.0):
    """Baja el grupo entero hasta que su punto mas bajo quede en z."""
    bpy.context.view_layer.update()
    lo, _ = world_bounds(objs)
    dz = z - lo.z
    for o in objs:
        o.data.transform(Matrix.Translation(Vector((0.0, 0.0, dz))))
        o.data.update()
    bpy.context.view_layer.update()
    return objs


def audit_layout(groups):
    print("\nauditoria de layout (separacion XY entre grupos):")
    names = list(groups.keys())
    ok = True
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = names[i], names[j]
            alo, ahi = world_bounds(groups[a])
            blo, bhi = world_bounds(groups[b])
            dx = max(blo.x - ahi.x, alo.x - bhi.x, 0.0)
            dy = max(blo.y - ahi.y, alo.y - bhi.y, 0.0)
            gap = math.hypot(dx, dy)
            if gap < MIN_GAP:
                print("  %-20s %-20s %6.1f mm  <-- REVISAR" % (a, b, gap * 1000))
                ok = False
            else:
                print("  %-20s %-20s %6.1f mm" % (a, b, gap * 1000))
    print("  resultado: %s" % ("todo separado" if ok else "hay pares muy juntos"))

    print("\napoyo en el piso (z minimo por grupo, debe ser 0.00 mm):")
    for name, objs in groups.items():
        lo, _ = world_bounds(objs)
        flag = "" if abs(lo.z) < 1e-4 else "   <-- FLOTA / HUNDIDO"
        print("  %-20s %7.2f mm%s" % (name, lo.z * 1000, flag))


def _coil(name, center, r_outer, turns, section, material_, phase,
          r_inner=None, rise=0.0060, steps=48):
    """
    Rollo apoyado plano. El radio interior se deriva del paso radial minimo
    (una seccion completa por vuelta) para que las vueltas no se pisen.
    """
    r_out = r_outer - section
    min_span = turns * (2.0 * section)
    r_in = r_inner if r_inner is not None else max(r_out - min_span, section * 2)
    if r_out - r_in < min_span:
        r_in = r_out - min_span
    path = flat_coil_path(r_out, r_in, turns=turns, z_base=section,
                          rise=rise, steps_per_turn=steps, phase=phase)
    cx, cy = center
    path = [(x + cx, y + cy, z) for (x, y, z) in path]
    return swept_tube(name, path, section, sides=SIDES, material=material_)


def build_power_coil():
    """Rollo de 4 AWG rojo: 4 vueltas, 180 -> 55 mm. Solo el rollo."""
    coil = _coil("power-cable-coil", RED_C, RED_R, RED_TURNS, CS_POWER,
                 cable_red(), phase=2.55, r_inner=0.0275 + CS_POWER,
                 rise=0.0090)
    return snap_group_to_floor([coil])


def build_ground_coil():
    """
    Rollo de tierra negro: 3 vueltas, 110 mm exterior, plano en el piso.
    Se reduce de 150 a 110 mm porque dos rollos de 180 y 150 no caben en
    300 mm sin pisarse: el limite geometrico es 112 mm con 6 mm de holgura.
    """
    coil = _coil("ground-cable-coil", GND_C, GND_R, GND_TURNS, CS_POWER,
                 matte_black(), phase=0.9, rise=0.0070)
    return snap_group_to_floor([coil])


def build_remote_coil():
    """Rollo chico de cable remoto azul, 2.5 vueltas."""
    coil = _coil("remote-cable-coil", BLUE_C, BLUE_R, BLUE_TURNS, CS_REMOTE,
                 cable_blue(), phase=1.1, rise=0.0045, steps=32)
    return snap_group_to_floor([coil])


# ------------------------------------------------------------- accesorios ---

def build_fuse_holder():
    """Portafusible ANL: cuerpo ahumado, laminilla de cobre y dos postes."""
    parts = []
    cx, cy = 0.0350, -0.0860
    yaw = math.radians(6.0) + jitter(2)
    body_l, body_w, body_h = 0.0950, 0.0350, 0.0300
    ux, uy = math.cos(yaw), math.sin(yaw)

    body = box("fuse-holder-body", (body_l, body_w, body_h),
               location=(cx, cy, body_h / 2.0), rotation=(0.0, 0.0, yaw),
               material=screen_glass())
    apply_bevel(body, 0.0025, segments=2)
    parts.append(body)

    parts.append(box("fuse-element", (0.0620, 0.0090, 0.0040),
                     location=(cx, cy, body_h * 0.55), rotation=(0.0, 0.0, yaw),
                     material=copper()))

    for i, s in enumerate((-1.0, 1.0)):
        px = cx + ux * s * (body_l / 2.0 + 0.0040)
        py = cy + uy * s * (body_l / 2.0 + 0.0040)
        post = box("fuse-terminal-%d" % (i + 1), (0.0180, 0.0200, 0.0150),
                   location=(px, py, 0.0075), rotation=(0.0, 0.0, yaw),
                   material=chrome())
        apply_bevel(post, 0.0010, segments=2)
        parts.append(post)
        parts.append(cylinder("fuse-terminal-screw-%d" % (i + 1), 0.0038, 0.0070,
                              segments=6, location=(px, py, 0.0160),
                              rotation=(0.0, 0.0, yaw + jitter(20)),
                              material=chrome()))
    return snap_group_to_floor(parts)


def build_ring_terminals():
    """
    6 terminales de ojo en abanico apuntando al frente. Abanico de +-14 grados:
    con mas apertura el largo de 26 mm invadia la fila de al lado.
    """
    parts = []
    for i in range(6):
        yaw = math.radians(-90.0 + (i - 2.5) * 5.6) + jitter(1.5)
        ux, uy = math.cos(yaw), math.sin(yaw)
        ox = -0.1420 + i * 0.0140
        oy = -0.0820
        parts.append(cylinder("ring-terminal-barrel-%d" % (i + 1), 0.0032, 0.0130,
                              segments=12, location=(ox, oy, 0.0032),
                              rotation=(0.0, math.pi / 2.0, yaw),
                              material=copper()))
        parts.append(box("ring-terminal-tab-%d" % (i + 1), (0.0060, 0.0055, 0.0014),
                         location=(ox + ux * 0.0080, oy + uy * 0.0080, 0.0016),
                         rotation=(0.0, 0.0, yaw), material=copper()))
        parts.append(torus("ring-terminal-eye-%d" % (i + 1), 0.0046, 0.0016,
                           major_segments=16, minor_segments=6,
                           location=(ox + ux * 0.0142, oy + uy * 0.0142, 0.0016),
                           rotation=(0.0, 0.0, yaw), material=copper()))
    return snap_group_to_floor(parts)


def build_banana_pair():
    """Par de conectores banana, apuntando al frente para no invadir a los lados."""
    parts = []
    for i, (x, yaw_deg) in enumerate(((-0.0490, -84.0), (-0.0370, -96.0))):
        yaw = math.radians(yaw_deg) + jitter(2)
        y = -0.0920
        parts.append(cylinder("banana-plug-%d" % (i + 1), 0.0040, 0.0230,
                              segments=14, location=(x, y, 0.0040),
                              rotation=(0.0, math.pi / 2.0, yaw),
                              material=chrome()))
        parts.append(cylinder("banana-plug-collar-%d" % (i + 1), 0.0054, 0.0080,
                              segments=14,
                              location=(x - math.cos(yaw) * 0.0125,
                                        y - math.sin(yaw) * 0.0125, 0.0040),
                              rotation=(0.0, math.pi / 2.0, yaw),
                              material=matte_black()))
    return snap_group_to_floor(parts)


def build_speaker_terminals():
    """Dos terminales de bocina con su tornillo, al frente derecha."""
    parts = []
    for i, x in enumerate((0.1050, 0.1350)):
        y = -0.1000
        blk = box("speaker-terminal-%d" % (i + 1), (0.0200, 0.0160, 0.0130),
                  location=(x, y, 0.0065),
                  rotation=(0.0, 0.0, math.radians(12.0 * (1 - 2 * i)) + jitter(3)),
                  material=matte_black())
        apply_bevel(blk, 0.0010, segments=2)
        parts.append(blk)
        parts.append(cylinder("speaker-terminal-screw-%d" % (i + 1), 0.0035, 0.0055,
                              segments=6, location=(x, y, 0.0140),
                              rotation=(0.0, 0.0, jitter(25)), material=chrome()))
    return snap_group_to_floor(parts)


def main():
    reset_scene()
    groups = {
        "power-coil": build_power_coil(),
        "ground-coil": build_ground_coil(),
        "remote-coil": build_remote_coil(),
        "fuse-holder": build_fuse_holder(),
        "ring-terminals": build_ring_terminals(),
        "banana-pair": build_banana_pair(),
        "speaker-terminals": build_speaker_terminals(),
    }
    audit_layout(groups)

    parts = [o for objs in groups.values() for o in objs]
    print("\npiezas: %d (semilla %d)" % (len(parts), SEED))
    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huerfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    obj = join_objects(parts, "install-kit")
    finalize(obj, "install-kit", expected_dims=(None, None, None))


if __name__ == "__main__":
    main()
