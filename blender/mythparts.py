"""
Shared parts for the mythic bosses (Lv 350-1111) and the God skin: tubes between any two points, tori and
ray-discs facing any direction, blades, feathered and bat wings, flames, and extra keyframe helpers.
All coordinates are Decentraland metres (x right, y up, z forward = the way the boss faces).
"""
import math
from rig import *  # noqa


# ───────────── vector maths ─────────────
def add(a, b):
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def sub(a, b):
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def mul(a, k):
    return (a[0] * k, a[1] * k, a[2] * k)


def dot(a, b):
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def norm(a):
    ln = math.sqrt(dot(a, a)) or 1.0
    return (a[0] / ln, a[1] / ln, a[2] / ln)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t)


def basis(n):
    """two unit vectors u, w with u × w = n"""
    n = norm(n)
    ref = (0, 1, 0) if abs(n[1]) < 0.92 else (1, 0, 0)
    u = norm(cross(ref, n))
    w = cross(n, u)
    return u, w


# ───────────── shapes ─────────────
def tube(b, p0, p1, r0, r1, m, seg=8, caps=True, smooth=True):
    """tapered cylinder from p0 (radius r0) to p1 (radius r1)"""
    n = sub(p1, p0)
    u, w = basis(n)
    vs = []
    for p, r in ((p0, r0), (p1, r1)):
        for i in range(seg):
            a = 2 * math.pi * i / seg
            vs.append(add(p, add(mul(u, math.cos(a) * r), mul(w, math.sin(a) * r))))
    fs = [[i, (i + 1) % seg, seg + (i + 1) % seg, seg + i] for i in range(seg)]
    if caps:
        fs.append(list(range(seg))[::-1])
        if r1 > 0:
            fs.append(list(range(seg, 2 * seg)))
    b.faces(b.a(m), vs, fs, smooth)


def chain(b, pts, radii, m, seg=8):
    """a bent tube through several points (tails, tentacles, horns)"""
    for i in range(len(pts) - 1):
        tube(b, pts[i], pts[i + 1], radii[i], radii[i + 1], m, seg, caps=(i == 0 or i == len(pts) - 2))
        if 0 < i:
            b.sphere(pts[i][0], pts[i][1], pts[i][2], radii[i] * 1.02, m, max(6, seg), 4)


def cone(b, base, tip, r, m, seg=6):
    tube(b, base, tip, r, 0.0, m, seg, caps=True, smooth=False)


def torus(b, c, n, R, r, m, seg=24, sides=6):
    """ring of radius R (tube radius r) around axis n"""
    u, w = basis(n)
    n = norm(n)
    vs = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        d = add(mul(u, math.cos(a)), mul(w, math.sin(a)))
        for j in range(sides):
            t = 2 * math.pi * j / sides
            vs.append(add(c, add(mul(d, R + math.cos(t) * r), mul(n, math.sin(t) * r))))
    fs = []
    for i in range(seg):
        for j in range(sides):
            a0 = i * sides + j
            a1 = ((i + 1) % seg) * sides + j
            a2 = ((i + 1) % seg) * sides + (j + 1) % sides
            a3 = i * sides + (j + 1) % sides
            fs.append([a0, a1, a2, a3])
    b.faces(b.a(m), vs, fs, True)


def disc(b, c, n, R, m, seg=24, R0=0.0):
    """flat disc (or annulus from R0) facing n (both sides)"""
    u, w = basis(n)
    if R0 <= 0:
        vs = [c] + [add(c, add(mul(u, math.cos(2 * math.pi * i / seg) * R), mul(w, math.sin(2 * math.pi * i / seg) * R))) for i in range(seg)]
        fs = [[0, 1 + i, 1 + (i + 1) % seg] for i in range(seg)]
    else:
        vs = []
        for i in range(seg):
            a = 2 * math.pi * i / seg
            d = add(mul(u, math.cos(a)), mul(w, math.sin(a)))
            vs += [add(c, mul(d, R0)), add(c, mul(d, R))]
        fs = [[2 * i, 2 * ((i + 1) % seg), 2 * ((i + 1) % seg) + 1, 2 * i + 1] for i in range(seg)]
    b.faces(b.a(m), vs, fs + [f[::-1] for f in fs])


def rays(b, c, n, R0, R1, k, w, m, phase=0.0, alt=0.0):
    """k flat triangular rays between radius R0 and R1 in the plane facing n; every second ray R1*(1-alt)"""
    u, v = basis(n)
    for i in range(k):
        a = phase + 2 * math.pi * i / k
        d = add(mul(u, math.cos(a)), mul(v, math.sin(a)))
        side = add(mul(u, -math.sin(a)), mul(v, math.cos(a)))
        R = R1 * (1 - alt if i % 2 else 1)
        p0 = add(c, add(mul(d, R0), mul(side, w)))
        p1 = add(c, add(mul(d, R0), mul(side, -w)))
        tip = add(c, mul(d, R))
        b.faces(b.a(m), [p0, p1, tip], [[0, 1, 2], [2, 1, 0]])


def blade(b, p0, p1, w, t, m, tip=0.18, side=None):
    """flat sword blade from hilt p0 to tip p1: width w, thickness t; side = blade's flat-normal hint"""
    d = norm(sub(p1, p0))
    s = norm(cross(d, side or (0, 0, 1))) if abs(dot(d, norm(side or (0, 0, 1)))) < 0.95 else basis(d)[0]
    nrm = cross(s, d)
    L = math.sqrt(dot(sub(p1, p0), sub(p1, p0)))
    body = sub(p1, mul(d, L * tip))
    pts = []
    for p, ww in ((p0, w), (body, w), (p1, 0.0)):
        for sx, sz in ((1, 0), (0, 1), (-1, 0), (0, -1)):
            pts.append(add(p, add(mul(s, sx * ww / 2), mul(nrm, sz * t / 2))))
    fs = []
    for r in range(2):
        for i in range(4):
            a0, a1 = r * 4 + i, r * 4 + (i + 1) % 4
            fs.append([a0, a1, a1 + 4, a0 + 4])
    fs.append([3, 2, 1, 0])
    b.faces(b.a(m), pts, fs)


# ───────────── flames: textured cards (read as fire from any side, unlike solid cones) ─────────────
import numpy as np
from textures_hd import _rgba

_FIRE_TEX = {}


def _hexrgb(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def fire_tex(key, col, hot, soft=False, opacity=1.0):
    """teardrop flame (base at the bottom of the image, tip at the top); soft=True → smoky wisp"""
    k = (key, col, hot, soft, opacity)
    if k in _FIRE_TEX:
        return _FIRE_TEX[k]
    W, H = 96, 192
    yy, xx = np.mgrid[0:H, 0:W]
    y = (H - 1 - yy) / (H - 1)                      # 0 bottom … 1 top
    x = (xx + 0.5) / W * 2 - 1
    wv = np.where(y < 0.22, 0.95 * np.sqrt(np.clip(y / 0.22, 0, 1)), 0.95 * np.clip((1 - y) / 0.78, 0, 1) ** 1.25)
    wv = wv * (1 + 0.12 * np.sin(y * 17.0 + 1.3) + 0.06 * np.sin(y * 41.0))
    xs = x + 0.12 * np.sin(y * 9.0) * y             # a little sway towards the tip
    edge = 0.55 if soft else 0.32
    a = np.clip((wv - np.abs(xs)) / (edge * wv + 0.02), 0, 1) ** (1.6 if soft else 1.15)
    a *= np.clip(y / 0.06, 0, 1)
    core = np.clip((wv * 0.42 - np.abs(xs)) / (0.25 * wv + 0.01), 0, 1) * np.clip(1.15 - y * 1.25, 0, 1)
    c, ht = _hexrgb(col), _hexrgb(hot)
    rgb = c[None, None, :] * (1 - core[..., None]) + ht[None, None, :] * core[..., None]
    arr = np.concatenate([np.clip(rgb, 0, 1), (a * opacity)[..., None]], -1)
    path = _rgba(f'fire_{key}.png', arr)
    _FIRE_TEX[k] = path
    return path


def fire_mat(M, name, col, hot='#FFFFFF', strength=5.0, soft=False, opacity=1.0):
    return M.add(name, col, tex=fire_tex(name, col, hot, soft, opacity), emit_tex=True, strength=strength, tile=None)


def card(b, base, tip, w, m, n=2, roll=0.0, face=None):
    """n crossed textured quads from base to tip (texture v=0 at base, v=1 at tip); face = which way the first quad looks"""
    d = norm(sub(tip, base))
    u0, w0 = basis(d)
    if face is not None and abs(dot(d, norm(face))) < 0.97:
        u0 = norm(cross(d, face))
        w0 = cross(d, u0)
    for k in range(n):
        a = math.radians(roll) + math.pi * k / n
        sd = add(mul(u0, math.cos(a) * w / 2), mul(w0, math.sin(a) * w / 2))
        b.quad(sub(base, sd), add(base, sd), add(tip, sd), sub(tip, sd), m, uv=((0, 0), (1, 0), (1, 1), (0, 1)))


def flame(b, base, h, r, m, n=2, yaw0=0.0, lean=(0, 0, 0)):
    """a tongue of fire of height h (negative = hanging down) and half-width ~r, as crossed flame cards"""
    tip = add(add(base, (0, h, 0)), lean)
    card(b, base, tip, r * 2.6, m, n=max(2, n), roll=yaw0)


def feather_wing(b, root, s, span, lift, drop, back, memb, bone, feathers=7, glow=None, width=0.07):
    """feathered wing: a fan of feathers from the root; s = ±1 side; lift = how high the top feather climbs"""
    tips = []
    for k in range(feathers):
        t = k / (feathers - 1)
        a = math.radians(72 - t * 118)
        R = span * (0.5 + 0.5 * math.sin(t * math.pi * 0.85 + 0.35))
        tip = (root[0] + s * math.cos(a) * R, root[1] + math.sin(a) * R * lift - drop * t, root[2] - back * (0.25 + t))
        tips.append(tip)
        tube(b, root, tip, width * (1.3 - 0.6 * t), width * 0.35, bone, seg=5)
        if glow is not None:
            b.octa(tip[0], tip[1], tip[2], 0.1 * span / 4, 0.22 * span / 4, glow)
    vs = [root] + tips
    fs = [[0, i, i + 1] for i in range(1, len(vs) - 1)]
    b.faces(b.a(memb), vs, fs + [f[::-1] for f in fs])
    # a second, shorter layer of coverts for depth
    vs2 = [add(root, (0, 0, 0.05))] + [lerp(root, t, 0.55) for t in tips]
    b.faces(b.a(memb), vs2, fs + [f[::-1] for f in fs])
    return tips


def feather_blade(b, p0, p1, w, m, face=(0, 0, 1)):
    """one long feather: a leaf shape from quill p0 to tip p1, width w, lying across `face`"""
    d = sub(p1, p0)
    side = norm(cross(norm(d), norm(face)))
    pts = []
    for t, k in ((0.0, 0.12), (0.18, 0.42), (0.5, 0.5), (0.8, 0.4), (0.95, 0.18)):
        c = add(p0, mul(d, t))
        pts += [add(c, mul(side, -w * k)), add(c, mul(side, w * k))]
    pts.append(p1)
    fs = [[2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2] for i in range(4)] + [[8, 9, 10]]
    b.faces(b.a(m), pts, fs + [f[::-1] for f in fs])


def angel_wing(b, root, s, span, lift, back, feather, bone, prim=8, sec=6, glow=None, droop=1.0, thick=0.05):
    """spread angel wing: arm bones along the leading edge, primaries fanning from the hand,
    secondaries hanging from the forearm, coverts layered on top. s = ±1 side."""
    el = add(root, (s * span * 0.3, span * 0.22 * lift, -back * 0.25))
    wr = add(root, (s * span * 0.6, span * 0.45 * lift, -back * 0.5))
    tip = add(root, (s * span * 0.95, span * 0.62 * lift, -back * 0.8))
    for p0, p1, r in ((root, el, thick * 1.4), (el, wr, thick), (wr, tip, thick * 0.6)):
        tube(b, p0, p1, r, r * 0.8, bone, 6)
    face = (0, 0.15, 1)
    for i in range(prim):
        t = i / (prim - 1)
        base = lerp(tip, wr, t * 0.9)
        a = math.radians(25 - t * (95 + 25 * droop))
        dvec = (s * math.cos(a), math.sin(a), -0.12)
        L = span * (0.5 - 0.14 * t)
        feather_blade(b, base, add(base, mul(norm(dvec), L)), span * 0.11, feather, face)
        if glow is not None and i % 2 == 0:
            q = add(base, mul(norm(dvec), L))
            b.octa(q[0], q[1], q[2], span * 0.02, span * 0.04, glow)
    for i in range(sec):
        t = i / max(1, sec - 1)
        base = lerp(wr, root, 0.1 + t * 0.8)
        dvec = (s * (0.35 - 0.25 * t), -1, -0.08)
        L = span * (0.36 - 0.06 * t) * droop
        feather_blade(b, base, add(base, mul(norm(dvec), L)), span * 0.12, feather, face)
    for i in range(sec + 2):
        t = i / (sec + 1)
        base = add(lerp(tip, root, 0.12 + t * 0.85), (0, 0, 0.04))
        dvec = (s * (0.5 - 0.3 * t), -1, -0.05)
        feather_blade(b, base, add(base, mul(norm(dvec), span * 0.17)), span * 0.1, feather, face)
    return tip


def bat_wing(b, root, s, span, up, down, back, memb, bone, fingers=4, r=0.09, claw=None):
    """membrane wing: arm to a wrist, fingers fanning out, membrane between them"""
    el = (root[0] + s * span * 0.32, root[1] + up * 0.55, root[2] - back * 0.25)
    wr = (root[0] + s * span * 0.55, root[1] + up, root[2] - back * 0.45)
    tube(b, root, el, r * 1.3, r, bone, 6)
    tube(b, el, wr, r, r * 0.85, bone, 6)
    tips = []
    for k in range(fingers):
        t = k / (fingers - 1)
        a = math.radians(40 - t * 120)
        L = span * (0.62 - 0.22 * t)
        tip = (wr[0] + s * math.cos(a) * L, wr[1] + math.sin(a) * L - down * t, wr[2] - back * (0.5 + 0.4 * t))
        tips.append(tip)
        tube(b, wr, tip, r * 0.7, r * 0.2, bone, 5)
    if claw is not None:
        cone(b, wr, add(wr, (s * 0.1, 0.5, 0.15)), r * 0.9, claw, seg=4)
    body = (root[0] + s * 0.15, root[1] - down * 0.9, root[2] - back * 0.2)
    pts = [root, el, wr] + tips + [body]
    fs = [[0, 1, 2]]
    for i in range(2, len(pts) - 1):
        fs.append([0, i, i + 1])
    # scalloped trailing edge: small dips between the fingers
    b.faces(b.a(memb), pts, fs + [f[::-1] for f in fs])
    return wr, tips


def eye(b, c, n, R, sclera, iris, pupil):
    """an eye looking along n"""
    b.sphere(c[0], c[1], c[2], R, sclera, 10, 6)
    nn = norm(n)
    disc(b, add(c, mul(nn, R * 0.97)), nn, R * 0.55, iris, seg=12)
    disc(b, add(c, mul(nn, R * 1.0)), nn, R * 0.24, pupil, seg=10)


def gear(b, c, n, R, w, teeth, m, tooth=None):
    """flat cog: a short cylinder ring with teeth"""
    tooth = tooth or R * 0.18
    torus(b, c, n, R - tooth * 0.4, tooth * 0.55, m, seg=max(16, teeth * 2), sides=4)
    u, v = basis(n)
    for i in range(teeth):
        a = 2 * math.pi * i / teeth
        d = add(mul(u, math.cos(a)), mul(v, math.sin(a)))
        p = add(c, mul(d, R + tooth * 0.3))
        tube(b, sub(p, mul(norm(n), w / 2)), add(p, mul(norm(n), w / 2)), tooth * 0.55, tooth * 0.55, m, seg=4)
    for k in range(3):
        a = 2 * math.pi * k / 3
        d = add(mul(u, math.cos(a)), mul(v, math.sin(a)))
        tube(b, c, add(c, mul(d, R - tooth * 0.5)), tooth * 0.3, tooth * 0.3, m, seg=4)


def zigzag(b, p0, p1, n, amp, r, m, seed=1):
    """a lightning bolt between two points"""
    import random
    rnd = random.Random(seed)
    d = sub(p1, p0)
    u, w = basis(d)
    pts = [p0]
    for i in range(1, n):
        t = i / n
        off = add(mul(u, (rnd.random() - 0.5) * 2 * amp), mul(w, (rnd.random() - 0.5) * 2 * amp))
        pts.append(add(lerp(p0, p1, t), off))
    pts.append(p1)
    for i in range(len(pts) - 1):
        tube(b, pts[i], pts[i + 1], r, r * 0.8, m, seg=4)


# ───────────── animation helpers ─────────────
def key_scale(obj, frames_s):
    """uniform scale keys: [(frame, s)] or [(frame, (sx, sy, sz))] in DCL axes"""
    obj.rotation_mode = 'XYZ'
    for f, s in frames_s:
        if isinstance(s, (int, float)):
            obj.scale = (s, s, s)
        else:
            sx, sy, sz = s
            obj.scale = (sx, sz, sy)   # DCL x→B X, DCL z→B Y, DCL y→B Z (sign-free for scale)
        obj.keyframe_insert('scale', frame=f)


def key_rot3(obj, frames):
    """[(frame, (rx, ry, rz))] degrees about DCL axes, combined"""
    obj.rotation_mode = 'XYZ'
    for f, (rx, ry, rz) in frames:
        # DCL x → Blender -X, DCL y → Blender Z, DCL z → Blender -Y
        obj.rotation_euler = (math.radians(-rx), math.radians(-rz), math.radians(ry))
        obj.keyframe_insert('rotation_euler', frame=f)


def spin(obj, axis='y', turns=1, sign=1):
    """continuous rotation over the 25-frame loop (seamless)"""
    key_rot(obj, axis, [(1, 0), (7, sign * 90 * turns), (13, sign * 180 * turns), (19, sign * 270 * turns), (25, sign * 360 * turns)])
    linear(obj)


def sway(obj, axis, amp, phase=0, base=0.0):
    """smooth back-and-forth (cosine) around a DCL axis; phase in frames (0-24); seamless over the loop"""
    key_rot(obj, axis, [(k, base + amp * math.cos(2 * math.pi * (k - 1 + phase) / 24)) for k in (1, 4, 7, 10, 13, 16, 19, 22, 25)])


def bob(obj, amp, phase=0):
    key_loc(obj, [(k, amp * math.sin(2 * math.pi * (k - 1 + phase) / 24)) for k in (1, 4, 7, 10, 13, 16, 19, 22, 25)])


def pulse(obj, lo, hi, phase=0):
    key_scale(obj, [(k, lo + (hi - lo) * (0.5 + 0.5 * math.sin(2 * math.pi * (k - 1 + phase) / 24))) for k in (1, 4, 7, 10, 13, 16, 19, 22, 25)])
