"""
PET SHOP — a menagerie stall beside the WHO IS GOD throne (arena east end, x 41.8–47, z 13.4–19), facing west
toward the gate. Striped canopy, soul jars on the counter, cages with glowing eyes, three cushions where the free
pets sit (placed at runtime), lanterns and a sign board.
PET GOD — the 10th and last pet: a little floating god with a crown, halo and two pairs of wings (animated "Idle").
Run: python3 blender/build_petshop.py → models/pet_shop.glb (scene origin), models/pet_god.glb (feet at origin)
"""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(__file__))
from rig import *  # noqa
from mythparts import torus, rays, disc, tube, cone, card, fire_mat, angel_wing  # noqa

SX, SZ = 44.4, 16.2       # stall centre
FX = 42.2                 # front (counter) line
BX = 46.7                 # back wall
Z0, Z1 = SZ - 2.7, SZ + 2.7

# ═════════ PET SHOP ═════════
M = new_scene()
STONE = skin(M, 'ps_stone', '#4A4250', 0.85, seed=71, scale=0.8, contrast=0.5)
WOOD = skin(M, 'ps_wood', '#4A2E1C', 0.7, seed=72, scale=0.5, contrast=0.6)
GOLD = M.add('ps_gold', '#D9A93E', 1.0, 0.25, '#4A3000', 0.3)
IRON = M.add('ps_iron', '#2A2830', 0.85, 0.4)
CLOTH_A = M.add('ps_cloth_a', '#5A1A8A', 0.0, 0.8)
CLOTH_B = M.add('ps_cloth_b', '#E8C060', 0.0, 0.75)
GLASS = M.add('ps_glass', '#CFE8FF', 0.1, 0.05, '#203040', 0.3, alpha=0.3)
GLOWS = [glowmat(M, 'ps_soul_g', '#7DFF5A', 5.0), glowmat(M, 'ps_soul_p', '#B04BFF', 5.0), glowmat(M, 'ps_soul_o', '#FF7A2A', 5.0), glowmat(M, 'ps_soul_c', '#3FE6FF', 5.0)]
EYE = glowmat(M, 'ps_eye', '#FFE14A', 8.0)
FLAME = fire_mat(M, 'ps_flame', '#FFB02A', '#FFF4C8', 5.0)
RUG = M.add('ps_rug', '#7A1022', 0.0, 0.9)
B = Builder(M)

# platform + steps
B.box(SX, 0.14, SZ, BX - FX + 1.0, 0.28, Z1 - Z0 + 0.6, STONE, collide=True)
B.box(FX - 0.75, 0.07, SZ, 0.5, 0.14, 3.2, STONE)
B.decal(SX + 0.6, 0.29, SZ, 2.6, 4.2, RUG)
# back wall with gold frame
B.box(BX, 1.9, SZ, 0.25, 3.3, Z1 - Z0, WOOD, collide=True)
B.box(BX - 0.14, 3.55, SZ, 0.1, 0.12, Z1 - Z0, GOLD)
for z in (Z0 + 0.1, SZ, Z1 - 0.1):
    B.box(BX - 0.14, 1.9, z, 0.12, 3.3, 0.12, GOLD)
# shelves on the back wall with soul jars
for i, y in enumerate((1.25, 2.15)):
    B.box(BX - 0.35, y, SZ, 0.45, 0.06, Z1 - Z0 - 0.5, WOOD)
    for j in range(5):
        z = Z0 + 0.8 + j * ((Z1 - Z0 - 1.6) / 4)
        B.cyl(BX - 0.35, y + 0.03, z, 0.13, 0.32, GLASS, seg=10)
        B.sphere(BX - 0.35, y + 0.18, z, 0.08, GLOWS[(i * 5 + j) % 4], 6, 4)
        B.cyl(BX - 0.35, y + 0.35, z, 0.09, 0.05, GOLD, seg=8)
# corner posts + canopy (striped, sloping down to the front, scalloped edge)
ROOF_B, ROOF_F = 4.3, 3.35
for (x, z) in ((FX - 0.2, Z0), (FX - 0.2, Z1), (BX, Z0), (BX, Z1)):
    B.cyl(x, 0.28, z, 0.11, (ROOF_F if x < SX else ROOF_B) - 0.28, IRON, seg=8)
    B.sphere(x, (ROOF_F if x < SX else ROOF_B) + 0.05, z, 0.12, GOLD, 8, 5)
stripes = 8
for i in range(stripes):
    za = Z0 - 0.25 + (Z1 - Z0 + 0.5) * i / stripes
    zb = Z0 - 0.25 + (Z1 - Z0 + 0.5) * (i + 1) / stripes
    m = CLOTH_A if i % 2 == 0 else CLOTH_B
    B.quad((FX - 0.6, ROOF_F, za), (FX - 0.6, ROOF_F, zb), (BX + 0.2, ROOF_B, zb), (BX + 0.2, ROOF_B, za), m)
    # scalloped flap hanging at the front
    zm = (za + zb) / 2
    B.faces(B.a(m), [(FX - 0.6, ROOF_F, za), (FX - 0.6, ROOF_F, zb), (FX - 0.6, ROOF_F - 0.42, zm)], [[0, 1, 2]], smooth=False)
B.box(FX - 0.6, ROOF_F + 0.02, SZ, 0.08, 0.08, Z1 - Z0 + 0.6, GOLD)
# sign board above the canopy front (text at runtime)
B.box(FX - 0.35, ROOF_F + 0.75, SZ, 0.14, 0.9, 3.6, WOOD)
B.box(FX - 0.44, ROOF_F + 1.22, SZ, 0.1, 0.08, 3.8, GOLD)
B.box(FX - 0.44, ROOF_F + 0.28, SZ, 0.1, 0.08, 3.8, GOLD)
for s in (-1, 1):
    B.box(FX - 0.35, ROOF_F + 0.35, SZ + s * 1.4, 0.06, 0.5, 0.06, IRON)
# paw emblem on the board edge
for (dz, dy, r) in ((0, 0, 0.13), (-0.14, 0.15, 0.06), (-0.05, 0.21, 0.06), (0.05, 0.21, 0.06), (0.14, 0.15, 0.06)):
    B.sphere(FX - 0.44, ROOF_F + 0.75 + dy, SZ - 1.55 + dz, r, GOLD, 8, 5)
# counter at the front
B.box(FX + 0.45, 0.78, SZ, 0.7, 1.0, Z1 - Z0 - 0.9, WOOD, collide=True)
B.box(FX + 0.45, 1.3, SZ, 0.86, 0.06, Z1 - Z0 - 0.75, GOLD)
for z in (Z0 + 0.7, SZ - 0.9, SZ + 0.9, Z1 - 0.7):
    B.box(FX + 0.08, 0.78, z, 0.05, 0.9, 0.05, GOLD)
# soul jars on the counter
for j, z in enumerate((SZ - 1.5, SZ - 0.5, SZ + 0.5, SZ + 1.5)):
    B.cyl(FX + 0.45, 1.33, z, 0.17, 0.42, GLASS, seg=12)
    B.sphere(FX + 0.45, 1.52, z, 0.11, GLOWS[j % 4], 8, 5)
    B.cyl(FX + 0.45, 1.75, z, 0.12, 0.06, GOLD, seg=10)
# three cushions where the free pets sit
for z in (SZ - 1.5, SZ, SZ + 1.5):
    B.cyl(SX + 0.9, 0.28, z, 0.55, 0.35, STONE, seg=16)
    B.cyl(SX + 0.9, 0.63, z, 0.5, 0.12, RUG, seg=16, r_top=0.44)
    torus(B, (SX + 0.9, 0.66, z), (0, 1, 0), 0.5, 0.03, GOLD, 16, 4)
# hanging cages with glowing eyes (front corners)
for z in (Z0 + 0.4, Z1 - 0.4):
    cx = FX + 0.2
    tube(B, (cx, ROOF_F - 0.05, z), (cx, ROOF_F - 0.7, z), 0.012, 0.012, IRON, 4)
    B.cyl(cx, ROOF_F - 1.55, z, 0.32, 0.05, IRON, seg=10)
    for k in range(8):
        a = 2 * math.pi * k / 8
        tube(B, (cx + math.cos(a) * 0.3, ROOF_F - 1.52, z + math.sin(a) * 0.3), (cx + math.cos(a) * 0.05, ROOF_F - 0.72, z + math.sin(a) * 0.05), 0.012, 0.012, IRON, 3)
    for s in (-1, 1):
        B.sphere(cx - 0.12, ROOF_F - 1.28, z + s * 0.06, 0.035, EYE, 6, 4)
# lanterns on the front posts
for z in (Z0 - 0.25, Z1 + 0.25):
    B.box(FX - 0.25, 2.25, z, 0.22, 0.32, 0.22, IRON)
    card(B, (FX - 0.25, 2.12, z), (FX - 0.25, 2.42, z), 0.16, FLAME, n=2)
B.emit('pet_shop')
finish('pet_shop', animated=False)

# ═════════ PET GOD ═════════
M = new_scene()
BODY = M.add('pg_body', '#FFF4DC', 0.0, 0.35, '#FFD86A', 0.5)
GLD = M.add('pg_gold', '#E8B84A', 1.0, 0.2, '#5A3A00', 0.5)
HALO = glowmat(M, 'pg_halo', '#FFE9A8', 6.0)
EYEG = glowmat(M, 'pg_eye', '#7DF9FF', 8.0)
GEM = glowmat(M, 'pg_gem', '#FF4AA8', 6.0)
FEATH = M.add('pg_feather', '#FFFFFF', 0.0, 0.4, '#FFE9C0', 0.6)
SUN = glowmat(M, 'pg_sun', '#FFC94A', 3.0)
TAIL = fire_mat(M, 'pg_tail', '#FFD86A', '#FFFFFF', 5.0)
shadow(M, 0.45)
b = Builder(M)
Y0 = 0.75
b.sphere(0, Y0, 0, 0.32, BODY, 14, 9, ry=0.36)                         # round little body
b.sphere(0, Y0 + 0.52, 0.04, 0.27, BODY, 14, 9)                         # big head
for s in (-1, 1):
    b.sphere(s * 0.1, Y0 + 0.55, 0.26, 0.06, EYEG, 8, 5)
    b.sphere(s * 0.2, Y0 + 0.44, 0.2, 0.04, GEM, 6, 4)                  # rosy cheeks
    b.sphere(s * 0.26, Y0 + 0.02, 0.08, 0.09, BODY, 8, 5)               # little arms
    b.sphere(s * 0.13, Y0 - 0.33, 0.04, 0.09, BODY, 8, 5)               # feet
# crown
b.cyl(0, Y0 + 0.74, 0.02, 0.17, 0.1, GLD, seg=16, r_top=0.2)
for k in range(6):
    a = 2 * math.pi * k / 6
    cone(b, (math.cos(a) * 0.18, Y0 + 0.82, 0.02 + math.sin(a) * 0.18), (math.cos(a) * 0.2, Y0 + 0.99, 0.02 + math.sin(a) * 0.2), 0.04, GLD, 4)
b.octa(0, Y0 + 0.82, 0.21, 0.04, 0.06, GEM)
# sash + sun medallion
torus(b, (0, Y0 + 0.02, 0), (0.25, 1, 0), 0.31, 0.03, GLD, 24, 4)
disc(b, (0, Y0 + 0.05, 0.33), (0, 0, 1), 0.08, SUN, 12)
# sun rays behind
rays(b, (0, Y0 + 0.3, -0.25), (0, 0, -1), 0.3, 0.8, 16, 0.05, SUN, alt=0.4)
rays(b, (0, Y0 + 0.3, -0.25), (0, 0, 1), 0.3, 0.8, 16, 0.05, SUN, alt=0.4)
card(b, (0, Y0 - 0.15, -0.2), (0, Y0 - 0.5, -0.75), 0.32, TAIL, n=2)   # comet tail of light
body = b.emit('petgod_body')
hb = Builder(M)
torus(hb, (0, 0, 0), (0, 1, 0), 0.24, 0.025, HALO, 32, 4)
halo_o = hb.emit('petgod_halo')
halo = pivot('petgod_halo_p', (0, 0, 0), halo_o)
halo.location = to_b((0, Y0 + 1.1, 0))
key_loc(halo, [(1, 0), (13, 0.05), (25, 0)])
wings = []
for s in (-1, 1):
    for big in (True, False):
        wb = Builder(M)
        root = (s * 0.18, Y0 + (0.18 if big else -0.05), -0.18)
        angel_wing(wb, root, s, 0.6 if big else 0.42, 0.7 if big else 0.45, 0.12, FEATH, GLD, prim=7, sec=5, droop=0.7, thick=0.025)
        objs = wb.emit(f'pg_wing{s}{int(big)}')
        pv = pivot(f'pg_wing_p{s}{int(big)}', root, objs)
        amp = 24 if big else 18
        key_rot(pv, 'y', [(1, amp * s), (7, -amp * 0.6 * s), (13, amp * s), (19, -amp * 0.6 * s), (25, amp * s)])
        wings.append(pv)
rootp = pivot('pet_god', (0, 0, 0), body + wings + [halo])
key_loc(rootp, [(1, 0), (13, 0.14), (25, 0)])
finish('pet_god')
print('PETSHOP', json.dumps(REPORT))
