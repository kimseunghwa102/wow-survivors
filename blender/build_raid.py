"""THE PALE SOVEREIGN raid (parcel -91,71): reaper boss (multi-clip), cursed arena, raid FX, cosmetics.
Everything fits ONE parcel: 16×16 m, < 20 m tall, ≈10k triangles in total.
python3 blender/build_raid.py → raid/models/*.glb (+ cosmetics copied to models/ for the castle)"""
import bpy, json, math, os, shutil, sys
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
from common import *  # noqa
import common
from textures_hd import _rgba

OUT = os.path.join(ROOT, 'raid', 'models')
os.makedirs(OUT, exist_ok=True)
REPORT = {}
rng = np.random.default_rng(66)


def fresh(fps=24, end=48):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.fps = fps
    sc.frame_start, sc.frame_end = 1, end
    return Mats()


def save(name, animated=False):
    p = os.path.join(OUT, name + '.glb')
    export(p, animation=animated)
    REPORT[name] = {'tris': tri_count(), 'kb': os.path.getsize(p) // 1024}
    return p


def skin(M, name, color, rough=0.8, metal=0.0, seed=1, contrast=0.5, tile=0.8, emit=None, strength=0.0):
    n = 256
    f = fbm(n, 5, seed)
    g = fbm(n, 6, seed + 9)
    c = np.array(lin(color)) ** (1 / 2.2)
    col = c * (1 - contrast / 2 + contrast * f[..., None]) * (0.8 + 0.4 * g[..., None])
    return M.add(name, color, metal, rough, emit, strength, tex=save_img(f'raid_{name}.jpg', col), tile=tile)


# ─────────── rig helpers (multi-clip) ───────────
def pivot(name, at, parts):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = to_b(at)
    bpy.context.view_layer.update()
    for o in parts:
        o.parent = e
        o.matrix_parent_inverse = e.matrix_world.inverted()
    return e


def parent(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


def krot(o, frames):
    """frames: [(frame, (rx, ry, rz) in DCL degrees)]"""
    o.rotation_mode = 'XYZ'
    for f, (x, y, z) in frames:
        o.rotation_euler = (-math.radians(x), -math.radians(z), math.radians(y))
        o.keyframe_insert('rotation_euler', frame=f)


def kloc(o, frames):
    """frames: [(frame, (dx, dy, dz) DCL offsets from rest)]"""
    base = o.get('rest')
    if base is None:
        o['rest'] = list(o.location)
        base = o['rest']
    for f, (dx, dy, dz) in frames:
        o.location = (base[0] - dx, base[1] - dz, base[2] + dy)
        o.keyframe_insert('location', frame=f)


def bake_clip(name, objs):
    """push the current actions of objs into NLA tracks called `name` (one glTF clip per track name)"""
    for o in objs:
        ad = o.animation_data
        if ad and ad.action:
            tr = ad.nla_tracks.new()
            tr.name = name
            st = tr.strips.new(name, int(ad.action.frame_range[0]), ad.action)
            st.name = name
            ad.action = None
        o.rotation_euler = (0, 0, 0)
        if o.get('rest') is not None:
            o.location = o['rest']


def emit_obj(b, prefix):
    objs = b.emit(prefix)
    return objs


# ══════════════════════════ THE REAPER (16.5 m) ══════════════════════════
def build_reaper():
    M = fresh()
    CL = skin(M, 'cloak', '#141012', 0.95, seed=3, contrast=0.6, tile=2.5)
    BN = skin(M, 'bone', '#B8A47E', 0.65, seed=8, contrast=0.7, tile=0.6)
    RU = skin(M, 'rust', '#6B3418', 0.75, 0.5, seed=12, contrast=0.8, tile=1.5)
    M.add('ember', '#FF6A1E', 0, 0.4, '#FF5A14', 9.0)
    M.add('rope', '#4A3A26', 0, 0.9)
    M.add('void', '#000000', 0, 1.0)
    M.add('glass', '#C8E4FF', 0, 0.1, '#FFB85A', 0.6, alpha=0.45)
    M.add('edge', '#FF7B3A', 0.2, 0.3, '#FF4A12', 4.0)

    SH, HZ, FLOAT = 11.4, 13.3, 1.0
    b = Builder(M)
    rnd = np.random.default_rng(5)

    # robe (from the hips down): tapered, wobbly, ragged hem
    SEG, RINGS = 20, 9
    vs, fs = [], []
    for j in range(RINGS + 1):
        t = j / RINGS
        y = SH - 2.2 - t * (SH - 2.2 - FLOAT)
        r = 1.45 + 2.9 * t ** 1.4
        for i in range(SEG):
            a = 2 * math.pi * i / SEG
            wob = 1 + 0.07 * math.sin(a * 5 + t * 5) + 0.05 * math.sin(a * 3 - t * 7)
            yy = y
            if j == RINGS:
                yy = FLOAT + rnd.uniform(-0.2, 0.8) - (1.2 if i % 2 == 0 else 0) * rnd.uniform(0.6, 1.0)
            vs.append((math.cos(a) * r * wob, yy, math.sin(a) * r * wob * 0.82))
    for j in range(RINGS):
        for i in range(SEG):
            a, c = j * SEG + i, j * SEG + (i + 1) % SEG
            fs.append([a, c, c + SEG, a + SEG])
    b.faces(b.a(CL), vs, fs, smooth=True)
    # rope belt + hanging skulls
    b.ring(0, SH - 2.35, 0, 1.45, 1.6, 0.18, 'rope', seg=16)
    for a in (-110, -75, -45):
        r = math.radians(a)
        x, z = math.cos(r) * 1.6, math.sin(r) * 1.32
        b.box(x, SH - 3.0, z, 0.06, 1.1, 0.06, 'rope')
        b.sphere(x, SH - 3.7, z - 0.05, 0.2, BN, 8, 5, 0.22, 0.2)

    # spine + ribcage (exposed chest) + ember heart
    for k in range(9):
        b.sphere(0, SH + 0.3 - k * 0.38, 0.2, 0.24, BN, 6, 4, 0.13, 0.2)
    for k in range(6):
        y0 = SH - 0.25 - k * 0.38
        w = 1.35 - abs(k - 2) * 0.1
        for s in (-1, 1):
            prev = None
            for i in range(5):
                u = i / 4
                a = math.radians(-5 + u * 170)
                p = (s * w * math.sin(a), y0 - 0.3 * math.sin(u * math.pi) - u * 0.2, 0.15 - w * 0.95 * (1 - math.cos(a)) * 0.6)
                if prev:
                    seg_between(b, prev, p, 0.075, BN, 5)
                prev = p
    seg_between(b, (0, SH - 0.05, -1.45), (0, SH - 2.2, -1.45), 0.13, BN, 6)
    b.sphere(0, SH - 1.6, -0.35, 0.38, 'ember', 8, 6)
    # shoulder mantle
    for s in (-1, 1):
        b.sphere(s * 1.45, SH + 0.05, 0.1, 1.0, CL, 10, 6, 0.65, 0.95)
    # tattered rags hanging from the mantle and back
    for k in range(18):
        s = -1 if k % 2 else 1
        x0 = s * rnd.uniform(0.6, 2.3)
        z0 = rnd.uniform(-0.6, 1.2)
        L = rnd.uniform(4, 8.5)
        w = rnd.uniform(0.35, 0.7)
        dx, dz = s * rnd.uniform(0.5, 1.8), rnd.uniform(0.3, 1.8)
        rag(b, (x0, SH + 0.2, z0), L, w, (dx, dz), CL, k)

    objs_body = emit_obj(b, 'body')

    # head: skull in a peaked hood
    hb = Builder(M)
    hb.sphere(0, HZ + 0.2, 0.0, 0.78, BN, 12, 8, 0.85, 0.85)                  # cranium
    hb.sphere(0, HZ - 0.15, -0.45, 0.65, BN, 10, 6, 0.55, 0.5)                # face
    hb.sphere(0, HZ + 0.26, -0.6, 0.68, BN, 8, 4, 0.16, 0.32)                 # brow
    for s in (-1, 1):
        hb.sphere(s * 0.29, HZ + 0.03, -0.86, 0.22, 'void', 8, 5, 0.2, 0.15)
        hb.sphere(s * 0.27, HZ + 0.02, -0.93, 0.07, 'ember', 6, 4)
        hb.sphere(s * 0.47, HZ - 0.3, -0.72, 0.18, BN, 6, 4, 0.14, 0.24)
    hb.octa(0, HZ - 0.3, -0.98, 0.1, 0.13, 'void')
    hb.sphere(0, HZ - 0.8, -0.5, 0.5, BN, 8, 5, 0.22, 0.42)                    # jaw
    for k in range(8):
        x = -0.31 + k * 0.088
        hb.box(x, HZ - 0.53, -0.9 + abs(x) * 0.3, 0.06, 0.18, 0.05, BN)
        hb.box(x * 0.95, HZ - 0.74, -0.86 + abs(x) * 0.3, 0.055, 0.15, 0.05, BN)
    # hood: half shell, open at the front, peaked at the back
    lon, lat = 18, 9
    vs, fs = [], []
    for j in range(lat + 1):
        th = math.pi * 0.95 * j / lat
        for i in range(lon + 1):
            ph = math.radians(-125 + 250 * i / lon)  # leave the front (−z) open
            x = 1.55 * math.sin(th) * math.sin(ph)
            z = 1.75 * math.sin(th) * math.cos(ph) + 0.15
            y = HZ + 0.25 + 1.75 * math.cos(th)
            if y > HZ + 0.8 and z > 0:
                y += (y - HZ - 0.8) * z * 0.45
                z += (y - HZ - 0.8) * 0.3
            vs.append((x, y, z))
    for j in range(lat):
        for i in range(lon):
            a = j * (lon + 1) + i
            fs.append([a, a + 1, a + lon + 2, a + lon + 1])
    hb.faces(hb.a(CL), vs, fs, smooth=True)
    objs_head = emit_obj(hb, 'head')

    # right arm + the scythe
    rb = Builder(M)
    SHR, ELR, WRR = (1.7, SH, 0), (2.9, SH - 2.2, -1.2), (3.2, SH - 3.9, -2.3)
    seg_between(rb, SHR, ELR, 0.62, CL, 8, 0.48)
    seg_between(rb, ELR, WRR, 0.11, BN, 5)
    seg_between(rb, (ELR[0] + 0.12, ELR[1], ELR[2] + 0.1), (WRR[0] + 0.1, WRR[1], WRR[2] + 0.12), 0.08, BN, 5)
    claw(rb, WRR, (0, -0.25, -1), (0, -1, 0.3), 1.0, BN)
    for k in range(4):
        rag(rb, (ELR[0] + rnd.uniform(-0.3, 0.3), ELR[1] + 0.2, ELR[2] + rnd.uniform(-0.3, 0.3)), rnd.uniform(1.5, 3.5), 0.4, (rnd.uniform(0.2, 1), rnd.uniform(0.3, 1.2)), CL, 40 + k)
    # gnarled shaft with thorns
    A, Bt = np.array((3.5, 0.3, -2.75)), np.array((2.9, 16.4, -2.3))
    prev = None
    for i in range(9):
        u = i / 8
        p = A + (Bt - A) * u + np.array((0.15 * math.sin(u * 11), 0, 0.15 * math.cos(u * 9)))
        if prev is not None:
            seg_between(rb, tuple(prev), tuple(p), 0.17, BN, 6)
        prev = p
    for i in range(14):
        u = 0.12 + i / 14 * 0.8
        p = A + (Bt - A) * u
        a = u * 37
        d = np.array((math.cos(a), 0.55, math.sin(a)))
        d /= np.linalg.norm(d)
        seg_between(rb, tuple(p), tuple(p + d * 0.5), 0.07, BN, 4, 0.0)
    for u in (0.25, 0.5, 0.72):
        p = A + (Bt - A) * u
        rb.cyl(p[0], p[1] - 0.15, p[2], 0.24, 0.3, 'rope', seg=8)
    rb.sphere(Bt[0], Bt[1], Bt[2], 0.42, BN, 8, 5, 0.5, 0.42)
    # rusted serrated blade arching back over his hood (stays inside one parcel)
    N = 16
    top, bot = [], []
    for i in range(N + 1):
        u = i / N
        a = math.radians(u * 118)
        R = 4.4
        x = Bt[0] - R * math.sin(a)
        y = Bt[1] + 0.35 - R * (1 - math.cos(a)) * 0.36
        w = 1.6 * (1 - u) ** 0.6 + 0.05
        serr = 0.18 * (i % 2) * (1 - u)
        top.append((x, y, Bt[2]))
        bot.append((x + w * 0.15 * math.sin(a), y - w - serr, Bt[2]))
    vs = top + bot + [(x, y, z + 0.14) for x, y, z in top] + [(x, y, z + 0.14) for x, y, z in bot]
    T, Bo, T2, B2 = 0, N + 1, 2 * (N + 1), 3 * (N + 1)
    fs = []
    for i in range(N):
        fs.append([T + i, T + i + 1, Bo + i + 1, Bo + i])
        fs.append([T2 + i, B2 + i, B2 + i + 1, T2 + i + 1])
        fs.append([T + i, T2 + i, T2 + i + 1, T + i + 1])
    rb.faces(rb.a(RU), vs, fs)
    evs, efs = [], []
    for i in range(N + 1):
        x, y, z = bot[i]
        evs += [(x, y, z - 0.03), (x + 0.04, y + 0.22 * (1 - i / N) + 0.04, z - 0.03)]
    for i in range(N):
        efs.append([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1])
    rb.faces(rb.a('edge'), evs, efs)
    objs_r = emit_obj(rb, 'arm_r')

    # left arm + hourglass on a rope
    lb = Builder(M)
    SHL, ELL, WRL = (-1.7, SH, 0), (-2.9, SH - 1.3, -1.8), (-3.4, SH - 1.6, -3.3)
    seg_between(lb, SHL, ELL, 0.62, CL, 8, 0.48)
    seg_between(lb, ELL, WRL, 0.11, BN, 5)
    seg_between(lb, (ELL[0] - 0.1, ELL[1], ELL[2] + 0.1), (WRL[0] - 0.12, WRL[1], WRL[2] + 0.1), 0.08, BN, 5)
    claw(lb, WRL, (-0.15, 0, -1), (0, 1, 0), 0.85, BN)
    for k in range(4):
        rag(lb, (ELL[0] + rnd.uniform(-0.3, 0.3), ELL[1] + 0.2, ELL[2] + rnd.uniform(-0.3, 0.3)), rnd.uniform(1.5, 3.5), 0.4, (-rnd.uniform(0.2, 1), rnd.uniform(0.3, 1.2)), CL, 60 + k)
    hg = (-3.55, SH - 4.3, -3.75)
    lb.box(-3.5, SH - 2.8, -3.6, 0.05, 1.9, 0.05, 'rope')
    for dy in (0.75, -0.75):
        lb.cyl(hg[0], hg[1] + dy - 0.06, hg[2], 0.5, 0.12, BN, seg=10)
    for k in range(4):
        a = math.radians(45 + k * 90)
        lb.box(hg[0] + math.cos(a) * 0.42, hg[1], hg[2] + math.sin(a) * 0.42, 0.08, 1.5, 0.08, BN)
    lb.cyl(hg[0], hg[1] + 0.02, hg[2], 0.05, 0.7, 'glass', seg=10, r_top=0.4)
    lb.cyl(hg[0], hg[1] - 0.7, hg[2], 0.4, 0.7, 'glass', seg=10, r_top=0.05)
    lb.cyl(hg[0], hg[1] - 0.68, hg[2], 0.33, 0.25, 'ember', seg=8, r_top=0.12)
    lb.cyl(hg[0], hg[1] + 0.25, hg[2], 0.04, 0.35, 'ember', seg=8, r_top=0.3)
    objs_l = emit_obj(lb, 'arm_l')

    # pivots & clips
    core = pivot('core', (0, 0, 0), [])
    body = pivot('body', (0, 0, 0), objs_body)
    head = pivot('head', (0, SH + 0.6, 0), objs_head)
    arm_r = pivot('arm_r', SHR, objs_r)
    arm_l = pivot('arm_l', SHL, objs_l)
    for o in (body, head, arm_r, arm_l):
        parent(o, core)
    for o in (head, arm_r, arm_l):
        parent(o, body)
    anim = [body, head, arm_r, arm_l]
    for o in anim:
        o['rest'] = list(o.location)

    def clip(name, end, fn):
        bpy.context.scene.frame_end = end
        fn()
        bake_clip(name, anim)

    def idle():
        kloc(body, [(1, (0, 0, 0)), (25, (0, 0.45, 0)), (49, (0, 0, 0))])
        krot(head, [(1, (0, 0, 0)), (25, (4, -6, 0)), (49, (0, 0, 0))])
        krot(arm_r, [(1, (0, 0, 0)), (25, (-4, 0, 3)), (49, (0, 0, 0))])
        krot(arm_l, [(1, (0, 0, 0)), (25, (5, 0, -4)), (49, (0, 0, 0))])

    def swing():
        kloc(body, [(1, (0, 0, 0)), (14, (0, 0.2, 0.4)), (22, (0, -0.2, -0.6)), (37, (0, 0, 0))])
        krot(body, [(1, (0, 0, 0)), (14, (0, 25, 0)), (22, (6, -35, 0)), (37, (0, 0, 0))])
        krot(arm_r, [(1, (0, 0, 0)), (14, (-55, 35, 20)), (20, (25, -85, -10)), (26, (30, -100, -15)), (37, (0, 0, 0))])
        krot(head, [(1, (0, 0, 0)), (14, (-8, 15, 0)), (22, (10, -20, 0)), (37, (0, 0, 0))])
        krot(arm_l, [(1, (0, 0, 0)), (14, (10, 10, -15)), (22, (-10, -10, 10)), (37, (0, 0, 0))])

    def slam():
        kloc(body, [(1, (0, 0, 0)), (14, (0, 1.0, 0)), (20, (0, -1.0, -0.5)), (30, (0, -0.6, -0.4)), (41, (0, 0, 0))])
        krot(body, [(1, (0, 0, 0)), (14, (-10, 0, 0)), (20, (18, 0, 0)), (41, (0, 0, 0))])
        krot(arm_r, [(1, (0, 0, 0)), (14, (-130, 0, 15)), (20, (35, 0, 5)), (30, (30, 0, 5)), (41, (0, 0, 0))])
        krot(arm_l, [(1, (0, 0, 0)), (14, (-120, 0, -15)), (20, (40, 0, -5)), (30, (35, 0, -5)), (41, (0, 0, 0))])
        krot(head, [(1, (0, 0, 0)), (14, (-20, 0, 0)), (20, (25, 0, 0)), (41, (0, 0, 0))])

    def cast():
        kloc(body, [(1, (0, 0, 0)), (14, (0, 0.6, 0)), (30, (0, 0.6, 0)), (37, (0, 0, 0))])
        krot(arm_l, [(1, (0, 0, 0)), (12, (-95, -20, -10)), (30, (-100, -20, -10)), (37, (0, 0, 0))])
        krot(head, [(1, (0, 0, 0)), (12, (-18, 10, 0)), (30, (-18, 10, 0)), (37, (0, 0, 0))])
        krot(arm_r, [(1, (0, 0, 0)), (12, (-10, 0, 15)), (37, (0, 0, 0))])

    def roar():
        krot(head, [(1, (0, 0, 0)), (8, (-32, 0, 0)), (12, (-28, 6, 0)), (16, (-34, -6, 0)), (20, (-30, 5, 0)), (24, (-32, 0, 0)), (37, (0, 0, 0))])
        krot(arm_r, [(1, (0, 0, 0)), (10, (-20, 0, 45)), (28, (-22, 0, 48)), (37, (0, 0, 0))])
        krot(arm_l, [(1, (0, 0, 0)), (10, (-20, 0, -45)), (28, (-22, 0, -48)), (37, (0, 0, 0))])
        kloc(body, [(1, (0, 0, 0)), (10, (0, 0.5, 0.3)), (28, (0, 0.5, 0.3)), (37, (0, 0, 0))])

    def death():
        kloc(body, [(1, (0, 0, 0)), (12, (0, 0.8, 0)), (30, (0, -4.0, -1.0)), (48, (0, -9.0, -1.5))])
        krot(body, [(1, (0, 0, 0)), (12, (-12, 0, 0)), (30, (25, 10, 5)), (48, (40, 15, 10))])
        krot(head, [(1, (0, 0, 0)), (12, (-40, 0, 0)), (48, (30, 0, 15))])
        krot(arm_r, [(1, (0, 0, 0)), (12, (-40, 0, 50)), (48, (60, 0, 20))])
        krot(arm_l, [(1, (0, 0, 0)), (12, (-40, 0, -50)), (48, (60, 0, -20))])

    for name, end, fn in [('Idle', 49, idle), ('Swing', 37, swing), ('Slam', 41, slam), ('Cast', 37, cast), ('Roar', 37, roar), ('Death', 48, death)]:
        clip(name, end, fn)
    save('reaper', animated=True)


def seg_between(b, p0, p1, r, m, seg=6, r1=None):
    """tapered tube between two DCL points"""
    p0, p1 = np.array(p0, float), np.array(p1, float)
    d = p1 - p0
    L = np.linalg.norm(d)
    if L < 1e-6:
        return
    d /= L
    up = np.array((0, 1, 0)) if abs(d[1]) < 0.95 else np.array((1, 0, 0))
    u = np.cross(d, up)
    u /= np.linalg.norm(u)
    v = np.cross(d, u)
    rt = r if r1 is None else r1
    vs = []
    for (c, rr) in ((p0, r), (p1, rt)):
        for i in range(seg):
            a = 2 * math.pi * i / seg
            q = c + (u * math.cos(a) + v * math.sin(a)) * rr
            vs.append(tuple(q))
    fs = [[i, (i + 1) % seg, seg + (i + 1) % seg, seg + i] for i in range(seg)]
    b.faces(b.a(m), vs, fs, smooth=True)


def rag(b, top, length, width, drift, m, seed):
    """tattered cloth strip (double sided via material), hanging and blown"""
    N = 5
    vs, fs = [], []
    for i in range(N + 1):
        u = i / N
        w = width * (1 - u * 0.8)
        x = top[0] + drift[0] * u * u + 0.25 * math.sin(u * 6 + seed)
        z = top[2] + drift[1] * u * u
        y = top[1] - length * u
        vs += [(x - w / 2, y, z), (x + w / 2, y, z + 0.1 * math.sin(u * 4 + seed))]
    for i in range(N):
        fs.append([2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2])
    b.faces(b.a(m), vs, fs, smooth=True)


def claw(b, wr, fwd, up, curl, m):
    wr, fwd, up = np.array(wr, float), np.array(fwd, float), np.array(up, float)
    fwd /= np.linalg.norm(fwd)
    up /= np.linalg.norm(up)
    side = np.cross(fwd, up)
    side /= np.linalg.norm(side)
    palm = wr + fwd * 0.5
    seg_between(b, wr, palm, 0.13, m, 5, 0.11)
    for f in range(4):
        p = palm + side * (-0.24 + f * 0.16)
        d = fwd.copy()
        r = 0.065
        for L in (0.45, 0.38, 0.32):
            d = d * math.cos(curl) - up * math.sin(curl)
            d /= np.linalg.norm(d)
            q = p + d * L
            seg_between(b, p, q, r, m, 4, r * 0.75)
            p = q
            r *= 0.75
    t = wr + fwd * 0.2 - side * 0.3
    seg_between(b, t, t + (fwd - side * 0.5 - up * 0.3) * 0.45, 0.06, m, 4, 0.02)


# ══════════════════════════ ARENA (one parcel) ══════════════════════════
def tex_ground(n=1024):
    """cracked dead earth with glowing lava veins"""
    h = fbm(n, 6, 4)
    yy, xx = np.mgrid[0:n, 0:n] / n
    pts = rng.random((60, 2))
    d1 = np.full((n, n), 9.0)
    d2 = np.full((n, n), 9.0)
    for px, py in pts:
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.hypot(xx - px - ox, yy - py - oy)
                d2 = np.minimum(d2, np.maximum(d1, d))
                d1 = np.minimum(d1, d)
    crack = np.clip(1 - (d2 - d1) / 0.012, 0, 1) ** 2
    vein = crack * np.clip(fbm(n, 4, 9) * 1.8 - 0.4, 0, 1)
    base = np.stack([0.11 + 0.08 * h, 0.085 + 0.06 * h, 0.07 + 0.05 * h], -1) * (0.75 + 0.5 * fbm(n, 5, 12)[..., None])
    base *= (1 - 0.8 * crack[..., None])
    lava = np.stack([1.0 * vein, 0.32 * vein, 0.05 * vein], -1)
    return save_img('raid_ground.jpg', np.clip(base + lava * 1.4, 0, 1))


def tex_backdrop(w=2048, h=512):
    """360° storm panorama for the inside of the walls: red horizon, dead forest, lava glow"""
    yy, xx = np.mgrid[0:h, 0:w]
    v = yy / h
    sky = np.stack([0.05 + 0.25 * v ** 3, 0.02 + 0.05 * v ** 3, 0.04 + 0.02 * v ** 3], -1)
    cl = fbm(512, 6, 21)
    cl = np.tile(cl, (1, 4))[:h, :w] if cl.shape[0] >= h else cl
    clouds = np.clip(cl[:h, :w] * 1.6 - 0.55, 0, 1)
    sky = sky * (1 - clouds[..., None] * 0.5) + clouds[..., None] * np.array((0.09, 0.08, 0.1)) * (1 - v[..., None])
    img = sky.copy()
    # mountain ridges
    x = np.arange(w)
    for k, (base, amp, col) in enumerate([(0.55, 0.12, (0.05, 0.03, 0.04)), (0.66, 0.1, (0.025, 0.015, 0.02))]):
        ridge = base + amp * (np.sin(x / w * 2 * math.pi * (3 + k)) * 0.4 + np.sin(x / w * 2 * math.pi * (11 + k * 3)) * 0.2 + rng.random() * 0)
        ridge += 0.04 * np.interp(x, np.linspace(0, w, 64), rng.random(64))
        mask = v > ridge[None, :]
        img[mask] = np.array(col)
    # dead trees silhouettes
    from PIL import Image, ImageDraw
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)

    def tree(x0, y0, hgt, wdt, depth, ang=-90):
        if depth == 0 or hgt < 4:
            return
        a = math.radians(ang)
        x1, y1 = x0 + math.cos(a) * hgt, y0 + math.sin(a) * hgt
        d.line([(x0, y0), (x1, y1)], fill=(6, 3, 5), width=max(1, int(wdt)))
        for _ in range(int(rng.integers(2, 4))):
            tree(x1, y1, hgt * rng.uniform(0.55, 0.75), wdt * 0.65, depth - 1, ang + rng.uniform(-45, 45))
    for i in range(34):
        xx0 = rng.uniform(0, w)
        tree(xx0, h * rng.uniform(0.82, 0.98), rng.uniform(40, 110), rng.uniform(4, 9), 5)
    a = np.asarray(im).astype(float) / 255
    # lava glow along the bottom + embers
    glow = np.clip((v - 0.8) / 0.2, 0, 1) ** 2 * (0.6 + 0.4 * np.tile(fbm(512, 4, 31), (1, 4))[:h, :w])
    a += glow[..., None] * np.array((0.9, 0.25, 0.04))
    for _ in range(400):
        ex, ey = int(rng.uniform(0, w)), int(rng.uniform(h * 0.3, h))
        a[max(0, ey - 1):ey + 1, max(0, ex - 1):ex + 1] += np.array((1, 0.4, 0.1)) * rng.uniform(0.3, 1)
    return save_img('raid_backdrop.jpg', np.clip(a, 0, 1))


def tex_sky(n=1024):
    c = fbm(n, 7, 41)
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    base = np.stack([0.04 + 0.1 * c, 0.02 + 0.03 * c, 0.035 + 0.04 * c], -1)
    clouds = np.clip(c * 1.8 - 0.7, 0, 1)[..., None]
    img = base * (1 - clouds) + clouds * np.array((0.16, 0.08, 0.1))
    # blood moon
    dm = np.hypot(xx - 0.35, yy + 0.25)
    moon = np.clip(1 - dm / 0.16, 0, 1) ** 0.4
    halo = np.clip(1 - dm / 0.5, 0, 1) ** 3
    img = img + moon[..., None] * np.array((0.85, 0.2, 0.08)) + halo[..., None] * np.array((0.35, 0.05, 0.03))
    return save_img('raid_sky.jpg', np.clip(img, 0, 1))


def build_arena():
    M = fresh()
    M.add('ground', '#ffffff', 0, 0.95, '#ffffff', 1.4, tex=tex_ground(), tile=16.0, emit_tex=True)
    M.add('wall', '#ffffff', 0, 1.0, '#ffffff', 1.0, tex=tex_backdrop(), tile=None, emit_tex=True)
    M.add('sky', '#ffffff', 0, 1.0, '#ffffff', 1.0, tex=tex_sky(), tile=None, emit_tex=True)
    M.add('lava', '#FF6A1E', 0, 0.3, '#FF4A0C', 7.0)
    M.add('rock', '#2A2224', 0, 0.9)
    M.add('rot', '#2B2117', 0, 0.95)
    M.add('moss', '#2E3A1C', 0, 0.95)
    M.add('stone', '#4A4648', 0, 0.85)
    M.add('portal', '#9B4BFF', 0, 0.3, '#B26BFF', 5.0)
    M.add('bonew', '#B8A47E', 0, 0.7)
    b = Builder(M)
    E, S, HT = 0.06, 16.0, 19.9
    # cracked ground (8×8 with heave)
    n = 8
    vs, fs, uvs = [], [], []
    hgt = fbm(9, 2, 3) if False else None
    for j in range(n + 1):
        for i in range(n + 1):
            x, z = E + (S - 2 * E) * i / n, E + (S - 2 * E) * j / n
            y = 0.0 if i in (0, n) or j in (0, n) else float(rng.uniform(-0.05, 0.12))
            vs.append((x, y, z))
    for j in range(n):
        for i in range(n):
            a = j * (n + 1) + i
            fs.append([a, a + n + 1, a + n + 2, a + 1])
            uvs.append([((i) / n, (j) / n), ((i) / n, (j + 1) / n), ((i + 1) / n, (j + 1) / n), ((i + 1) / n, (j) / n)])
    b.faces(b.a('ground'), vs, fs, uvs=uvs)
    b.collider(0, -0.3, 0, S, 0.0, S)
    # walls: inner faces carry the 360° panorama; ceiling = storm sky with a blood moon
    walls = [((E, 0, E), (S - E, 0, E), 0), ((S - E, 0, E), (S - E, 0, S - E), 1), ((S - E, 0, S - E), (E, 0, S - E), 2), ((E, 0, S - E), (E, 0, E), 3)]
    for (p0, p1, k) in walls:
        u0, u1 = k / 4, (k + 1) / 4
        b.quad((p0[0], 0, p0[2]), (p1[0], 0, p1[2]), (p1[0], HT, p1[2]), (p0[0], HT, p0[2]), 'wall', uv=((u0, 0), (u1, 0), (u1, 1), (u0, 1)))
    b.quad((E, HT, E), (E, HT, S - E), (S - E, HT, S - E), (S - E, HT, E), 'sky')
    for (x0, z0, x1, z1) in [(0, 0, S, 0.3), (0, S - 0.3, S, S), (0, 0, 0.3, S), (S - 0.3, 0, S, S)]:
        b.collider(x0, 0, z0, x1, HT, z1)
    # lava pools + rocks + bones
    for (cx, cz, r) in [(4.0, 11.5, 1.5), (12.3, 5.2, 1.2), (11.8, 12.6, 0.9)]:
        seg = 10
        pts = [(cx + math.cos(2 * math.pi * i / seg) * r * rng.uniform(0.7, 1.15), 0.05, cz + math.sin(2 * math.pi * i / seg) * r * rng.uniform(0.7, 1.15)) for i in range(seg)]
        b.faces(b.a('lava'), [(cx, 0.06, cz)] + pts, [[0, 1 + (i + 1) % seg, 1 + i] for i in range(seg)])
        for i in range(seg):
            x, _, z = pts[i]
            b.box(x, 0.12, z, rng.uniform(0.3, 0.6), 0.3, rng.uniform(0.3, 0.6), 'rock', yaw=float(rng.uniform(0, 90)), pitch=float(rng.uniform(-15, 15)))
    for _ in range(14):  # heaved slabs (earthquake)
        x, z = rng.uniform(1.2, 14.8), rng.uniform(1.2, 14.8)
        if 4.5 < x < 11.5 and 4.5 < z < 11.5:
            continue
        b.box(x, 0.15, z, rng.uniform(0.8, 1.8), 0.25, rng.uniform(0.6, 1.4), 'rock', yaw=float(rng.uniform(0, 180)), pitch=float(rng.uniform(8, 25)), roll=float(rng.uniform(-15, 15)))
    for (x, z, yaw) in [(2.2, 6.5, 10), (2.8, 8.8, -15), (13.6, 9.5, 20), (6.2, 14.2, 5), (9.8, 14.4, -8)]:  # graves
        b.box(x, 0.7, z, 0.75, 1.4, 0.22, 'stone', yaw=yaw, roll=float(rng.uniform(-12, 12)))
    for _ in range(9):
        x, z = rng.uniform(1.5, 14.5), rng.uniform(1.5, 14.5)
        b.sphere(x, 0.15, z, 0.18, 'bonew', 6, 4, 0.17, 0.2)
    # rotting trees in the corners (bent, hollow, dripping moss)
    for (tx, tz, ang) in [(1.6, 1.8, 30), (14.3, 2.2, 150), (1.9, 14.2, -40), (14.2, 14.1, -140)]:
        rot_tree(b, tx, tz, ang)
    # the dimensional portal home (south edge)
    px, pz = 8.0, 1.0
    for s in (-1, 1):
        b.box(px + s * 1.7, 1.9, pz, 0.6, 3.8, 0.6, 'stone')
        b.box(px + s * 1.7, 3.95, pz, 0.8, 0.3, 0.8, 'rock')
    for k in range(7):
        a = math.radians(k * 30)
        b.box(px - math.cos(a) * 1.7, 3.8 + math.sin(a) * 1.25, pz, 0.6, 0.55, 0.6, 'stone', roll=-math.degrees(a) + 90)
    save_objs = b.emit('arena')
    save('raid_arena')


def rot_tree(b, x, z, ang):
    a = math.radians(ang)
    dx, dz = math.cos(a), math.sin(a)
    pts = [(x, 0, z), (x + dx * 0.4, 2.2, z + dz * 0.4), (x + dx * 1.2, 4.0, z + dz * 1.2), (x + dx * 2.3, 5.2, z + dz * 2.3)]
    r = [0.55, 0.42, 0.3, 0.18]
    for i in range(3):
        seg_between(b, pts[i], pts[i + 1], r[i], 'rot', 6, r[i + 1])
    for k in range(5):  # crooked branches
        base = np.array(pts[1 + k % 3], float)
        ba = a + rng.uniform(-1.6, 1.6)
        tip = base + np.array((math.cos(ba) * rng.uniform(1.0, 2.0), rng.uniform(0.3, 1.4), math.sin(ba) * rng.uniform(1.0, 2.0)))
        seg_between(b, base, tip, 0.12, 'rot', 4, 0.03)
        b.box(tip[0], tip[1] - 0.6, tip[2], 0.08, 1.2, 0.08, 'moss')  # hanging moss
    for k in range(3):  # roots
        ra = a + math.pi + (k - 1) * 0.9
        seg_between(b, (x, 0.3, z), (x + math.cos(ra) * 1.3, -0.05, z + math.sin(ra) * 1.3), 0.2, 'rot', 4, 0.05)
    b.sphere(x + dx * 0.4, 1.6, z + dz * 0.4, 0.3, 'moss', 6, 4, 0.25, 0.3)


# ══════════════════════════ RAID FX ══════════════════════════
def fx(name, fn, mats):
    M = fresh()
    for (nm, col, strength, alpha) in mats:
        M.add(nm, col, 0, 0.4, col, strength, alpha=alpha)
    b = Builder(M)
    fn(b)
    b.emit(name)
    save(name)


def disc(b, r, m, y=0.04, seg=28, a0=0.0, a1=360.0, inner=0.0):
    vs, fs = [], []
    for i in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * i / seg)
        vs += [(math.sin(a) * inner, y, math.cos(a) * inner), (math.sin(a) * r, y, math.cos(a) * r)]
    for i in range(seg):
        fs.append([2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1])
    b.faces(b.a(m), vs, fs)


def build_fx():
    # warning circle (unit radius): dim red fill + bright rim
    fx('fx_r_warn', lambda b: (disc(b, 1.0, 'fill', 0.03, 16, inner=0.0), disc(b, 1.0, 'rim', 0.05, 16, inner=0.88)),
       [('fill', '#FF2A1A', 1.2, 0.35), ('rim', '#FF4A2A', 6.0, 1.0)])
    # warning cone 140° (unit radius, opening toward +z)
    fx('fx_r_cone', lambda b: (disc(b, 1.0, 'fill', 0.03, 20, -70, 70), disc(b, 1.0, 'rim', 0.05, 20, -70, 70, inner=0.94)),
       [('fill', '#FF2A1A', 1.2, 0.35), ('rim', '#FF4A2A', 6.0, 1.0)])
    # scythe sweep trail: tall burning crescent band (unit radius)
    def sweep(b):
        vs, fs = [], []
        seg = 18
        for i in range(seg + 1):
            a = math.radians(-70 + 140 * i / seg)
            for (r, y) in ((0.55, 0.3), (1.0, 0.3), (1.0, 1.2), (0.55, 1.2)):
                vs.append((math.sin(a) * r, y, math.cos(a) * r))
        for i in range(seg):
            for k in range(4):
                k2 = (k + 1) % 4
                fs.append([4 * i + k, 4 * (i + 1) + k, 4 * (i + 1) + k2, 4 * i + k2])
        b.faces(b.a('trail'), vs, fs)
    fx('fx_r_sweep', sweep, [('trail', '#FF5A1E', 7.0, 0.7)])
    # lava eruption pillar (unit radius, 6 m)
    def erupt(b):
        b.cyl(0, 0, 0, 1.0, 5.5, 'lava', seg=10, r_top=0.3, caps=False)
        b.cyl(0, 0, 0, 0.6, 7.0, 'core', seg=8, r_top=0.05, caps=False)
        for k in range(6):
            a = math.radians(k * 60)
            b.octa(math.cos(a) * 1.2, 0.6, math.sin(a) * 1.2, 0.35, 0.6, 'rockg')
    fx('fx_r_erupt', erupt, [('lava', '#FF5A14', 6.0, 0.85), ('core', '#FFD27A', 12.0, 0.9), ('rockg', '#4A2414', 0.5, 1.0)])
    # shockwave ring (unit radius)
    fx('fx_r_shock', lambda b: b.ring(0, 0, 0, 0.82, 1.0, 0.8, 'wave', seg=28), [('wave', '#FFB45A', 5.0, 0.7)])
    # soul bolt: green skull orb with tail
    def bolt(b):
        b.sphere(0, 0, 0, 0.45, 'soul', 8, 6)
        b.sphere(0, 0.05, -0.32, 0.12, 'eye', 5, 4)
        b.cyl(0, 0, 0.3, 0.3, 1.4, 'tail', seg=6, r_top=0.0, caps=False)
    fx('fx_r_bolt', bolt, [('soul', '#5CFFB0', 7.0, 0.9), ('eye', '#000000', 0.0, 1.0), ('tail', '#3DE8A0', 4.0, 0.5)])
    # hit spark
    fx('fx_r_hit', lambda b: [b.octa(0, 0, 0, 0.35, 0.9, 'spark'), b.octa(0, 0, 0, 0.9, 0.25, 'spark')], [('spark', '#FFE7A0', 10.0, 1.0)])
    # time-stop dome (hourglass curse)
    fx('fx_r_dome', lambda b: b.sphere(0, 0, 0, 1.0, 'dome', 16, 8), [('dome', '#FFC85A', 1.6, 0.18)])
    # portal swirl disc (vertical, faces -z)
    def portal(b):
        vs, fs = [], []
        arms = 5
        for k in range(arms):
            pts = []
            for i in range(12):
                u = i / 11
                a = k * 2 * math.pi / arms + u * 3.2
                r = 0.15 + u * 1.25
                pts.append((math.cos(a) * r, math.sin(a) * r * 1.4))
            for i in range(11):
                (x0, y0), (x1, y1) = pts[i], pts[i + 1]
                w = 0.06 + 0.14 * (i / 11)
                base = len(vs)
                vs += [(x0 - w, y0, 0), (x1 - w, y1, 0), (x1 + w, y1, 0), (x0 + w, y0, 0)]
                fs.append([base, base + 1, base + 2, base + 3])
        b.faces(b.a('swirl'), vs, fs)
        disc_v = [(0, 0, 0.02)] + [(math.cos(2 * math.pi * i / 20) * 1.45, math.sin(2 * math.pi * i / 20) * 2.0, 0.02) for i in range(20)]
        b.faces(b.a('void'), disc_v, [[0, 1 + i, 1 + (i + 1) % 20] for i in range(20)])
    fx('fx_r_portal', portal, [('swirl', '#C07BFF', 6.0, 0.9), ('void', '#12051F', 1.5, 0.95)])


# ══════════════════════════ COSMETICS (worn in both maps) ══════════════════════════
def build_cosmetics():
    def lantern(b):
        b.box(0, 0.5, 0, 0.04, 0.5, 0.04, 'iron')
        b.cyl(0, 0, 0, 0.17, 0.08, 'iron', seg=8)
        b.cyl(0, -0.4, 0, 0.15, 0.4, 'glow', seg=8)
        b.cyl(0, -0.48, 0, 0.19, 0.08, 'iron', seg=8)
        for k in range(4):
            a = math.radians(45 + k * 90)
            b.box(math.cos(a) * 0.16, -0.2, math.sin(a) * 0.16, 0.03, 0.42, 0.03, 'iron')
    fx('cos_lantern', lantern, [('iron', '#2A2622', 0.0, 1.0), ('glow', '#5CFFB0', 8.0, 0.9)])

    def crown(b):
        b.ring(0, 0, 0, 0.17, 0.21, 0.08, 'bone', seg=12)
        for k in range(8):
            a = math.radians(k * 45)
            h = 0.32 if k % 2 == 0 else 0.2
            b.cyl(math.cos(a) * 0.19, 0.06, math.sin(a) * 0.19, 0.035, h, 'bone', seg=4, r_top=0.0)
        for k in range(4):
            a = math.radians(k * 90 + 22)
            b.sphere(math.cos(a) * 0.21, 0.05, math.sin(a) * 0.21, 0.035, 'gem', 5, 3)
    fx('cos_crown', crown, [('bone', '#D8C69A', 0.3, 1.0), ('gem', '#FF3B2E', 6.0, 1.0)])

    def hourglass(b):
        for dy in (0.32, -0.32):
            b.cyl(0, dy - 0.03, 0, 0.22, 0.06, 'frame', seg=8)
        for k in range(3):
            a = math.radians(k * 120)
            b.box(math.cos(a) * 0.18, 0, math.sin(a) * 0.18, 0.035, 0.64, 0.035, 'frame')
        b.cyl(0, 0.0, 0, 0.02, 0.3, 'sand', seg=8, r_top=0.17)
        b.cyl(0, -0.3, 0, 0.17, 0.3, 'sand', seg=8, r_top=0.02)
    fx('cos_hourglass', hourglass, [('frame', '#B8A47E', 0.3, 1.0), ('sand', '#FFB45A', 4.0, 0.85)])

    def shroud(b):
        for k in range(10):
            a = math.radians(k * 36)
            x, z = math.cos(a) * 0.75, math.sin(a) * 0.75
            b.quad((x - 0.12, 0, z), (x + 0.12, 0, z), (x + 0.05 * math.cos(a), 1.7, z + 0.05 * math.sin(a)), (x - 0.05, 1.7, z), 'smoke')
        b.ring(0, 0.02, 0, 0.55, 0.95, 0.04, 'ember', seg=20)
    fx('cos_shroud', shroud, [('smoke', '#1A0F1F', 0.6, 0.55), ('ember', '#FF5A14', 4.0, 0.9)])

    def scythe(b):
        seg_between(b, (0, -0.8, 0), (0, 1.6, 0), 0.04, 'bonew', 5)
        top = []
        for i in range(9):
            u = i / 8
            a = math.radians(u * 110)
            top.append((-math.sin(a) * 0.9, 1.6 - (1 - math.cos(a)) * 0.35 - u * u * 0.3, 0))
        vs = top + [(x + 0.04, y - 0.28 * (1 - i / 8) - 0.03, z) for i, (x, y, z) in enumerate(top)]
        fs = [[i, i + 1, 10 + i, 9 + i] for i in range(8)]
        b.faces(b.a('rust'), vs, fs)
        b.faces(b.a('edge'), [(x + 0.04, y - 0.28 * (1 - i / 8) - 0.03, 0.01) for i, (x, y, z) in enumerate(top)] + [(x + 0.04, y - 0.28 * (1 - i / 8) + 0.03, 0.01) for i, (x, y, z) in enumerate(top)], [[i, i + 1, 10 + i, 9 + i] for i in range(8)])
    fx('cos_scythe', scythe, [('bonew', '#B8A47E', 0.2, 1.0), ('rust', '#6B3418', 0.0, 1.0), ('edge', '#FF5A14', 6.0, 1.0)])


def build_gate():
    """the castle-side gate to the Reaper's Realm (stone arch, skulls, ember braziers)"""
    M = fresh()
    M.add('stone', '#4A4648', 0, 0.85)
    M.add('rock', '#2A2224', 0, 0.9)
    M.add('bonew', '#B8A47E', 0, 0.7)
    M.add('ember', '#FF6A1E', 0, 0.4, '#FF5A14', 8.0)
    b = Builder(M)
    for s in (-1, 1):
        b.box(s * 1.7, 1.9, 0, 0.6, 3.8, 0.6, 'stone')
        b.box(s * 1.7, 3.95, 0, 0.8, 0.3, 0.8, 'rock')
        b.box(s * 1.7, 0.15, 0, 0.9, 0.3, 0.9, 'rock')
        b.sphere(s * 1.7, 4.35, 0, 0.26, 'bonew', 8, 5, 0.28, 0.26)
        b.cyl(s * 2.6, 0, -0.4, 0.25, 1.1, 'rock', seg=6, r_top=0.35)
        b.octa(s * 2.6, 1.35, -0.4, 0.22, 0.4, 'ember')
    for k in range(7):
        a = math.radians(k * 30)
        b.box(-math.cos(a) * 1.7, 3.8 + math.sin(a) * 1.25, 0, 0.6, 0.55, 0.6, 'stone', roll=-math.degrees(a) + 90)
    b.sphere(0, 5.25, -0.2, 0.36, 'bonew', 8, 5, 0.4, 0.36)
    b.emit('gate')
    save('raid_gate')


if __name__ == '__main__':
    build_gate()
    build_reaper()
    build_arena()
    build_fx()
    build_cosmetics()
    for c in ('cos_lantern', 'cos_crown', 'cos_hourglass', 'cos_shroud', 'cos_scythe', 'fx_r_portal', 'raid_gate'):
        shutil.copy(os.path.join(OUT, c + '.glb'), os.path.join(MODELS, c + '.glb'))
    total = sum(v['tris'] for v in REPORT.values())
    REPORT['_total_tris'] = total
    json.dump(REPORT, open(os.path.join(os.path.dirname(__file__), 'raid_report.json'), 'w'), indent=1)
    print('RAID', json.dumps(REPORT))
