"""
WOW NIGHTSWARM — original creature bosses (Blender / bpy). Not based on any existing franchise.
Origin at the feet, facing +z, looping clip "Idle".
  boss_fox     — VOLTKIT, the Storm Kitsune: lightning fox with five spark-tipped tails
  boss_hound   — EMBERFANG: hellhound with a burning mane
  boss_toad    — SPORELORD: giant toad carrying a glowing mushroom grove
  boss_golem   — PRISMHORN: crystal colossus with a beating core
  boss_moth    — LUMORA, the Moth Queen: four eye-spotted wings that glow
  boss_turtle  — MAGMASHELL: tortoise with a live volcano for a shell
Run: python3 blender/build_creatures.py → models/boss_*.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from rig import *  # noqa


def cone(b, base, tip, r, m, seg=6):
    bx, by, bz = base
    tx, ty, tz = tip
    ax, ay, az = tx - bx, ty - by, tz - bz
    ln = math.sqrt(ax * ax + ay * ay + az * az) or 1
    ax, ay, az = ax / ln, ay / ln, az / ln
    ux, uy, uz = (0, 1, 0) if abs(ay) < 0.9 else (1, 0, 0)
    px, py, pz = ay * uz - az * uy, az * ux - ax * uz, ax * uy - ay * ux
    pl = math.sqrt(px * px + py * py + pz * pz)
    px, py, pz = px / pl, py / pl, pz / pl
    qx, qy, qz = ay * pz - az * py, az * px - ax * pz, ax * py - ay * px
    vs = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a) * r, math.sin(a) * r
        vs.append((bx + px * c + qx * s, by + py * c + qy * s, bz + pz * c + qz * s))
    vs.append(tip)
    fs = [[i, (i + 1) % seg, seg] for i in range(seg)] + [list(range(seg))[::-1]]
    b.faces(b.a(m), vs, fs)


def limb(b, p0, p1, r, m):
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    ln = math.sqrt(dx * dx + dy * dy + dz * dz)
    yaw = math.degrees(math.atan2(dx, dz))
    pitch = -math.degrees(math.atan2(dy, math.hypot(dx, dz)))
    b.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, r, r, ln, m, yaw=yaw, pitch=pitch)


def quad_legs(b, M, body, hip_y, xs, zs, foot, claw=None, thick=0.34):
    """four legs: xs = (left/right offset), zs = (rear z, front z)"""
    for sx in (-1, 1):
        for z in zs:
            x = sx * xs
            b.sphere(x, hip_y, z, thick * 1.4, body, 8, 5)
            knee = (x * 1.12, hip_y * 0.45, z + 0.15)
            limb(b, (x, hip_y, z), knee, thick, body)
            limb(b, knee, (x * 1.12, 0.12, z + 0.3), thick * 0.8, body)
            b.box(x * 1.12, 0.09, z + 0.45, thick * 1.6, 0.18, thick * 2.0, foot)
            if claw:
                for c in (-1, 0, 1):
                    cone(b, (x * 1.12 + c * thick * 0.45, 0.1, z + 0.45 + thick), (x * 1.12 + c * thick * 0.5, 0.02, z + 0.45 + thick * 1.8), 0.05, claw, seg=4)


# ───────────────────────── VOLTKIT — storm kitsune ─────────────────────────
def fox():
    name = 'boss_fox'
    M = new_scene()
    FUR = skin(M, 'fox_fur', '#F4E9C8', 0.85, seed=11, scale=0.8, contrast=0.35)
    DARK = skin(M, 'fox_dark', '#2A2E44', 0.8, seed=12, scale=0.8, contrast=0.3)
    GL = glowmat(M, 'fox_spark', '#5EF2FF', 7.0)
    EY = glowmat(M, 'fox_eye', '#FFE45A', 10.0)
    shadow(M, 2.4)
    b = Builder(M)
    b.sphere(0, 1.9, 0, 0.95, FUR, 12, 7, ry=0.85, rz=1.7)          # body
    b.sphere(0, 1.75, 0.5, 0.8, FUR, 10, 6, ry=0.75, rz=1.0)        # chest ruff
    for k in range(6):                                              # lightning crest along the spine
        z = -1.2 + k * 0.45
        cone(b, (0, 2.6, z), (0, 3.2 - abs(k - 2.5) * 0.08, z - 0.35), 0.12, GL, seg=4)
    quad_legs(b, M, FUR, 1.5, 0.55, (-1.0, 0.95), DARK, claw=GL, thick=0.26)
    torso = b.emit(f'{name}_torso')
    # head
    hb = Builder(M)
    hb.sphere(0, 2.75, 1.75, 0.6, FUR, 10, 6, ry=0.55, rz=0.62)
    cone(hb, (0, 2.62, 2.15), (0, 2.5, 3.05), 0.32, FUR, seg=8)     # snout
    hb.sphere(0, 2.5, 3.0, 0.08, DARK, 6, 4)                        # nose
    for s in (-1, 1):
        cone(hb, (s * 0.32, 3.1, 1.65), (s * 0.62, 4.05, 1.45), 0.22, FUR, seg=4)   # ears
        cone(hb, (s * 0.34, 3.12, 1.7), (s * 0.6, 3.85, 1.52), 0.12, GL, seg=4)
        hb.sphere(s * 0.26, 2.9, 2.2, 0.1, EY, 6, 4, ry=0.07)
        cone(hb, (s * 0.45, 2.55, 1.9), (s * 0.95, 2.35, 1.6), 0.08, FUR, seg=4)    # cheek fluff
    head = hb.emit(f'{name}_head')
    hpv = pivot(f'{name}_headpv', (0, 2.5, 1.3), head)
    key_rot(hpv, 'y', [(1, -10), (13, 10), (25, -10)])
    parts = list(torso) + [hpv]
    # five tails fanning behind, each swishing with its own phase
    for i in range(5):
        a = math.radians(-60 + i * 30)
        tb = Builder(M)
        pts = []
        for k in range(1, 7):
            t = k / 6
            pts.append((math.sin(a) * 2.2 * t, 2.2 + math.sin(t * math.pi) * 1.4 + t * 0.6, -1.4 - math.cos(a) * 1.9 * t))
        for k, p in enumerate(pts):
            tb.sphere(p[0], p[1], p[2], 0.42 - k * 0.04, FUR, 8, 5)
        tip = pts[-1]
        tb.sphere(tip[0], tip[1] + 0.1, tip[2] - 0.2, 0.32, GL, 8, 5)
        cone(tb, (tip[0], tip[1] + 0.2, tip[2] - 0.3), (tip[0], tip[1] + 0.9, tip[2] - 0.6), 0.14, GL, seg=4)
        tobj = tb.emit(f'{name}_tail{i}')
        tpv = pivot(f'{name}_tailpv{i}', (0, 2.2, -1.4), tobj)
        ph = i * 2
        key_rot(tpv, 'y', [(1, -12), (13 - ph // 2, 12), (25, -12)] if i % 2 else [(1, 12), (13 + ph // 2, -12), (25, 12)])
        parts.append(tpv)
    # crackling ring under the paws
    rb = Builder(M)
    for k in range(10):
        aa = 2 * math.pi * k / 10
        rb.octa(math.cos(aa) * 2.6, 0.5 + (k % 2) * 0.4, math.sin(aa) * 2.6, 0.12, 0.35, GL)
    robj = rb.emit(f'{name}_sparks')
    rpv = pivot(f'{name}_sparkpv', (0, 0.5, 0), robj)
    key_rot(rpv, 'y', [(1, 0), (13, 180), (25, 360)])
    linear(rpv)
    parts.append(rpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, 0.12), (25, 0)])
    finish(name)


# ───────────────────────── EMBERFANG — hellhound ─────────────────────────
def hound():
    name = 'boss_hound'
    M = new_scene()
    HIDE = skin(M, 'hound_hide', '#1C1210', 0.75, seed=21, scale=0.8, contrast=0.5)
    LAVA = M.add('hound_lava', '#FF5A0A', 0.0, 0.5, '#FF4A00', 3.0)
    FL = glowmat(M, 'hound_flame', '#FFB020', 6.0)
    EY = glowmat(M, 'hound_eye', '#FF2A00', 10.0)
    BONE = M.add('hound_bone', '#E8DFC8', 0.0, 0.4)
    shadow(M, 2.6)
    b = Builder(M)
    b.sphere(0, 2.0, -0.2, 1.0, HIDE, 12, 7, ry=0.9, rz=1.9)
    b.sphere(0, 1.75, 0.1, 0.7, LAVA, 10, 6, ry=0.5, rz=1.5)              # molten belly showing through
    for k in range(5):                                                   # ribs cracks
        b.box(0, 1.45, -1.0 + k * 0.45, 1.2, 0.06, 0.1, LAVA)
    quad_legs(b, M, HIDE, 1.6, 0.6, (-1.25, 1.0), HIDE, claw=BONE, thick=0.3)
    torso = b.emit(f'{name}_torso')
    # burning mane
    mb = Builder(M)
    for k in range(14):
        a = math.radians(-90 + k * (180 / 13))
        base = (math.sin(a) * 0.75, 2.7 + math.cos(a) * 0.2, 1.1)
        cone(mb, base, (base[0] * 1.6, base[1] + 1.0 + (k % 3) * 0.25, 0.6), 0.2, FL if k % 2 else LAVA, seg=4)
    mobj = mb.emit(f'{name}_mane')
    mpv = pivot(f'{name}_manepv', (0, 2.7, 1.0), mobj)
    key_loc(mpv, [(1, 0), (7, 0.12), (13, 0), (19, 0.12), (25, 0)])
    # head
    hb = Builder(M)
    hb.sphere(0, 2.9, 1.9, 0.62, HIDE, 10, 6, ry=0.55, rz=0.7)
    hb.box(0, 2.72, 2.6, 0.62, 0.42, 0.9, HIDE)
    hb.box(0, 2.48, 2.55, 0.52, 0.1, 0.8, LAVA)                          # mouth glow
    for s in (-1, 1):
        hb.sphere(s * 0.28, 3.05, 2.35, 0.1, EY, 6, 4)
        cone(hb, (s * 0.3, 3.35, 1.8), (s * 0.85, 4.2, 1.2), 0.15, BONE, seg=5)   # horns
        cone(hb, (s * 0.22, 2.5, 2.95), (s * 0.22, 2.2, 3.0), 0.06, BONE, seg=3)  # fangs
    head = hb.emit(f'{name}_head')
    hpv = pivot(f'{name}_headpv', (0, 2.6, 1.3), head)
    key_rot(hpv, 'x', [(1, 0), (6, 8), (12, -3), (25, 0)])
    # flaming tail
    tb = Builder(M)
    for k in range(1, 7):
        tb.sphere(0, 2.3 + k * 0.12, -2.0 - k * 0.45, 0.28 - k * 0.025, HIDE, 8, 5)
    cone(tb, (0, 3.0, -4.6), (0, 4.0, -5.2), 0.35, FL, seg=6)
    tobj = tb.emit(f'{name}_tail')
    tpv = pivot(f'{name}_tailpv', (0, 2.3, -1.9), tobj)
    key_rot(tpv, 'y', [(1, -18), (13, 18), (25, -18)])
    root = pivot(name, (0, 0, 0), list(torso) + [mpv, hpv, tpv])
    key_loc(root, [(1, 0), (13, 0.1), (25, 0)])
    finish(name)


# ───────────────────────── SPORELORD — mushroom toad ─────────────────────────
def toad():
    name = 'boss_toad'
    M = new_scene()
    SK = skin(M, 'toad_skin', '#4E7A3A', 0.7, seed=31, scale=0.9, contrast=0.55)
    BEL = M.add('toad_belly', '#D9D2A0', 0.0, 0.7)
    CAP = skin(M, 'toad_cap', '#C02A3A', 0.6, seed=32, scale=0.6, contrast=0.3)
    SPOT = M.add('toad_spot', '#FFF3D8', 0.0, 0.6, '#FFE9A8', 0.8)
    GLO = glowmat(M, 'toad_glow', '#9DFF5A', 5.0)
    EY = glowmat(M, 'toad_eye', '#FFD000', 9.0)
    STEM = M.add('toad_stem', '#EDE3C8', 0.0, 0.7)
    shadow(M, 3.0)
    b = Builder(M)
    b.sphere(0, 1.6, 0, 2.0, SK, 14, 8, ry=1.4, rz=2.0)
    b.sphere(0, 1.1, 0.7, 1.5, BEL, 12, 6, ry=0.9, rz=1.4)
    for sx in (-1, 1):  # big folded hind legs + front arms
        b.sphere(sx * 1.7, 0.9, -0.8, 0.9, SK, 10, 6, ry=0.7, rz=1.2)
        b.box(sx * 1.9, 0.12, 0.1, 0.9, 0.22, 1.2, SK)
        limb(b, (sx * 1.3, 1.2, 1.2), (sx * 1.5, 0.15, 1.8), 0.35, SK)
        b.box(sx * 1.5, 0.1, 2.0, 0.7, 0.18, 0.6, SK)
    # warts
    for k in range(16):
        a = 2.4 * k
        b.sphere(math.cos(a) * 1.6, 1.9 + math.sin(k) * 0.5, math.sin(a) * 1.4 - 0.2, 0.16, GLO if k % 4 == 0 else SK, 6, 4)
    # mushroom grove on the back
    for (x, z, h, r) in [(0, -0.6, 2.2, 1.3), (-1.1, 0.0, 1.4, 0.75), (1.1, -0.2, 1.6, 0.85), (0.4, -1.5, 1.2, 0.6), (-0.6, -1.4, 1.0, 0.5)]:
        b.cyl(x, 2.6, z, r * 0.22, h, STEM, seg=10)
        b.sphere(x, 2.6 + h, z, r, CAP, 12, 6, ry=r * 0.55)
        b.sphere(x, 2.6 + h - r * 0.12, z, r * 0.9, GLO, 10, 3, ry=r * 0.12)   # glowing gills
        for k in range(5):
            aa = 2 * math.pi * k / 5 + x
            b.sphere(x + math.cos(aa) * r * 0.6, 2.6 + h + r * 0.35, z + math.sin(aa) * r * 0.6, r * 0.13, SPOT, 6, 4, ry=r * 0.06)
    torso = b.emit(f'{name}_body')
    # head with wide mouth (jaw drops)
    hb = Builder(M)
    for s in (-1, 1):
        hb.sphere(s * 0.85, 3.0, 1.35, 0.42, SK, 8, 6)
        hb.sphere(s * 0.85, 3.05, 1.65, 0.24, EY, 8, 5)
        hb.sphere(s * 0.85, 3.05, 1.86, 0.1, M.add('toad_pupil', '#120A00', 0.0, 0.3), 6, 4, ry=0.16)
    head = hb.emit(f'{name}_eyes')
    jb = Builder(M)
    jb.sphere(0, 1.6, 1.6, 1.3, BEL, 12, 5, ry=0.45, rz=0.6)
    jb.box(0, 1.85, 2.05, 2.0, 0.06, 0.3, M.add('toad_mouth', '#3A0A14', 0.0, 0.5))
    jaw = jb.emit(f'{name}_throat')
    jpv = pivot(f'{name}_throatpv', (0, 1.9, 1.2), jaw)
    key_rot(jpv, 'x', [(1, 0), (10, 10), (14, 2), (25, 0)])
    root = pivot(name, (0, 0, 0), list(torso) + head + [jpv])
    root.scale = (1.0, 1.0, 1.0)
    key_loc(root, [(1, 0), (6, 0.05), (10, 0.35), (14, 0), (25, 0)])
    finish(name)


# ───────────────────────── PRISMHORN — crystal colossus ─────────────────────────
def golem():
    name = 'boss_golem'
    M = new_scene()
    ST = skin(M, 'golem_stone', '#5A5F6E', 0.9, seed=41, scale=0.7, contrast=0.6)
    CR = M.add('golem_crystal', '#7AF0FF', 0.2, 0.05, '#3FD8FF', 3.5, alpha=0.85)
    CR2 = M.add('golem_crystal2', '#D69BFF', 0.2, 0.05, '#B05BFF', 3.5, alpha=0.85)
    CORE = glowmat(M, 'golem_core', '#E8FBFF', 9.0)
    EY = glowmat(M, 'golem_eye', '#7AF0FF', 10.0)
    shadow(M, 2.8)
    b = Builder(M)
    for sx in (-1, 1):                                                      # legs
        b.box(sx * 0.7, 0.9, 0, 0.9, 1.8, 0.95, ST, roll=sx * 4)
        b.box(sx * 0.75, 0.18, 0.15, 1.15, 0.36, 1.3, ST)
    b.box(0, 2.1, 0, 2.0, 0.8, 1.3, ST)                                     # hips
    torso = b.emit(f'{name}_legs')
    ub = Builder(M)
    ub.box(0, 3.4, 0, 2.6, 2.0, 1.7, ST, pitch=-6)
    ub.box(0, 4.5, 0.1, 3.2, 0.8, 1.6, ST)                                  # shoulders
    ub.octa(0, 3.5, 0.9, 0.45, 0.6, CORE)                                   # core
    ub.ring(0, 3.2, 0.86, 0.5, 0.7, 0.6, CR, seg=8)
    ub.box(0, 5.25, 0.3, 1.0, 0.8, 0.9, ST)                                 # head
    for s in (-1, 1):
        ub.box(s * 0.24, 5.3, 0.77, 0.22, 0.1, 0.05, EY)
    for (x, y, z, h, c) in [(0, 6.0, 0.1, 1.6, CR), (-0.9, 5.2, -0.3, 1.4, CR2), (0.9, 5.1, -0.2, 1.5, CR), (-1.5, 4.9, 0, 1.0, CR), (1.5, 4.9, 0, 1.1, CR2),
                            (0.4, 4.4, -0.8, 1.6, CR2), (-0.5, 4.3, -0.85, 1.3, CR), (0, 3.4, -0.9, 1.2, CR)]:
        ub.octa(x, y + h * 0.4, z - 0.1, h * 0.22, h * 0.8, c)
    upper = ub.emit(f'{name}_upper')
    arms = []
    for s in (-1, 1):
        ab = Builder(M)
        ab.box(s * 1.9, 3.9, 0, 0.95, 1.4, 0.95, ST)
        ab.box(s * 2.0, 2.6, 0.15, 0.85, 1.4, 0.85, ST)
        ab.box(s * 2.05, 1.6, 0.25, 1.25, 1.0, 1.2, ST)                     # fist
        ab.octa(s * 2.05, 2.4, 0.25, 0.3, 0.8, CR if s > 0 else CR2)
        aobj = ab.emit(f'{name}_arm{s}')
        apv = pivot(f'{name}_armpv{s}', (s * 1.9, 4.4, 0), aobj)
        key_rot(apv, 'x', [(1, 10 * s), (13, -10 * s), (25, 10 * s)])
        arms.append(apv)
    upv = pivot(f'{name}_upperpv', (0, 2.4, 0), upper + arms)
    key_rot(upv, 'y', [(1, -6), (13, 6), (25, -6)])
    root = pivot(name, (0, 0, 0), list(torso) + [upv])
    key_loc(root, [(1, 0), (13, 0.08), (25, 0)])
    finish(name)


# ───────────────────────── LUMORA — moth queen ─────────────────────────
def moth():
    name = 'boss_moth'
    M = new_scene()
    FUZ = skin(M, 'moth_fuzz', '#E8D8B0', 0.95, seed=51, scale=1.0, contrast=0.4)
    DARK = skin(M, 'moth_dark', '#3A2A4A', 0.9, seed=52, scale=0.8, contrast=0.4)
    WING = M.add('moth_wing', '#6A3AAA', 0.0, 0.6, '#5A2ADA', 1.0, alpha=0.9)
    SPOT = glowmat(M, 'moth_spot', '#FFD86A', 7.0)
    SPOT2 = glowmat(M, 'moth_spot2', '#5EF2FF', 7.0)
    EY = glowmat(M, 'moth_eye', '#FF4FD2', 9.0)
    shadow(M, 2.6)
    # body hovers at y≈3
    b = Builder(M)
    b.sphere(0, 3.2, 0.6, 0.62, FUZ, 10, 6)                                 # thorax
    b.sphere(0, 3.0, -0.6, 0.55, DARK, 10, 6, ry=0.6, rz=1.2)             # abdomen
    for k in range(4):
        b.ring(0, 2.95 - 0.05, -0.2 - k * 0.38, 0.4 - k * 0.06, 0.6 - k * 0.07, 0.1, FUZ, seg=12)
    b.sphere(0, 3.4, 1.3, 0.45, FUZ, 10, 6)                                 # head
    for s in (-1, 1):
        b.sphere(s * 0.27, 3.5, 1.55, 0.2, EY, 8, 5)
        # feathered antennae
        limb(b, (s * 0.15, 3.8, 1.4), (s * 0.7, 4.8, 1.9), 0.05, DARK)
        for k in range(5):
            t = k / 4
            p = (s * (0.15 + 0.55 * t), 3.8 + t, 1.4 + 0.5 * t)
            cone(b, p, (p[0] + s * 0.25, p[1] + 0.1, p[2] + 0.15), 0.04, FUZ, seg=3)
        for k in range(3):                                                  # dangling legs
            limb(b, (s * 0.3, 3.0, 0.8 - k * 0.3), (s * 0.6, 2.2, 1.0 - k * 0.35), 0.07, DARK)
    body = b.emit(f'{name}_body')
    parts = list(body)
    # four wings
    for (wi, sz, wz, yoff, spot) in [(0, 1.0, 0.8, 0.0, SPOT), (1, 0.75, -0.1, -0.25, SPOT2)]:
        for s in (-1, 1):
            wb = Builder(M)
            root = (s * 0.4, 3.3 + yoff, wz)
            pts = [root]
            for k in range(9):
                a = math.radians(-20 + k * 22) if wi == 0 else math.radians(-60 + k * 18)
                R = (3.4 if wi == 0 else 2.6) * sz * (0.75 + 0.25 * math.sin(k / 8 * math.pi))
                pts.append((s * (0.4 + math.cos(a) * R), 3.3 + yoff + math.sin(a) * R * 0.75, wz - 0.25 * k * sz))
            fs = [[0, i, i + 1] if s > 0 else [0, i + 1, i] for i in range(1, len(pts) - 1)]
            wb.faces(wb.a(WING), pts, fs)
            # eye-spot on the wing (both faces)
            c = pts[5]
            cx, cy, cz = root[0] + (c[0] - root[0]) * 0.6, root[1] + (c[1] - root[1]) * 0.6, root[2] + (c[2] - root[2]) * 0.6
            wb.sphere(cx, cy, cz, 0.42 * sz, spot, 10, 6, ry=0.42 * sz, rz=0.06)
            wb.sphere(cx, cy, cz, 0.2 * sz, DARK, 8, 5, ry=0.2 * sz, rz=0.08)
            wobj = wb.emit(f'{name}_wing{wi}{s}')
            wpv = pivot(f'{name}_wingpv{wi}{s}', root, wobj)
            amp = 32 if wi == 0 else 26
            key_rot(wpv, 'z', [(1, s * amp), (7 + wi, -s * amp * 0.7), (13, s * amp), (19 + wi, -s * amp * 0.7), (25, s * amp)])
            parts.append(wpv)
    # glowing dust ring
    db = Builder(M)
    for k in range(12):
        a = 2 * math.pi * k / 12
        db.octa(math.cos(a) * 3.0, 1.0 + (k % 3) * 0.5, math.sin(a) * 3.0, 0.1, 0.22, SPOT if k % 2 else SPOT2)
    dobj = db.emit(f'{name}_dust')
    dpv = pivot(f'{name}_dustpv', (0, 1, 0), dobj)
    key_rot(dpv, 'y', [(1, 0), (13, -180), (25, -360)])
    linear(dpv)
    parts.append(dpv)
    rootp = pivot(name, (0, 0, 0), parts)
    key_loc(rootp, [(1, 0), (13, 0.45), (25, 0)])
    finish(name)


# ───────────────────────── MAGMASHELL — volcano tortoise ─────────────────────────
def turtle():
    name = 'boss_turtle'
    M = new_scene()
    SK = skin(M, 'turtle_skin', '#5A4A3A', 0.85, seed=61, scale=0.9, contrast=0.5)
    ROCK = skin(M, 'turtle_rock', '#2A2420', 0.95, seed=62, scale=0.6, contrast=0.6)
    LAVA = M.add('turtle_lava', '#FF6A1A', 0.0, 0.4, '#FF4A00', 4.0)
    GL = glowmat(M, 'turtle_glow', '#FFC24A', 8.0)
    EY = glowmat(M, 'turtle_eye', '#FF8A00', 9.0)
    shadow(M, 3.4)
    b = Builder(M)
    b.sphere(0, 1.5, 0, 2.6, ROCK, 14, 7, ry=1.4, rz=2.9)                  # shell dome
    b.cyl(0, 0.6, 0, 2.75, 0.5, SK, seg=16)                                 # rim
    for k in range(10):                                                     # lava cracks
        a = 2 * math.pi * k / 10
        b.box(math.cos(a) * 1.7, 2.35, math.sin(a) * 1.9, 0.14, 0.08, 1.6, LAVA, yaw=-math.degrees(a) + 90)
    b.cyl(0, 2.5, 0, 1.2, 1.4, ROCK, seg=12, r_top=0.7)                     # volcano cone
    b.cyl(0, 3.85, 0, 0.62, 0.08, LAVA, seg=12)                             # crater lava
    quad_legs(b, M, SK, 0.9, 1.9, (-1.6, 1.6), SK, claw=ROCK, thick=0.45)
    body = b.emit(f'{name}_body')
    # erupting plume
    pb = Builder(M)
    for k in range(6):
        pb.octa(math.sin(k * 2.1) * 0.35, 4.2 + k * 0.4, math.cos(k * 2.1) * 0.35, 0.25 - k * 0.02, 0.4, GL if k % 2 else LAVA)
    plume = pb.emit(f'{name}_plume')
    ppv = pivot(f'{name}_plumepv', (0, 3.9, 0), plume)
    key_rot(ppv, 'y', [(1, 0), (13, 180), (25, 360)])
    linear(ppv)
    key_loc(ppv, [(1, 0), (7, 0.5), (13, 0), (19, 0.5), (25, 0)])
    # head on a long neck
    hb = Builder(M)
    for k in range(4):
        hb.sphere(0, 1.2 + k * 0.12, 2.8 + k * 0.32, 0.55 - k * 0.03, SK, 10, 6)
    hb.sphere(0, 1.75, 4.15, 0.62, SK, 10, 6, ry=0.5, rz=0.75)
    cone(hb, (0, 1.6, 4.7), (0, 1.35, 5.1), 0.3, ROCK, seg=6)              # beak
    for s in (-1, 1):
        hb.sphere(s * 0.38, 1.95, 4.4, 0.11, EY, 6, 4)
        cone(hb, (s * 0.35, 2.15, 3.95), (s * 0.7, 2.6, 3.5), 0.1, ROCK, seg=4)
    head = hb.emit(f'{name}_head')
    hpv = pivot(f'{name}_headpv', (0, 1.2, 2.6), head)
    key_rot(hpv, 'y', [(1, -12), (13, 12), (25, -12)])
    root = pivot(name, (0, 0, 0), list(body) + [ppv, hpv])
    key_loc(root, [(1, 0), (13, 0.06), (25, 0)])
    finish(name)


for fn in (fox, hound, toad, golem, moth, turtle):
    fn()
print('CREATURES', json.dumps(REPORT))
json.dump(REPORT, open(os.path.join(ROOT, 'blender', 'creatures_report.json'), 'w'), indent=1)
