"""
WOW SURVIVORS — monsters & pickups (Blender / bpy). Original low-poly designs.
Each model: origin at the feet, facing +z (Decentraland forward), looping animation clip "Idle".
Run: python3 blender/build_monsters.py  →  models/<name>.glb
"""
import bpy, json, math, os, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import *  # noqa

REPORT = {}


def new_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = 'Idle'
    sc.render.fps = 24
    sc.frame_start = 1
    sc.frame_end = 24
    return Mats()


def pivot(name, at, parts):
    """empty at DCL point `at`, parenting the given objects (for animation)"""
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = to_b(at)
    bpy.context.view_layer.update()
    for o in parts:
        o.parent = e
        o.matrix_parent_inverse = e.matrix_world.inverted()
    return e


def key_rot(obj, axis_dcl, frames_deg):
    """keyframe rotation around a DCL axis ('x','y','z'); frames_deg = [(frame, degrees)]"""
    # DCL x → Blender -X, DCL y → Blender Z, DCL z → Blender -Y
    idx, sign = {'x': (0, -1), 'y': (2, 1), 'z': (1, -1)}[axis_dcl]
    obj.rotation_mode = 'XYZ'
    for f, d in frames_deg:
        r = [0.0, 0.0, 0.0]
        r[idx] = math.radians(d) * sign
        obj.rotation_euler = r
        obj.keyframe_insert('rotation_euler', frame=f)


def key_loc(obj, frames_dy):
    base = obj.location.copy()
    for f, dy in frames_dy:
        obj.location = (base.x, base.y, base.z + dy)
        obj.keyframe_insert('location', frame=f)
    obj.location = base


def linear(obj):
    if obj.animation_data and obj.animation_data.action:
        try:
            for fc in obj.animation_data.action.fcurves:
                for k in fc.keyframe_points:
                    k.interpolation = 'LINEAR'
        except Exception:
            pass


def to_nla():
    """push every object's action into an NLA track named 'Idle' so glTF exports ONE clip"""
    for o in bpy.context.scene.objects:
        ad = o.animation_data
        if ad and ad.action:
            tr = ad.nla_tracks.new()
            tr.name = 'Idle'
            st = tr.strips.new('Idle', int(ad.action.frame_range[0]), ad.action)
            st.name = 'Idle'
            ad.action = None


def finish(name, animated=True):
    if animated:
        to_nla()
    out = os.path.join(MODELS, f'{name}.glb')
    export(out, animation=animated)
    REPORT[name] = {'tris': tri_count(), 'kb': os.path.getsize(out) // 1024}


# ─────────── BAT ───────────
M = new_scene()
BODY = M.add('bat_fur', '#2B1B3A', 0.0, 0.8)
WING = M.add('bat_wing', '#4A2560', 0.0, 0.7)
EYE = M.add('eye_red', '#FF2A3D', 0.0, 0.3, '#FF1030', 6.0)
b = Builder(M)
b.sphere(0, 0.0, 0, 0.2, BODY, 8, 5, ry=0.24, rz=0.26)
b.sphere(0, 0.2, 0.18, 0.14, BODY, 8, 5)
for s in (-1, 1):
    b.prism_xy([(s * 0.06, 0.3), (s * 0.12, 0.45), (s * 0.15, 0.28)], 0.12, 0.2, BODY)
    b.sphere(s * 0.06, 0.23, 0.3, 0.035, EYE, 6, 4)
body = b.emit('bat_body')
wings = []
for s in (-1, 1):
    w = Builder(M)
    pts = [(s * 0.15, 0.05), (s * 0.75, 0.25), (s * 0.95, -0.05), (s * 0.7, -0.08), (s * 0.55, -0.22), (s * 0.35, -0.1), (s * 0.15, -0.12)]
    w.prism_xy(pts, -0.02, 0.02, WING)
    objs = w.emit(f'bat_wing{s}')
    pv = pivot(f'wing_pivot{s}', (s * 0.15, 0, 0), objs)
    key_rot(pv, 'z', [(1, 35 * s), (7, -40 * s), (13, 35 * s), (19, -40 * s), (25, 35 * s)])
    wings.append(pv)
root = pivot('bat', (0, 0, 0), body + wings)
root.location.z += 1.25  # fly at head height
key_loc(root, [(1, 0), (13, 0.08), (25, 0)])
finish('bat')

# ─────────── GHOUL (+ elite variant) ───────────
for variant in ('ghoul', 'ghoul_elite'):
    M = new_scene()
    elite = variant == 'ghoul_elite'
    SKIN = M.add('skin', '#7A1E1E' if elite else '#5E7A55', 0.0, 0.85)
    RAGS = M.add('rags', '#2A2430' if not elite else '#160A0A', 0.0, 0.9)
    EYE = M.add('eyes', '#FFE24A' if not elite else '#FF2A3D', 0.0, 0.3, '#FFC000' if not elite else '#FF1030', 6.0)
    HORN = M.add('horn', '#E8DCC0', 0.0, 0.5)
    b = Builder(M)
    for s in (-1, 1):
        b.cyl(s * 0.14, 0, 0, 0.09, 0.8, RAGS, seg=6, r_top=0.11)
        b.box(s * 0.14, 0.04, 0.06, 0.16, 0.08, 0.28, SKIN)
    b.box(0, 1.1, -0.02, 0.5, 0.65, 0.32, RAGS, pitch=18)
    b.box(0, 0.85, 0.0, 0.46, 0.25, 0.3, RAGS)
    b.sphere(0, 1.55, 0.18, 0.2, SKIN, 8, 5, ry=0.22)
    b.box(0, 1.43, 0.33, 0.2, 0.06, 0.06, RAGS)
    for s in (-1, 1):
        b.sphere(s * 0.08, 1.6, 0.35, 0.04, EYE, 6, 4)
        if elite:
            b.cyl(s * 0.13, 1.72, 0.12, 0.05, 0.3, HORN, seg=5, r_top=0.0)
    body = b.emit('ghoul_body')
    arms = []
    for s in (-1, 1):
        a = Builder(M)
        a.box(s * 0.3, 1.3, 0.25, 0.11, 0.11, 0.6, SKIN)
        a.box(s * 0.3, 1.3, 0.58, 0.14, 0.05, 0.12, SKIN)
        objs = a.emit(f'arm{s}')
        pv = pivot(f'arm_pivot{s}', (s * 0.3, 1.3, 0.0), objs)
        ph = 0 if s > 0 else 12
        key_rot(pv, 'x', [(1 + ph % 24, 12), (13 + ph % 24, -8), (25, 12)] if s > 0 else [(1, -8), (13, 12), (25, -8)])
        arms.append(pv)
    root = pivot('ghoul', (0, 0, 0), body + arms)
    key_rot(root, 'z', [(1, -4), (13, 4), (25, -4)])
    finish(variant)

# ─────────── SKELETON ───────────
M = new_scene()
BONE = M.add('bone', '#E8E2D0', 0.0, 0.6)
EYE = M.add('eyes', '#5EF2FF', 0.0, 0.3, '#20D8FF', 6.0)
DARK = M.add('dark', '#151018', 0.0, 0.8)
b = Builder(M)
for s in (-1, 1):
    b.box(s * 0.12, 0.42, 0, 0.07, 0.84, 0.07, BONE)
    b.box(s * 0.12, 0.03, 0.06, 0.12, 0.06, 0.22, BONE)
b.box(0, 0.92, 0, 0.36, 0.12, 0.2, BONE)
b.box(0, 1.2, 0, 0.06, 0.55, 0.06, BONE)
for k in range(4):
    b.box(0, 1.08 + k * 0.1, 0.04, 0.38 - k * 0.03, 0.035, 0.24, BONE)
b.box(0, 1.47, 0, 0.5, 0.07, 0.12, BONE)
b.sphere(0, 1.68, 0.02, 0.17, BONE, 8, 5, ry=0.19)
b.box(0, 1.55, 0.1, 0.18, 0.08, 0.12, BONE)
for s in (-1, 1):
    b.sphere(s * 0.07, 1.7, 0.15, 0.045, DARK, 6, 4)
    b.sphere(s * 0.07, 1.7, 0.17, 0.02, EYE, 6, 4)
body = b.emit('skel_body')
arms = []
for s in (-1, 1):
    a = Builder(M)
    a.box(s * 0.28, 1.15, 0.0, 0.06, 0.6, 0.06, BONE)
    a.box(s * 0.28, 0.82, 0.04, 0.1, 0.12, 0.06, BONE)
    if s > 0:  # rusty sword
        a.box(s * 0.28, 0.82, 0.3, 0.04, 0.08, 0.6, DARK)
    objs = a.emit(f'skarm{s}')
    pv = pivot(f'skarm_pivot{s}', (s * 0.28, 1.45, 0.0), objs)
    key_rot(pv, 'x', [(1, 25 * s), (13, -25 * s), (25, 25 * s)])
    arms.append(pv)
root = pivot('skeleton', (0, 0, 0), body + arms)
key_loc(root, [(1, 0), (7, 0.04), (13, 0), (19, 0.04), (25, 0)])
finish('skeleton')

# ─────────── WRAITH ───────────
M = new_scene()
ROBE = M.add('robe', '#122A33', 0.0, 0.8, '#062028', 0.6)
TRIM = M.add('trim', '#5EF2FF', 0.0, 0.3, '#20D8FF', 4.0)
VOID = M.add('void', '#020203', 0.0, 1.0)
b = Builder(M)
b.cyl(0, 0.0, 0, 0.12, 1.5, ROBE, seg=8, r_top=0.42)
b.cyl(0, 1.5, 0, 0.42, 0.5, ROBE, seg=8, r_top=0.25)
b.sphere(0, 2.05, 0.0, 0.28, ROBE, 8, 5, ry=0.32)
b.sphere(0, 2.0, 0.12, 0.2, VOID, 8, 5)
for s in (-1, 1):
    b.sphere(s * 0.08, 2.03, 0.28, 0.04, TRIM, 6, 4)
    b.box(s * 0.45, 1.55, 0.25, 0.12, 0.12, 0.55, ROBE, pitch=-15)
    b.box(s * 0.45, 1.5, 0.55, 0.08, 0.04, 0.16, TRIM)
b.ring(0, 1.45, 0, 0.42, 0.46, 0.06, TRIM, seg=8)
objs = b.emit('wraith')
root = pivot('wraith', (0, 0, 0), objs)
root.location.z += 0.25  # floats
key_loc(root, [(1, 0), (13, 0.18), (25, 0)])
key_rot(root, 'z', [(1, -6), (13, 6), (25, -6)])
finish('wraith')

# ─────────── LICH (boss) ───────────
M = new_scene()
ROBE = M.add('lich_robe', '#2A0F3A', 0.0, 0.8)
TRIM = M.add('lich_trim', '#E9B949', 0.6, 0.3, '#7A5200', 0.6)
BONE = M.add('lich_bone', '#DCD3BC', 0.0, 0.6)
SOULM = M.add('lich_soul', '#A26BFF', 0.0, 0.3, '#7B3BFF', 8.0)
EYE = M.add('lich_eye', '#FF2A3D', 0.0, 0.3, '#FF1030', 8.0)
b = Builder(M)
b.cyl(0, 0, 0, 0.9, 2.2, ROBE, seg=10, r_top=0.55)
b.ring(0, 0.05, 0, 0.88, 0.95, 0.12, TRIM, seg=10)
b.cyl(0, 2.2, 0, 0.55, 0.6, ROBE, seg=10, r_top=0.7)
for s in (-1, 1):
    b.box(s * 0.75, 2.6, 0, 0.5, 0.3, 0.6, TRIM)  # pauldrons
b.sphere(0, 3.15, 0.05, 0.3, BONE, 8, 6, ry=0.34)
b.box(0, 2.98, 0.22, 0.26, 0.1, 0.14, BONE)
for s in (-1, 1):
    b.sphere(s * 0.11, 3.2, 0.28, 0.06, EYE, 6, 4)
for k in range(7):  # crown
    a = math.radians(k * 360 / 7)
    b.box(math.sin(a) * 0.26, 3.5, math.cos(a) * 0.26, 0.08, 0.28, 0.08, TRIM, yaw=k * 360 / 7)
b.ring(0, 3.38, 0, 0.24, 0.3, 0.08, TRIM, seg=14)
b.octa(0, 3.66, 0.27, 0.06, 0.1, EYE)
body = b.emit('lich_body')
a = Builder(M)
a.box(0.78, 2.3, 0.25, 0.22, 0.22, 0.7, ROBE)
a.cyl(0.8, 0.3, 0.6, 0.05, 3.3, TRIM, seg=6)
a.octa(0.8, 3.85, 0.6, 0.22, 0.32, SOULM)
a.ring(0.8, 3.75, 0.6, 0.25, 0.3, 0.06, TRIM, seg=10)
staff = a.emit('lich_staff')
pv = pivot('staff_pivot', (0.78, 2.4, 0.0), staff)
key_rot(pv, 'x', [(1, 0), (13, -10), (25, 0)])
root = pivot('lich', (0, 0, 0), body + [pv])
key_loc(root, [(1, 0.15), (13, 0.35), (25, 0.15)])
finish('lich')

# ─────────── PICKUPS ───────────
for (name, col, emit, r) in [('gem_blue', '#4AA8FF', '#1F7BFF', 0.14), ('gem_green', '#3DFF8E', '#10C060', 0.18), ('gem_red', '#FF3B5C', '#E0102A', 0.24)]:
    M = new_scene()
    G = M.add(name, col, 0.0, 0.2, emit, 4.0)
    b = Builder(M)
    b.octa(0, 0.35, 0, r, r * 1.5, G)
    b.emit(name)
    finish(name, animated=False)

M = new_scene()
GOLDM = M.add('coin_gold', '#FFD45A', 0.7, 0.25, '#B07800', 1.5)
b = Builder(M)
b.cyl(0, 0.2, 0, 0.16, 0.05, GOLDM, seg=12)
for o in b.emit('coin'):
    pass
bpy.context.view_layer.update()
finish('coin', animated=False)

M = new_scene()
WOODM = M.add('chest_wood', '#5A2A12', 0.0, 0.7)
GOLDM = M.add('chest_gold', '#FFD45A', 0.7, 0.25, '#B07800', 1.5)
GLOW = M.add('chest_glow', '#FFF0A0', 0.0, 0.3, '#FFD040', 6.0)
b = Builder(M)
b.box(0, 0.3, 0, 0.9, 0.6, 0.6, WOODM)
b.box(0, 0.68, 0, 0.92, 0.18, 0.62, WOODM)
for x in (-0.38, 0.0, 0.38):
    b.box(x, 0.42, 0, 0.08, 0.84, 0.64, GOLDM)
b.box(0, 0.5, 0.31, 0.16, 0.2, 0.04, GLOW)
b.ring(0, 0.01, 0, 0.7, 0.8, 0.02, GLOW, seg=20)
b.emit('chest')
finish('chest', animated=False)

print('MONSTERS', json.dumps(REPORT))
json.dump(REPORT, open(os.path.join(ROOT, 'blender', 'monsters_report.json'), 'w'), indent=1)
