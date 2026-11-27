"""
WOW NIGHTSWARM — raid boss "AZRATH, THE ECLIPSE COLOSSUS" (Blender / bpy). Original design.
A four-armed obsidian demon-titan with an eclipse (black sun) burning in its chest, a crown of black fire,
ram horns, six eyes, a colossal molten greatsword, tattered crimson wings and a rotating eclipse halo.
Origin at the feet, facing +z. Looping clip "Idle" (breathing, wing beats, arm sway, jaw roar, halo spin).
Run: python3 blender/build_titan.py → models/titan_azrath.glb
"""
import os, sys, json, math, random
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




def build():
    M = new_scene()
    SC = skin(M, 'az_hide', '#17111C', 0.5, seed=71, scale=0.8, contrast=0.55)
    AR = skin(M, 'az_armor', '#2B2433', 0.32, metal=0.85, seed=72, scale=0.7, contrast=0.35)
    GT = M.add('az_gold', '#D9A93A', 0.95, 0.25, '#6A4300', 0.5)
    BO = skin(M, 'az_bone', '#E6DCC4', 0.55, seed=73, scale=0.6, contrast=0.3)
    LV = glowmat(M, 'az_lava', '#FF4A12', 7.0)
    CO = glowmat(M, 'az_corona', '#FFC23A', 9.0)
    VO = M.add('az_void', '#010003', 0.0, 0.08)
    EY = glowmat(M, 'az_eye', '#FF1030', 14.0)
    FL = M.add('az_flame', '#FF3A0A', 0.0, 0.6, '#FF5A14', 5.0, alpha=0.85)
    BF = M.add('az_blackfire', '#050106', 0.0, 0.5, '#3A0010', 1.0, alpha=0.95)
    ME = M.add('az_membrane', '#140203', 0.0, 0.7, '#9A0A06', 0.55, alpha=0.88)
    SK = skin(M, 'az_skull', '#4A403A', 0.6, seed=74, scale=0.6, contrast=0.45)
    TE = M.add('az_teeth', '#F2EEDC', 0.0, 0.4)
    shadow(M, 5.0)
    rnd = random.Random(9)

    # ═══ legs + pelvis + torso (body, static on root) ═══
    b = Builder(M)
    for s in (-1, 1):
        hip, knee, ankle, hoof = (s * 1.05, 4.3, 0), (s * 1.45, 2.7, 0.8), (s * 1.5, 1.05, -0.45), (s * 1.55, 0.25, 0.25)
        b.sphere(*hip, 0.85, SC, 10, 6)
        limb(b, hip, knee, 0.95, SC)
        limb(b, knee, ankle, 0.66, SC)
        limb(b, ankle, hoof, 0.5, SC)
        b.box(hoof[0], 0.18, hoof[2] + 0.35, 0.95, 0.36, 1.2, AR)
        for c in (-1, 0, 1):
            cone(b, (hoof[0] + c * 0.3, 0.2, hoof[2] + 0.9), (hoof[0] + c * 0.36, 0.02, hoof[2] + 1.35), 0.11, BO, seg=4)
        b.sphere(knee[0], knee[1], knee[2] + 0.15, 0.62, AR, 8, 5)                                      # knee guard
        cone(b, (knee[0], knee[1] + 0.2, knee[2] + 0.5), (knee[0] + s * 0.2, knee[1] + 0.9, knee[2] + 1.3), 0.22, BO, seg=5)
        b.box(s * 1.4, 3.6, 0.55, 0.95, 1.3, 0.25, AR, pitch=-12)                                      # thigh plate
        b.box(s * 1.4, 3.6, 0.69, 0.75, 0.08, 0.04, LV, pitch=-12)
    b.sphere(0, 4.5, 0, 1.35, AR, 10, 6, ry=0.8, rz=0.95)                                                # pelvis
    for k in range(5):                                                                                  # tassets
        x = (k - 2) * 0.55
        b.box(x, 3.55, 1.0 - abs(k - 2) * 0.12, 0.5, 1.4, 0.12, AR, yaw=(k - 2) * 12, pitch=-8)
        b.box(x, 3.0, 1.06 - abs(k - 2) * 0.12, 0.42, 0.08, 0.06, GT, yaw=(k - 2) * 12)
    b.sphere(0, 5.3, 0.05, 1.25, SC, 10, 6, ry=0.85)                                                   # abdomen
    b.sphere(0, 6.6, 0, 2.05, SC, 12, 8, ry=1.55, rz=1.25)                                             # chest
    for k in range(4):                                                                                  # ribbed abs + lava seams
        b.box(0, 5.0 + k * 0.32, 1.05, 1.3 - k * 0.05, 0.1, 0.12, LV)
    for _ in range(26):                                                                                 # molten cracks across the hide
        a = rnd.uniform(-1.2, 1.2)
        y = rnd.uniform(5.6, 7.7)
        b.box(math.sin(a) * 1.95, y, math.cos(a) * 1.2 + 0.02, rnd.uniform(0.25, 0.7), 0.05, 0.05, LV, yaw=math.degrees(a), roll=rnd.uniform(-60, 60))
    # chest plates framing the eclipse
    for s in (-1, 1):
        b.box(s * 1.05, 7.1, 1.05, 1.2, 1.1, 0.3, AR, yaw=s * 20, roll=s * -12)
        b.box(s * 1.05, 6.55, 1.2, 1.1, 0.07, 0.06, GT, yaw=s * 20, roll=s * -12)
    # ── the eclipse: a black sun with a burning corona ──
    b.sphere(0, 6.55, 1.15, 0.62, VO, 12, 8, rz=0.35)
    for k in range(16):
        a = 2 * math.pi * k / 16
        ln = 1.15 if k % 2 == 0 else 0.85
        cone(b, (math.sin(a) * 0.55, 6.55 + math.cos(a) * 0.55, 1.28), (math.sin(a) * ln * 1.25, 6.55 + math.cos(a) * ln * 1.25, 1.22), 0.13, CO, seg=4)
    b.sphere(0, 6.55, 1.2, 0.72, CO, 12, 8, rz=0.1)                                                     # corona disc behind the void
    # spine spikes down the back
    for k in range(7):
        y = 4.6 + k * 0.62
        cone(b, (0, y, -1.15 - (0.2 if 1 < k < 6 else 0)), (0, y + 0.5, -2.2 - (0.3 if 1 < k < 6 else 0)), 0.22, BO, seg=4)
    # pauldrons with bone spikes
    for s in (-1, 1):
        b.sphere(s * 2.25, 7.65, 0, 1.05, AR, 10, 6, ry=0.75)
        b.ring(s * 2.25, 7.25, 0, 0.98, 1.08, 0.12, GT, seg=14)
        for (dx, dy, dz) in [(0.2, 1.6, 0.0), (0.75, 1.2, 0.4), (0.7, 1.1, -0.5)]:
            cone(b, (s * (2.3 + dx * 0.3), 8.2, dz * 0.6), (s * (2.3 + dx), 8.2 + dy, dz), 0.24, BO, seg=5)
    b.sphere(0, 8.35, 0.15, 0.75, SC, 8, 6)                                                            # neck
    body = b.emit('az_body')
    parts = list(body)

    # ═══ head: horned skull, six eyes, crown of black fire ═══
    hb = Builder(M)
    hx, hy, hz = 0, 9.25, 0.45
    hb.sphere(hx, hy, hz, 0.88, SK, 12, 8, ry=0.82, rz=0.95)                                          # cranium
    cone(hb, (hx, hy - 0.2, hz + 0.35), (hx, hy - 0.42, hz + 1.85), 0.62, SK, seg=6)                    # long predatory snout
    hb.box(hx, hy + 0.28, hz + 0.72, 1.35, 0.2, 0.55, SK, pitch=-10)                                    # heavy brow
    for s in (-1, 1):
        hb.box(hx + s * 0.38, hy + 0.12, hz + 0.86, 0.5, 0.26, 0.2, VO, roll=s * 22)                       # deep eye sockets
        for r_ in range(3):                                                                             # six burning slit eyes
            hb.box(hx + s * (0.22 + r_ * 0.16), hy + 0.14 - r_ * 0.13, hz + 0.97 - r_ * 0.05, 0.2 - r_ * 0.03, 0.06, 0.05, EY, roll=s * 24)
        hb.box(hx + s * 0.55, hy - 0.05, hz + 0.75, 0.08, 0.5, 0.5, SC, roll=s * -15)                      # cheek ridges
        for t in range(2):                                                                              # huge upper fangs
            cone(hb, (hx + s * (0.22 + t * 0.14), hy - 0.45, hz + 1.3 - t * 0.3), (hx + s * (0.22 + t * 0.14), hy - 1.05 + t * 0.2, hz + 1.38 - t * 0.3), 0.08, TE, seg=4)
    hb.box(hx, hy - 0.5, hz + 1.0, 0.6, 0.12, 0.9, LV)                                                  # throat fire
    # crown of black fire + gold circlet
    hb.ring(hx, hy + 0.55, hz - 0.05, 0.72, 0.84, 0.16, GT, seg=14)
    for k in range(9):
        a = math.radians(-80 + k * 20)
        h = 1.2 + (0.7 if k == 4 else 0.35 if k in (3, 5) else 0)
        base = (hx + math.sin(a) * 0.75, hy + 0.65, hz - 0.05 + math.cos(a) * 0.35)
        cone(hb, base, (base[0] * 1.15, base[1] + h, base[2] - 0.15), 0.2, BF, seg=5)
        cone(hb, (base[0], base[1] + 0.05, base[2] + 0.05), (base[0] * 1.1, base[1] + h * 0.55, base[2]), 0.12, FL, seg=4)
    head = hb.emit('az_head')
    jb = Builder(M)
    jb.box(hx, hy - 0.78, hz + 0.95, 0.8, 0.24, 1.4, SK)
    jb.box(hx, hy - 0.66, hz + 0.95, 0.55, 0.04, 1.2, LV)
    for s in (-1, 1):
        for t in range(3):
            cone(jb, (hx + s * 0.3, hy - 0.68, hz + 1.5 - t * 0.35), (hx + s * 0.3, hy - 0.22, hz + 1.52 - t * 0.35), 0.07, TE, seg=4)
    jaw = jb.emit('az_jaw')
    jpv = pivot('az_jawpv', (hx, hy - 0.55, hz + 0.25), jaw)
    key_rot(jpv, 'x', [(1, 4), (7, 34), (12, 30), (18, 6), (25, 4)])
    hpv = pivot('az_headpv', (0, 8.5, 0.1), head + [jpv])
    key_rot(hpv, 'y', [(1, -10), (13, 10), (25, -10)])
    parts.append(hpv)

    # ═══ eclipse halo behind the head (spins) ═══
    gb = Builder(M)
    R, cy, cz = 2.9, 9.4, -1.25
    n = 22
    for k in range(n):
        a = 2 * math.pi * (k + 0.5) / n
        gb.box(R * math.sin(a), cy + R * math.cos(a), cz, 2 * math.pi * R / n * 1.05, 0.32, 0.22, CO, roll=-math.degrees(a))
    for k in range(8):
        a = 2 * math.pi * k / 8
        gb.octa(R * 1.18 * math.sin(a), cy + R * 1.18 * math.cos(a), cz, 0.28, 0.55, LV)
    for k in range(12):
        a = 2 * math.pi * k / 12
        cone(gb, (R * 0.86 * math.sin(a), cy + R * 0.86 * math.cos(a), cz + 0.05), (R * 0.45 * math.sin(a), cy + R * 0.45 * math.cos(a), cz + 0.05), 0.1, GT, seg=3)
    halo = gb.emit('az_halo')
    gpv = pivot('az_halopv', (0, cy, cz), halo)
    key_rot(gpv, 'z', [(1, 0), (13, 180), (25, 360)])
    linear(gpv)
    parts.append(gpv)

    # ═══ arms: upper pair (greatsword + spell hand), lower pair (claws) ═══
    for s in (-1, 1):
        ab = Builder(M)
        sh, el, wr = (s * 2.45, 7.45, 0.0), (s * 3.55, 6.05, 0.7), (s * 3.75, 4.75, 1.65)
        limb(ab, sh, el, 0.82, SC)
        limb(ab, el, wr, 0.66, SC)
        ab.sphere(*el, 0.62, AR, 8, 5)
        cone(ab, (el[0] + s * 0.3, el[1], el[2] - 0.3), (el[0] + s * 0.9, el[1] + 0.3, el[2] - 1.1), 0.18, BO, seg=4)
        ab.box(wr[0], wr[1] + 0.55, wr[2] - 0.45, 0.8, 0.8, 0.9, AR, pitch=-35)                               # bracer
        ab.box(wr[0], wr[1] + 0.55, wr[2] - 0.0, 0.82, 0.07, 0.07, LV, pitch=-35)
        ab.sphere(wr[0], wr[1] - 0.2, wr[2] + 0.3, 0.6, SC, 8, 6)                                          # fist
        for c in (-1, 0, 1):
            cone(ab, (wr[0] + c * 0.22, wr[1] - 0.3, wr[2] + 0.75), (wr[0] + c * 0.26, wr[1] - 0.55, wr[2] + 1.25), 0.08, BO, seg=4)
        if s > 0:
            # the colossal molten greatsword, raised over the shoulder
            gx, gy, gz = wr[0], wr[1] - 0.2, wr[2] + 0.3
            ab.box(gx, gy, gz, 0.3, 1.2, 0.3, AR)                                                          # grip
            ab.box(gx, gy + 0.7, gz, 1.9, 0.3, 0.5, GT)                                                     # crossguard
            cone(ab, (gx - 0.95, gy + 0.7, gz), (gx - 1.5, gy + 1.2, gz), 0.18, GT, seg=4)
            cone(ab, (gx + 0.95, gy + 0.7, gz), (gx + 1.5, gy + 1.2, gz), 0.18, GT, seg=4)
            ab.box(gx, gy + 4.3, gz, 0.95, 7.0, 0.18, VO)                                                   # blade
            ab.box(gx - 0.5, gy + 4.3, gz, 0.1, 7.0, 0.22, LV)                                              # molten edges
            ab.box(gx + 0.5, gy + 4.3, gz, 0.1, 7.0, 0.22, LV)
            ab.box(gx, gy + 4.0, gz + 0.1, 0.2, 5.6, 0.04, FL)                                              # fuller fire
            cone(ab, (gx, gy + 7.8, gz), (gx, gy + 9.0, gz), 0.55, VO, seg=4)
            for k in range(6):                                                                             # flame licks
                y = gy + 1.5 + k * 1.1
                cone(ab, (gx + 0.5, y, gz), (gx + 1.0, y + 0.8, gz - 0.1), 0.16, FL, seg=4)
                cone(ab, (gx - 0.5, y + 0.5, gz), (gx - 1.0, y + 1.2, gz - 0.1), 0.16, FL, seg=4)
        else:
            # spell hand: a floating sphere of hellfire with orbiting runes
            ab.sphere(wr[0], wr[1] + 0.9, wr[2] + 0.9, 0.75, FL, 10, 7)
            ab.sphere(wr[0], wr[1] + 0.9, wr[2] + 0.9, 0.42, CO, 8, 5)
            for k in range(6):
                a = 2 * math.pi * k / 6
                ab.octa(wr[0] + math.sin(a) * 1.25, wr[1] + 0.9 + math.cos(a) * 0.4, wr[2] + 0.9 + math.cos(a) * 1.0, 0.12, 0.3, LV)
        arm = ab.emit(f'az_arm{s}')
        apv = pivot(f'az_armpv{s}', sh, arm)
        key_rot(apv, 'x', [(1, 0), (13, -9 if s > 0 else 7), (25, 0)])
        parts.append(apv)

        lb = Builder(M)
        sh2, el2, wr2 = (s * 1.7, 5.9, 0.55), (s * 2.55, 4.85, 1.2), (s * 2.15, 4.25, 2.15)
        limb(lb, sh2, el2, 0.52, SC)
        limb(lb, el2, wr2, 0.42, SC)
        lb.sphere(*wr2, 0.4, SC, 8, 5)
        for c in (-1, 0, 1):
            cone(lb, (wr2[0] + c * 0.15, wr2[1], wr2[2] + 0.3), (wr2[0] + c * 0.25, wr2[1] - 0.15, wr2[2] + 1.0), 0.07, BO, seg=4)
        # broken chains hanging from the lower wrists
        for k in range(6):
            lb.ring(wr2[0], wr2[1] - 0.45 - k * 0.32, wr2[2] - 0.1, 0.1, 0.16, 0.08 if k % 2 else 0.2, GT, seg=8)
        larm = lb.emit(f'az_larm{s}')
        lpv = pivot(f'az_larmpv{s}', sh2, larm)
        key_rot(lpv, 'z', [(1, 0), (13, s * 10), (25, 0)])
        parts.append(lpv)

    # ═══ wings: tattered crimson, plus a smaller lower pair ═══
    for wi, ws in enumerate((1.0, 0.6)):
        wy = 7.9 if wi == 0 else 6.2
        for s in (-1, 1):
            wb = Builder(M)
            sh = (s * 1.0, wy, -1.0)
            el = (s * 4.5 * ws + s * 1.0, wy + 2.2 * ws, -1.8)
            wr = (s * 8.2 * ws + s * 1.0, wy + 1.4 * ws, -2.8)
            tips = [(s * 8.6 * ws + s, wy - 3.6 * ws, -4.4), (s * 6.8 * ws + s, wy - 4.6 * ws, -4.1), (s * 4.9 * ws + s, wy - 4.9 * ws, -3.6),
                    (s * 3.0 * ws + s, wy - 4.2 * ws, -3.0), (s * 1.6 * ws + s, wy - 2.6 * ws, -2.2)]
            limb(wb, sh, el, 0.32, SC)
            limb(wb, el, wr, 0.24, SC)
            cone(wb, wr, (wr[0] + s * 0.9 * ws, wr[1] + 1.2, wr[2] + 0.2), 0.16, BO, seg=4)
            cone(wb, el, (el[0] + s * 0.2, el[1] + 1.0, el[2] - 0.2), 0.14, BO, seg=4)
            for tp in tips:
                limb(wb, wr, tp, 0.1, SC)
            pts = [sh, el, wr] + tips
            fs = []
            for i in range(2, len(pts) - 1):
                # tattered: skip some panels' outer half by notching
                fs.append([0, i, i + 1] if s > 0 else [0, i + 1, i])
            fs.append([0, 1, 2] if s > 0 else [0, 2, 1])
            wb.faces(wb.a(ME), pts, fs)
            wobj = wb.emit(f'az_wing{wi}{s}')
            wpv = pivot(f'az_wingpv{wi}{s}', sh, wobj)
            amp = 16 if wi == 0 else 22
            key_rot(wpv, 'z', [(1 + wi * 3, s * amp), (13 + wi * 3, -s * amp * 0.5), (25, s * amp)])
            parts.append(wpv)

    # ═══ tail ═══
    tb = Builder(M)
    prev = (0, 4.2, -1.0)
    for k in range(1, 10):
        p = (math.sin(k * 0.5) * 0.6, max(0.5, 4.2 - k * 0.45), -1.0 - k * 0.8)
        limb(tb, prev, p, 0.62 - k * 0.05, SC)
        cone(tb, (p[0], p[1] + 0.4 - k * 0.02, p[2]), (p[0], p[1] + 0.9 - k * 0.03, p[2] - 0.4), 0.13, BO, seg=4)
        prev = p
    tb.prism_xy([(0, prev[1] + 1.0), (0.9, prev[1] + 0.3), (0, prev[1] - 0.2), (-0.9, prev[1] + 0.3)], prev[2] - 1.4, prev[2] - 0.2, LV)
    tail = tb.emit('az_tail')
    tpv = pivot('az_tailpv', (0, 4.2, -1.0), tail)
    key_rot(tpv, 'y', [(1, -12), (13, 12), (25, -12)])
    parts.append(tpv)

    # ═══ orbiting molten debris at its feet ═══
    db = Builder(M)
    for k in range(10):
        a = 2 * math.pi * k / 10
        r = 4.6 + (k % 3) * 0.6
        db.octa(math.cos(a) * r, 0.8 + (k % 4) * 0.55, math.sin(a) * r, 0.3 + (k % 2) * 0.15, 0.5, LV if k % 3 == 0 else SC)
    deb = db.emit('az_debris')
    dpv = pivot('az_debrispv', (0, 1, 0), deb)
    key_rot(dpv, 'y', [(1, 0), (13, 180), (25, 360)])
    linear(dpv)
    parts.append(dpv)

    root = pivot('titan_azrath', (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, 0.25), (25, 0)])
    finish('titan_azrath')


build()
print('TITAN', json.dumps(REPORT))
