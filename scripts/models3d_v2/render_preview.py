"""
Sonoro — render de QA para los .glb de categoría.

Importa un .glb, lo ilumina con un set de estudio neutro y saca cuatro vistas
ortográficas en un contact-sheet PNG cuadrado (1024 px por defecto):

    +----------------+----------------+
    | frente         | 3/4            |
    +----------------+----------------+
    | lateral        | superior       |
    +----------------+----------------+

Uso:
    blender --background --python scripts/models3d/render_preview.py -- \
        public/models/speaker.glb [--size 1024] [--out ruta.png] [--samples 48]

    # todos los modelos de una pasada
    blender --background --python scripts/models3d/render_preview.py -- --all

Fondo gris claro a propósito: casi todos los modelos son negros y la silueta
es lo que hay que juzgar en el paso (d) del flujo.
"""

import math
import os
import sys

import bpy
import numpy as np
from mathutils import Vector


def _locate_common():
    """Igual que en los scripts de producto: sirve headless y desde el Text Editor."""
    cands = [os.path.dirname(os.path.abspath(bpy.path.abspath(__file__)))]
    for t in bpy.data.texts:
        if t.filepath:
            cands.append(os.path.dirname(os.path.abspath(bpy.path.abspath(t.filepath))))
    cands.append(os.path.dirname(os.path.abspath(__file__)))
    cands.append(os.getcwd())
    cands.append(os.path.join(os.getcwd(), "scripts", "models3d"))
    for d in cands:
        if d and os.path.isfile(os.path.join(d, "_common.py")):
            return d
    raise RuntimeError("no encuentro _common.py; agrega su carpeta a sys.path")


sys.path.insert(0, _locate_common())
from _common import MODELS_DIR, PREVIEWS_DIR, REPO_ROOT, ensure_dirs, reset_scene  # noqa: E402

BG_GRAY = 0.55          # fondo del world (lineal)
MARGIN = 1.18           # holgura de encuadre
VIEWS = (
    # nombre, dirección desde la que mira la cámara (Blender Z-up)
    ("front", Vector((0.0, -1.0, 0.0))),
    ("three-quarter", Vector((-0.85, -1.0, 0.62))),
    ("side", Vector((1.0, 0.0, 0.0))),
    ("top", Vector((0.0, -0.001, 1.0))),
)


# ------------------------------------------------------------------ args -----

def parse_args(argv):
    args = argv[argv.index("--") + 1:] if "--" in argv else []
    opts = {"targets": [], "size": 1024, "out": None, "samples": 48, "all": False}
    i = 0
    while i < len(args):
        a = args[i]
        if a == "--all":
            opts["all"] = True
        elif a in ("--size", "--samples"):
            opts[a[2:]] = int(args[i + 1]); i += 1
        elif a == "--out":
            opts["out"] = args[i + 1]; i += 1
        else:
            opts["targets"].append(a)
        i += 1
    if opts["all"]:
        opts["targets"] = sorted(
            os.path.join(MODELS_DIR, f) for f in os.listdir(MODELS_DIR)
            if f.endswith(".glb"))
    return opts


# ------------------------------------------------------------- studio --------

def setup_world():
    scene = bpy.context.scene
    world = bpy.data.worlds.get("qa-world") or bpy.data.worlds.new("qa-world")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (BG_GRAY, BG_GRAY, BG_GRAY, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    scene.world = world


def setup_engine(samples):
    scene = bpy.context.scene
    engines = {e.identifier for e in
               bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    scene.render.engine = ("BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines
                           else "BLENDER_EEVEE")
    ee = getattr(scene, "eevee", None)
    if ee is not None:
        if hasattr(ee, "taa_render_samples"):
            ee.taa_render_samples = samples
        for flag in ("use_gtao", "use_raytracing", "use_shadows"):
            if hasattr(ee, flag):
                setattr(ee, flag, True)
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.view_settings.view_transform = "Standard"  # sin AgX/Filmic: colores predecibles
    scene.view_settings.look = "None"


def add_lights(radius):
    """Tres puntos + relleno inferior, escalados al tamaño del objeto."""
    specs = (
        ("key",  (-1.4, -1.9, 2.2), 1.6 * radius, 320.0),
        ("fill", (2.3, -1.4, 0.9), 2.2 * radius, 110.0),
        ("rim",  (0.6, 2.4, 1.8), 1.6 * radius, 180.0),
        ("base", (0.0, 0.0, -2.4), 3.0 * radius, 40.0),
    )
    for name, direction, size, power in specs:
        data = bpy.data.lights.new(name="light-" + name, type="AREA")
        data.shape = "DISK"
        data.size = max(size, 0.05)
        data.energy = power * max(radius, 0.05) ** 2 * 40.0
        obj = bpy.data.objects.new("light-" + name, data)
        bpy.context.collection.objects.link(obj)
        d = Vector(direction).normalized()
        obj.location = d * (radius * 4.2)
        obj.rotation_euler = (-d).to_track_quat("Z", "Y").to_euler()


def add_camera():
    data = bpy.data.cameras.new("qa-camera")
    data.type = "ORTHO"
    obj = bpy.data.objects.new("qa-camera", data)
    bpy.context.collection.objects.link(obj)
    bpy.context.scene.camera = obj
    return obj


def aim(camera, direction, center, radius, ortho_scale):
    d = Vector(direction).normalized()
    camera.location = center + d * (radius * 6.0)
    camera.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    camera.data.ortho_scale = ortho_scale
    camera.data.clip_start = max(radius * 0.5, 0.001)
    camera.data.clip_end = radius * 20.0


# ------------------------------------------------------------ composite ------

def read_pixels(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(h, w, 4)


def contact_sheet(tiles, size, out_path, gutter=2):
    """tiles: lista de 4 arrays (h, w, 4) en orden frente, 3/4, lateral, superior."""
    sheet = np.ones((size, size, 4), dtype=np.float32)
    sheet[:, :, :3] = 0.10  # separadores oscuros
    half = size // 2
    slots = ((1, 0), (1, 1), (0, 0), (0, 1))  # (row_from_bottom, col) -> orden de VIEWS
    for tile, (row, col) in zip(tiles, slots):
        th, tw = tile.shape[0], tile.shape[1]
        y0 = row * half + gutter
        x0 = col * half + gutter
        h = min(th, half - 2 * gutter)
        w = min(tw, half - 2 * gutter)
        sheet[y0:y0 + h, x0:x0 + w, :] = tile[:h, :w, :]
    sheet[:, :, 3] = 1.0

    img = bpy.data.images.new("contact-sheet", width=size, height=size, alpha=False)
    img.pixels.foreach_set(sheet.reshape(-1))
    img.filepath_raw = out_path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


# --------------------------------------------------------------- render ------

def imported_meshes():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def render_glb(glb_path, size, samples, out_path=None):
    reset_scene()
    bpy.ops.import_scene.gltf(filepath=glb_path)
    meshes = imported_meshes()
    if not meshes:
        raise RuntimeError("el glb no trajo mallas: %s" % glb_path)

    bpy.context.view_layer.update()
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
        for corner in o.bound_box:
            p = o.matrix_world @ Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
    center = (lo + hi) / 2.0
    extent = hi - lo
    radius = max(extent.length / 2.0, 0.02)
    ortho_scale = max(extent.x, extent.y, extent.z) * MARGIN

    setup_world()
    setup_engine(samples)
    add_lights(radius)
    camera = add_camera()

    tile = size // 2 - 4
    scene = bpy.context.scene
    scene.render.resolution_x = tile
    scene.render.resolution_y = tile
    scene.render.resolution_percentage = 100

    ensure_dirs()
    base = os.path.splitext(os.path.basename(glb_path))[0]
    tmp_dir = os.path.join(PREVIEWS_DIR, ".tmp")
    os.makedirs(tmp_dir, exist_ok=True)

    tiles = []
    for view_name, direction in VIEWS:
        aim(camera, direction, center, radius, ortho_scale)
        tmp = os.path.join(tmp_dir, "%s-%s.png" % (base, view_name))
        scene.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        tiles.append(read_pixels(tmp))
        os.remove(tmp)

    out = out_path or os.path.join(PREVIEWS_DIR, base + ".png")
    contact_sheet(tiles, size, out)
    try:
        os.rmdir(tmp_dir)
    except OSError:
        pass

    glb_bytes = os.path.getsize(glb_path)
    print("\n" + "-" * 62)
    print("preview       : %s" % os.path.relpath(out, REPO_ROOT))
    print("vistas        : frente | 3/4  /  lateral | superior")
    print("triangulos    : %s" % f"{tris:,}")
    print("bbox (m)      : %.3f x %.3f x %.3f" % (extent.x, extent.y, extent.z))
    print("base en z     : %.4f m (debe ser 0.0000)" % lo.z)
    print("centro XY     : %.4f, %.4f m (debe ser 0, 0)" % (center.x, center.y))
    print("peso glb      : %.1f KB" % (glb_bytes / 1024.0))
    print("-" * 62 + "\n")
    return out


def main():
    opts = parse_args(sys.argv)
    if not opts["targets"]:
        print("uso: blender --background --python render_preview.py -- <archivo.glb> | --all")
        return
    for t in opts["targets"]:
        path = t if os.path.isabs(t) else os.path.join(REPO_ROOT, t)
        if not os.path.exists(path):
            path = os.path.join(MODELS_DIR, os.path.basename(t))
        render_glb(path, opts["size"], opts["samples"],
                   opts["out"] if len(opts["targets"]) == 1 else None)


if __name__ == "__main__":
    main()
