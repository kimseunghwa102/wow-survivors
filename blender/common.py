"""Shared Blender helpers: procedural textures, materials, a fast mesh accumulator and GLB export.
All coordinates are Decentraland metres (x east, y up, z north); to_b() maps them to Blender (X=-x, Y=-z, Z=y)
so exported glTF lands in the same place inside Decentraland."""
import bpy, bmesh, math, os
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
TEX_DIR = os.path.join(ROOT, 'blender', 'textures')
MODELS = os.path.join(ROOT, 'models')
os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(MODELS, exist_ok=True)


def to_b(v):
    return (-v[0], -v[2], v[1])


# ───────────── textures ─────────────
def fbm(n, octaves=5, seed=0):
    rng = np.random.default_rng(seed)
    out = np.zeros((n, n))
    amp, total = 1.0, 0.0
    for o in range(octaves):
        k = 4 * 2 ** o
        g = rng.random((k + 1, k + 1))
        g[-1, :] = g[0, :]
        g[:, -1] = g[:, 0]
        xs = np.linspace(0, k, n, endpoint=False)
        i0 = xs.astype(int)
        t = xs - i0
        t = t * t * (3 - 2 * t)
        a, b, c, d = g[i0][:, i0], g[i0][:, i0 + 1], g[i0 + 1][:, i0], g[i0 + 1][:, i0 + 1]
        tx, ty = t[None, :], t[:, None]
        out += amp * ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty)
        total += amp
        amp *= 0.5
    return out / total


def save_img(name, rgb):
    from PIL import Image
    path = os.path.join(TEX_DIR, name)
    Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)).save(path, quality=86)
    return path


def tex_cobble(name, n=1024, base=(0.30, 0.29, 0.31), seed=3, cells=8):
    """irregular cobblestones via jittered voronoi"""
    rng = np.random.default_rng(seed)
    pts = (np.stack(np.meshgrid(np.arange(cells), np.arange(cells)), -1).reshape(-1, 2) + rng.random((cells * cells, 2)) * 0.8 + 0.1) / cells
    yy, xx = np.mgrid[0:n, 0:n] / n
    d1 = np.full((n, n), 9.0)
    d2 = np.full((n, n), 9.0)
    idx = np.zeros((n, n), int)
    for i, (px, py) in enumerate(pts):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.hypot(xx - (px + ox), yy - (py + oy))
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d))
                idx = np.where(closer, i, idx)
                d1 = np.where(closer, d, d1)
    edge = np.clip((d2 - d1) * cells * 6, 0, 1)
    tint = rng.random(cells * cells)[idx] * 0.25 + 0.85
    noise = fbm(n, 5, seed + 9)
    col = np.array(base)[None, None, :] * (tint * (0.8 + noise * 0.4))[..., None]
    col = col * (0.25 + 0.75 * edge[..., None])
    moss = (fbm(n, 4, seed + 5) > 0.62) * (1 - edge) * 0.5
    col = col * (1 - moss[..., None]) + np.array([0.12, 0.2, 0.1])[None, None, :] * moss[..., None]
    return save_img(name, col)


def tex_stone(name, n=1024, base=(0.36, 0.35, 0.38), seed=21, rows=4):
    t = fbm(n, 6, seed)[..., None]
    col = np.array(base)[None, None, :] * (0.75 + t * 0.5)
    yy, xx = np.mgrid[0:n, 0:n] / n
    row = (yy * rows).astype(int)
    xs = (xx * 2 + 0.5 * (row % 2)) % 1
    joint = ((np.abs(((yy * rows) % 1)) < 0.015) | (xs < 0.008)).astype(float)[..., None]
    return save_img(name, col * (1 - joint * 0.6))


def tex_marble(name, base, vein, seed, n=1024, sharp=6.0):
    t = fbm(n, 6, seed)
    x = np.linspace(0, 2 * np.pi * 3, n)[None, :] + np.linspace(0, 2 * np.pi, n)[:, None]
    v = 1 - np.abs(np.sin(x + t * 9.0)) ** (1 / sharp)
    col = np.array(base)[None, None, :] * (1 - v[..., None]) + np.array(vein)[None, None, :] * v[..., None]
    return save_img(name, col)


# ───────────── materials ─────────────
def lin(h):
    h = h.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]


class Mats:
    def __init__(self):
        self.m = {}
        self.tile = {}

    def add(self, name, color='#ffffff', metal=0.0, rough=0.5, emit=None, strength=0.0, alpha=1.0, tex=None, tile=4.0):
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        nt = m.node_tree
        bsdf = nt.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = (*lin(color), 1)
        bsdf.inputs['Metallic'].default_value = metal
        bsdf.inputs['Roughness'].default_value = rough
        if emit:
            bsdf.inputs['Emission Color'].default_value = (*lin(emit), 1)
            bsdf.inputs['Emission Strength'].default_value = strength
        if alpha < 1:
            bsdf.inputs['Alpha'].default_value = alpha
            try:
                m.surface_render_method = 'BLENDED'
            except Exception:
                pass
        if tex:
            img = bpy.data.images.load(tex)
            tn = nt.nodes.new('ShaderNodeTexImage')
            tn.image = img
            nt.links.new(tn.outputs['Color'], bsdf.inputs['Base Color'])
        m.use_backface_culling = False
        self.m[name] = m
        self.tile[name] = tile if tex else None
        return name


# ───────────── accumulator ─────────────
class Acc:
    def __init__(self):
        self.v = []
        self.f = []


class Builder:
    def __init__(self, mats):
        self.mats = mats
        self.acc = {}
        self.col = Acc()

    def a(self, m):
        if m not in self.acc:
            self.acc[m] = Acc()
        return self.acc[m]

    def faces(self, a, verts, faces, smooth=False):
        base = len(a.v)
        a.v.extend(verts)
        for f in faces:
            a.f.append(([base + i for i in f], smooth))

    def box(self, cx, cy, cz, sx, sy, sz, m, yaw=0.0, collide=False, pitch=0.0, roll=0.0):
        hx, hy, hz = sx / 2, sy / 2, sz / 2
        vs = []
        for (x, y, z) in [(-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz), (-hx, hy, -hz),
                          (-hx, -hy, hz), (hx, -hy, hz), (hx, hy, hz), (-hx, hy, hz)]:
            x, y, z = rot(x, y, z, yaw, pitch, roll)
            vs.append((cx + x, cy + y, cz + z))
        quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 4, 7, 3], [1, 2, 6, 5], [3, 7, 6, 2], [0, 1, 5, 4]]
        if m:
            self.faces(self.a(m), vs, quads)
        if collide:
            self.faces(self.col, vs, quads)

    def box2(self, x0, y0, z0, x1, y1, z1, m, collide=False):
        self.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, abs(x1 - x0), abs(y1 - y0), abs(z1 - z0), m, collide=collide)

    def collider(self, x0, y0, z0, x1, y1, z1):
        self.box2(x0, y0, z0, x1, y1, z1, None, collide=True)

    def cyl(self, cx, y0, cz, r, h, m, seg=12, r_top=None, smooth=True, collide=False, caps=True):
        rt = r if r_top is None else r_top
        vs = [(cx + math.cos(2 * math.pi * i / seg) * r, y0, cz + math.sin(2 * math.pi * i / seg) * r) for i in range(seg)]
        vs += [(cx + math.cos(2 * math.pi * i / seg) * rt, y0 + h, cz + math.sin(2 * math.pi * i / seg) * rt) for i in range(seg)]
        fs = [[i, (i + 1) % seg, seg + (i + 1) % seg, seg + i] for i in range(seg)]
        if caps:
            fs.append(list(range(seg))[::-1])
            if rt > 0:
                fs.append(list(range(seg, 2 * seg)))
        self.faces(self.a(m), vs, fs, smooth)
        if collide:
            self.box2(cx - r, y0, cz - r, cx + r, y0 + h, cz + r, None, collide=True)

    def ring(self, cx, y0, cz, r_in, r_out, h, m, seg=32):
        vs = []
        for i in range(seg):
            c, s = math.cos(2 * math.pi * i / seg), math.sin(2 * math.pi * i / seg)
            vs += [(cx + c * r_in, y0, cz + s * r_in), (cx + c * r_out, y0, cz + s * r_out),
                   (cx + c * r_out, y0 + h, cz + s * r_out), (cx + c * r_in, y0 + h, cz + s * r_in)]
        fs = []
        for i in range(seg):
            a, b = 4 * i, 4 * ((i + 1) % seg)
            for k in range(4):
                k2 = (k + 1) % 4
                fs.append([a + k, b + k, b + k2, a + k2])
        self.faces(self.a(m), vs, fs)

    def sphere(self, cx, cy, cz, rx, m, lon=10, lat=6, ry=None, rz=None, smooth=True):
        ry = rx if ry is None else ry
        rz = rx if rz is None else rz
        vs = [(cx, cy + ry, cz)]
        for j in range(1, lat):
            th = math.pi * j / lat
            for i in range(lon):
                ph = 2 * math.pi * i / lon
                vs.append((cx + rx * math.sin(th) * math.cos(ph), cy + ry * math.cos(th), cz + rz * math.sin(th) * math.sin(ph)))
        vs.append((cx, cy - ry, cz))
        fs = [[0, 1 + (i + 1) % lon, 1 + i] for i in range(lon)]
        for j in range(lat - 2):
            for i in range(lon):
                a = 1 + j * lon + i
                b = 1 + j * lon + (i + 1) % lon
                fs.append([a, b, b + lon, a + lon])
        last = len(vs) - 1
        off = 1 + (lat - 2) * lon
        fs += [[off + i, off + (i + 1) % lon, last] for i in range(lon)]
        self.faces(self.a(m), vs, fs, smooth)

    def prism_xy(self, pts, z0, z1, m):
        n = len(pts)
        vs = [(x, y, z0) for x, y in pts] + [(x, y, z1) for x, y in pts]
        fs = [list(range(n)), list(range(n, 2 * n))[::-1]] + [[i, (i + 1) % n, n + (i + 1) % n, n + i] for i in range(n)]
        self.faces(self.a(m), vs, fs)

    def octa(self, cx, cy, cz, r, h, m):
        vs = [(cx, cy + h, cz), (cx, cy - h, cz), (cx + r, cy, cz), (cx, cy, cz + r), (cx - r, cy, cz), (cx, cy, cz - r)]
        fs = [[0, 2, 3], [0, 3, 4], [0, 4, 5], [0, 5, 2], [1, 3, 2], [1, 4, 3], [1, 5, 4], [1, 2, 5]]
        self.faces(self.a(m), vs, fs)

    def emit(self, prefix, collection=None):
        objs = []
        for m, a in self.acc.items():
            objs.append(make_obj(f'{prefix}_{m}', a, self.mats, m, collection))
        if self.col.v:
            objs.append(make_obj(f'{prefix}_collider', self.col, self.mats, None, collection))
        self.acc = {}
        self.col = Acc()
        return objs


def rot(x, y, z, yaw, pitch, roll):
    if roll:
        a = math.radians(roll)
        x, y = x * math.cos(a) - y * math.sin(a), x * math.sin(a) + y * math.cos(a)
    if pitch:
        a = math.radians(pitch)
        y, z = y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a)
    if yaw:
        a = math.radians(yaw)
        x, z = x * math.cos(a) + z * math.sin(a), -x * math.sin(a) + z * math.cos(a)
    return x, y, z


def make_obj(name, a, mats, m, collection=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata([to_b(v) for v in a.v], [], [f for f, _ in a.f])
    me.update()
    for poly, (_, sm) in zip(me.polygons, a.f):
        poly.use_smooth = sm
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    t = mats.tile.get(m) if m else None
    if t:
        uv = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            n = f.normal
            ax = max(range(3), key=lambda i: abs(n[i]))
            for lo in f.loops:
                co = lo.vert.co
                lo[uv].uv = (co.x / t, co.y / t) if ax == 2 else (co.x / t, co.z / t) if ax == 1 else (co.y / t, co.z / t)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if m:
        me.materials.append(mats.m[m])
    return ob


def tri_count(objs=None):
    objs = objs or [o for o in bpy.context.scene.objects if o.type == 'MESH']
    return sum(len(p.vertices) - 2 for o in objs if 'collider' not in o.name for p in o.data.polygons)


def export(path, animation=False):
    kw = dict(filepath=path, export_format='GLB', export_yup=True, export_apply=True,
              export_image_format='JPEG', export_jpeg_quality=85, export_cameras=False)
    if animation:
        kw.update(export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True)
    else:
        kw.update(export_animations=False)
    bpy.ops.export_scene.gltf(**kw)
