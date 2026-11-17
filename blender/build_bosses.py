"""
WOW NIGHTSWARM — dragon bosses (Blender / bpy).
One procedural dragon rig, four variants. Origin at the feet, facing +z, looping clip "Idle"
(wing beats, neck sway, jaw, tail swish, breathing).
  dragon_bone  — Ossuary Drake: bleached bones, spectral cyan wings, soul core in the ribcage
  dragon_fire  — Cinderwing: obsidian scales, molten belly, ember wings
  dragon_void  — Voidmaw: star-black hide, magenta rifts, orbiting void crystals
  dragon_wyrm  — NIGHTSWARM, the World Eater: three heads, four wings, gold armour, crown
Run: python3 blender/build_bosses.py → models/dragon_*.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from rig import *  # noqa


def cone(b, base, tip, r, m, seg=6):
    """cone from base point to tip point (DCL coords)"""
    bx, by, bz = base
    tx, ty, tz = tip
    ax, ay, az = tx - bx, ty - by, tz - bz
    ln = math.sqrt(ax * ax + ay * ay + az * az) or 1
    ax, ay, az = ax / ln, ay / ln, az / ln
    # any perpendicular basis
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
    """stretched box between two points (bones / leg segments)"""
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    ln = math.sqrt(dx * dx + dy * dy + dz * dz)
    yaw = math.degrees(math.atan2(dx, dz))
    pitch = -math.degrees(math.atan2(dy, math.hypot(dx, dz)))
    b.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, r, r, ln, m, yaw=yaw, pitch=pitch)


V = {
    'bone': dict(scale='#D8D0BC', belly='#1A1A22', horn='#EDE6D2', memb='#3FE6FF', memb_emit='#20C8FF', memb_a=0.45, eye='#3FE6FF',
                 belly_emit=None, glow='#3FE6FF', heads=1, wings=1, size=1.0, contrast=0.3, armor=None, crystals=False, ribs=True),
    'fire': dict(scale='#4A0E08', belly='#FF6A1E', horn='#140C0C', memb='#7A1A0A', memb_emit='#FF3A00', memb_a=0.92, eye='#FFD000',
                 belly_emit='#FF5A00', glow='#FF7A1A', heads=1, wings=1, size=1.0, contrast=0.6, armor=None, crystals=False, ribs=False),
    'void': dict(scale='#1A0E2A', belly='#C04BFF', horn='#0A0612', memb='#2A0A4A', memb_emit='#8A2BFF', memb_a=0.85, eye='#FF4FD2',
                 belly_emit='#9A2BFF', glow='#FF4FD2', heads=1, wings=1, size=1.0, contrast=0.55, armor=None, crystals=True, ribs=False),
    'wyrm': dict(scale='#0E0C12', belly='#FFB000', horn='#E9B949', memb='#2A0606', memb_emit='#FF1A1A', memb_a=0.9, eye='#FF1030',
                 belly_emit='#FF8A00', glow='#FFD86A', heads=3, wings=2, size=1.6, contrast=0.5, armor='#E9B949', crystals=True, ribs=False),
}


def dragon(name, v):
    M = new_scene()
    SC = skin(M, f'{name}_scale', v['scale'], 0.55, seed=hash(name) % 50 + 3, scale=0.9, contrast=v['contrast'])
    BE = M.add(f'{name}_belly', v['belly'], 0.0, 0.5, v['belly_emit'], 2.5 if v['belly_emit'] else 0.0)
    HO = M.add(f'{name}_horn', v['horn'], 0.6 if v['armor'] else 0.0, 0.35)
    ME = M.add(f'{name}_membrane', v['memb'], 0.0, 0.6, v['memb_emit'], 1.2, alpha=v['memb_a'])
    EY = glowmat(M, f'{name}_eye', v['eye'], 10.0)
    GL = glowmat(M, f'{name}_glow', v['glow'], 5.0)
    TE = M.add(f'{name}_teeth', '#F2EEDC', 0.0, 0.4)
    AR = M.add(f'{name}_armor', v['armor'], 0.95, 0.25, '#7A5200', 0.4) if v['armor'] else HO
    shadow(M, 3.4)

    # ── torso + legs (static on root) ──
    b = Builder(M)
    if v['ribs']:
        b.sphere(0, 2.6, 0, 0.55, BE, 10, 6, ry=0.6, rz=1.9)          # dark spine core
        b.sphere(0, 2.6, 0.3, 0.45, GL, 8, 5)                         # soul core
        for k in range(7):                                            # ribs
            z = -1.5 + k * 0.5
            rr = 1.1 - abs(k - 3) * 0.12
            b.ring(0, 2.6 - rr * 0.1, z, rr - 0.08, rr, 0.12, SC, seg=12)
        limb(b, (0, 3.4, -2.0), (0, 3.4, 2.0), 0.22, SC)               # spine
    else:
        b.sphere(0, 2.6, 0, 1.25, SC, 12, 7, ry=1.15, rz=2.1)
        b.sphere(0, 2.25, 0.25, 1.0, BE, 10, 6, ry=0.8, rz=1.8)
    for k in range(7):
        z = -1.8 + k * 0.6
        cone(b, (0, 3.55, z), (0, 4.3 - abs(k - 3) * 0.1, z - 0.35), 0.18, HO, seg=4)
    if v['armor']:
        for k in range(5):
            z = -1.6 + k * 0.8
            b.sphere(0, 3.3, z, 0.8, AR, 8, 3, ry=0.35, rz=0.42)
    for (sx, z, front) in [(-1, -1.2, False), (1, -1.2, False), (-1, 1.2, True), (1, 1.2, True)]:
        x = sx * (0.95 if front else 1.05)
        b.sphere(x, 2.1, z, 0.55, SC, 8, 5, ry=0.7)
        limb(b, (x, 2.0, z), (x * 1.15, 0.9, z + (0.35 if front else -0.25)), 0.38, SC)
        limb(b, (x * 1.15, 0.9, z + (0.35 if front else -0.25)), (x * 1.15, 0.15, z + (0.6 if front else 0.1)), 0.3, SC)
        b.box(x * 1.15, 0.1, z + (0.85 if front else 0.35), 0.55, 0.2, 0.7, SC)
        for c in (-1, 0, 1):
            cone(b, (x * 1.15 + c * 0.17, 0.12, z + (1.15 if front else 0.65)), (x * 1.15 + c * 0.2, 0.0, z + (1.45 if front else 0.95)), 0.06, TE, seg=4)
        if v['armor']:
            b.sphere(x * 1.05, 2.2, z, 0.62, AR, 8, 3, ry=0.3)
    torso = b.emit(f'{name}_torso')

    parts = list(torso)

    # ── necks + heads ──
    heads = []
    nh = v['heads']
    for hi in range(nh):
        off = (hi - (nh - 1) / 2) * 1.25
        spread = (hi - (nh - 1) / 2) * 0.35
        nb = Builder(M)
        hx = off * 1.6
        for k in range(1, 6):
            t = k / 5
            cx = off * 0.3 + (hx - off * 0.3) * t
            nb.sphere(cx, 3.0 + k * 0.35, 1.8 + k * 0.45, 0.62 - k * 0.05, SC, 10, 6)
            cone(nb, (cx, 3.4 + k * 0.35 + 0.3, 1.8 + k * 0.45), (cx, 3.7 + k * 0.35 + 0.45, 1.6 + k * 0.45), 0.12, HO, seg=4)
            if v['armor'] and k % 2:
                nb.sphere(cx, 3.15 + k * 0.35, 1.8 + k * 0.45, 0.66 - k * 0.05, AR, 8, 3, ry=0.35)
        hz, hy = 4.35, 5.0
        nb.sphere(hx, hy, hz, 0.58, SC, 10, 6, ry=0.5, rz=0.8)
        nb.box(hx, hy - 0.12, hz + 0.85, 0.62, 0.42, 1.0, SC, pitch=6)
        nb.box(hx, hy - 0.26, hz + 0.85, 0.5, 0.06, 0.9, GL if v['belly_emit'] else BE)     # mouth glow
        for s in (-1, 1):
            nb.sphere(hx + s * 0.3, hy + 0.12, hz + 0.42, 0.11, EY, 6, 4)
            nb.box(hx + s * 0.31, hy + 0.24, hz + 0.42, 0.18, 0.05, 0.3, HO, roll=s * -20)      # brow
            cone(nb, (hx + s * 0.28, hy + 0.3, hz - 0.1), (hx + s * 0.75, hy + 1.1, hz - 1.3), 0.13, HO, seg=5)
            cone(nb, (hx + s * 0.4, hy, hz - 0.35), (hx + s * 0.95, hy - 0.05, hz - 1.0), 0.08, HO, seg=4)
            nb.octa(hx + s * 0.15, hy - 0.02, hz + 1.38, 0.05, 0.04, GL)                         # nostrils
            for t in range(4):
                cone(nb, (hx + s * 0.27, hy - 0.3, hz + 0.55 + t * 0.2), (hx + s * 0.27, hy - 0.48, hz + 0.6 + t * 0.2), 0.04, TE, seg=3)
        if v['armor']:   # crown
            for k in range(7):
                a = math.radians(-60 + k * 20)
                cone(nb, (hx + math.sin(a) * 0.45, hy + 0.45, hz - 0.1 + math.cos(a) * 0.2), (hx + math.sin(a) * 0.55, hy + 0.95 + (0.3 if k == 3 else 0), hz - 0.15), 0.06, AR, seg=4)
        nobj = nb.emit(f'{name}_neck{hi}')
        jb = Builder(M)
        jb.box(hx, hy - 0.42, hz + 0.75, 0.5, 0.16, 0.95, SC)
        for s in (-1, 1):
            for t in range(3):
                cone(jb, (hx + s * 0.22, hy - 0.36, hz + 0.6 + t * 0.22), (hx + s * 0.22, hy - 0.2, hz + 0.62 + t * 0.22), 0.04, TE, seg=3)
        jobj = jb.emit(f'{name}_jaw{hi}')
        jpv = pivot(f'{name}_jawpv{hi}', (hx, hy - 0.35, hz + 0.25), jobj)
        key_rot(jpv, 'x', [(1, 0), (8, 14), (14, 3), (25, 0)])
        npv = pivot(f'{name}_neckpv{hi}', (off * 0.3, 3.0, 1.8), nobj + [jpv])
        ph = hi * 5
        key_rot(npv, 'y', [(1, -8 + spread * 10), (13, 8 + spread * 10), (25, -8 + spread * 10)] if hi % 2 == 0 else [(1, 8 + spread * 10), (13, -8 + spread * 10), (25, 8 + spread * 10)])
        heads.append(npv)
    parts += heads

    # ── tail ──
    tb = Builder(M)
    for k in range(1, 9):
        y = 2.5 - k * 0.2
        z = -2.0 - k * 0.72
        r = 0.62 - k * 0.06
        tb.sphere(0, max(0.45, y), z, r, SC, 8, 5)
        cone(tb, (0, max(0.45, y) + r * 0.8, z), (0, max(0.45, y) + r * 0.8 + 0.4, z - 0.3), 0.1, HO, seg=4)
    tz = -2.0 - 9 * 0.72
    tb.prism_xy([(0, 1.35), (0.55, 0.9), (0, 0.45), (-0.55, 0.9)], tz + 0.2, tz + 0.9, GL if v['belly_emit'] else HO)
    tobj = tb.emit(f'{name}_tail')
    tpv = pivot(f'{name}_tailpv', (0, 2.5, -2.0), tobj)
    key_rot(tpv, 'y', [(1, -14), (13, 14), (25, -14)])
    parts.append(tpv)

    # ── wings ──
    for wi in range(v['wings']):
        ws = 1.0 if wi == 0 else 0.62
        wz = 0.7 if wi == 0 else -0.9
        for s in (-1, 1):
            wb = Builder(M)
            sh = (s * 0.9, 3.4, wz)
            el = (s * 3.2 * ws + s * 0.9 * (1 - ws), 4.6, wz - 0.5 * ws)
            wr = (s * 5.8 * ws + s * 0.9 * (1 - ws), 4.25, wz - 1.3 * ws)
            tips = [(s * 5.5 * ws, 1.9, wz - 3.7 * ws), (s * 4.2 * ws, 2.1, wz - 3.9 * ws), (s * 2.8 * ws, 2.4, wz - 3.6 * ws), (s * 1.3 * ws, 2.7, wz - 3.0 * ws)]
            limb(wb, sh, el, 0.22, SC)
            limb(wb, el, wr, 0.17, SC)
            cone(wb, wr, (wr[0] + s * 0.6 * ws, wr[1] + 0.7, wr[2] + 0.2), 0.1, HO, seg=4)
            for tp in tips:
                limb(wb, wr, tp, 0.08, SC)
            # membrane fan: shoulder → wrist → tips (double layered for both sides)
            pts = [sh, el, wr] + tips + [(s * 0.9, 2.8, wz - 1.8 * ws)]
            fs = []
            for i in range(2, len(pts) - 1):
                fs.append([0, i, i + 1] if s > 0 else [0, i + 1, i])
            fs.append([0, 1, 2] if s > 0 else [0, 2, 1])
            wb.faces(wb.a(ME), pts, fs)
            wobj = wb.emit(f'{name}_wing{wi}{s}')
            wpv = pivot(f'{name}_wingpv{wi}{s}', sh, wobj)
            amp = 28 if wi == 0 else 34
            phs = 0 if wi == 0 else 3
            key_rot(wpv, 'z', [(1 + phs, s * amp), (13 + phs, -s * amp * 0.6), (25, s * amp)])
            parts.append(wpv)

    # ── orbiting crystals ──
    if v['crystals']:
        cb = Builder(M)
        for k in range(6):
            a = 2 * math.pi * k / 6
            cb.octa(math.cos(a) * 4.2, 4.5 + (k % 2) * 0.8, math.sin(a) * 4.2, 0.25, 0.6, GL)
        cobj = cb.emit(f'{name}_crystals')
        cpv = pivot(f'{name}_crystpv', (0, 4.5, 0), cobj)
        key_rot(cpv, 'y', [(1, 0), (13, 180), (25, 360)])
        linear(cpv)
        parts.append(cpv)

    root = pivot(name, (0, 0, 0), parts)
    root.scale = (v['size'], v['size'], v['size'])
    key_loc(root, [(1, 0), (13, 0.18), (25, 0)])
    finish(name)


for nm, key in [('dragon_bone', 'bone'), ('dragon_fire', 'fire'), ('dragon_void', 'void'), ('dragon_wyrm', 'wyrm')]:
    dragon(nm, V[key])
print('BOSSES', json.dumps(REPORT))
