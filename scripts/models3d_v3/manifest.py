"""
Sonoro — números del manifiesto del carrusel a partir de las medidas reales.

    python scripts/models3d_v3/manifest.py

Lee `medidas/<id>.json`, que escribe `finalize()` en cada export, y calcula
para los nueve modelos los `displayScale`, `radius` y `height` de
lib/models3d.ts y las constantes FRAME_RADIUS y FRAME_HEIGHT. Imprime el
bloque para revisar y pegar; NO toca lib/models3d.ts.

Existe para que nadie vuelva a calcular estos números a mano:

    displayScale_i = (radio_mayor / radio_i) ^ (1 − 0.65)
    FRAME_RADIUS   = max(radio_i · displayScale_i)
    FRAME_HEIGHT   = max(alto_i · displayScale_i)

El exponente 0.65 es una decisión de diseño (CLAUDE.md § El exponente 0.65
de displayScale): conserva el orden de tamaños y acerca los extremos. No es
auto-fit ni escala real. Si cambia el modelo más grande, cambian los nueve
valores: por eso este script los recalcula siempre todos juntos.

No necesita Blender: es Python puro.
"""

import json
import os
import sys

EXPONENTE = 0.65

# mismo orden que MODEL_IDS en lib/models3d.ts
MODEL_IDS = [
    "speaker", "subwoofer", "amplifier", "head-unit", "screen",
    "equalizer", "install-kit", "sound-deadening", "rca-cable",
]

MEASURES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "medidas")


def load():
    found, missing = {}, []
    for mid in MODEL_IDS:
        path = os.path.join(MEASURES_DIR, mid + ".json")
        if not os.path.isfile(path):
            missing.append(mid)
            continue
        with open(path, encoding="utf-8") as f:
            found[mid] = json.load(f)
    return found, missing


def compute(measures):
    r_max = max(m["radius"] for m in measures.values())
    out = {}
    for mid, m in measures.items():
        ds = (r_max / m["radius"]) ** (1.0 - EXPONENTE)
        out[mid] = dict(m, displayScale=ds)
    frame_r = max(v["radius"] * v["displayScale"] for v in out.values())
    frame_h = max(v["height"] * v["displayScale"] for v in out.values())
    return out, frame_r, frame_h


def main():
    measures, missing = load()
    if missing:
        print("faltan medidas de: %s" % ", ".join(missing))
        print("(se generan al exportar cada modelo con su script de v3)")
        sys.exit(1)

    out, frame_r, frame_h = compute(measures)
    biggest = max(out, key=lambda k: out[k]["radius"])
    tallest = max(out, key=lambda k: out[k]["height"] * out[k]["displayScale"])

    print("// Generado por scripts/models3d_v3/manifest.py — no editar a mano.")
    print("// Referencia de escala: %s (radio %.4f). Alto del encuadre: %s."
          % (biggest, out[biggest]["radius"], tallest))
    for mid in MODEL_IDS:
        v = out[mid]
        print('  %-18s archivo: "%s", displayScale: %.4f, radius: %.4f, height: %.4f,'
              % ('"%s":' % mid if "-" in mid else mid + ":",
                 v["archivo"], v["displayScale"], v["radius"], v["height"]))
    print("export const FRAME_RADIUS = %.4f;" % frame_r)
    print("export const FRAME_HEIGHT = %.4f;" % frame_h)
    print("// Los .glb de v3 ya miran a la cámara: ningún modelo lleva giroBase.")


if __name__ == "__main__":
    main()
