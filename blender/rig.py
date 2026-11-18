"""
WOW NIGHTSWARM — shared rigging helpers (pivots, keyframes, NLA, skins, shadows).
monsters & pickups (Blender / bpy). Original low-poly designs.
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
    sc.frame_end = 25  # last key (frame 25) equals frame 1 → seamless loop
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


# ─────────── shared upgrades: textured skins + contact shadow ───────────
import numpy as np
from textures_hd import _rgba

_TEX = {}


def skin(M, name, color, rough=0.8, metal=0.0, seed=1, scale=0.6, emit=None, strength=0.0, contrast=0.45):
    """material with a tinted fbm grunge texture (subtle mottling reads much richer than flat colour)"""
    key = (color, seed, contrast)
    if key not in _TEX:
        n = 256
        f = fbm(n, 5, seed)
        g = fbm(n, 6, seed + 50)
        c = np.array(lin(color)) ** (1 / 2.2)
        col = c * (1 - contrast / 2 + contrast * f[..., None]) * (0.85 + 0.3 * g[..., None])
        _TEX[key] = save_img(f'skin_{name}_{seed}.jpg', col)
    return M.add(name, color, metal, rough, emit, strength, tex=_TEX[key], tile=scale)


def shadow(M, r=0.5):
    """soft dark blob under the feet (static, not animated)"""
    if 'shadow' not in M.m:
        n = 128
        yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
        a = np.clip(1 - np.hypot(xx, yy), 0, 1) ** 1.5 * 0.75
        M.add('shadow', tex=_rgba('shadow.png', np.concatenate([np.zeros((n, n, 3)), a[..., None]], -1)), tile=None, rough=1.0)
    b = Builder(M)
    b.decal(0, 0.03, 0, r * 2, r * 2, 'shadow')
    b.emit('shadow')


def glowmat(M, name, col, strength=6.0):
    return M.add(name, col, 0.0, 0.3, col, strength)


