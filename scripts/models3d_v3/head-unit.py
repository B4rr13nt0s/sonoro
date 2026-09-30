"""
Sonoro — categoría "receptores" (head-unit), versión 3.
Radio 1-DIN con lector de CD y display LCD horizontal.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/head-unit.py

Geometría portada de scripts/models3d/head-unit.py (v1), que generó el
head-unit.glb publicado. Medidas sin cambios:

    frente   0.178 (X) x 0.050 (Z)      bezel 1-DIN, sobresale del chasis
    chasis   0.160 (X) x 0.045 (Z) x 0.140 (Y), brushed-alu con celosías
    total Y  0.165 = bezel 0.012 + chasis 0.140 + conectores 0.013
             (el mazo de cable sale 0.040 más y no cuenta en la cota)

Icono de categoría, no un SKU: sin logos ni texto legible. La lectura de
«radio» la dan la franja de LCD horizontal, la perilla grande a la
izquierda, la fila de botones finos bajo el display y la jaula metálica
expuesta atrás.

El script construye con el frente hacia −Y; `finalize` lo gira a +Y, así que
ya no necesita `giroBase`.

Qué cambia respecto de la v1
----------------------------
  - Normales: la v1 salía 100 % suavizada (ver _common.py, nota 1).
  - LCD ENCENDIDO, igual que la pantalla de screen.py: fondo azul, glifo de
    ecualizador, barras de «pista» y reloj en bloques (screen_ui.render_lcd,
    textura emisiva de 512 x 64). Nada legible.
  - Bezel satinado, reborde del LCD en negro piano, perilla satinada con
    bisel de 1.5 mm y jaula con bisel de 2.5 mm (antes 1.8).
  - Mazo de cable: un solo tubo barrido y suavizado.
  - Cilindros a 32 segmentos (antes 28).
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
import screen_ui                                            # noqa: E402
importlib.reload(screen_ui)

ARCHIVO = "head-unit-3"

# --- frente 1-DIN
W = 0.1780
H = 0.0500
BEZEL_T = 0.0120
Y_FRONT = -0.0825
Y_FACE = Y_FRONT + 0.0002               # plano de apoyo de los controles
Y_BEZEL_BACK = Y_FRONT + BEZEL_T        # -0.0705

# --- chasis
CH_W = 0.1600
CH_H = 0.0450
CH_D = 0.1400
Y_CH_BACK = Y_BEZEL_BACK + CH_D         # 0.0695
Z_CH_BOT = (H - CH_H) / 2.0             # 0.0025
Z_CH_TOP = Z_CH_BOT + CH_H              # 0.0475

# --- reparto vertical de la cara (Z de 0 a 0.050)
Z_CD_SLOT = 0.0428                      # ranura fina de CD, arriba
Z_BTN_ROW = 0.0125                      # fila de botones finos
Z_LIP = 0.0035                          # ceja inferior

# --- perilla de volumen (izquierda, la pieza dominante de la cara)
KNOB_R = 0.0125
KNOB_OUT = 0.0155
X_KNOB = -0.0522
Z_KNOB = 0.0250

# --- display
LCD_W = 0.1000
LCD_H = 0.0125
X_LCD = 0.0230
Z_LCD_C = 0.0285

SEG_ROUND = 32


def build_bezel():
    """Placa frontal 1-DIN con esquinas redondeadas y cejas de relieve."""
    parts = []
    bez = box("front-bezel", (W, BEZEL_T, H),
              location=(0.0, Y_FRONT + BEZEL_T / 2.0, H / 2.0),
              material=satin_black())
    bevel(bez, 0.0035, segments=4)
    parts.append(bez)

    brow = box("bezel-brow", (W - 0.0090, 0.0030, 0.0035),
               location=(0.0, Y_FRONT - 0.0008, 0.0478), material=textured_black())
    bevel(brow, 0.0006, segments=2)
    parts.append(brow)

    lip = box("bezel-lip", (W - 0.0060, 0.0045, 0.0055),
              location=(0.0, Y_FRONT - 0.0014, Z_LIP), material=matte_black())
    bevel(lip, 0.0012, segments=2)
    parts.append(lip)
    return parts


def build_cd_slot():
    """Ranura de CD: hendidura fina de 138 x 3 mm cruzando casi todo el ancho."""
    parts = [box("cd-slot", (0.1380, 0.0070, 0.0030),
                 location=(-0.0040, Y_FRONT + 0.0036, Z_CD_SLOT),
                 material=textured_black())]
    ej = box("eject-button", (0.0075, 0.0028, 0.0042),
             location=(0.0790, Y_FACE - 0.0013, Z_CD_SLOT), material=brushed_alu())
    bevel(ej, 0.0006, segments=2)
    parts.append(ej)
    return parts


def build_lcd():
    """
    Ventana del LCD: una placa continua en relieve (no 4 barras: las juntas
    de esquina se ven), biselada en todo su contorno, con el vidrio encendido
    a ras sobre su frente.
    """
    parts = []
    fw = 0.0032
    proud = 0.0015
    ow, oh = LCD_W + 2 * fw, LCD_H + 2 * fw

    relief = box("lcd-relief", (ow, proud + 0.0025, oh),
                 location=(X_LCD, Y_FACE - proud / 2.0 + 0.0008, Z_LCD_C),
                 material=gloss_black())
    bevel(relief, 0.0008, segments=3)
    parts.append(relief)

    lcd_img = image_from_array("head-unit-lcd", screen_ui.render_lcd())
    glass = box("lcd-glass", (LCD_W, 0.0016, LCD_H),
                location=(X_LCD, Y_FACE - proud - 0.0002, Z_LCD_C),
                material=display_material("display-lcd", lcd_img, strength=1.0))
    planar_uv(glass, origin=(X_LCD - LCD_W / 2.0, 0.0, Z_LCD_C - LCD_H / 2.0),
              u_axis=(1, 0, 0), v_axis=(0, 0, 1), size_u=LCD_W, size_v=LCD_H)
    parts.append(glass)
    return parts


def build_volume_knob():
    """Perilla grande a la izquierda: cuerpo estriado + aro de acento + tapa."""
    parts = []
    rot = (math.pi / 2.0, 0.0, 0.0)
    y_body = Y_FACE - KNOB_OUT / 2.0

    parts.append(cylinder("knob-well", KNOB_R + 0.0022, 0.0030, segments=SEG_ROUND,
                          location=(X_KNOB, Y_FRONT + 0.0016, Z_KNOB),
                          rotation=rot, material=textured_black()))

    knob = cylinder("volume-knob", KNOB_R, KNOB_OUT, segments=SEG_ROUND,
                    location=(X_KNOB, y_body, Z_KNOB), rotation=rot,
                    material=satin_black())
    bevel(knob, 0.0015, segments=3)
    parts.append(knob)

    ridges = 22
    for i in range(ridges):
        a = 2 * math.pi * i / ridges
        parts.append(box("volume-knob-flute-%02d" % (i + 1),
                         (0.0024, KNOB_OUT - 0.0024, 0.0014),
                         location=(X_KNOB + (KNOB_R - 0.0004) * math.cos(a), y_body,
                                   Z_KNOB - (KNOB_R - 0.0004) * math.sin(a)),
                         rotation=(0.0, a, 0.0), material=brushed_alu()))

    y_cap = Y_FACE - KNOB_OUT
    parts.append(tube("volume-knob-ring", KNOB_R - 0.0012, KNOB_R - 0.0034, 0.0022,
                      segments=SEG_ROUND, location=(X_KNOB, y_cap - 0.0009, Z_KNOB),
                      rotation=rot, material=accent_orange()))
    cap = cylinder("volume-knob-cap", KNOB_R - 0.0036, 0.0024, segments=SEG_ROUND,
                   location=(X_KNOB, y_cap - 0.0010, Z_KNOB), rotation=rot,
                   material=brushed_alu())
    bevel(cap, 0.0006, segments=2)
    parts.append(cap)
    return parts


def build_left_cluster():
    """Columna de 3 teclas chicas al extremo izquierdo, paso uniforme de 11 mm."""
    parts = []
    for i in range(3):
        z = Z_KNOB + (i - 1) * 0.0110
        btn = box("side-button-%d" % (i + 1), (0.0095, 0.0024, 0.0070),
                  location=(-0.0790, Y_FACE - 0.0011, z), material=textured_black())
        bevel(btn, 0.0006, segments=2)
        parts.append(btn)
    return parts


def build_button_row():
    """Fila de 5 botones finos bajo el display, barra de luz y jack auxiliar."""
    parts = []
    pitch = 0.0165
    x0 = 0.0230 - (4 * pitch) / 2.0
    for i in range(5):
        btn = box("preset-button-%d" % (i + 1), (0.0135, 0.0026, 0.0042),
                  location=(x0 + i * pitch, Y_FACE - 0.0012, Z_BTN_ROW),
                  material=textured_black())
        bevel(btn, 0.0006, segments=2)
        parts.append(btn)

    parts.append(box("light-bar", (0.1000, 0.0016, 0.0012),
                     location=(0.0230, Y_FACE - 0.0009, Z_BTN_ROW - 0.0040),
                     material=accent_orange()))

    rot = (math.pi / 2.0, 0.0, 0.0)
    parts.append(tube("aux-jack-ring", 0.0046, 0.0031, 0.0022, segments=SEG_ROUND,
                      location=(0.0775, Y_FACE - 0.0010, Z_BTN_ROW),
                      rotation=rot, material=chrome()))
    parts.append(cylinder("aux-jack-well", 0.0031, 0.0055, segments=SEG_ROUND,
                          location=(0.0775, Y_FRONT + 0.0032, Z_BTN_ROW),
                          rotation=rot, material=textured_black()))
    return parts


def build_chassis():
    ch = box("chassis-cage", (CH_W, CH_D, CH_H),
             location=(0.0, Y_BEZEL_BACK + CH_D / 2.0, Z_CH_BOT + CH_H / 2.0),
             material=brushed_alu())
    bevel(ch, 0.0025, segments=3)
    return [ch]


def build_louvers():
    """
    Celosías estampadas en tapa y costados: ranuras de color, no agujeros
    booleanos (a tamaño de carrusel se lee igual y la malla queda estanca).
    """
    parts = []
    y0 = Y_BEZEL_BACK + 0.0170
    pitch = 0.0125
    for i in range(10):
        y = y0 + i * pitch
        if y > Y_CH_BACK - 0.0110:
            break
        for j, x in enumerate((-0.0470, -0.0155, 0.0155, 0.0470)):
            parts.append(box("louver-top-%02d-%d" % (i + 1, j + 1),
                             (0.0235, 0.0032, 0.0010),
                             location=(x, y, Z_CH_TOP - 0.0003),
                             material=textured_black()))
        for sx in (-1, 1):
            for j, z in enumerate((Z_CH_BOT + 0.0120, Z_CH_BOT + 0.0330)):
                parts.append(box("louver-side-%s-%02d-%d" % ("l" if sx < 0 else "r", i + 1, j + 1),
                                 (0.0010, 0.0032, 0.0130),
                                 location=(sx * (CH_W / 2.0 - 0.0003), y, z),
                                 material=textured_black()))
    return parts


def build_rear():
    """ISO A/B, 4 RCA de preout, antena DIN y el mazo de cable."""
    parts = []
    y = Y_CH_BACK
    rot_y = (math.pi / 2.0, 0.0, 0.0)

    iso = box("iso-connector", (0.0450, 0.0130, 0.0170),
              location=(-0.0420, y + 0.0065, 0.0330), material=matte_black())
    bevel(iso, 0.0010, segments=2)
    parts.append(iso)

    for i in range(4):
        x = -0.0110 + i * 0.0165
        parts.append(cylinder("preout-rca-%d" % (i + 1), 0.0044, 0.0110,
                              segments=SEG_ROUND, location=(x, y + 0.0055, 0.0140),
                              rotation=rot_y, material=chrome()))
        parts.append(tube("preout-rca-ring-%d" % (i + 1), 0.0056, 0.0044, 0.0020,
                          segments=SEG_ROUND, location=(x, y + 0.0100, 0.0140),
                          rotation=rot_y,
                          material=accent_orange() if i % 2 == 0 else brushed_alu()))

    parts.append(cylinder("antenna-connector", 0.0058, 0.0130, segments=SEG_ROUND,
                          location=(0.0630, y + 0.0065, 0.0150),
                          rotation=rot_y, material=chrome()))

    # El mazo no baja de z = 0.006: si cruzara el plano de base, la
    # normalización levantaría todo el modelo.
    path = [(0.0430, y + 0.0020, 0.0330),
            (0.0430, y + 0.0170, 0.0320),
            (0.0430, y + 0.0300, 0.0270),
            (0.0430, y + 0.0385, 0.0180),
            (0.0430, y + 0.0400, 0.0060)]
    parts.append(swept_tube("wire-harness", path, 0.0068, sides=16,
                            smooth_path=5, material=rubber()))
    boot = box("harness-boot", (0.0210, 0.0055, 0.0190),
               location=(0.0430, y + 0.0028, 0.0330), material=matte_black())
    bevel(boot, 0.0012, segments=2)
    parts.append(boot)
    return parts


def main():
    reset_scene()
    parts = []
    parts += build_bezel()
    parts += build_cd_slot()
    parts += build_lcd()
    parts += build_volume_knob()
    parts += build_left_cluster()
    parts += build_button_row()
    parts += build_chassis()
    parts += build_louvers()
    parts += build_rear()

    print("\npiezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "head-unit")
    finalize(obj, ARCHIVO, front="-Y", expected_dims=(0.178, None, 0.050),
             ao="--ao" in sys.argv, texture=True)


if __name__ == "__main__":
    main()
