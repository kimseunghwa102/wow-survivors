"""
WOW NIGHTSWARM — monsters & pickups (Blender / bpy). Original low-poly designs.
Each model: origin at the feet, facing +z (Decentraland forward), looping animation clip "Idle".
Run: python3 blender/build_monsters.py  →  models/<name>.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from rig import *  # noqa

# ─────────── BAT ───────────
M = new_scene()
BODY = skin(M, 'bat_fur', '#3A2350', 0.85, seed=3, scale=0.3)
WING = M.add('bat_wing', '#5A2A78', 0.0, 0.6, '#3A0A50', 0.6)
EYE = glowmat(M, 'eye_red', '#FF1030', 8.0)
FANG = M.add('fang', '#F2EEDC', 0.0, 0.4)
CORE = glowmat(M, 'bat_core', '#FF2A6A', 3.0)
shadow(M, 0.35)
b = Builder(M)
b.sphere(0, 0.0, 0, 0.2, BODY, 10, 6, ry=0.24, rz=0.26)
b.sphere(0, 0.2, 0.18, 0.15, BODY, 10, 6)
b.sphere(0, 0.02, 0.2, 0.07, CORE, 6, 4)
for s in (-1, 1):
    b.prism_xy([(s * 0.05, 0.3), (s * 0.15, 0.55), (s * 0.17, 0.28)], 0.12, 0.2, BODY)
    b.sphere(s * 0.065, 0.24, 0.31, 0.04, EYE, 6, 4)
    b.octa(s * 0.04, 0.1, 0.3, 0.018, 0.05, FANG)
    b.box(s * 0.1, -0.24, 0.02, 0.04, 0.14, 0.04, BODY)
    b.octa(s * 0.1, -0.33, 0.06, 0.03, 0.05, FANG)
body = b.emit('bat_body')
wings = []
for s in (-1, 1):
    w = Builder(M)
    pts = [(s * 0.15, 0.05), (s * 0.55, 0.3), (s * 0.85, 0.32), (s * 1.05, -0.02), (s * 0.8, -0.1), (s * 0.66, -0.26), (s * 0.45, -0.12), (s * 0.3, -0.24), (s * 0.15, -0.12)]
    w.prism_xy(pts, -0.015, 0.015, WING)
    for (x0, y0, x1, y1) in [(0.15, 0.05, 0.85, 0.32), (0.5, 0.25, 0.66, -0.26), (0.85, 0.32, 1.05, -0.02)]:
        ln = math.hypot(x1 - x0, y1 - y0)
        w.box(s * (x0 + x1) / 2, (y0 + y1) / 2, 0, ln, 0.03, 0.04, BODY, roll=math.degrees(math.atan2(y1 - y0, (x1 - x0) * s)))
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
    SKIN = skin(M, 'skin', '#8A2A22' if elite else '#5E7A55', 0.75, seed=5 if elite else 6, scale=0.5, contrast=0.6)
    RAGS = skin(M, 'rags', '#2A2430' if not elite else '#1A0E0E', 0.95, seed=8, scale=0.4)
    EYE = glowmat(M, 'eyes', '#FFC000' if not elite else '#FF1030', 8.0)
    HORN = M.add('horn', '#E8DCC0', 0.0, 0.5)
    RUNE = glowmat(M, 'rune', '#7CFF4A' if not elite else '#FF5A10', 4.0)
    IRONM = M.add('iron', '#2A2830', 0.85, 0.35)
    shadow(M, 0.55 if not elite else 0.6)
    b = Builder(M)
    # hunched spine spikes + glowing belly rune
    for k in range(4):
        b.cyl(0, 1.05 + k * 0.13, -0.2 + k * 0.01, 0.05, 0.16 + (0.08 if elite else 0), HORN, seg=4, r_top=0.0)
    b.octa(0, 1.05, 0.17, 0.11, 0.13, RUNE)
    for k in range(5):
        b.box(-0.2 + k * 0.1, 0.7, 0.13, 0.08, 0.22 + (k % 2) * 0.1, 0.03, RAGS, roll=(k - 2) * 6)
    if elite:
        for sx in (-1, 1):
            b.box(sx * 0.33, 1.42, -0.02, 0.3, 0.16, 0.36, IRONM)
            for k in range(3):
                b.cyl(sx * (0.25 + k * 0.08), 1.5, -0.02, 0.04, 0.22, HORN, seg=4, r_top=0.0)
        for k in range(6):
            b.box(-0.25 + k * 0.1, 1.2 - abs(k - 2.5) * 0.04, 0.18, 0.06, 0.04, 0.03, IRONM)
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
        for k in (-1, 0, 1):
            a.box(s * 0.3 + k * 0.045, 1.28, 0.7, 0.02, 0.03, 0.12, HORN, pitch=20)
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
BONE = skin(M, 'bone', '#E8E2D0', 0.55, seed=11, scale=0.3, contrast=0.35)
EYE = glowmat(M, 'eyes', '#20D8FF', 8.0)
DARK = M.add('dark', '#151018', 0.0, 0.8)
STEEL = M.add('steel', '#3A3F4A', 0.9, 0.3)
SOULF = glowmat(M, 'soul', '#3FE6FF', 4.0)
shadow(M, 0.45)
b = Builder(M)
b.octa(0, 1.22, 0.02, 0.09, 0.13, SOULF)                                          # soul flame in the ribcage
b.cyl(0, 1.74, 0.02, 0.2, 0.16, STEEL, seg=10)                                    # helmet
b.cyl(0, 1.9, 0.02, 0.2, 0.12, STEEL, seg=10, r_top=0.06)
b.box(0, 1.98, -0.02, 0.04, 0.18, 0.34, EYE)                                      # crest
b.box(0, 1.66, 0.2, 0.04, 0.16, 0.03, STEEL)                                      # nasal guard
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
    if s > 0:  # runed sword
        a.box(s * 0.28, 0.82, 0.12, 0.2, 0.04, 0.05, STEEL)
        a.box(s * 0.28, 0.82, 0.48, 0.03, 0.09, 0.7, STEEL)
        a.box(s * 0.28, 0.82, 0.5, 0.012, 0.04, 0.6, EYE)
    else:      # round shield
        sh = Builder(M)
        sh.sphere(s * 0.36, 1.0, 0.12, 0.28, STEEL, 12, 4, rz=0.06)
        sh.sphere(s * 0.39, 1.0, 0.14, 0.08, SOULF, 6, 4, rz=0.03)
        objs_extra = sh.emit('shield')
    objs = a.emit(f'skarm{s}') + (objs_extra if s < 0 else [])
    pv = pivot(f'skarm_pivot{s}', (s * 0.28, 1.45, 0.0), objs)
    key_rot(pv, 'x', [(1, 25 * s), (13, -25 * s), (25, 25 * s)])
    arms.append(pv)
root = pivot('skeleton', (0, 0, 0), body + arms)
key_loc(root, [(1, 0), (7, 0.04), (13, 0), (19, 0.04), (25, 0)])
finish('skeleton')

# ─────────── WRAITH ───────────
M = new_scene()
ROBE = skin(M, 'robe', '#163240', 0.85, seed=21, scale=0.5, emit='#062028', strength=0.6, contrast=0.6)
TRIM = glowmat(M, 'trim', '#20D8FF', 5.0)
VOID = M.add('void', '#020203', 0.0, 1.0)
STEEL = M.add('blade', '#9AB8C8', 0.95, 0.2, '#3FE6FF', 0.8)
WOODW = M.add('haft', '#1A1410', 0.0, 0.9)
shadow(M, 0.5)
b = Builder(M)
for k in range(7):     # tattered hem
    a = 2 * math.pi * k / 7
    b.box(math.sin(a) * 0.2, 0.05, math.cos(a) * 0.2, 0.12, 0.5, 0.03, ROBE, yaw=math.degrees(a), pitch=-12)
for k in range(5):     # spectral flames above the hood
    a = 2 * math.pi * k / 5
    b.cyl(math.sin(a) * 0.14, 2.28, math.cos(a) * 0.14 - 0.04, 0.05, 0.22, TRIM, seg=4, r_top=0.0)
# scythe
b.cyl(0.5, 0.4, 0.45, 0.03, 2.1, WOODW, seg=6)
b.prism_xy([(0.5, 2.45), (1.25, 2.25), (1.45, 1.95), (1.15, 2.2), (0.5, 2.32)], 0.43, 0.47, STEEL)
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
ROBE = skin(M, 'lich_robe', '#3A1250', 0.8, seed=31, scale=0.8, contrast=0.55)
TRIM = M.add('lich_trim', '#E9B949', 0.85, 0.25, '#7A5200', 0.6)
BONE = skin(M, 'lich_bone', '#DCD3BC', 0.6, seed=33, scale=0.4, contrast=0.35)
SOULM = glowmat(M, 'lich_soul', '#8A3BFF', 8.0)
EYE = glowmat(M, 'lich_eye', '#FF1030', 9.0)
CAPE = M.add('lich_cape', '#12040E', 0.0, 0.9, '#2A0020', 0.4)
shadow(M, 1.2)
b = Builder(M)
# cape and spectral wing-blades
b.prism_xy([(-0.7, 2.6), (0.7, 2.6), (1.3, 0.1), (0.4, 0.3), (0.0, 0.05), (-0.4, 0.3), (-1.3, 0.1)], -0.62, -0.56, CAPE)
for sx in (-1, 1):
    for k in range(4):
        ang = 25 + k * 16
        ln = 1.6 - k * 0.2
        b.box(sx * (0.9 + math.cos(math.radians(ang)) * ln / 2), 2.9 + math.sin(math.radians(ang)) * ln / 2, -0.5, ln, 0.1, 0.05, SOULM, roll=sx * ang)
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
orbs = Builder(M)
for k in range(3):
    a = 2 * math.pi * k / 3
    orbs.sphere(math.cos(a) * 1.4, 2.2, math.sin(a) * 1.4, 0.16, SOULM, 8, 5)
    orbs.sphere(math.cos(a) * 1.4, 2.2, math.sin(a) * 1.4, 0.07, EYE, 6, 4)
ob = orbs.emit('lich_orbs')
opv = pivot('orb_pivot', (0, 2.2, 0), ob)
key_rot(opv, 'y', [(1, 0), (13, 180), (25, 360)])
linear(opv)
root = pivot('lich', (0, 0, 0), body + [pv, opv])
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
WOODM = skin(M, 'vault_body', '#3A1050', 0.5, seed=41, scale=0.4)
GOLDM = M.add('chest_gold', '#FFD45A', 0.7, 0.25, '#B07800', 1.5)
GLOW = glowmat(M, 'vault_glow', '#FFD040', 6.0)
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
