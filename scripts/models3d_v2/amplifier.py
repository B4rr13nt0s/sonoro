"""
Sonoro — categoría "amplificadores" (amplifier).
Clase D de 4 canales, formato compacto.

    blender --background --python scripts/models3d/amplifier.py

Referencia de medidas (metros):
    largo  0.260 (eje X)   <- paneles cortos en -X (entradas) y +X (potencia)
    ancho  0.175 (eje Y)   <- mas las 2 orejas de montaje, que sobresalen
    alto   0.055 (eje Z)   <- pies 3 + cuerpo 40 + aletas 12

El rasgo silueta es el disipador: 14 aletas longitudinales corriendo los
260 mm. Nada de booleanos en las piezas estructurales.
"""

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
from _common import *  # noqa: F401,F403,E402

L = 0.2600                  # largo total (X)
W = 0.1750                  # ancho del cuerpo (Y)
H = 0.0550                  # alto total (Z)

H_FOOT = 0.0030
H_BODY = 0.0400
H_FIN = 0.0120
Z_BODY_BOT = H_FOOT
Z_BODY_TOP = Z_BODY_BOT + H_BODY        # 0.043
Z_FIN_TOP = Z_BODY_TOP + H_FIN          # 0.055

X_FACE = L / 2.0            # 0.130, cara de los paneles cortos
Y_HALF = W / 2.0            # 0.0875

FIN_COUNT = 14
FIN_W = 0.0040
# 14 aletas de 4 mm con paso de 14 mm miden 186 mm y no caben en 175 de ancho:
# se mantiene el conteo y el ancho, y el paso baja a 11.9 mm.
FIN_PITCH = 0.0119
FIN_LEN = L - 0.0100

PLATE_X = 0.1200            # placa central hundida 120 x 90
PLATE_Y = 0.0900
PLATE_SINK = 0.0030

SEG_ROUND = 24


def build_body():
    body = box("chassis", (L, W, H_BODY),
               location=(0.0, 0.0, Z_BODY_BOT + H_BODY / 2.0),
               material=brushed_alu())
    apply_bevel(body, 0.0030, segments=3)
    return body


def build_fins():
    """
    14 aletas longitudinales. Las que cruzan la placa central se parten en dos
    tramos para dejarla libre — asi se evita un boolean y se lee como la placa
    de identificacion que tienen los amplificadores reales.
    """
    parts = []
    z = Z_BODY_TOP + H_FIN / 2.0
    plate_x_half = PLATE_X / 2.0
    plate_y_half = PLATE_Y / 2.0
    seg_len = (FIN_LEN / 2.0) - plate_x_half - 0.0040
    seg_center = plate_x_half + 0.0040 + seg_len / 2.0

    for i in range(FIN_COUNT):
        y = (i - (FIN_COUNT - 1) / 2.0) * FIN_PITCH
        if abs(y) < plate_y_half + FIN_W:
            spans = ((-seg_center, seg_len), (seg_center, seg_len))
        else:
            spans = ((0.0, FIN_LEN),)
        for k, (cx, length) in enumerate(spans):
            fin = box("heatsink-fin-%02d%s" % (i + 1, "ab"[k] if len(spans) > 1 else ""),
                      (length, FIN_W, H_FIN), location=(cx, y, z),
                      material=brushed_alu())
            apply_bevel(fin, 0.0008, segments=1)
            parts.append(fin)
    return parts


def build_badge_plate():
    """Placa central hundida 3 mm + logo abstracto (solo geometria)."""
    parts = []
    z_plate = Z_BODY_TOP - PLATE_SINK
    parts.append(box("badge-plate", (PLATE_X, PLATE_Y, 0.0040),
                     location=(0.0, 0.0, z_plate - 0.0020),
                     material=matte_black()))

    z_logo = z_plate + 0.0006
    parts.append(torus("logo-ring", 0.0230, 0.0022, major_segments=40,
                       minor_segments=8, location=(0.0, 0.0, z_logo),
                       material=brushed_alu()))
    for i, (dx, w) in enumerate(((-0.0060, 0.0260), (0.0060, 0.0180))):
        bar = box("logo-bar-%d" % (i + 1), (0.0035, w, 0.0030),
                  location=(dx, 0.0, z_logo), material=brushed_alu())
        apply_bevel(bar, 0.0006, segments=1)
        parts.append(bar)
    return parts


def build_input_panel():
    """
    Panel corto A (-X): 4 RCA hembra, 2 potenciometros, 2 switches.

    Reparto en Y con holgura uniforme de 9 mm entre bordes de piezas vecinas
    (no entre centros), y el grupo completo centrado en el panel. Los RCA
    conservan paso constante entre si y los potenciometros tambien.
    """
    parts = []
    x = -X_FACE
    z = Z_BODY_BOT + H_BODY / 2.0
    rot = (0.0, math.pi / 2.0, 0.0)          # eje de los cilindros sobre X

    y_switch = 0.0737                        # simetrico: -y_switch y +y_switch
    y_rca = (-0.0519, -0.0313, -0.0107, 0.0099)   # paso 20.6 mm
    y_pot = (0.0307, 0.0517)                      # paso 21.0 mm

    # 4 jacks RCA de 9 mm, aros alternados
    for i, y in enumerate(y_rca):
        parts.append(cylinder("rca-jack-%d" % (i + 1), 0.0045, 0.0090,
                              segments=SEG_ROUND, location=(x - 0.0030, y, z),
                              rotation=rot, material=chrome()))
        ring_mat = accent_orange() if i % 2 == 0 else brushed_alu()
        parts.append(tube("rca-ring-%d" % (i + 1), 0.0058, 0.0045, 0.0022,
                          segments=SEG_ROUND, location=(x - 0.0012, y, z),
                          rotation=rot, material=ring_mat))
        parts.append(cylinder("rca-pin-%d" % (i + 1), 0.0012, 0.0060,
                              segments=10, location=(x - 0.0020, y, z),
                              rotation=rot, material=chrome()))

    # 2 potenciometros de ganancia de 12 mm con muesca indicadora
    for i, y in enumerate(y_pot):
        knob = cylinder("gain-pot-%d" % (i + 1), 0.0060, 0.0070,
                        segments=SEG_ROUND, location=(x - 0.0025, y, z),
                        rotation=rot, material=matte_black())
        apply_bevel(knob, 0.0008, segments=1)
        parts.append(knob)
        parts.append(box("gain-pot-notch-%d" % (i + 1), (0.0020, 0.0012, 0.0048),
                         location=(x - 0.0055, y, z + 0.0028),
                         material=brushed_alu()))

    # 2 switches deslizables de 14 x 5 mm
    for i, y in enumerate((-y_switch, y_switch)):
        parts.append(box("switch-well-%d" % (i + 1), (0.0030, 0.0140, 0.0080),
                         location=(x - 0.0010, y, z), material=matte_black()))
        parts.append(box("switch-lever-%d" % (i + 1), (0.0026, 0.0050, 0.0055),
                         location=(x - 0.0022, y - 0.0035, z),
                         material=brushed_alu()))
    return parts


def hex_socket(name, radius, depth, location, rotation, material_):
    """Barreno hexagonal hundido, como cilindro de 6 lados (sin boolean)."""
    return cylinder(name, radius, depth, segments=6, location=location,
                    rotation=rotation, material=material_)


def build_power_panel():
    """Panel corto B (+X): +12V, GND, REM y 4 salidas de bocina."""
    parts = []
    x = X_FACE
    rot = (0.0, math.pi / 2.0, 0.0)
    z_mid = Z_BODY_BOT + H_BODY / 2.0

    def terminal(name, size, y, z, socket_r):
        blk = box(name, (0.0060, size, size), location=(x + 0.0030, y, z),
                  material=matte_black())
        apply_bevel(blk, 0.0008, segments=1)
        parts.append(blk)
        parts.append(hex_socket(name + "-socket", socket_r, 0.0055,
                                (x + 0.0042, y, z), rot, chrome()))

    terminal("power-terminal-positive", 0.0160, -0.0640, z_mid, 0.0042)
    terminal("power-terminal-ground", 0.0160, -0.0430, z_mid, 0.0042)
    terminal("remote-terminal", 0.0080, -0.0270, z_mid, 0.0022)

    for i in range(4):
        y = 0.0000 + i * 0.0180
        terminal("speaker-terminal-%d" % (i + 1), 0.0120, y, z_mid, 0.0030)
    return parts


def build_feet_and_ears():
    parts = []
    for i, (sx, sy) in enumerate(((-1, -1), (-1, 1), (1, -1), (1, 1))):
        foot = cylinder("rubber-foot-%d" % (i + 1), 0.0060, H_FOOT,
                        segments=SEG_ROUND,
                        location=(sx * (L / 2.0 - 0.0200),
                                  sy * (Y_HALF - 0.0200), H_FOOT / 2.0),
                        material=rubber())
        parts.append(foot)

    for i, sy in enumerate((-1, 1)):
        ear = box("mount-ear-%d" % (i + 1), (0.0250, 0.0200, 0.0040),
                  location=(0.0, sy * (Y_HALF + 0.0090),
                            Z_BODY_BOT + 0.0060),
                  material=brushed_alu())
        apply_bevel(ear, 0.0010, segments=2)
        parts.append(ear)
        parts.append(hex_socket("mount-ear-bolt-%d" % (i + 1), 0.0030, 0.0050,
                                (0.0, sy * (Y_HALF + 0.0130),
                                 Z_BODY_BOT + 0.0060), (0, 0, 0), chrome()))
    return parts


def main():
    reset_scene()
    parts = [build_body()]
    parts += build_fins()
    parts += build_badge_plate()
    parts += build_input_panel()
    parts += build_power_panel()
    parts += build_feet_and_ears()

    print("\npiezas: %d" % len(parts))
    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huerfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    obj = join_objects(parts, "amplifier")
    finalize(obj, "amplifier", expected_dims=(0.260, None, 0.055))


if __name__ == "__main__":
    main()
