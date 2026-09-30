"""
Sonoro — categoría "ecualizadores" (equalizer), versión 3.
Ecualizador gráfico de bajo tablero, media-DIN, chasis plano.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/equalizer.py

Geometría portada de scripts/models3d/equalizer.py (v1), que generó el
equalizer-2.glb publicado. Medidas sin cambios:

    cuerpo    0.178 (X) x 0.085 (Y) x 0.020 (Z) sobre pies de 3 mm
    bezel     0.190 x 0.026, placa frontal con orejas en los dos extremos
    controles 11 en fila, repartidos en TODA la cara frontal con luz uniforme
              entre bordes (el encabezado de la v1 decía «alineada a la
              derecha», pero el código —y el modelo publicado— los reparten
              en toda la cara; manda el código)
    jacks     10 RCA y la bornera en la cara TRASERA; la tapa va limpia
    total     0.026 de alto

Icono de categoría: sin logos ni texto. Frente hacia −Y en el script;
`finalize` lo gira a +Y, así que ya no necesita `giroBase`.

Ojo al juzgar «de frente o de espaldas» a ojo: los RCA traseros llevan aro
accent-orange y se parecen bastante a perillas. La fila de controles reales
es la de conos oscuros del canto frontal.

Qué cambia respecto de la v1
----------------------------
  - Chasis en aluminio anodizado NEGRO (metálico): refleja el estudio y
    dibuja la forma. En plástico negro mate el modelo entero era una silueta.
  - Bisel del chasis de 2 mm (antes 1.2) y del bezel de 1.5 mm (antes 1.0).
  - Bezel y perillas satinados: los conos de las perillas agarran brillo y
    la fila se lee como controles.
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

ARCHIVO = "equalizer-3"

W = 0.1780
D = 0.0850
BODY_H = 0.0200

BEZEL_T = 0.0035
BEZEL_H = 0.0260
EAR_W = 0.0060                          # oreja a cada costado

Z_BODY_BOT = 0.0030
Z_BODY_TOP = Z_BODY_BOT + BODY_H        # 0.023
Y_FRONT = -D / 2.0                      # -0.0425
Y_FACE = Y_FRONT - BEZEL_T              # -0.046
Y_BACK = D / 2.0                        # 0.0425

Z_CTRL = 0.0130                         # eje de la hilera

# (nombre, radio, cuánto sobresale). Bandas de 11 mm, dos grandes de 14 y el
# mini switch de dos posiciones.
CONTROLS = [
    ("sub-level", 0.0068, 0.0095),
    ("volume", 0.0068, 0.0095),
    ("source-switch", 0.0030, 0.0070),
    ("fader", 0.0055, 0.0088),
    ("band-50", 0.0055, 0.0088),
    ("band-125", 0.0055, 0.0088),
    ("band-315", 0.0055, 0.0088),
    ("band-750", 0.0055, 0.0088),
    ("band-2k2", 0.0055, 0.0088),
    ("band-6k", 0.0055, 0.0088),
    ("band-16k", 0.0055, 0.0088),
]
ROW_MARGIN = 0.0080                     # aire a cada canto de la cara

SEG_ROUND = 32


def control_positions():
    """
    Reparte los 11 controles a lo largo de TODA la cara frontal, con luz
    uniforme entre BORDES (no entre centros: con diámetros distintos, el paso
    constante deja huecos desiguales) y márgenes iguales a los dos cantos.
    """
    widths = [2 * r for (_, r, _) in CONTROLS]
    span = W - 2 * ROW_MARGIN
    gap = (span - sum(widths)) / (len(CONTROLS) - 1)
    x = -span / 2.0
    out = []
    for (name, r, out_len), w in zip(CONTROLS, widths):
        out.append((name, r, out_len, x + w / 2.0))
        x += w + gap
    return out, gap


def build_body():
    """Plancha principal, con la tapa marcada por una junta en los costados."""
    parts = []
    body = box("chassis", (W, D, BODY_H),
               location=(0.0, 0.0, Z_BODY_BOT + BODY_H / 2.0),
               material=anodized_black())
    bevel(body, 0.0020, segments=3)
    parts.append(body)

    for name, size, loc in (
        ("chassis-seam-left", (0.0012, D - 0.0060, 0.0016),
         (-W / 2.0 + 0.0002, 0.0, Z_BODY_TOP - 0.0075)),
        ("chassis-seam-right", (0.0012, D - 0.0060, 0.0016),
         (W / 2.0 - 0.0002, 0.0, Z_BODY_TOP - 0.0075)),
    ):
        parts.append(box(name, size, location=loc, material=textured_black()))
    return parts


def build_bezel():
    """Placa frontal del alto del cuerpo, con oreja y dos tornillos por lado."""
    parts = []
    bezel = box("front-bezel", (W + 2 * EAR_W, BEZEL_T, BEZEL_H),
                location=(0.0, Y_FRONT - BEZEL_T / 2.0, BEZEL_H / 2.0),
                material=satin_black())
    bevel(bezel, 0.0015, segments=3)
    parts.append(bezel)

    inset = 0.0035
    face_half_w = W / 2.0 + EAR_W
    for i, sx in enumerate((-1, 1)):
        for j, z in enumerate((inset, BEZEL_H - inset)):
            parts.append(cylinder("bezel-screw-%d-%d" % (i + 1, j + 1),
                                  0.0020, 0.0016, segments=SEG_ROUND,
                                  location=(sx * (face_half_w - inset), Y_FACE + 0.0003, z),
                                  rotation=(math.pi / 2.0, 0.0, 0.0),
                                  material=brushed_alu()))

    for j, x in enumerate((-0.0855, 0.0855)):
        parts.append(cylinder("face-bore-%d" % (j + 1), 0.0018, 0.0022, segments=16,
                              location=(x, Y_FACE + 0.0006, Z_CTRL),
                              rotation=(math.pi / 2.0, 0.0, 0.0),
                              material=textured_black()))
    return parts


def build_control_row():
    """
    Hilera de controles: cada perilla con nido hundido, cuerpo troncocónico y
    punto indicador girado distinto.
    """
    parts = []
    positions, gap = control_positions()
    rot = (math.pi / 2.0, 0.0, 0.0)

    for i, (name, r, out_len, x) in enumerate(positions):
        parts.append(cylinder("control-well-%s" % name, r + 0.0007, 0.0016,
                              segments=SEG_ROUND, location=(x, Y_FACE + 0.0007, Z_CTRL),
                              rotation=rot, material=textured_black()))

        if name == "source-switch":
            lever = box("switch-lever", (0.0034, out_len, 0.0080),
                        location=(x, Y_FACE - out_len / 2.0 + 0.0003, Z_CTRL + 0.0016),
                        material=satin_black())
            bevel(lever, 0.0006, segments=2)
            parts.append(lever)
            continue

        knob = cone("knob-%s" % name, r, r - 0.0007, out_len, segments=SEG_ROUND,
                    location=(x, Y_FACE - out_len / 2.0 + 0.0003, Z_CTRL),
                    rotation=(-math.pi / 2.0, 0.0, 0.0), material=satin_black())
        bevel(knob, 0.0008, segments=2)
        parts.append(knob)

        ang = math.radians((-130.0 + i * 29.0) % 360.0)
        dot_mat = accent_orange() if name == "sub-level" else brushed_alu()
        parts.append(cylinder("knob-dot-%s" % name, 0.0007, 0.0012, segments=12,
                              location=(x + (r - 0.0022) * math.sin(ang),
                                        Y_FACE - out_len - 0.0002,
                                        Z_CTRL + (r - 0.0022) * math.cos(ang)),
                              rotation=rot, material=dot_mat))
    return parts, gap


def build_rear_jacks():
    """10 RCA y la bornera, en la CARA TRASERA (la tapa queda limpia)."""
    parts = []
    rot = (math.pi / 2.0, 0.0, 0.0)
    z = Z_BODY_BOT + BODY_H / 2.0
    pitch = 0.0125
    x0 = -0.0790
    for i in range(10):
        x = x0 + i * pitch
        parts.append(cylinder("rear-jack-%d" % (i + 1), 0.0042, 0.0062,
                              segments=SEG_ROUND, location=(x, Y_BACK + 0.0031, z),
                              rotation=rot, material=chrome()))
        parts.append(tube("rear-jack-ring-%d" % (i + 1), 0.0054, 0.0042, 0.0014,
                          segments=SEG_ROUND, location=(x, Y_BACK + 0.0055, z),
                          rotation=rot,
                          material=accent_orange() if i % 2 == 0 else brushed_alu()))
        parts.append(cylinder("rear-jack-pin-%d" % (i + 1), 0.0011, 0.0034,
                              segments=12, location=(x, Y_BACK + 0.0028, z),
                              rotation=rot, material=chrome()))

    blk = box("power-terminal-block", (0.0260, 0.0055, 0.0110),
              location=(0.0640, Y_BACK + 0.0027, z), material=textured_black())
    bevel(blk, 0.0008, segments=2)
    parts.append(blk)
    for i in range(3):
        parts.append(cylinder("power-terminal-screw-%d" % (i + 1), 0.0026, 0.0020,
                              segments=6, location=(0.0560 + i * 0.0080, Y_BACK + 0.0056, z),
                              rotation=rot, material=chrome()))
    return parts


def build_side_bores():
    """Dos barrenos de montaje en cada costado del cuerpo."""
    parts = []
    for i, sx in enumerate((-1, 1)):
        for j, y in enumerate((-0.0180, 0.0060)):
            parts.append(cylinder("side-bore-%d-%d" % (i + 1, j + 1), 0.0021, 0.0024,
                                  segments=16,
                                  location=(sx * (W / 2.0 - 0.0002), y, Z_BODY_BOT + 0.0065),
                                  rotation=(0.0, math.pi / 2.0, 0.0),
                                  material=textured_black()))
    return parts


def main():
    reset_scene()
    parts = []
    parts += build_body()
    parts += build_bezel()
    row, gap = build_control_row()
    parts += row
    parts += build_rear_jacks()
    parts += build_side_bores()

    print("\nhilera: %d controles, luz entre bordes %.1f mm" % (len(CONTROLS), gap * 1000))
    print("piezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "equalizer")
    finalize(obj, ARCHIVO, front="-Y", ao="--ao" in sys.argv)


if __name__ == "__main__":
    main()
