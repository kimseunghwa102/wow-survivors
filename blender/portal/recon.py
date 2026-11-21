"""Rebuild a Decentraland scene in Blender from its GLBs + code placements, then render an
equirectangular panorama from the player's arrival point.
DCL coords: x east, y up, z north (left-handed). Blender: CM maps DCL -> Blender (X=-x, Y=-z, Z=y),
the same mapping blender/common.py uses, so imported GLBs land where Decentraland puts them."""
import bpy, math, os
from mathutils import Matrix, Vector, Quaternion

CM = Matrix(((-1, 0, 0), (0, 0, -1), (0, 1, 0)))
FONT = None


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.use_denoising = False
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = 0.02
    sc.cycles.max_bounces = 6
    sc.cycles.diffuse_bounces = int(os.environ.get('DB', '1'))
    sc.cycles.glossy_bounces = 1
    sc.cycles.transmission_bounces = 2
    sc.cycles.transparent_max_bounces = 12
    sc.cycles.volume_bounces = 0
    sc.cycles.sample_clamp_indirect = 1.0
    sc.cycles.sample_clamp_direct = float(os.environ.get('CD', '3'))
    sc.cycles.blur_glossy = 1.0
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    return sc


def q_euler(x=0.0, y=0.0, z=0.0):
    """DCL Quaternion.fromEulerDegrees (Unity order: z, then x, then y) -> (x, y, z, w)"""
    def ax(v, a):
        h = math.radians(a) / 2
        s = math.sin(h)
        return Quaternion((math.cos(h), v[0] * s, v[1] * s, v[2] * s))
    q = ax((0, 1, 0), y) @ ax((1, 0, 0), x) @ ax((0, 0, 1), z)
    return (q.x, q.y, q.z, q.w)


def dcl_m(pos=(0, 0, 0), q=(0, 0, 0, 1), s=(1, 1, 1)):
    """DCL transform as a DCL-space 4x4 (column vectors)"""
    R = Quaternion((q[3], q[0], q[1], q[2])).to_matrix().to_4x4()
    S = Matrix.Diagonal((s[0], s[1], s[2], 1))
    T = Matrix.Translation(Vector(pos))
    return T @ R @ S


def to_blender(Md):
    C4 = CM.to_4x4()
    return C4 @ Md @ C4.transposed()


def place(path, Md, name=None, hide=False):
    """import a GLB and put it where Decentraland would (Md = DCL world matrix of the entity)"""
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    e = bpy.data.objects.new(name or os.path.basename(path), None)
    bpy.context.scene.collection.objects.link(e)
    # imported geometry is in Blender space B = CM·L, so the entity matrix is conjugated by CM
    e.matrix_world = to_blender(Md)
    for o in new:
        if o.parent is None:
            o.parent = e
            o.matrix_parent_inverse = Matrix.Identity(4)
        if hide:
            o.hide_render = True
    return e


def hex_lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


LIGHT_K = 0.05  # DCL LightSource intensity -> Blender watts


def point(pos, color, intensity, rng=10, radius=0.15):
    L = bpy.data.lights.new('pt', 'POINT')
    L.color = hex_lin(color) if isinstance(color, str) else color
    L.energy = intensity * LIGHT_K
    L.shadow_soft_size = radius
    o = bpy.data.objects.new('pt', L)
    bpy.context.scene.collection.objects.link(o)
    o.location = CM @ Vector(pos)
    return o


def spot(pos, q, color, intensity, inner, outer, rng=14):
    L = bpy.data.lights.new('sp', 'SPOT')
    L.color = hex_lin(color)
    L.energy = intensity * LIGHT_K
    L.spot_size = math.radians(outer * 2)
    L.spot_blend = max(0.05, 1 - inner / max(outer, 1e-3))
    L.shadow_soft_size = 0.1
    o = bpy.data.objects.new('sp', L)
    bpy.context.scene.collection.objects.link(o)
    o.location = CM @ Vector(pos)
    fwd = Quaternion((q[3], q[0], q[1], q[2])).to_matrix() @ Vector((0, 0, 1))
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (CM @ fwd).to_track_quat('-Z', 'Y')
    return o


def sun(dir_dcl, color, strength):
    L = bpy.data.lights.new('sun', 'SUN')
    L.color = color
    L.energy = strength
    L.angle = math.radians(1.0)
    o = bpy.data.objects.new('sun', L)
    bpy.context.scene.collection.objects.link(o)
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (CM @ Vector(dir_dcl)).to_track_quat('-Z', 'Y')


_tmats = {}


def emit_mat(color, strength):
    key = (color, strength)
    if key in _tmats:
        return _tmats[key]
    m = bpy.data.materials.new('txt')
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*hex_lin(color), 1)
    em.inputs['Strength'].default_value = strength
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    _tmats[key] = m
    return m


def text(pos, value, size, color, yaw=0.0, face=None, strength=1.5, outline=None, align='CENTER', valign='CENTER'):
    """TextShape stand-in. yaw = DCL entity yaw (text faces -z at yaw 0); face = DCL point to face (billboard)"""
    if face is not None:
        dx, dz = face[0] - pos[0], face[2] - pos[2]
        yaw = math.degrees(math.atan2(-dx, -dz))  # facing direction -z rotated by yaw must point at the viewer
    out = []
    for k, (col, off, st) in enumerate(((outline, 0.012, 1.0), (color, 0.0, strength))):
        if col is None:
            continue
        cu = bpy.data.curves.new('t', 'FONT')
        cu.body = value
        cu.size = size * 0.1
        cu.align_x = align
        cu.align_y = valign
        cu.space_line = 1.0
        if FONT:
            cu.font = bpy.data.fonts.load(FONT, check_existing=True)
        if k == 0:
            cu.offset = size * 0.008  # fattened copy behind the text = outline
        o = bpy.data.objects.new('t', cu)
        bpy.context.scene.collection.objects.link(o)
        o.data.materials.append(emit_mat(col, st))
        # text lies in Blender XY facing +Z; stand it up (faces -Y), then turn to the DCL facing direction
        f = CM @ (Quaternion((math.cos(math.radians(yaw) / 2), 0, math.sin(math.radians(yaw) / 2), 0)).to_matrix() @ Vector((0, 0, -1)))
        a = math.atan2(f.x, -f.y)
        o.rotation_mode = 'XYZ'
        o.rotation_euler = (math.radians(90), 0, a)
        o.location = CM @ Vector(pos) + f * (-off)
        out.append(o)
    return out


def ground(y=0.0, color='#0B0B10', size=400, rough=0.8):
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, y - 0.02))
    o = bpy.context.active_object
    m = bpy.data.materials.new('ground')
    m.use_nodes = True
    b = m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = (*hex_lin(color), 1)
    b.inputs['Roughness'].default_value = rough
    o.data.materials.append(m)
    return o


def night_world(zenith=(0.002, 0.003, 0.012), horizon=(0.02, 0.025, 0.06), strength=1.0, stars=True, amb=(0.05, 0.06, 0.10), amb_strength=0.0):
    w = bpy.data.worlds.new('night')
    bpy.context.scene.world = w
    w.use_nodes = True
    nt = w.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*horizon, 1)
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = (*zenith, 1)
    mp = nt.nodes.new('ShaderNodeMapRange')
    mp.inputs['From Min'].default_value = 0.0
    mp.inputs['From Max'].default_value = 1.0
    nt.links.new(sep.outputs['Z'], mp.inputs['Value'])
    nt.links.new(mp.outputs['Result'], ramp.inputs['Fac'])
    bg = nt.nodes.new('ShaderNodeBackground')
    bg.inputs['Strength'].default_value = strength
    col = ramp.outputs['Color']
    if stars:
        vor = nt.nodes.new('ShaderNodeTexVoronoi')
        vor.inputs['Scale'].default_value = 420.0
        vor.feature = 'F1'
        nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
        sr = nt.nodes.new('ShaderNodeMapRange')
        sr.inputs['From Min'].default_value = 0.035
        sr.inputs['From Max'].default_value = 0.0
        sr.inputs['To Min'].default_value = 0.0
        sr.inputs['To Max'].default_value = 2.5
        nt.links.new(vor.outputs['Distance'], sr.inputs['Value'])
        mask = nt.nodes.new('ShaderNodeMath')
        mask.operation = 'MULTIPLY'
        nt.links.new(sr.outputs['Result'], mask.inputs[0])
        nt.links.new(sep.outputs['Z'], mask.inputs[1])
        add = nt.nodes.new('ShaderNodeMix')
        add.data_type = 'RGBA'
        add.blend_type = 'ADD'
        add.inputs['Factor'].default_value = 1.0
        nt.links.new(col, add.inputs[6])
        nt.links.new(mask.outputs['Value'], add.inputs[7])
        col = add.outputs[2]
    if amb_strength > 0:
        # DCL-style ambient: rays that light the scene see a brighter fill, the camera still sees the dark sky
        lp = nt.nodes.new('ShaderNodeLightPath')
        mix = nt.nodes.new('ShaderNodeMix')
        mix.data_type = 'RGBA'
        nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Factor'])
        mix.inputs[6].default_value = (amb[0] * amb_strength, amb[1] * amb_strength, amb[2] * amb_strength, 1)
        nt.links.new(col, mix.inputs[7])
        col = mix.outputs[2]
    nt.links.new(col, bg.inputs['Color'])
    out = nt.nodes.new('ShaderNodeOutputWorld')
    nt.links.new(bg.outputs['Background'], out.inputs['Surface'])


def pano_camera(eye, yaw, lon=180.0, lat=90.0):
    """equirect camera at DCL eye position, image centre = DCL heading yaw (0 = +z north, 90 = +x east)"""
    cam = bpy.data.cameras.new('pano')
    cam.type = 'PANO'
    cam.panorama_type = 'EQUIRECTANGULAR'
    cam.longitude_min, cam.longitude_max = -math.radians(lon), math.radians(lon)
    cam.latitude_min, cam.latitude_max = -math.radians(lat), math.radians(lat)
    o = bpy.data.objects.new('pano', cam)
    bpy.context.scene.collection.objects.link(o)
    f = Vector((math.sin(math.radians(yaw)), 0, math.cos(math.radians(yaw))))
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = (CM @ f).to_track_quat('-Z', 'Y')
    o.location = CM @ Vector(eye)
    bpy.context.scene.camera = o
    return o


def render(path, w, h, samples):
    sc = bpy.context.scene
    sc.render.resolution_x = w
    sc.render.resolution_y = h
    sc.render.resolution_percentage = 100
    sc.cycles.samples = samples
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_depth = '8'
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)


def persp_camera(eye, target, fov=60.0):
    cam = bpy.data.cameras.new('persp')
    cam.lens_unit = 'FOV'
    cam.angle = math.radians(fov)
    o = bpy.data.objects.new('persp', cam)
    bpy.context.scene.collection.objects.link(o)
    o.location = CM @ Vector(eye)
    d = CM @ (Vector(target) - Vector(eye))
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('-Z', 'Y')
    bpy.context.scene.camera = o
    return o
