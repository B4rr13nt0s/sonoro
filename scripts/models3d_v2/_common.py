"""
Sonoro — utilidades compartidas para los modelos 3D de categoría.

Convenciones (no negociables):
  - metros, escala real
  - origen del mundo en el centro de la base, objeto centrado en XY
  - Blender es Z-up; el export glTF hace la conversión a +Y up (NO se rota la malla)
  - 5,000 a 25,000 triángulos por modelo
  - shade_auto_smooth a 30 grados, sin subdivisión
  - materiales PBR por valores, sin texturas de imagen
  - Draco activado, sin cámaras ni luces, .glb < 300 KB
  - nombres de objetos y materiales en inglés, kebab-case

Uso típico en un script de producto:

    import sys, os
    sys.path.append(os.path.dirname(__file__))
    from _common import *

    reset_scene()
    parts = []
    parts.append(box("basket-frame", (0.16, 0.16, 0.02), material=matte_black()))
    ...
    obj = join_objects(parts, "speaker")
    finalize(obj, "speaker")
"""

import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- paths ------

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, "..", ".."))
MODELS_DIR = os.path.join(REPO_ROOT, "public", "models")
PREVIEWS_DIR = os.path.join(MODELS_DIR, "previews")

TRI_BUDGET = (5_000, 25_000)
MAX_GLB_BYTES = 300 * 1024
AUTO_SMOOTH_DEG = 30.0


def ensure_dirs():
    os.makedirs(MODELS_DIR, exist_ok=True)
    os.makedirs(PREVIEWS_DIR, exist_ok=True)


# ------------------------------------------------------------ materials ------

PALETTE = {
    # name             : (hex,       roughness, metallic)
    "matte-black":      ("1A1A1A", 0.85, 0.0),
    "textured-black":   ("232323", 0.95, 0.0),
    "brushed-alu":      ("B8BCC0", 0.35, 1.0),
    "chrome":           ("E8EAED", 0.08, 1.0),
    "rubber":           ("101010", 0.98, 0.0),
    "copper":           ("B87333", 0.30, 1.0),
    "screen-glass":     ("0A0C10", 0.05, 0.0),
    "accent-orange":    ("FF6A00", 0.50, 0.0),
    # aislaciones de cable: no son acentos de marca, son codigo de color
    # electrico (positivo / remoto) y solo se usan en install-kit y rca-cable
    "cable-red":        ("C41E1E", 0.90, 0.0),
    "cable-blue":       ("1B4FA8", 0.90, 0.0),
    "cable-white":      ("E6E6E6", 0.85, 0.0),
}


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(hex_str, alpha=1.0):
    h = hex_str.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b), alpha)


def material(name):
    """Devuelve (creando una sola vez) un material PBR de la paleta compartida."""
    if name not in PALETTE:
        raise KeyError("material '%s' no esta en la paleta compartida" % name)
    existing = bpy.data.materials.get(name)
    if existing is not None:
        return existing

    hex_str, roughness, metallic = PALETTE[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hex_to_linear_rgba(hex_str)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    # sin texturas: apagamos todo lo que pueda meter mapas o costo extra
    for socket in ("Specular IOR Level", "Specular", "Sheen Weight", "Coat Weight"):
        if socket in bsdf.inputs:
            try:
                bsdf.inputs[socket].default_value = 0.5 if "Specular" in socket else 0.0
            except (TypeError, AttributeError):
                pass
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = 0.0
    mat.diffuse_color = hex_to_linear_rgba(hex_str)  # viewport / fallback
    mat.roughness = roughness
    mat.metallic = metallic
    return mat


# atajos con nombre, para legibilidad en los scripts de producto
def matte_black():    return material("matte-black")
def textured_black(): return material("textured-black")
def brushed_alu():    return material("brushed-alu")
def chrome():         return material("chrome")
def rubber():         return material("rubber")
def copper():         return material("copper")
def screen_glass():   return material("screen-glass")
def accent_orange():  return material("accent-orange")
def cable_red():      return material("cable-red")
def cable_blue():     return material("cable-blue")
def cable_white():    return material("cable-white")


# ----------------------------------------------------------- scene mgmt ------

def reset_scene():
    """Escena vacía y determinista. Borra objetos, mallas y materiales huérfanos."""
    if bpy.context.object and bpy.context.object.mode != "OBJECT":
        bpy.ops.object.mode_set(mode="OBJECT")
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.curves,
                 bpy.data.cameras, bpy.data.lights, bpy.data.images):
        for item in list(coll):
            if item.users == 0:
                coll.remove(item)
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.length_unit = "METERS"
    bpy.context.scene.unit_settings.scale_length = 1.0
    ensure_dirs()


def _link(name, mesh_data, material_=None):
    obj = bpy.data.objects.new(name, mesh_data)
    bpy.context.collection.objects.link(obj)
    if material_ is not None:
        obj.data.materials.append(material_)
    return obj


def _from_bmesh(name, bm, material_=None):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    return _link(name, mesh, material_)


def euler_matrix(rotation):
    """Rotación XYZ en radianes, como matriz 4x4."""
    rx, ry, rz = rotation
    return (Matrix.Rotation(rz, 4, "Z")
            @ Matrix.Rotation(ry, 4, "Y")
            @ Matrix.Rotation(rx, 4, "X"))


def _mat(location=(0, 0, 0), rotation=(0, 0, 0), scale=(1, 1, 1)):
    """Matriz de construcción para las primitivas de bmesh."""
    return (Matrix.Translation(Vector(location))
            @ euler_matrix(rotation)
            @ Matrix.Diagonal(Vector(scale).to_4d()))


# --------------------------------------------------------------- prims ------

def box(name, size, location=(0, 0, 0), rotation=(0, 0, 0), material=None):
    """Caja de dimensiones `size` (x, y, z) en metros, centrada en `location`."""
    sx, sy, sz = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=_mat(location, rotation, (sx, sy, sz)))
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
    """Tronco de cono — la primitiva base para conos de parlante, domos, pies."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap_ends, cap_tris=False, segments=segments,
                          radius1=radius_bottom, radius2=radius_top, depth=depth,
                          matrix=_mat(location, rotation))
    return _from_bmesh(name, bm, material)


def tube(name, radius_outer, radius_inner, depth, segments=32, location=(0, 0, 0),
         rotation=(0, 0, 0), material=None):
    """Anillo extruido (aro de montaje, boca de puerto, cuerpo de conector)."""
    bm = bmesh.new()
    for i in range(segments):
        a0 = 2 * math.pi * i / segments
        a1 = 2 * math.pi * (i + 1) / segments
        ring = []
        for (r, a) in ((radius_outer, a0), (radius_outer, a1),
                       (radius_inner, a1), (radius_inner, a0)):
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), -depth / 2)))
        bm.faces.new(ring)
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=depth)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.transform(_mat(location, rotation))
    return _from_bmesh(name, bm, material)


def sphere(name, radius, segments=32, rings=16, location=(0, 0, 0),
           rotation=(0, 0, 0), material=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segments, v_segments=rings,
                              radius=radius, matrix=_mat(location, rotation))
    return _from_bmesh(name, bm, material)


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
    return _from_bmesh(name, bm, material)


def lathe(name, profile, segments=48, location=(0, 0, 0), rotation=(0, 0, 0),
          material=None, close=False):
    """
    Revoluciona un perfil 2D alrededor de Z.
    `profile`: lista de (radio, z) de abajo hacia arriba, en metros.
    Ideal para conos de parlante, domos, cuerpos torneados.
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
            verts = [lo[i], lo[j], hi[j], hi[i]]
            uniq = []
            for v in verts:
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
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.transform(_mat(location, rotation))
    return _from_bmesh(name, bm, material)


def swept_tube(name, path, radius, sides=8, material=None, caps=True):
    """
    Barre una seccion circular a lo largo de una polilinea 3D.
    `path`: lista de (x, y, z) en metros. Para rollos de cable, mazos y
    latiguillos — cualquier tubo que siga una curva, no un eje recto.
    Los marcos se calculan con una referencia arriba estable, asi que la
    seccion no gira sobre si misma a lo largo del recorrido.
    """
    pts = [Vector(p) for p in path]
    if len(pts) < 2:
        raise ValueError("swept_tube: hacen falta al menos 2 puntos")

    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        if i == 0:
            tan = (pts[1] - pts[0])
        elif i == len(pts) - 1:
            tan = (pts[-1] - pts[-2])
        else:
            tan = (pts[i + 1] - pts[i - 1])
        tan.normalize()
        ref = Vector((0.0, 0.0, 1.0))
        if abs(tan.dot(ref)) > 0.95:
            ref = Vector((1.0, 0.0, 0.0))
        side = tan.cross(ref).normalized()
        up = side.cross(tan).normalized()
        ring = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            ring.append(bm.verts.new(
                p + side * (radius * math.cos(a)) + up * (radius * math.sin(a))))
        rings.append(ring)

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
    return _from_bmesh(name, bm, material)


def flat_coil_path(radius_outer, radius_inner, turns, z_base, rise=0.0,
                   steps_per_turn=40, phase=0.0):
    """
    Polilinea de una espiral plana (rollo de cable apoyado en el piso):
    el radio decrece de exterior a interior a lo largo de `turns` vueltas.
    """
    total = int(turns * steps_per_turn)
    path = []
    for i in range(total + 1):
        t = i / total
        a = phase + 2 * math.pi * turns * t
        r = radius_outer + (radius_inner - radius_outer) * t
        path.append((r * math.cos(a), r * math.sin(a), z_base + rise * t))
    return path


def grid_instances(factory, count_x, count_y, pitch_x, pitch_y, origin=(0, 0, 0)):
    """Repite `factory(i, j, (x, y, z))` en una rejilla centrada en `origin`."""
    out = []
    ox, oy, oz = origin
    for i in range(count_x):
        for j in range(count_y):
            x = ox + (i - (count_x - 1) / 2) * pitch_x
            y = oy + (j - (count_y - 1) / 2) * pitch_y
            obj = factory(i, j, (x, y, oz))
            if obj is not None:
                out.append(obj)
    return out


def radial_instances(factory, count, radius, origin=(0, 0, 0), phase=0.0):
    """Repite `factory(i, angle, (x, y, z))` en un círculo (tornillos, pernos)."""
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
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_bevel(obj, width, segments=2, angle_deg=40.0, clamp=True):
    """Chaflán aplicado (no destructivo cero: se aplica y queda en la malla)."""
    _activate(obj)
    m = obj.modifiers.new(name="bevel", type="BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.angle_limit = math.radians(angle_deg)
    if hasattr(m, "harden_normals"):
        m.harden_normals = False
    # el nombre de la propiedad cambio entre versiones de Blender
    for prop in ("use_clamp_overlap", "clamp_overlap"):
        if hasattr(m, prop):
            setattr(m, prop, clamp)
            break
    bpy.ops.object.modifier_apply(modifier=m.name)
    return obj


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


def join_objects(objects, name):
    """Une una lista de objetos en uno; conserva los slots de material."""
    objects = [o for o in objects if o is not None]
    if not objects:
        raise ValueError("join_objects: lista vacia")
    target = objects[0]
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target
    if len(objects) > 1:
        bpy.ops.object.join()
    target.name = name
    target.data.name = name
    return target


def screw_revolve(name, profile, segments=96, material=None, close=False,
                  thickness=0.0):
    """
    Revolucion por modificador Screw a partir de una polilinea de perfil
    (r, z). A diferencia de `lathe`, que teje la malla a mano, aca el propio
    Screw genera los segmentos radiales: con `segments` alto la superficie
    sale continua y no aparece el aro dentado de un perfil con pocos pasos.
    """
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
    if hasattr(m, "use_normal_calculate"):
        m.use_normal_calculate = True
    bpy.ops.object.modifier_apply(modifier=m.name)
    if thickness:
        apply_solidify(obj, thickness, offset=0.0)
    return obj


def weld(obj, distance=1e-5):
    _activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=distance)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    return obj


# -------------------------------------------------------------- shading -----

def shade_auto_smooth(obj, angle_deg=AUTO_SMOOTH_DEG):
    """Auto-smooth a 30 grados. Compatible 4.1+ (operador) y <=4.0 (mesh flags)."""
    _activate(obj)
    angle = math.radians(angle_deg)
    if hasattr(bpy.ops.object, "shade_auto_smooth"):
        bpy.ops.object.shade_smooth()
        bpy.ops.object.shade_auto_smooth(angle=angle)
    else:
        bpy.ops.object.shade_smooth()
        obj.data.use_auto_smooth = True
        obj.data.auto_smooth_angle = angle
    return obj


# ---------------------------------------------------- limpieza de malla -----

def cleanup_mesh(obj, distance=0.0001, verbose=True):
    """
    Saneamiento de malla despues de joins y booleanos:
      1. merge by distance (0.1 mm por defecto),
      2. borra geometria suelta (vertices y aristas sin cara),
      3. disuelve caras degeneradas (area cero) y aristas de largo cero,
      4. recalcula normales hacia AFUERA.
    El volumen firmado negativo y los miles de triangulos de area cero salen
    de booleanos que dejan caras invertidas o colapsadas: esto los elimina.
    """
    before_tris = triangle_count(obj)
    before_verts = len(obj.data.vertices)
    before_vol = signed_volume(obj)

    _activate(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=distance)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.delete_loose(use_verts=True, use_edges=True, use_faces=False)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.dissolve_degenerate(threshold=distance / 10.0)
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # las caras que quedaron con area cero no se disuelven solas: se marcan
    # y se borran por area calculada
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    dead = [f for f in bm.faces if f.calc_area() < 1e-10]
    if dead:
        bmesh.ops.delete(bm, geom=dead, context="FACES")
        bm.to_mesh(obj.data)
        obj.data.update()
    bm.free()

    after_vol = signed_volume(obj)
    if verbose:
        print("cleanup_mesh  : %s" % obj.name)
        print("  vertices    : %s -> %s" % (f"{before_verts:,}",
                                            f"{len(obj.data.vertices):,}"))
        print("  triangulos  : %s -> %s" % (f"{before_tris:,}",
                                            f"{triangle_count(obj):,}"))
        print("  caras area 0: %d eliminadas" % len(dead))
        print("  volumen     : %+.2f L -> %+.2f L  %s" % (
            before_vol * 1000.0, after_vol * 1000.0,
            "OK" if after_vol > 0 else "SIGUE NEGATIVO"))
    return obj


def signed_volume(obj):
    """Volumen firmado en m3. Negativo = normales invertidas / malla al reves."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    vol = bm.calc_volume(signed=True)
    bm.free()
    return vol


# ------------------------------------------------------ pivot / medidas -----

def mesh_bounds(obj):
    """
    Bounding box calculado sobre los VERTICES reales, en espacio de mundo.
    `obj.bound_box` queda cacheado y despues de obj.data.transform() puede
    devolver valores viejos — ese cache es la razon por la que los modelos
    terminaban flotando en Z aunque se llamara a center_on_base.
    """
    mw = obj.matrix_world
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for v in obj.data.vertices:
        p = mw @ v.co
        for i in range(3):
            lo[i] = min(lo[i], p[i])
            hi[i] = max(hi[i], p[i])
    return lo, hi


def normalize_object(obj, xy="bbox", verbose=True):
    """
    Deja la malla en la posicion canonica del proyecto:
      1. limpia parent y delta transforms, y hornea matrix_world en la malla
         (asi no queda ninguna transformacion pendiente que el exportador
         pueda interpretar distinto),
      2. recalcula el bbox desde los vertices, no desde el cache,
      3. traslada la malla para que Zmin = 0,
      4. deja el centro XY del bbox en (0, 0).

    xy="bbox"  centra el bbox (lo normal).
    xy="keep"  respeta el eje de construccion en XY y solo corrige Z. Es lo
               correcto para los modelos con eje de revolucion (speaker,
               subwoofer): si se centra el bbox, las piezas que sobresalen a
               un solo lado — los terminales — corren el eje del driver y el
               tweeter deja de quedar concentrico con el cono.
    """
    if obj.parent:
        obj.parent = None
    obj.delta_location = (0.0, 0.0, 0.0)
    obj.delta_rotation_euler = (0.0, 0.0, 0.0)
    obj.delta_scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()

    obj.data.transform(obj.matrix_world)
    obj.matrix_world = Matrix.Identity(4)
    obj.data.update()
    bpy.context.view_layer.update()

    lo, hi = mesh_bounds(obj)
    dx = -(lo.x + hi.x) / 2.0 if xy == "bbox" else 0.0
    dy = -(lo.y + hi.y) / 2.0 if xy == "bbox" else 0.0
    obj.data.transform(Matrix.Translation(Vector((dx, dy, -lo.z))))
    obj.data.update()
    bpy.context.view_layer.update()

    lo, hi = mesh_bounds(obj)
    if verbose:
        print("normalize     : %s (xy=%s)" % (obj.name, xy))
        print("  bbox min    : %+.4f %+.4f %+.4f" % (lo.x, lo.y, lo.z))
        print("  bbox max    : %+.4f %+.4f %+.4f" % (hi.x, hi.y, hi.z))
        print("  centro XY   : %+.4f %+.4f   %s" % (
            (lo.x + hi.x) / 2.0, (lo.y + hi.y) / 2.0,
            "OK" if max(abs(lo.x + hi.x), abs(lo.y + hi.y)) / 2.0 < 5e-4
            or xy == "keep" else "DESCENTRADO"))
        print("  Zmin        : %+.6f  %s" % (
            lo.z, "OK" if abs(lo.z) < 1e-6 else "FUERA DEL ORIGEN"))
    return obj


def world_bounds(objects):
    lo = Vector((float("inf"),) * 3)
    hi = Vector((float("-inf"),) * 3)
    for o in objects:
        for corner in o.bound_box:
            p = o.matrix_world @ Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi


def center_on_base(obj, xy="bbox"):
    """Alias historico: delega en normalize_object."""
    return normalize_object(obj, xy=xy, verbose=False)


def triangle_count(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def dimensions(obj):
    lo, hi = mesh_bounds(obj)
    return (hi.x - lo.x, hi.y - lo.y, hi.z - lo.z)


# --------------------------------------------------------------- export -----

def export_glb(obj, basename):
    """Export glTF binario: Draco on, +Y up, sin cámaras ni luces."""
    ensure_dirs()
    path = os.path.join(MODELS_DIR, basename + ".glb")
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    kwargs = dict(
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
        export_image_format="NONE",
        export_normals=True,
        export_tangents=False,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except TypeError:
        # versión de Blender con firma distinta: reintenta solo con lo esencial
        minimal = {k: v for k, v in kwargs.items() if k in (
            "filepath", "export_format", "use_selection", "export_yup",
            "export_apply", "export_cameras", "export_lights",
            "export_draco_mesh_compression_enable",
            "export_draco_mesh_compression_level")}
        bpy.ops.export_scene.gltf(**minimal)
    return path


def finalize(obj, basename, expected_dims=None, xy="bbox"):
    """
    Cierra el pipeline de un modelo: limpieza de malla, auto-smooth,
    normalizacion de origen, export y reporte.

    `xy="keep"` para los modelos con eje de revolucion (ver normalize_object).
    Devuelve un dict con las métricas para el paso (e) del flujo.
    """
    print("")
    cleanup_mesh(obj, distance=0.0001)
    shade_auto_smooth(obj, AUTO_SMOOTH_DEG)
    normalize_object(obj, xy=xy)
    tris = triangle_count(obj)
    dims = dimensions(obj)
    vol = signed_volume(obj)
    lo, hi = mesh_bounds(obj)
    path = export_glb(obj, basename)
    size = os.path.getsize(path)

    mats = sorted({s.material.name for s in obj.material_slots if s.material})
    print("\n" + "=" * 62)
    print("modelo        : %s" % basename)
    print("objeto        : %s" % obj.name)
    print("triangulos    : %s  %s" % (
        f"{tris:,}",
        "OK" if TRI_BUDGET[0] <= tris <= TRI_BUDGET[1] else "FUERA DE PRESUPUESTO"))
    print("dimensiones   : %.3f x %.3f x %.3f m (x, y, z Blender)" % dims)
    print("bbox min      : %+.4f %+.4f %+.4f" % (lo.x, lo.y, lo.z))
    print("bbox max      : %+.4f %+.4f %+.4f" % (hi.x, hi.y, hi.z))
    print("volumen firm. : %+.2f L  %s" % (
        vol * 1000.0, "OK" if vol > 0 else "NEGATIVO — normales invertidas"))
    print("pivote        : centro de base%s" % (
        ", XY centrado" if xy == "bbox" else ", XY = eje de construccion"))
    print("materiales    : %s" % ", ".join(mats))
    print("glb           : %s" % os.path.relpath(path, REPO_ROOT))
    print("peso          : %.1f KB  %s" % (
        size / 1024.0, "OK" if size <= MAX_GLB_BYTES else "EXCEDE 300 KB"))
    if expected_dims:
        for axis, got, want in zip("xyz", dims, expected_dims):
            if want and abs(got - want) > max(0.002, want * 0.02):
                print("AVISO: eje %s mide %.3f m, se esperaba ~%.3f m" % (axis, got, want))
    print("=" * 62 + "\n")

    return {"name": basename, "tris": tris, "bytes": size, "dims": dims,
            "materials": mats, "path": path}
