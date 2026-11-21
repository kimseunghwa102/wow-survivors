"""Portal models that show the other land.
  <name>_win.glb : the window — an inward bowl behind the portal plane whose texture is the destination panorama
                   re-projected from a nominal eye in front, so it keeps parallax as you walk past + a dark back dome
  <name>_rim.glb : glowing swirl ring around the window edge (spins in-scene)
  <name>_bub.glb : the step-in bubble — a small inside-out sphere with the full 360° panorama, put around the camera
Portal-local DCL frame: origin = portal centre, +x = viewer's right, +y = up, +z = into the portal (away from the viewer).
Run: python3 build_portal.py -- name crop.png full.png '#rim' seg rings domerings blon blat outdir"""
import sys, os, math, json
import numpy as np
import cv2
sys.path.insert(0, '/home/claude/wow-survivors/blender')
from common import *  # noqa  (Mats, Builder, export, tri_count, to_b)
import bpy

A = sys.argv[sys.argv.index('--') + 1:]
NAME, CROP, FULL, RIM = A[0], A[1], A[2], A[3]
SEG, RINGS, DRINGS, BLON, BLAT = (int(x) for x in A[4:9])
OUT = A[9]
R, D, E = 1.5, 1.2, 2.2        # window radius, bowl depth, nominal eye distance in front
CROP_HALF = math.radians(40)    # the crop render covers ±40° in both axes
RO = R + 0.45                   # rim ring outer radius
TEX = '/home/claude/pano/tex'
os.makedirs(TEX, exist_ok=True)
os.makedirs(OUT, exist_ok=True)


def hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


# ───────── bowl mesh (DCL portal-local) ─────────
def bowl(seg, rings, radius, depth):
    """rings from the rim (z=0) to the deepest point; denser near the rim where the wall is steep"""
    verts = []
    for i in range(rings):
        th = math.pi / 2 * (1 - i / rings)  # 90° at the rim
        rho, z = radius * math.sin(th), depth * math.cos(th)
        for j in range(seg):
            ph = 2 * math.pi * j / seg
            verts.append((rho * math.cos(ph), rho * math.sin(ph), z))
    verts.append((0.0, 0.0, depth))
    tris = []
    for i in range(rings - 1):
        for j in range(seg):
            a, b = i * seg + j, i * seg + (j + 1) % seg
            c, d = (i + 1) * seg + (j + 1) % seg, (i + 1) * seg + j
            tris += [(a, b, c), (a, c, d)]
    ctr = len(verts) - 1
    base = (rings - 1) * seg
    for j in range(seg):
        tris.append((base + j, base + (j + 1) % seg, ctr))
    return np.array(verts), tris


def depth_map(verts, tris, n):
    """exact depth of the (piecewise-linear) bowl under every texel of the window texture"""
    c = np.full((n, n), np.nan)
    px = (verts[:, 0] / (2 * R) + 0.5) * n - 0.5
    py = (0.5 - verts[:, 1] / (2 * R)) * n - 0.5
    for t in tris:
        x, y, z = px[list(t)], py[list(t)], verts[list(t), 2]
        x0, x1 = int(max(0, math.floor(x.min()))), int(min(n - 1, math.ceil(x.max())))
        y0, y1 = int(max(0, math.floor(y.min()))), int(min(n - 1, math.ceil(y.max())))
        if x1 < x0 or y1 < y0:
            continue
        gy, gx = np.mgrid[y0:y1 + 1, x0:x1 + 1].astype(float)
        den = (y[1] - y[2]) * (x[0] - x[2]) + (x[2] - x[1]) * (y[0] - y[2])
        if abs(den) < 1e-12:
            continue
        w0 = ((y[1] - y[2]) * (gx - x[2]) + (x[2] - x[1]) * (gy - y[2])) / den
        w1 = ((y[2] - y[0]) * (gx - x[2]) + (x[0] - x[2]) * (gy - y[2])) / den
        w2 = 1 - w0 - w1
        m = (w0 >= -1e-6) & (w1 >= -1e-6) & (w2 >= -1e-6)
        zz = w0 * z[0] + w1 * z[1] + w2 * z[2]
        sub = c[y0:y1 + 1, x0:x1 + 1]
        sub[m] = zz[m]
    return c


LIFT = float(os.environ.get('LIFT', '1.0'))  # >1 lifts the shadows/midtones of a dark destination (night sky land)


def denoise(img):
    img = cv2.fastNlMeansDenoisingColored(img, None, 3, 3, 7, 21)
    if LIFT != 1.0:
        f = (img.astype(np.float32) / 255) ** (1 / LIFT)
        img = (np.clip(f * (1 + (LIFT - 1) * 0.35), 0, 1) * 255).astype(np.uint8)
    return img


# ───────── window texture: destination as seen through the portal from the nominal eye ─────────
verts, tris = bowl(SEG, RINGS, R, D)
N = 1024
crop = cv2.imread(CROP, cv2.IMREAD_COLOR)
crop = denoise(crop)
Hc, Wc = crop.shape[:2]
ys, xs = np.mgrid[0:N, 0:N] + 0.5
a = (xs / N - 0.5) * 2 * R
b = (0.5 - ys / N) * 2 * R
rho = np.hypot(a, b)
k = np.where(rho > R * 0.999, R * 0.999 / np.maximum(rho, 1e-9), 1.0)  # outside the disc: repeat the rim
a, b = a * k, b * k
cm = depth_map(verts, tris, N)
# texels clamped onto the rim may fall just outside the mesh; they sit at depth ~0
c = np.where(np.isnan(cm), 0.0, cm)
d = np.stack([a, b, c + E], -1)
d /= np.linalg.norm(d, axis=-1, keepdims=True)
lon = np.arctan2(d[..., 0], d[..., 2])
lat = np.arcsin(np.clip(d[..., 1], -1, 1))
mx = ((lon / CROP_HALF + 1) / 2 * Wc - 0.5).astype(np.float32)
my = ((1 - (lat / CROP_HALF + 1) / 2) * Hc - 0.5).astype(np.float32)
win = cv2.remap(crop, mx, my, cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
win_path = os.path.join(TEX, f'{NAME}_win.jpg')
cv2.imwrite(win_path, win, [cv2.IMWRITE_JPEG_QUALITY, 90])

# ───────── bubble texture: the full panorama ─────────
full = cv2.imread(FULL, cv2.IMREAD_COLOR)
full = denoise(full)
bub_path = os.path.join(TEX, f'{NAME}_bub.jpg')
cv2.imwrite(bub_path, full, [cv2.IMWRITE_JPEG_QUALITY, 88])

# ───────── rim ring texture ─────────
n = 512
yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
r = np.hypot(xx, yy)
th = np.arctan2(yy, xx)
re = R / RO
lr = np.log(r + 1e-3)
sw = (0.55 + 0.45 * np.sin(9 * th + 16 * lr)) * (0.6 + 0.4 * np.sin(4 * th - 10 * lr + 1.3))
outer = np.exp(-np.clip(r - re, 0, None) / 0.085) * (r >= re)
inner = np.exp(-np.clip(re - r, 0, None) / 0.018) * (r < re)
core = np.exp(-((r - re) / 0.011) ** 2)
rng = np.random.default_rng(7)
spark = np.zeros_like(r)
for _ in range(90):
    sr = re + abs(rng.normal(0, 0.07))
    st = rng.uniform(-math.pi, math.pi)
    cx, cy = sr * math.cos(st), sr * math.sin(st)
    spark += np.exp(-((xx - cx) ** 2 + (yy - cy) ** 2) / (2 * (0.006 + 0.006 * rng.random()) ** 2))
glow = np.clip(outer * sw * 1.25 + inner * 0.9, 0, 1)
main, hot = hexrgb(RIM), np.array([1.0, 0.96, 0.85])
rgb = main * glow[..., None] + hot * np.clip(core + spark, 0, 1)[..., None]
alpha = np.clip(glow * 1.1 + core + spark, 0, 1) * (r < 0.995) * (r > (R - 0.06) / RO)
rim_rgba = np.concatenate([np.clip(rgb, 0, 1), alpha[..., None]], -1)
from PIL import Image
rim_path = os.path.join(TEX, f'{NAME}_rim.png')
Image.fromarray((rim_rgba * 255).astype(np.uint8), 'RGBA').save(rim_path)


# ───────── materials ─────────
def emissive(M, name, tex, strength=1.0):
    """black base + emissive texture: shows the panorama at its rendered brightness, no scene lighting"""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (0, 0, 0, 1)
    bsdf.inputs['Roughness'].default_value = 1.0
    try:
        bsdf.inputs['Specular IOR Level'].default_value = 0.0
    except Exception:
        pass
    tn = nt.nodes.new('ShaderNodeTexImage')
    tn.image = bpy.data.images.load(tex)
    nt.links.new(tn.outputs['Color'], bsdf.inputs['Emission Color'])
    bsdf.inputs['Emission Strength'].default_value = strength
    m.use_backface_culling = False
    M.m[name] = m
    M.tile[name] = None
    return name


def uvw(v):
    return (0.5 + v[0] / (2 * R), 0.5 + v[1] / (2 * R))


report = {}

# window: bowl (panorama) + dark dome behind it

bpy.ops.wm.read_factory_settings(use_empty=True)
M = Mats()
wm = emissive(M, f'{NAME}_view', win_path, 1.25)
dome = M.add(f'{NAME}_shell', '#05010A', 0.0, 0.6, '#2A0848', 0.5)
B = Builder(M)
acc = B.a(wm)
B.faces(acc, [tuple(v) for v in verts], [list(t) for t in tris], uvs=[[uvw(verts[i]) for i in t] for t in tris])
# the shell is the same mesh scaled about the portal centre: a scaled convex cap always contains the
# original, so it can never poke through the view (a coarser shell would, between its flat facets)
B.faces(B.a(dome), [tuple(v * 1.04) for v in verts], [list(t) for t in tris])
B.emit(f'{NAME}_win')
export(os.path.join(OUT, f'{NAME}_win.glb'))
report['win'] = tri_count()

# rim ring: annulus slightly in front of the window plane
bpy.ops.wm.read_factory_settings(use_empty=True)
M = Mats()
rm = M.add(f'{NAME}_rim', '#000000', tex=rim_path, emit_tex=True, strength=4.0, tile=None)
B = Builder(M)
rs = 28 if SEG >= 20 else 20
ri = R - 0.06
vs, fs, us = [], [], []
for j in range(rs):
    p0, p1 = 2 * math.pi * j / rs, 2 * math.pi * (j + 1) / rs
    q = [(ri * math.cos(p0), ri * math.sin(p0)), (RO * math.cos(p0), RO * math.sin(p0)),
         (RO * math.cos(p1), RO * math.sin(p1)), (ri * math.cos(p1), ri * math.sin(p1))]
    base = len(vs)
    vs += [(x, y, -0.015) for x, y in q]
    fs.append([base, base + 1, base + 2, base + 3])
    us.append([(0.5 + x / (2 * RO), 0.5 + y / (2 * RO)) for x, y in q])
B.faces(B.a(rm), vs, fs, uvs=us)
B.emit(f'{NAME}_rim')
export(os.path.join(OUT, f'{NAME}_rim.glb'))
report['rim'] = tri_count()

# bubble: unit sphere, full panorama inside, forward (+z) = destination heading
bpy.ops.wm.read_factory_settings(use_empty=True)
M = Mats()
bm = emissive(M, f'{NAME}_sky', bub_path, 1.25)
B = Builder(M)
vs, fs, us = [], [], []
for jl in range(BLAT):
    la0, la1 = -math.pi / 2 + math.pi * jl / BLAT, -math.pi / 2 + math.pi * (jl + 1) / BLAT
    for il in range(BLON):
        lo0, lo1 = -math.pi + 2 * math.pi * il / BLON, -math.pi + 2 * math.pi * (il + 1) / BLON
        pts = [(la0, lo0), (la0, lo1), (la1, lo1), (la1, lo0)]
        if jl == 0:
            pts = [(la0, (lo0 + lo1) / 2), (la1, lo1), (la1, lo0)]
        elif jl == BLAT - 1:
            pts = [(la0, lo0), (la0, lo1), (la1, (lo0 + lo1) / 2)]
        base = len(vs)
        for la, lo in pts:
            vs.append((math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)))
        fs.append(list(range(base, base + len(pts))))
        us.append([(lo / (2 * math.pi) + 0.5, la / math.pi + 0.5) for la, lo in pts])
B.faces(B.a(bm), vs, fs, uvs=us)
B.emit(f'{NAME}_bub')
export(os.path.join(OUT, f'{NAME}_bub.glb'))
report['bub'] = tri_count()
report['kb'] = {k: os.path.getsize(os.path.join(OUT, f'{NAME}_{k}.glb')) // 1024 for k in ('win', 'rim', 'bub')}
print('REPORT', json.dumps(report))
