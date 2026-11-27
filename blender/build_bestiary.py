"""
WOW NIGHTSWARM — the wider bestiary (six new normal monsters). Same conventions as build_monsters.py:
origin at the feet, facing +z (Decentraland forward), one looping animation clip "Idle".
  slime   — a wobbling jelly with a glowing core (splits in two when it dies; the slimelet is this model scaled down)
  spider  — a cave spider with a glowing hourglass; it pounces
  imp     — a little winged devil holding a fireball; it throws them
  wisp    — a flickering will-o'-the-wisp; it rushes in and explodes
  hound   — a hellhound with a burning mane; fast pack hunter
  brute   — a stone giant with glowing rune cracks; slow and huge
Run: python3 blender/build_bestiary.py  →  models/{slime,spider,imp,wisp,hound,brute}.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from rig import *  # noqa
from mythparts import card, fire_mat, tube, cone, torus, bat_wing  # noqa


def key_scale3(obj, frames):
    """frames = [(frame, (sx, sy, sz))] in DCL axes"""
    for f, (sx, sy, sz) in frames:
        obj.scale = (sx, sz, sy)          # DCL x,y,z → Blender X, Z(up)…: X=x, Y=z, Z=y
        obj.keyframe_insert('scale', frame=f)
    obj.scale = (1, 1, 1)


# ─────────── SLIME ───────────
M = new_scene()
JELLY = M.add('jelly', '#3AE8A0', 0.1, 0.08, '#0A6A40', 0.6, alpha=0.72)
CORE = glowmat(M, 'slime_core', '#C8FF6A', 5.0)
EYE = M.add('slime_eye', '#0A140E', 0.2, 0.2)
SHINE = glowmat(M, 'slime_shine', '#FFFFFF', 2.0)
shadow(M, 0.55)
b = Builder(M)
b.sphere(0, 0.36, 0, 0.5, JELLY, 16, 9, ry=0.38)
b.sphere(0, 0.12, 0, 0.52, JELLY, 16, 4, ry=0.12)
b.octa(0, 0.38, -0.04, 0.16, 0.2, CORE)
for (x, y, z, r) in ((0.18, 0.5, 0.1, 0.05), (-0.22, 0.32, -0.12, 0.04), (0.05, 0.22, 0.25, 0.035)):
    b.sphere(x, y, z, r, SHINE, 6, 4)
for s in (-1, 1):
    b.sphere(s * 0.15, 0.48, 0.36, 0.075, EYE, 8, 5)
    b.sphere(s * 0.15 + 0.025, 0.51, 0.42, 0.022, SHINE, 6, 4)
objs = b.emit('slime')
root = pivot('slime', (0, 0, 0), objs)
key_scale3(root, [(1, (1, 1, 1)), (7, (1.12, 0.84, 1.12)), (13, (0.92, 1.14, 0.92)), (19, (1.06, 0.94, 1.06)), (25, (1, 1, 1))])
finish('slime')

# ─────────── SPIDER ───────────
M = new_scene()
CHIT = skin(M, 'chitin', '#2A1A30', 0.45, metal=0.3, seed=31, scale=0.3, contrast=0.5)
HAIR = skin(M, 'spider_hair', '#3A2A20', 0.9, seed=33, scale=0.25)
MARK = glowmat(M, 'hourglass', '#9AFF3A', 4.5)
EYES = glowmat(M, 'spider_eyes', '#FF2A3D', 7.0)
FANG = M.add('spider_fang', '#E8DCC0', 0.0, 0.4)
shadow(M, 0.75)
b = Builder(M)
b.sphere(0, 0.5, -0.38, 0.42, CHIT, 12, 8, ry=0.34, rz=0.5)                      # abdomen
b.prism_xy([(0, 0.82), (0.12, 0.72), (0, 0.62), (-0.12, 0.72)], -0.7, -0.66, MARK)   # hourglass on the back
b.sphere(0, 0.84, -0.42, 0.1, MARK, 6, 4, ry=0.04)
b.sphere(0, 0.46, 0.18, 0.24, HAIR, 10, 6, ry=0.2)                               # thorax
b.sphere(0, 0.46, 0.42, 0.15, CHIT, 8, 5)                                         # head
for (x, y) in ((-0.06, 0.52), (0.06, 0.52), (-0.11, 0.47), (0.11, 0.47), (-0.04, 0.44), (0.04, 0.44)):
    b.sphere(x, y, 0.55, 0.028, EYES, 5, 3)
for s in (-1, 1):
    b.cyl(s * 0.05, 0.3, 0.55, 0.03, 0.14, FANG, seg=5, r_top=0.0)
body = b.emit('spider_body')
legs = []
for i in range(4):
    for s in (-1, 1):
        lg = Builder(M)
        z0 = 0.3 - i * 0.14
        ang = math.radians(35 - i * 25)
        kx, kz = s * (0.25 + 0.4 * math.cos(ang)), z0 + 0.45 * math.sin(ang)
        fx_, fz = s * (0.3 + 0.75 * math.cos(ang)), z0 + 0.8 * math.sin(ang)
        tube(lg, (s * 0.15, 0.45, z0), (kx, 0.85, kz), 0.045, 0.035, HAIR, 5)
        tube(lg, (kx, 0.85, kz), (fx_, 0.0, fz), 0.035, 0.012, CHIT, 5)
        objs = lg.emit(f'leg{i}{s}')
        pv = pivot(f'leg_pivot{i}{s}', (s * 0.15, 0.45, z0), objs)
        ph = 6 if (i + (s > 0)) % 2 else 0
        key_rot(pv, 'y', [(1, 0), (1 + 6, 10 * s if ph else -10 * s), (13, 0), (19, -10 * s if ph else 10 * s), (25, 0)])
        legs.append(pv)
root = pivot('spider', (0, 0, 0), body + legs)
key_loc(root, [(1, 0), (7, 0.04), (13, 0), (19, 0.04), (25, 0)])
finish('spider')

# ─────────── IMP ───────────
M = new_scene()
RED = skin(M, 'imp_skin', '#B8281E', 0.6, seed=41, scale=0.3, contrast=0.4)
DARKR = M.add('imp_dark', '#3A0A0A', 0.0, 0.7)
HORN = M.add('imp_horn', '#1A1410', 0.2, 0.5)
EYE = glowmat(M, 'imp_eye', '#FFE14A', 8.0)
FIRE = fire_mat(M, 'imp_fire', '#FF7A1A', '#FFF4C8', 6.0)
ORB = glowmat(M, 'imp_orb', '#FF9A2A', 6.0)
WING = M.add('imp_wing', '#5A1010', 0.0, 0.6, '#2A0000', 0.3)
shadow(M, 0.4)
b = Builder(M)
b.sphere(0, 0.62, 0, 0.26, RED, 10, 6, ry=0.3)                                    # pot belly
b.sphere(0, 1.02, 0.04, 0.2, RED, 10, 6)                                          # head
for s in (-1, 1):
    cone(b, (s * 0.11, 1.16, 0.0), (s * 0.22, 1.42, -0.06), 0.06, HORN, 6)
    b.sphere(s * 0.07, 1.05, 0.2, 0.04, EYE, 6, 4)
    b.box(s * 0.12, 0.2, 0.02, 0.09, 0.4, 0.09, RED)                                # legs
    b.box(s * 0.12, 0.02, 0.08, 0.12, 0.05, 0.18, HORN)                             # hooves
b.box(0, 0.94, 0.21, 0.14, 0.03, 0.02, DARKR)                                     # grin
tube(b, (0, 0.45, -0.22), (0, 0.25, -0.55), 0.04, 0.02, RED, 5)                   # tail
cone(b, (0, 0.25, -0.55), (0, 0.35, -0.7), 0.07, HORN, 4)
b.box(0.28, 0.72, 0.12, 0.08, 0.08, 0.28, RED, pitch=-30)                         # arm holding the fireball
b.sphere(0.3, 0.82, 0.32, 0.12, ORB, 8, 6)
card(b, (0.3, 0.8, 0.32), (0.3, 1.18, 0.32), 0.34, FIRE, n=2)
b.box(-0.28, 0.6, 0.0, 0.08, 0.3, 0.08, RED, roll=-15)
body = b.emit('imp_body')
wings = []
for s in (-1, 1):
    w = Builder(M)
    bat_wing(w, (s * 0.12, 0.82, -0.18), s, 0.62, 0.3, 0.2, 0.1, WING, DARKR, fingers=3, r=0.025)
    objs = w.emit(f'imp_wing{s}')
    pv = pivot(f'imp_wing_pivot{s}', (s * 0.12, 0.82, -0.18), objs)
    key_rot(pv, 'y', [(1, 20 * s), (7, -25 * s), (13, 20 * s), (19, -25 * s), (25, 20 * s)])
    wings.append(pv)
root = pivot('imp', (0, 0, 0), body + wings)
root.location.z += 0.25
key_loc(root, [(1, 0), (7, 0.14), (13, 0), (19, 0.14), (25, 0)])
finish('imp')

# ─────────── WISP ───────────
M = new_scene()
CORE = glowmat(M, 'wisp_core', '#FFFFFF', 9.0)
HALO = glowmat(M, 'wisp_halo', '#7DF9FF', 4.0)
FLAME = fire_mat(M, 'wisp_flame', '#5ADCFF', '#FFFFFF', 7.0)
SPARK = glowmat(M, 'wisp_spark', '#FFF2A0', 6.0)
shadow(M, 0.35)
b = Builder(M)
b.sphere(0, 1.0, 0, 0.17, CORE, 10, 6)
b.sphere(0, 1.0, 0, 0.27, HALO, 10, 6)
for k in range(3):
    card(b, (0, 0.85, 0), (0.08 * math.cos(k), 1.6, 0.08 * math.sin(k)), 0.6, FLAME, n=2, roll=k * 60)
card(b, (0, 1.05, 0), (0, 0.55, 0), 0.35, FLAME, n=2)
inner = b.emit('wisp')
orb = []
for k in range(4):
    sb = Builder(M)
    a = 2 * math.pi * k / 4
    sb.octa(math.cos(a) * 0.45, 1.0 + 0.15 * math.sin(a * 2), math.sin(a) * 0.45, 0.05, 0.09, SPARK)
    orb += sb.emit(f'spark{k}')
ring = pivot('wisp_ring', (0, 1.0, 0), orb)
key_rot(ring, 'y', [(1, 0), (13, 180), (25, 360)])
linear(ring)
core = pivot('wisp_core', (0, 1.0, 0), inner)
key_scale3(core, [(1, (1, 1, 1)), (7, (1.15, 1.2, 1.15)), (13, (0.9, 0.95, 0.9)), (19, (1.1, 1.1, 1.1)), (25, (1, 1, 1))])
root = pivot('wisp', (0, 0, 0), [core, ring])
key_loc(root, [(1, 0), (13, 0.15), (25, 0)])
finish('wisp')

# ─────────── HOUND ───────────
M = new_scene()
FUR = skin(M, 'hound_fur', '#2A1414', 0.8, seed=51, scale=0.3, contrast=0.55)
BONEH = M.add('hound_bone', '#D8CCB0', 0.0, 0.5)
EYE = glowmat(M, 'hound_eye', '#FF5A1A', 8.0)
MANE = fire_mat(M, 'hound_mane', '#FF3B1A', '#FFE08A', 6.0)
LAVA = glowmat(M, 'hound_lava', '#FF5A1A', 3.0)
shadow(M, 0.7)
b = Builder(M)
b.box(0, 0.75, 0, 0.42, 0.42, 1.1, FUR, pitch=-4)                                  # body
b.box(0, 0.62, -0.05, 0.3, 0.05, 0.8, LAVA)                                        # glowing belly seam
for k in range(5):
    b.box(0, 0.98, -0.35 + k * 0.17, 0.26, 0.05, 0.08, BONEH)                      # ribbed spine plates
b.box(0, 0.95, 0.62, 0.3, 0.3, 0.32, FUR)                                          # head
b.box(0, 0.86, 0.86, 0.2, 0.16, 0.26, FUR)                                         # snout
b.box(0, 0.78, 0.86, 0.18, 0.06, 0.24, BONEH)                                      # jaw
for s in (-1, 1):
    b.sphere(s * 0.1, 1.0, 0.78, 0.035, EYE, 6, 4)
    cone(b, (s * 0.1, 1.08, 0.58), (s * 0.15, 1.32, 0.48), 0.06, BONEH, 4)
    for k in range(3):
        b.octa(s * 0.05 + (k - 1) * 0.02, 0.74, 0.96 - k * 0.04, 0.012, 0.035, BONEH)
for k in range(4):
    card(b, (0, 1.0, 0.45 - k * 0.22), (0, 1.45 - k * 0.06, 0.3 - k * 0.25), 0.36, MANE, n=2)
tube(b, (0, 0.85, -0.55), (0, 1.1, -0.95), 0.06, 0.03, FUR, 5)
card(b, (0, 1.05, -0.9), (0, 1.4, -1.05), 0.26, MANE, n=2)
body = b.emit('hound_body')
legs = []
for (sx, sz) in ((-1, 1), (1, 1), (-1, -1), (1, -1)):
    lg = Builder(M)
    lg.box(sx * 0.15, 0.32, sz * 0.38, 0.12, 0.62, 0.14, FUR)
    lg.box(sx * 0.15, 0.03, sz * 0.38 + 0.05, 0.14, 0.06, 0.2, BONEH)
    objs = lg.emit(f'hleg{sx}{sz}')
    pv = pivot(f'hleg_pivot{sx}{sz}', (sx * 0.15, 0.62, sz * 0.38), objs)
    a = 30 if sx * sz > 0 else -30
    key_rot(pv, 'x', [(1, a), (13, -a), (25, a)])
    legs.append(pv)
root = pivot('hound', (0, 0, 0), body + legs)
key_loc(root, [(1, 0), (7, 0.08), (13, 0), (19, 0.08), (25, 0)])
finish('hound')

# ─────────── BRUTE ───────────
M = new_scene()
STONE = skin(M, 'brute_stone', '#6A625A', 0.85, seed=61, scale=0.6, contrast=0.6)
MOSS = skin(M, 'brute_moss', '#3A5A2A', 0.95, seed=63, scale=0.4)
RUNE = glowmat(M, 'brute_rune', '#FFB43A', 5.0)
EYE = glowmat(M, 'brute_eye', '#FFE14A', 8.0)
shadow(M, 0.95)
b = Builder(M)
for s in (-1, 1):
    b.box(s * 0.32, 0.45, 0, 0.42, 0.9, 0.46, STONE, roll=s * 4)                   # legs
    b.box(s * 0.32, 0.06, 0.08, 0.5, 0.14, 0.6, STONE)
b.box(0, 1.35, 0, 1.25, 1.0, 0.8, STONE, pitch=8)                                  # torso
b.box(0, 1.92, -0.05, 1.45, 0.45, 0.9, STONE, pitch=8)                             # shoulders
b.box(0, 1.95, -0.1, 1.2, 0.12, 0.7, MOSS)
b.box(0, 2.2, 0.22, 0.42, 0.36, 0.42, STONE)                                       # small head
for s in (-1, 1):
    b.sphere(s * 0.1, 2.24, 0.44, 0.045, EYE, 6, 4)
for (x, y, w, h, rl) in ((0, 1.4, 0.06, 0.7, 12), (-0.25, 1.2, 0.05, 0.4, -30), (0.3, 1.55, 0.05, 0.35, 40), (0.1, 1.85, 0.32, 0.05, 0)):
    b.box(x, y, 0.42, w, h, 0.03, RUNE, roll=rl)
body = b.emit('brute_body')
arms = []
for s in (-1, 1):
    a = Builder(M)
    a.box(s * 0.92, 1.5, 0.05, 0.42, 0.75, 0.45, STONE)
    a.box(s * 0.98, 0.85, 0.15, 0.5, 0.7, 0.5, STONE)
    a.box(s * 1.0, 0.4, 0.22, 0.62, 0.42, 0.62, STONE)                              # fists
    a.box(s * 1.0, 0.65, 0.53, 0.3, 0.05, 0.03, RUNE)
    objs = a.emit(f'brute_arm{s}')
    pv = pivot(f'brute_arm_pivot{s}', (s * 0.85, 1.85, 0.0), objs)
    key_rot(pv, 'x', [(1, 10 * s), (13, -10 * s), (25, 10 * s)])
    arms.append(pv)
root = pivot('brute', (0, 0, 0), body + arms)
key_rot(root, 'z', [(1, -3), (13, 3), (25, -3)])
key_loc(root, [(1, 0), (7, 0.05), (13, 0), (19, 0.05), (25, 0)])
finish('brute')

print('BESTIARY', json.dumps(REPORT))

# ─────────── imp fireball (projectile, static; spun in TS) ───────────
M = new_scene()
CORE = glowmat(M, 'impfire_core', '#FFE08A', 7.0)
FLM = fire_mat(M, 'impfire_flame', '#FF6A1A', '#FFF4C8', 6.0)
b = Builder(M)
b.sphere(0, 0, 0, 0.16, CORE, 8, 6)
for k in range(3):
    card(b, (0, 0, 0.12), (0, 0, -0.55), 0.42, FLM, n=2, roll=k * 60)
b.emit('impfire')
finish('fx_impfire', animated=False)
print('IMPFIRE', json.dumps(REPORT.get('fx_impfire')))
