"""
Sonoro — categoría "pantallas" (screen), versión 3.
Receptor 2-DIN con pantalla táctil de cara completa y jaula metálica expuesta.

    blender --background --python-exit-code 1 --python scripts/models3d_v3/screen.py

(`-- --ao` al final hornea oclusión en los vértices; en este modelo no se
usa: el cambio no se ve y suma 12 KB.)

Necesita screen_ui.py en la misma carpeta (dibuja la interfaz con numpy,
que viene con Blender).

Geometría portada de scripts/models3d/screen.py (v1), que es la que generó
el screen.glb publicado. Medidas sin cambios:

    cara     0.178 (X) x 0.100 (Z) x 0.014 (grosor del bezel)
    activa   0.166 x 0.088, hundida 1.5 mm  -> bisel de 6 mm, edge to edge
    jaula    0.160 (X) x 0.092 (Z) x 0.150 (Y), más angosta que la cara
    total Y  0.177 = bezel 0.014 + jaula 0.150 + conectores 0.013
             (el mazo de cable sale 0.040 más y no cuenta en la cota)

La losa de vidrio ES la cara del aparato, pegada al chasis. La diferencia
contra head-unit.py es la proporción: allá 1-DIN con perilla y LCD chico,
acá 2-DIN donde el vidrio se come toda la cara y no hay control giratorio.

Icono de categoría: sin logos, sin texto legible, sin marca. La pantalla
está ENCENDIDA y muestra una interfaz genérica de receptor multimedia
(screen_ui.py): glifos propios, barras donde iría texto, ninguna app real.
El script construye con el frente hacia −Y (como la v1); `finalize` lo gira
a +Y, así que en el sitio este modelo ya no necesita `giroBase`.

Qué cambia respecto de la v1
----------------------------
  - Normales: la v1 salía 100 % suavizada (ver _common.py, nota 1) y el
    vidrio se veía abombado, como un televisor de tubo. Ahora es plano.
  - Pantalla encendida: el vidrio muestra una interfaz (textura emisiva
    generada por screen_ui.py, única textura del proyecto). Apagada, a este
    tamaño, la cara era un rectángulo negro que igual podía ser una caja.
  - Reborde del vidrio en negro piano con clearcoat: una línea de brillo fina
    alrededor de la ventana, que es lo que separa vidrio de bezel.
  - Bezel satinado en vez de mate, y jaula con bisel de 2.5 mm (antes 1.8):
    los cantos agarran brillo a tamaño de carrusel.
  - Sin marcas táctiles (en la v1 quedaban detrás del vidrio y no se veían)
    y sin el punto naranja de encendido del canto inferior.
  - Mazo de cable: un solo tubo barrido y suavizado, en vez de cilindros
    rectos con esferas en las juntas.
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

ARCHIVO = "screen-3"

# --- cara / bezel
W = 0.1780
H = 0.1000
BEZEL_T = 0.0140
Y_FRONT = -0.0885
Y_FACE = Y_FRONT + 0.0002
Y_BEZEL_BACK = Y_FRONT + BEZEL_T        # -0.0745

# --- área activa (edge to edge, bisel de 6 mm)
ACT_W = 0.1660
ACT_H = 0.0880
Z_ACT_C = 0.0510                        # levemente arriba del centro
RIM_W = 0.0022                          # reborde visible alrededor del vidrio
PROUD = 0.0010
GLASS_T = 0.0018
Y_GLASS_C = Y_FACE - PROUD - 0.0002
Y_GLASS_FRONT = Y_GLASS_C - GLASS_T / 2.0

# --- jaula
CG_W = 0.1600
CG_H = 0.0920
CG_D = 0.1500
Y_CG_BACK = Y_BEZEL_BACK + CG_D         # 0.0755
Z_CG_BOT = (H - CG_H) / 2.0             # 0.004
Z_CG_TOP = Z_CG_BOT + CG_H              # 0.096

SEG_ROUND = 32


def build_bezel():
    """Cara completa: losa con esquinas redondeadas y canto biselado."""
    bez = box("front-bezel", (W, BEZEL_T, H),
              location=(0.0, Y_FRONT + BEZEL_T / 2.0, H / 2.0),
              material=satin_black())
    bevel(bez, 0.0045, segments=4)
    return [bez]


def build_glass():
    """
    Vidrio hundido 1.5 mm, casi a sangre, con un reborde continuo en relieve
    alrededor (una sola pieza, no 4 barras: las juntas de esquina se ven).
    """
    parts = []
    relief = box("screen-relief", (ACT_W + 2 * RIM_W, PROUD + 0.0022,
                                   ACT_H + 2 * RIM_W),
                 location=(0.0, Y_FACE - PROUD / 2.0 + 0.0007, Z_ACT_C),
                 material=gloss_black())
    bevel(relief, 0.0008, segments=3)
    parts.append(relief)

    parts.append(box("screen-recess", (ACT_W + 0.0012, 0.0032, ACT_H + 0.0012),
                     location=(0.0, Y_FRONT + 0.0020, Z_ACT_C),
                     material=textured_black()))
    ui = image_from_array("screen-ui", screen_ui.render())
    glass = box("screen-glass-panel", (ACT_W, GLASS_T, ACT_H),
                location=(0.0, Y_GLASS_C, Z_ACT_C),
                material=display_material("display-ui", ui, strength=1.0))
    # la imagen cubre el área activa: u crece hacia +X (derecha, mirando la
    # cara desde −Y) y v hacia +Z (arriba)
    planar_uv(glass, origin=(-ACT_W / 2.0, 0.0, Z_ACT_C - ACT_H / 2.0),
              u_axis=(1, 0, 0), v_axis=(0, 0, 1), size_u=ACT_W, size_v=ACT_H)
    parts.append(glass)
    return parts


def build_face_details():
    """Ventana de IR y micrófono en la ceja inferior, y el botón de reset."""
    parts = []
    y = Y_FACE - 0.0008
    z = 0.0048
    rot = (math.pi / 2.0, 0.0, 0.0)
    parts.append(box("ir-window", (0.0090, 0.0014, 0.0024),
                     location=(-0.0700, y, z), material=screen_glass()))
    parts.append(cylinder("mic-port", 0.0011, 0.0016, segments=12,
                          location=(0.0700, y, z), rotation=rot,
                          material=textured_black()))
    parts.append(tube("reset-ring", 0.0022, 0.0012, 0.0016, segments=16,
                      location=(0.0820, y, 0.0510), rotation=rot,
                      material=textured_black()))
    return parts


def build_cage():
    """Jaula metálica expuesta, más angosta que la cara por los 4 lados."""
    cage = box("chassis-cage", (CG_W, CG_D, CG_H),
               location=(0.0, Y_BEZEL_BACK + CG_D / 2.0, Z_CG_BOT + CG_H / 2.0),
               material=brushed_alu())
    bevel(cage, 0.0025, segments=3)
    return [cage]


def build_side_rails():
    """Rieles de montaje laterales con ranuras: dos flejes a los costados."""
    parts = []
    for sx in (-1, 1):
        side = "l" if sx < 0 else "r"
        rail = box("mount-rail-%s" % side, (0.0016, CG_D - 0.0180, 0.0180),
                   location=(sx * (CG_W / 2.0 + 0.0008),
                             Y_BEZEL_BACK + CG_D / 2.0 + 0.0040,
                             Z_CG_BOT + CG_H - 0.0230),
                   material=brushed_alu())
        bevel(rail, 0.0006, segments=2)
        parts.append(rail)

        for i in range(4):
            y = Y_BEZEL_BACK + 0.0280 + i * 0.0300
            if y > Y_CG_BACK - 0.0140:
                break
            parts.append(box("mount-rail-slot-%s-%d" % (side, i + 1),
                             (0.0012, 0.0130, 0.0040),
                             location=(sx * (CG_W / 2.0 + 0.0014), y,
                                       Z_CG_BOT + CG_H - 0.0230),
                             material=textured_black()))
    return parts


def build_louvers():
    """
    Celosías estampadas en tapa y costados: ranuras de color, no agujeros
    booleanos (la malla queda estanca y a tamaño de carrusel se lee igual).
    """
    parts = []
    y0 = Y_BEZEL_BACK + 0.0190
    pitch = 0.0135
    for i in range(10):
        y = y0 + i * pitch
        if y > Y_CG_BACK - 0.0120:
            break
        for j, x in enumerate((-0.0470, -0.0155, 0.0155, 0.0470)):
            parts.append(box("louver-top-%02d-%d" % (i + 1, j + 1),
                             (0.0235, 0.0036, 0.0010),
                             location=(x, y, Z_CG_TOP - 0.0003),
                             material=textured_black()))
        for sx in (-1, 1):
            parts.append(box("louver-side-%s-%02d" % ("l" if sx < 0 else "r", i + 1),
                             (0.0010, 0.0036, 0.0300),
                             location=(sx * (CG_W / 2.0 - 0.0003), y, Z_CG_BOT + 0.0230),
                             material=textured_black()))
    return parts


def build_rear():
    """ISO A/B, 6 RCA, antena DIN, USB tipo A y el mazo de cable."""
    parts = []
    y = Y_CG_BACK
    rot_y = (math.pi / 2.0, 0.0, 0.0)

    iso = box("iso-connector", (0.0450, 0.0130, 0.0180),
              location=(-0.0430, y + 0.0065, 0.0700), material=matte_black())
    bevel(iso, 0.0010, segments=2)
    parts.append(iso)

    for i in range(6):
        x = -0.0170 + (i % 3) * 0.0170
        z = 0.0400 if i < 3 else 0.0180
        parts.append(cylinder("preout-rca-%d" % (i + 1), 0.0044, 0.0110,
                              segments=SEG_ROUND, location=(x, y + 0.0055, z),
                              rotation=rot_y, material=chrome()))
        parts.append(tube("preout-rca-ring-%d" % (i + 1), 0.0056, 0.0044, 0.0020,
                          segments=SEG_ROUND, location=(x, y + 0.0100, z),
                          rotation=rot_y,
                          material=accent_orange() if i % 2 == 0 else brushed_alu()))

    usb = box("usb-port", (0.0120, 0.0100, 0.0050),
              location=(0.0500, y + 0.0050, 0.0180), material=brushed_alu())
    bevel(usb, 0.0006, segments=2)
    parts.append(usb)
    parts.append(box("usb-port-well", (0.0096, 0.0060, 0.0026),
                     location=(0.0500, y + 0.0072, 0.0180),
                     material=textured_black()))

    parts.append(cylinder("antenna-connector", 0.0058, 0.0130, segments=SEG_ROUND,
                          location=(0.0620, y + 0.0065, 0.0430),
                          rotation=rot_y, material=chrome()))

    # El mazo no baja de z = 0.008: si cruzara el plano de base, la
    # normalización levantaría todo el modelo.
    path = [(0.0430, y + 0.0020, 0.0640),
            (0.0430, y + 0.0180, 0.0620),
            (0.0430, y + 0.0320, 0.0520),
            (0.0430, y + 0.0400, 0.0350),
            (0.0430, y + 0.0410, 0.0180),
            (0.0430, y + 0.0400, 0.0080)]
    parts.append(swept_tube("wire-harness", path, 0.0072, sides=16,
                            smooth_path=5, material=rubber()))
    boot = box("harness-boot", (0.0215, 0.0055, 0.0200),
               location=(0.0430, y + 0.0028, 0.0640), material=matte_black())
    bevel(boot, 0.0012, segments=2)
    parts.append(boot)
    return parts


def main():
    reset_scene()
    parts = []
    parts += build_bezel()
    parts += build_glass()
    parts += build_face_details()
    parts += build_cage()
    parts += build_side_rails()
    parts += build_louvers()
    parts += build_rear()

    print("\npiezas: %d" % len(parts))
    discard_orphans(parts)
    obj = join_objects(parts, "screen")
    ao = "--ao" in sys.argv
    finalize(obj, ARCHIVO, front="-Y", expected_dims=(0.178, None, 0.100), ao=ao,
             texture=True)


if __name__ == "__main__":
    main()
