"""
Sonoro — biblioteca compartida de los modelos 3D de categoría, versión 3.

Reemplaza a scripts/models3d/ (v1) y scripts/models3d_v2/. La geometría de
cada modelo se porta de la v1, que es la que generó los .glb publicados; lo
que cambia es esta capa, que es donde vivían los problemas.

Qué corrige respecto de la v1, y por qué
----------------------------------------

1. NORMALES. La v1 llamaba a `bpy.ops.object.shade_auto_smooth()`. Desde
   Blender 4.1 ese operador ya no marca aristas: agrega un modificador de
   nodos («Smooth by Angle») que sale de la biblioteca de assets Essentials.
   Corriendo con --background la biblioteca no termina de cargar («Asset
   loading is unfinished»), el modificador no se agrega y el operador NO
   FALLA: el modelo se exporta 100 % suavizado. Siete de los nueve .glb
   publicados salieron así (0 aristas duras): caras planas que se ven
   abombadas y aluminio que refleja como plástico. Reproducido con
   bpy 4.5.14 el 30 de septiembre de 2026.

   Aquí las aristas duras se marcan a mano con bmesh, POR PIEZA y antes de
   unir, con un ángulo según el tipo de pieza (ver `shading()`), y las piezas
   biseladas llevan normales ponderadas por área: las caras grandes quedan
   planas y el bisel redondea el canto. `finalize()` se niega a exportar un
   modelo sin aristas duras, así que este error no puede volver en silencio.

2. BISELES A ESCALA DE PANTALLA. En el carrusel un milímetro ocupa entre
   0.4 px (móvil) y 1.2 px (escritorio). Un bisel de 0.5–1 mm no se ve: el
   canto no agarra el brillo que hace que el metal se lea como metal. Los
   cantos principales van con biseles de 2–4 mm. Es una exageración
   deliberada, como la de cualquier render de producto.

3. PALETA. Los tres negros de la v1 eran casi el mismo (1A/23/10, rugosidad
   0.85–0.98) y los modelos negros se leían como siluetas. Se separan en
   valor y en rugosidad, y se agregan negros con brillo (satinado, piano con
   clearcoat, anodizado metálico) y un vidrio de pantalla encendida.

4. FRENTE ESTÁNDAR. Cada modelo de la v1 eligió su frente, y el sitio lo
   corregía con `giroBase`. Aquí `finalize(front=...)` gira la malla para que
   el frente quede SIEMPRE en +Y de Blender = −Z del glTF, que es hacia donde
   mira la cámara del carrusel. Con eso `giroBase` sobra.

5. VALIDACIÓN. `finalize()` corta con error (no con un print) si faltan
   aristas duras, si el nodo del glTF trae traslación, si falta Draco, si el
   modelo no apoya en z = 0 o se sale del presupuesto. Y escribe las medidas
   que usa el manifiesto en `medidas/<id>.json` (ver manifest.py).

6. EXPORT SIN RED DE SEGURIDAD FALSA. La v1 reintentaba el export con
   «lo esencial» si la firma del operador no coincidía: podía salir un .glb
   sin los ajustes de Draco sin que nadie lo notara. Aquí falla.

Convenciones (no negociables, igual que antes)
----------------------------------------------
  - metros, escala real
  - Blender Z-up; el export glTF convierte a +Y up (no se rota la malla para eso)
  - apoya en z = 0, centro XY en el origen
  - frente del producto hacia +Y de Blender (−Z en el glTF)
  - 5,000 a 25,000 triángulos, .glb < 300 KB, Draco obligatorio
  - materiales PBR por valores, sin cámaras ni luces
  - sin texturas de imagen, con UNA excepción: lo que muestra una pantalla
    encendida (la de screen y el LCD de head-unit). Esas imágenes no son
    archivos del repo: las dibuja screen_ui.py con numpy en cada export, y
    van como textura emisiva WebP (ver `display_material()`). Un modelo que
    no declara `texture=True` y trae una imagen hace fallar finalize.
  - nombres de objetos y materiales en inglés, kebab-case

Versión de Blender: 4.5 LTS. Distintas versiones exportan distinto; se avisa
si se corre con otra.

Correr SIEMPRE con --python-exit-code 1. Sin esa opción Blender termina con
código 0 aunque el script lance una excepción, y un ModelError de
`finalize()` pasaría inadvertido en una corrida por lotes:

    blender --background --python-exit-code 1 --python scripts/models3d_v3/screen.py

Uso típico:

    from _common import *

    reset_scene()
    parts = [box("chassis", (0.2, 0.1, 0.04), location=(0, 0, 0.02),
                 material=brushed_alu())]
    bevel(parts[0], 0.0025)
    obj = join_objects(parts, "amplifier")
    finalize(obj, "amplifier-3", front="-Y")
"""

import json
import math
import os
import struct

import bpy  # antes que bmesh: con bpy como módulo de Python, bmesh no existe hasta importar bpy
import bmesh
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

# ---------------------------------------------------------------- paths ------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
MODELS_DIR = os.path.join(REPO_ROOT, "public", "models")
MEASURES_DIR = os.path.join(SCRIPT_DIR, "medidas")

BLENDER_PIN = (4, 5)
TRI_BUDGET = (5_000, 25_000)
MAX_GLB_BYTES = 300 * 1024


def ensure_dirs():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(MEASURES_DIR, exist_ok=True)


def check_blender_version():
    v = bpy.app.version[:2]
    if v < (4, 1):
        raise RuntimeError(
            "Blender %d.%d: la v3 necesita 4.1 o más (atributos sharp_edge y "
            "normales por esquina). Versión fijada: %d.%d LTS." % (v + BLENDER_PIN))
    if v != BLENDER_PIN:
        print("AVISO: Blender %s; la versión fijada es %d.%d LTS. El .glb puede "
              "salir distinto." % (bpy.app.version_string, *BLENDER_PIN))


# ------------------------------------------------------------ materials ------
#
# nombre: (hex, rugosidad, metálico, extras)
# extras: coat=(peso, rugosidad) -> KHR_materials_clearcoat
#         emission=(hex, intensidad) -> emissiveFactor
#
# Los negros van de más oscuro a más claro: rubber < gloss-black <
# matte-black < satin-black < textured-black. Se distinguen tanto por valor
# como por rugosidad: con la iluminación del carrusel, la rugosidad es lo que
# decide si un canto agarra brillo o no.

PALETTE = {
    "rubber":          ("0F0F10", 0.92, 0.0, {}),
    "gloss-black":     ("0C0C0D", 0.22, 0.0, {"coat": (1.0, 0.04)}),
    "matte-black":     ("1B1B1C", 0.72, 0.0, {}),
    "satin-black":     ("1F1F21", 0.46, 0.0, {}),
    "textured-black":  ("2A2A2B", 0.90, 0.0, {}),
    # aluminio anodizado negro: metal, así que refleja el estudio y dibuja
    # la forma, que es lo que un plástico negro mate no puede hacer
    "anodized-black":  ("2A2A2E", 0.40, 1.0, {}),
    "brushed-alu":     ("B8BCC0", 0.33, 1.0, {}),
    "chrome":          ("E8EAED", 0.08, 1.0, {}),
    "copper":          ("B87333", 0.30, 1.0, {}),
    # vidrio oscuro sin encender (cuerpos ahumados, lentes)
    "screen-glass":    ("0A0C10", 0.05, 0.0, {"coat": (1.0, 0.02)}),
    # pantalla encendida: un azul muy apagado que se lee como «prendida» sin
    # dibujar nada. No es color de marca: es el color del producto.
    "display-glass":   ("05070A", 0.04, 0.0, {"coat": (1.0, 0.02),
                                              "emission": ("16283D", 1.0)}),
    "accent-orange":   ("FF6A00", 0.50, 0.0, {}),
    # bornes con baño dorado (portafusibles)
    "gold":            ("C9A34E", 0.28, 1.0, {}),
    # plástico blanco (cuerpo del fusible ANL)
    "white-plastic":   ("E4E1DA", 0.45, 0.0, {}),
    # tapa transparente de policarbonato: alphaMode BLEND en el glTF
    "clear-plastic":   ("F2F4F6", 0.05, 0.0, {"alpha": 0.20, "coat": (1.0, 0.02)}),
    # Forros de cable: código de color eléctrico, no acentos de marca. PVC
    # con brillo (rugosidad 0.34): mate, un cable se lee como manguera o
    # plastilina; es el brillo largo a lo largo del forro lo que lo hace cable.
    "cable-red":       ("C41E1E", 0.34, 0.0, {}),
    "cable-black":     ("161617", 0.36, 0.0, {}),
    "cable-blue":      ("1B4FA8", 0.34, 0.0, {}),
    "cable-white":     ("E6E6E6", 0.40, 0.0, {}),
    # cuerpos de conector RCA (plástico traslúcido en el producto real; aquí
    # opacos a propósito: la transmisión no se lee a este tamaño)
    "connector-red":   ("8E0F14", 0.25, 0.0, {}),
    "connector-smoke": ("2B2B2E", 0.25, 0.0, {}),
    "zip-clear":       ("D9D9D9", 0.40, 0.0, {}),
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str, alpha=1.0):
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def _set_input(bsdf, name, value):
    if name in bsdf.inputs:
        bsdf.inputs[name].default_value = value


def material(name):
    """Devuelve (creando una sola vez) un material PBR de la paleta."""
    if name not in PALETTE:
        raise KeyError("material '%s' no está en la paleta compartida" % name)
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing

    hex_str, roughness, metallic, extras = PALETTE[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    _set_input(bsdf, "Base Color", hex_to_linear_rgba(hex_str))
    _set_input(bsdf, "Roughness", roughness)
    _set_input(bsdf, "Metallic", metallic)
    _set_input(bsdf, "Specular IOR Level", 0.5)
    _set_input(bsdf, "Sheen Weight", 0.0)
    _set_input(bsdf, "Transmission Weight", 0.0)

    coat = extras.get("coat")
    _set_input(bsdf, "Coat Weight", coat[0] if coat else 0.0)
    if coat:
        _set_input(bsdf, "Coat Roughness", coat[1])

    alpha = extras.get("alpha")
    if alpha is not None:
        _set_input(bsdf, "Alpha", alpha)
        mat.surface_render_method = "BLENDED"   # -> alphaMode BLEND

    emission = extras.get("emission")
    if emission:
        _set_input(bsdf, "Emission Color", hex_to_linear_rgba(emission[0]))
        _set_input(bsdf, "Emission Strength", emission[1])
    else:
        _set_input(bsdf, "Emission Strength", 0.0)

    # Una sola cara: todas las piezas son sólidos cerrados. Con la opción por
    # defecto de Blender el glTF sale `doubleSided` y el navegador dibuja
    # también las caras de atrás, que nunca se ven.
    mat.use_backface_culling = True
    mat.diffuse_color = hex_to_linear_rgba(hex_str)  # viewport
    mat.roughness = roughness
    mat.metallic = metallic
    return mat


def rubber():          return material("rubber")
def gloss_black():     return material("gloss-black")
def matte_black():     return material("matte-black")
def satin_black():     return material("satin-black")
def textured_black():  return material("textured-black")
def anodized_black():  return material("anodized-black")
def brushed_alu():     return material("brushed-alu")
def chrome():          return material("chrome")
def copper():          return material("copper")
def screen_glass():    return material("screen-glass")
def display_glass():   return material("display-glass")
def accent_orange():   return material("accent-orange")
def cable_red():       return material("cable-red")
def cable_blue():      return material("cable-blue")
def cable_white():     return material("cable-white")
def cable_black():     return material("cable-black")
def gold():            return material("gold")
def white_plastic():   return material("white-plastic")
def clear_plastic():   return material("clear-plastic")
def connector_red():   return material("connector-red")
def connector_smoke(): return material("connector-smoke")
def zip_clear():       return material("zip-clear")


# ---------------------------------------------------- pantalla encendida -----

def image_from_array(name, rgb):
    """
    Imagen de Blender a partir de un array (alto, ancho, 3) en sRGB 0..1 con
    la fila 0 ARRIBA (como una imagen normal). Blender guarda la fila 0
    abajo, así que se invierte. Se empaqueta: el .blend no depende de un
    archivo externo y el exportador la encuentra.
    """
    import numpy as np
    h, w, _ = rgb.shape
    img = bpy.data.images.get(name)
    if img is not None:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, width=w, height=h, alpha=False)
    img.colorspace_settings.name = "sRGB"
    rgba = np.ones((h, w, 4), np.float32)
    rgba[..., :3] = rgb[::-1]
    img.pixels.foreach_set(rgba.ravel())
    img.update()
    img.pack()
    return img


def display_material(name, image, strength=1.0):
    """
    Vidrio de pantalla encendida: lo que se ve es la textura EMISIVA (no
    depende de las luces del carrusel, como una pantalla de verdad) y encima
    queda el vidrio: color base negro, rugosidad baja y clearcoat, así que
    los focos del estudio se reflejan sobre la imagen al girar el modelo.
    """
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    _set_input(bsdf, "Base Color", (0.0, 0.0, 0.0, 1.0))
    _set_input(bsdf, "Roughness", 0.05)
    _set_input(bsdf, "Metallic", 0.0)
    _set_input(bsdf, "Specular IOR Level", 0.5)
    _set_input(bsdf, "Coat Weight", 1.0)
    _set_input(bsdf, "Coat Roughness", 0.02)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = image
    tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    _set_input(bsdf, "Emission Strength", strength)
    mat.diffuse_color = (0.02, 0.03, 0.06, 1.0)
    return mat


def planar_uv(obj, origin, u_axis, v_axis, size_u, size_v, name="uv"):
    """
    Proyección plana: u = (p − origin)·u_axis / size_u, igual para v. Para
    una losa de vidrio basta: la cara de frente recibe la imagen completa y
    los cantos, de 2 mm, solo estiran el borde negro.
    """
    me = obj.data
    uv = me.uv_layers.get(name) or me.uv_layers.new(name=name)
    o, ua, va = Vector(origin), Vector(u_axis), Vector(v_axis)
    for loop in me.loops:
        p = me.vertices[loop.vertex_index].co - o
        uv.data[loop.index].uv = (p.dot(ua) / size_u, p.dot(va) / size_v)
    return obj


# -------------------------------------------------------------- shading -----
#
# Cada pieza guarda cómo se sombrea en dos propiedades del objeto, y
# `join_objects()` lo aplica justo antes de unir. Así el bisel, el boolean o
# el solidify que se le haga a la pieza después de crearla no pisan nada.
#
#   sharp_deg  arista más abierta que esto = dura. 35 por defecto: separa las
#              caras de una caja (90°) y funde los lados de un cilindro de 12
#              segmentos o más (30° o menos).
#   weighted   normales ponderadas por área. Lo activa `bevel()`: la cara
#              grande manda en sus esquinas y queda PLANA, y el bisel hace la
#              transición. Sin esto, una caja biselada se ve como un jabón.

SHARP_DEFAULT = 35.0
SHARP_BEVELED = 65.0      # los pasos del bisel se funden entre sí
SHARP_SOFT = 80.0         # tubos, cables, esferas: solo las tapas quedan duras


def shading(obj, sharp_deg=None, weighted=None):
    """Fija cómo se sombrea una pieza. Devuelve la pieza, para encadenar."""
    if sharp_deg is not None:
        obj["sharp_deg"] = float(sharp_deg)
    if weighted is not None:
        obj["weighted"] = bool(weighted)
    return obj


def _apply_shading(obj):
    sharp_deg = float(obj.get("sharp_deg", SHARP_DEFAULT))
    weighted = bool(obj.get("weighted", False))
    me = obj.data

    bm = bmesh.new()
    bm.from_mesh(me)
    thr = math.radians(sharp_deg)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) != 2:
            e.smooth = False                  # borde abierto o no-manifold
        else:
            e.smooth = e.calc_face_angle(math.pi) <= thr
    bm.to_mesh(me)
    bm.free()
    me.update()

    if weighted:
        _activate(obj)
        m = obj.modifiers.new(name="weighted-normal", type="WEIGHTED_NORMAL")
        m.mode = "FACE_AREA"
        m.weight = 100             # 50 = todas las caras pesan igual; 100 = manda la mayor
        m.keep_sharp = True
        m.thresh = 0.01
        bpy.ops.object.modifier_apply(modifier=m.name)


# ----------------------------------------------------------- scene mgmt ------

def reset_scene():
    """Escena vacía y determinista."""
    check_blender_version()
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                 bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)
    us = bpy.context.scene.unit_settings
    us.system, us.length_unit, us.scale_length = "METRIC", "METERS", 1.0
    ensure_dirs()


def _link(name, mesh_data, material_=None):
    obj = bpy.data.objects.new(name, mesh_data)
    bpy.context.collection.objects.link(obj)
    if material_ is not None:
        obj.data.materials.append(material_)
    return obj


def _from_bmesh(name, bm, material_=None, sharp_deg=SHARP_DEFAULT):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = _link(name, mesh, material_)
    return shading(obj, sharp_deg=sharp_deg, weighted=False)


def euler_matrix(rotation):
    """Rotación XYZ en radianes, como matriz 4x4."""
    rx, ry, rz = rotation
    return (Matrix.Rotation(rz, 4, "Z")
            @ Matrix.Rotation(ry, 4, "Y")
            @ Matrix.Rotation(rx, 4, "X"))


def _mat(location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    return (Matrix.Translation(Vector(location))
            @ euler_matrix(rotation)
            @ Matrix.Diagonal(Vector(scale).to_4d()))


# --------------------------------------------------------------- prims ------

def box(name, size, location=(0, 0, 0), rotation=(0, 0, 0), material=None):
    """Caja de dimensiones `size` (x, y, z) en metros, centrada en `location`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=_mat(location, rotation, size))
    return _from_bmesh(name, bm, material)


def cylinder(name, radius, depth, segments=32, location=(0, 0, 0),
             rotation=(0, 0, 0), cap_ends=True, material=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap_ends, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=depth,
                          matrix=_mat(location, rotation))
    return _from_bmesh(name, bm, material)


def cone(name, radius_bottom, radius_top, depth, segments=32, location=(0, 0, 0),
         rotation=(0, 0, 0), cap_ends=True, material=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap_ends, cap_tris=False, segments=segments,
                          radius1=radius_bottom, radius2=radius_top, depth=depth,
                          matrix=_mat(location, rotation))
    return _from_bmesh(name, bm, material)


def tube(name, radius_outer, radius_inner, depth, segments=32, location=(0, 0, 0),
         rotation=(0, 0, 0), material=None):
    """Anillo extruido (aro, boca de puerto, cuerpo de conector)."""
    bm = bmesh.new()
    for i in range(segments):
        a0 = 2 * math.pi * i / segments
        a1 = 2 * math.pi * (i + 1) / segments
        ring = [bm.verts.new((r * math.cos(a), r * math.sin(a), -depth / 2))
                for (r, a) in ((radius_outer, a0), (radius_outer, a1),
                               (radius_inner, a1), (radius_inner, a0))]
        bm.faces.new(ring)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=depth)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.transform(_mat(location, rotation))
    return _from_bmesh(name, bm, material)


def sphere(name, radius, segments=32, rings=16, location=(0, 0, 0),
           rotation=(0, 0, 0), material=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings,
                              radius=radius, matrix=_mat(location, rotation))
    return _from_bmesh(name, bm, material, sharp_deg=SHARP_SOFT)


def torus(name, radius_major, radius_minor, major_segments=32, minor_segments=12,
          location=(0, 0, 0), rotation=(0, 0, 0), material=None):
    bm = bmesh.new()
    for i in range(major_segments):
        for j in range(minor_segments):
            quad = []
            for (di, dj) in ((0, 0), (1, 0), (1, 1), (0, 1)):
                u = 2 * math.pi * ((i + di) % major_segments) / major_segments
                v = 2 * math.pi * ((j + dj) % minor_segments) / minor_segments
                r = radius_major + radius_minor * math.cos(v)
                quad.append(bm.verts.new((r * math.cos(u), r * math.sin(u),
                                          radius_minor * math.sin(v))))
            bm.faces.new(quad)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.transform(_mat(location, rotation))
    return _from_bmesh(name, bm, material, sharp_deg=SHARP_SOFT)


def lathe(name, profile, segments=48, location=(0, 0, 0), rotation=(0, 0, 0),
          material=None, close=False):
    """
    Revoluciona un perfil 2D alrededor de Z. `profile`: lista de (radio, z).
    Un radio 0 colapsa el anillo en un polo. Las esquinas del perfil más
    cerradas que SHARP_DEFAULT quedan duras; las curvas suaves, suaves.
    """
    bm = bmesh.new()
    rings = []
    for (r, z) in profile:
        ring = []
        for i in range(segments):
            a = 2 * math.pi * i / segments
            if r <= 1e-9:
                ring.append(bm.verts.new((0.0, 0.0, z)) if i == 0 else ring[0])
            else:
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        for i in range(segments):
            j = (i + 1) % segments
            uniq = []
            for v in (lo[i], lo[j], hi[j], hi[i]):
                if v not in uniq:
                    uniq.append(v)
            if len(uniq) >= 3:
                try:
                    bm.faces.new(uniq)
                except ValueError:
                    pass
    if close:
        for ring in (rings[0], rings[-1]):
            uniq = []
            for v in ring:
                if v not in uniq:
                    uniq.append(v)
            if len(uniq) >= 3:
                try:
                    bm.faces.new(uniq)
                except ValueError:
                    pass
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.transform(_mat(location, rotation))
    return _from_bmesh(name, bm, material)


def _catmull_rom(points, samples_per_span):
    """Interpola una polilínea con Catmull-Rom (pasa por todos los puntos)."""
    pts = [Vector(p) for p in points]
    if len(pts) < 3 or samples_per_span <= 1:
        return pts
    ext = [pts[0] + (pts[0] - pts[1])] + pts + [pts[-1] + (pts[-1] - pts[-2])]
    out = []
    for i in range(1, len(ext) - 2):
        p0, p1, p2, p3 = ext[i - 1], ext[i], ext[i + 1], ext[i + 2]
        for k in range(samples_per_span):
            t = k / samples_per_span
            t2, t3 = t * t, t * t * t
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(pts[-1])
    return out


def swept_tube(name, path, radius, sides=12, material=None, caps=True,
               smooth_path=1):
    """
    Barre una sección circular a lo largo de una polilínea 3D (cables, mazos,
    latiguillos). `smooth_path` > 1 interpola la polilínea con Catmull-Rom
    antes de barrer: pocos puntos de control, curva continua.

    Los marcos se transportan de punto a punto (transporte paralelo), así la
    sección no gira sobre sí misma ni se tuerce en los tramos verticales.
    Sombreado suave: los lados del tubo se funden; solo las tapas son duras.
    """
    pts = _catmull_rom(path, smooth_path) if smooth_path > 1 else [Vector(p) for p in path]
    if len(pts) < 2:
        raise ValueError("swept_tube: hacen falta al menos 2 puntos")

    tangents = []
    for i in range(len(pts)):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == len(pts) - 1:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        tangents.append(t.normalized())

    ref = Vector((0.0, 0.0, 1.0))
    if abs(tangents[0].dot(ref)) > 0.9:
        ref = Vector((1.0, 0.0, 0.0))
    side = tangents[0].cross(ref).normalized()

    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        if i > 0:
            # transporte paralelo: quita a `side` la componente sobre la
            # tangente nueva, sin rotarlo alrededor de ella
            side = (side - tangents[i] * side.dot(tangents[i])).normalized()
        up = side.cross(tangents[i]).normalized()
        rings.append([bm.verts.new(p + side * (radius * math.cos(2 * math.pi * j / sides))
                                   + up * (radius * math.sin(2 * math.pi * j / sides)))
                      for j in range(sides)])

    for k in range(len(rings) - 1):
        lo, hi = rings[k], rings[k + 1]
        for j in range(sides):
            n = (j + 1) % sides
            try:
                bm.faces.new([lo[j], lo[n], hi[n], hi[j]])
            except ValueError:
                pass
    if caps:
        for ring in (rings[0], rings[-1]):
            try:
                bm.faces.new(ring)
            except ValueError:
                pass
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    return _from_bmesh(name, bm, material, sharp_deg=SHARP_SOFT)


def flat_coil_path(radius_outer, radius_inner, turns, z_base, rise=0.0,
                   steps_per_turn=40, phase=0.0):
    """Espiral plana (rollo de cable apoyado en el piso)."""
    total = int(turns * steps_per_turn)
    path = []
    for i in range(total + 1):
        t = i / total
        a = phase + 2 * math.pi * turns * t
        r = radius_outer + (radius_inner - radius_outer) * t
        path.append((r * math.cos(a), r * math.sin(a), z_base + rise * t))
    return path


def grid_instances(factory, count_x, count_y, pitch_x, pitch_y, origin=(0, 0, 0)):
    out = []
    ox, oy, oz = origin
    for i in range(count_x):
        for j in range(count_y):
            obj = factory(i, j, (ox + (i - (count_x - 1) / 2) * pitch_x,
                                 oy + (j - (count_y - 1) / 2) * pitch_y, oz))
            if obj is not None:
                out.append(obj)
    return out


def radial_instances(factory, count, radius, origin=(0, 0, 0), phase=0.0):
    out = []
    ox, oy, oz = origin
    for i in range(count):
        a = phase + 2 * math.pi * i / count
        obj = factory(i, a, (ox + radius * math.cos(a), oy + radius * math.sin(a), oz))
        if obj is not None:
            out.append(obj)
    return out


# ---------------------------------------------------------- modifiers -------

def _activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width, segments=3, angle_deg=40.0, clamp=True):
    """
    Bisel aplicado + normales ponderadas. El ancho es el de PANTALLA, no el
    del plano: ver la nota 2 del encabezado.
    """
    _activate(obj)
    m = obj.modifiers.new(name="bevel", type="BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle_deg)
    m.harden_normals = False           # las normales las pone _apply_shading
    m.use_clamp_overlap = clamp
    bpy.ops.object.modifier_apply(modifier=m.name)
    return shading(obj, sharp_deg=SHARP_BEVELED, weighted=True)


# alias con el nombre de la v1, para portar scripts sin tropezar
apply_bevel = bevel


def apply_solidify(obj, thickness, offset=-1.0):
    _activate(obj)
    m = obj.modifiers.new(name="solidify", type="SOLIDIFY")
    m.thickness = thickness
    m.offset = offset
    bpy.ops.object.modifier_apply(modifier=m.name)
    return obj


def boolean(obj, cutter, operation="DIFFERENCE", delete_cutter=True):
    _activate(obj)
    m = obj.modifiers.new(name="boolean", type="BOOLEAN")
    m.operation = operation
    m.object = cutter
    m.solver = "EXACT"
    bpy.ops.object.modifier_apply(modifier=m.name)
    if delete_cutter:
        bpy.data.objects.remove(cutter, do_unlink=True)
    return obj


def screw_revolve(name, profile, segments=96, material=None, close=False,
                  thickness=0.0):
    """Revolución por modificador Screw a partir de un perfil (r, z)."""
    mesh = bpy.data.meshes.new(name)
    verts = [(float(r), 0.0, float(z)) for (r, z) in profile]
    edges = [(i, i + 1) for i in range(len(verts) - 1)]
    if close:
        edges.append((len(verts) - 1, 0))
    mesh.from_pydata(verts, edges, [])
    mesh.update()
    obj = _link(name, mesh, material)
    _activate(obj)
    m = obj.modifiers.new(name="screw", type="SCREW")
    m.axis = "Z"
    m.angle = 2.0 * math.pi
    m.steps = segments
    m.render_steps = segments
    m.screw_offset = 0.0
    m.iterations = 1
    m.use_merge_vertices = True
    m.merge_threshold = 1e-5
    m.use_normal_calculate = True
    bpy.ops.object.modifier_apply(modifier=m.name)
    if thickness:
        apply_solidify(obj, thickness, offset=0.0)
    return shading(obj, sharp_deg=SHARP_DEFAULT, weighted=False)


# ---------------------------------------------------- limpieza de malla -----

def _cleanup_part(obj, distance=2e-5):
    """
    Saneamiento POR PIEZA, antes de unir: suelda duplicados, borra geometría
    suelta y caras de área cero, y orienta las normales hacia afuera.

    La v1 lo hacía sobre el modelo ya unido, con 0.1 mm de tolerancia: eso
    soldaba entre sí piezas distintas que se tocaban y les compartía normales.
    """
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=distance)
    loose_e = [e for e in bm.edges if not e.link_faces]
    if loose_e:
        bmesh.ops.delete(bm, geom=loose_e, context="EDGES")
    loose_v = [v for v in bm.verts if v.is_valid and not v.link_faces]
    if loose_v:
        bmesh.ops.delete(bm, geom=loose_v, context="VERTS")
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=distance / 10.0)
    dead = [f for f in bm.faces if f.calc_area() < 1e-12]
    if dead:
        bmesh.ops.delete(bm, geom=dead, context="FACES")
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def _bake_transform(obj):
    """Hornea matrix_world en la malla y deja el objeto en identidad."""
    if obj.parent:
        obj.parent = None
    obj.delta_location = (0.0, 0.0, 0.0)
    obj.delta_rotation_euler = (0.0, 0.0, 0.0)
    obj.delta_scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()
    if obj.matrix_world != Matrix.Identity(4):
        obj.data.transform(obj.matrix_world)
        obj.matrix_world = Matrix.Identity(4)
        obj.data.update()


def join_objects(objects, name, prepare=True):
    """
    Une piezas en un objeto. Con `prepare` (lo normal) cada pieza se limpia
    y se sombrea ANTES de unir. `prepare=False` es para cortadores de
    booleano, que se borran después y no necesitan nada de eso.
    """
    objects = [o for o in objects if o is not None]
    if not objects:
        raise ValueError("join_objects: lista vacía")
    if prepare:
        for o in objects:
            _bake_transform(o)
            _cleanup_part(o)
            _apply_shading(o)
    target = objects[0]
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target
    if len(objects) > 1:
        bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def discard_orphans(parts):
    """Borra de la escena toda malla que no esté en `parts` (cortadores que
    sobrevivieron a un modifier_apply fallido, restos de pruebas)."""
    keep = {p.name for p in parts}
    for o in list(bpy.context.scene.objects):
        if o.type == "MESH" and o.name not in keep:
            print("  descartando objeto huérfano: %s" % o.name)
            bpy.data.objects.remove(o, do_unlink=True)


# -------------------------------------------------------- oclusión (AO) -----

def _fibonacci_hemisphere(n):
    """Direcciones fijas sobre el hemisferio +Z, ponderadas por coseno."""
    out = []
    golden = math.pi * (3.0 - math.sqrt(5.0))
    for i in range(n):
        u = (i + 0.5) / n
        r = math.sqrt(u)
        a = golden * i
        out.append(Vector((r * math.cos(a), r * math.sin(a), math.sqrt(1.0 - u))))
    return out


def bake_vertex_ao(obj, distance=0.012, samples=48, strength=0.85, floor=0.35,
                   name="ao"):
    """
    Oclusión ambiental de contacto horneada en un color por esquina
    (COLOR_0 del glTF). El cargador de three.js lo multiplica por el color
    base sin tocar nada del sitio. Sin texturas: respeta la convención.

    `distance` corto a propósito: se busca el oscurecido de los contactos y
    las ranuras, no una sombra global. Direcciones deterministas: el mismo
    script da siempre el mismo .glb.
    """
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    tree = BVHTree.FromBMesh(bm)
    bm.free()

    dirs = _fibonacci_hemisphere(samples)
    normals = me.corner_normals
    attr = me.color_attributes.get(name)
    if attr is None:
        attr = me.color_attributes.new(name=name, type="FLOAT_COLOR", domain="CORNER")
    me.color_attributes.active_color = attr

    eps = 2e-5
    cache = {}
    for loop in me.loops:
        n = Vector(normals[loop.index].vector)
        key = (loop.vertex_index, round(n.x, 3), round(n.y, 3), round(n.z, 3))
        if key not in cache:
            p = me.vertices[loop.vertex_index].co + n * eps
            basis = n.to_track_quat("Z", "Y").to_matrix()
            hits = 0
            for d in dirs:
                hit = tree.ray_cast(p, basis @ d, distance)
                if hit[0] is not None:
                    hits += 1
            occ = hits / samples
            cache[key] = max(floor, 1.0 - strength * occ)
        v = cache[key]
        attr.data[loop.index].color = (v, v, v, 1.0)
    return obj


# ------------------------------------------------------ pivot / medidas -----

FRONT_YAW = {
    # hacia dónde mira el frente en el script -> giro sobre Z para llevarlo a +Y
    "+Y": 0.0, "-Y": math.pi, "+X": math.pi / 2.0, "-X": -math.pi / 2.0,
    # los drivers miran hacia arriba (+Z); el frente horizontal no importa
    "top": 0.0,
}


def mesh_bounds(obj):
    """Bbox sobre los VÉRTICES reales en espacio de mundo (no el caché)."""
    mw = obj.matrix_world
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for v in obj.data.vertices:
        p = mw @ v.co
        for i in range(3):
            lo[i] = min(lo[i], p[i])
            hi[i] = max(hi[i], p[i])
    return lo, hi


def world_bounds(objects):
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for o in objects:
        for v in o.data.vertices:
            p = o.matrix_world @ v.co
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi


def normalize_object(obj, xy="bbox", front="+Y"):
    """
    Posición canónica: frente a +Y, Zmin = 0, centro XY en el origen (o el
    eje de construcción con xy="keep", para los drivers: si se centra el
    bbox, los terminales que sobresalen a un lado corren el eje del cono).
    """
    if front not in FRONT_YAW:
        raise ValueError("front debe ser uno de %s" % sorted(FRONT_YAW))
    _bake_transform(obj)
    yaw = FRONT_YAW[front]
    if yaw:
        obj.data.transform(Matrix.Rotation(yaw, 4, "Z"))
        obj.data.update()
    lo, hi = mesh_bounds(obj)
    dx = -(lo.x + hi.x) / 2.0 if xy == "bbox" else 0.0
    dy = -(lo.y + hi.y) / 2.0 if xy == "bbox" else 0.0
    obj.data.transform(Matrix.Translation(Vector((dx, dy, -lo.z))))
    obj.data.update()
    bpy.context.view_layer.update()
    return obj


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def dimensions(obj):
    lo, hi = mesh_bounds(obj)
    return (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)


def swept_radius(obj):
    """Radio del cilindro que barre el modelo al girar sobre su eje vertical
    (el FRAME_RADIUS del sitio se calcula con esto, no con el bbox)."""
    return max(math.hypot(v.co.x, v.co.y) for v in obj.data.vertices)


def signed_volume(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    vol = bm.calc_volume(signed=True)
    bm.free()
    return vol


# ------------------------------------------------------ control de normales -

def normal_report(obj, big_face_m2=2e-4):
    """
    Mide lo que falló en la v1:
      split    vértices con esquinas de normales distintas (> 30°): aristas duras
      bent     caras grandes (> 2 cm² y > 4 mm de ancho) con alguna normal a
               más de 8° de la cara: una caja que se ve como jabón
    """
    me = obj.data
    cn = me.corner_normals
    per_vertex = {}
    for loop in me.loops:
        per_vertex.setdefault(loop.vertex_index, []).append(Vector(cn[loop.index].vector))
    split = 0
    cos30 = math.cos(math.radians(30.0))
    for ns in per_vertex.values():
        if len(ns) > 1 and any(a.dot(b) < cos30 for a in ns for b in ns):
            split += 1
    bent = big = 0
    cos8 = math.cos(math.radians(8.0))
    verts = me.vertices
    for poly in me.polygons:
        if poly.area < big_face_m2:
            continue
        # las tiras de un bisel son largas y angostas, y SÍ deben curvarse:
        # solo cuentan las caras de más de 4 mm de ancho
        ids = list(poly.vertices)
        longest = max((verts[ids[i]].co - verts[ids[(i + 1) % len(ids)]].co).length
                      for i in range(len(ids)))
        if poly.area / longest < 0.004:
            continue
        big += 1
        fn = poly.normal
        if any(Vector(cn[li].vector).dot(fn) < cos8 for li in poly.loop_indices):
            bent += 1
    return {"split_vertices": split, "vertices": len(me.vertices),
            "big_faces": big, "big_faces_bent": bent}


# --------------------------------------------------------------- export -----

def export_glb(obj, basename, vertex_colors=False, texture=False):
    """Export glTF binario: Draco, +Y up, sin cámaras ni luces. Sin reintento
    silencioso: si la firma del operador cambió, que falle.

    `texture`: exporta UV y la textura de pantalla en WebP (EXT_texture_webp,
    que three.js lee de fábrica). Sin eso, ni UV ni imágenes."""
    ensure_dirs()
    path = os.path.join(MODELS_DIR, basename + ".glb")
    _activate(obj)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=False,
        export_materials="EXPORT",
        export_image_format="WEBP" if texture else "NONE",
        export_image_quality=90,
        export_image_webp_fallback=False,
        export_normals=True,
        export_tangents=False,
        export_texcoords=texture,
        export_vertex_color="ACTIVE" if vertex_colors else "NONE",
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=12,
        export_draco_color_quantization=8,
    )
    return path


def read_glb_json(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, _version, _length = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF":
        raise RuntimeError("%s no es un GLB" % path)
    chunk_len, chunk_type = struct.unpack_from("<II", data, 12)
    if chunk_type != 0x4E4F534A:
        raise RuntimeError("%s: el primer chunk no es JSON" % path)
    return json.loads(data[20:20 + chunk_len].decode("utf-8"))


# ------------------------------------------------------------- finalize -----

class ModelError(RuntimeError):
    pass


def finalize(obj, basename, front="+Y", xy="bbox", expected_dims=None,
             ao=False, ao_kwargs=None, texture=False):
    """
    Cierra el pipeline: orienta y normaliza, (opcional) hornea AO, exporta,
    VALIDA y escribe las medidas del manifiesto. Corta con ModelError ante
    cualquier falla de las que antes pasaban en silencio.

      basename  nombre del archivo CON versión («screen-3»)
      front     hacia dónde mira el frente en el script («-Y», «+X», «top»…)
      xy        «bbox» o «keep» (drivers: se respeta el eje de construcción)
      ao        hornear oclusión de contacto en COLOR_0
      texture   el modelo lleva la textura de una pantalla encendida
                (screen, head-unit)
    """
    model_id = basename.rsplit("-", 1)[0] if basename.rsplit("-", 1)[-1].isdigit() else basename
    normalize_object(obj, xy=xy, front=front)
    if ao:
        bake_vertex_ao(obj, **(ao_kwargs or {}))

    tris = triangle_count(obj)
    dims = dimensions(obj)
    lo, hi = mesh_bounds(obj)
    vol = signed_volume(obj)
    radius = swept_radius(obj)
    nrm = normal_report(obj)
    path = export_glb(obj, basename, vertex_colors=ao, texture=texture)
    size = os.path.getsize(path)
    gltf = read_glb_json(path)
    mats = sorted({s.material.name for s in obj.material_slots if s.material})

    errors, warnings = [], []
    if nrm["split_vertices"] == 0:
        errors.append("0 aristas duras: el modelo salió 100 % suavizado")
    if nrm["big_faces"] and nrm["big_faces_bent"] / nrm["big_faces"] > 0.10:
        warnings.append("%d de %d caras grandes con normales dobladas"
                        % (nrm["big_faces_bent"], nrm["big_faces"]))
    for node in gltf.get("nodes", []):
        for k in ("translation", "rotation", "scale", "matrix"):
            if k in node:
                errors.append("el nodo '%s' trae %s" % (node.get("name"), k))
    images = gltf.get("images", [])
    image_bytes = sum(gltf["bufferViews"][im["bufferView"]]["byteLength"]
                      for im in images if "bufferView" in im)
    if texture and len(images) != 1:
        errors.append("se esperaba 1 imagen (la pantalla) y hay %d" % len(images))
    if not texture and images:
        errors.append("trae %d imágenes: solo una pantalla encendida puede llevar "
                      "textura, y el script lo declara con texture=True" % len(images))
    if "KHR_draco_mesh_compression" not in gltf.get("extensionsRequired", []):
        errors.append("falta KHR_draco_mesh_compression en extensionsRequired")
    if abs(lo.z) > 1e-6:
        errors.append("no apoya en z = 0 (zmin %.6f)" % lo.z)
    if xy == "bbox" and max(abs(lo.x + hi.x), abs(lo.y + hi.y)) / 2.0 > 5e-4:
        errors.append("descentrado en XY")
    if not (TRI_BUDGET[0] <= tris <= TRI_BUDGET[1]):
        errors.append("%s triángulos, fuera de %s–%s"
                      % (f"{tris:,}", f"{TRI_BUDGET[0]:,}", f"{TRI_BUDGET[1]:,}"))
    if size > MAX_GLB_BYTES:
        errors.append("pesa %.1f KB, más de 300" % (size / 1024.0))
    if vol <= 0:
        warnings.append("volumen firmado negativo: normales invertidas en alguna pieza")
    if expected_dims:
        for axis, got, want in zip("xyz", dims, expected_dims):
            if want and abs(got - want) > max(0.002, want * 0.02):
                warnings.append("eje %s mide %.3f m, se esperaba ~%.3f m" % (axis, got, want))

    measures = {
        "id": model_id,
        "archivo": basename + ".glb",
        "radius": round(radius, 4),
        "height": round(hi.z - lo.z, 4),
        "tris": tris,
        "bytes": size,
        "materials": mats,
        "blender": bpy.app.version_string,
    }
    with open(os.path.join(MEASURES_DIR, model_id + ".json"), "w", encoding="utf-8") as f:
        json.dump(measures, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print("\n" + "=" * 64)
    print("modelo        : %s  (Blender %s)" % (basename, bpy.app.version_string))
    print("triángulos    : %s" % f"{tris:,}")
    print("dimensiones   : %.3f x %.3f x %.3f m (x, y, z Blender)" % dims)
    print("radio / alto  : %.4f / %.4f m  (para el manifiesto)" % (radius, hi.z - lo.z))
    print("frente        : %s" % ("hacia arriba (driver), sin giro" if front == "top"
                                      else "%s -> +Y de Blender (-Z del glTF)" % front))
    print("aristas duras : %d vértices partidos de %d" % (nrm["split_vertices"], nrm["vertices"]))
    print("caras grandes : %d, %d con normales dobladas" % (nrm["big_faces"], nrm["big_faces_bent"]))
    print("AO en vértices: %s" % ("sí" if ao else "no"))
    if texture:
        print("textura       : %d imagen, %.1f KB (%s)" % (
            len(images), image_bytes / 1024.0,
            ", ".join(im.get("mimeType", "?") for im in images)))
    print("materiales    : %s" % ", ".join(mats))
    print("glb           : %s  (%.1f KB)" % (os.path.relpath(path, REPO_ROOT), size / 1024.0))
    for w in warnings:
        print("AVISO         : " + w)
    for e in errors:
        print("ERROR         : " + e)
    print("=" * 64 + "\n")
    if errors:
        raise ModelError("%s: %s" % (basename, "; ".join(errors)))
    return measures
