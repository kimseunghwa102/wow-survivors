"""
THE BLOOD RING — dressing for the PvP block (-106..-105, 79..80 → scene x 0.6-31.4, z 48-78.3).
Placed at the scene origin by world.ts (no collider: nothing here blocks movement).
  · a blood-red sigil laid over the purple rune circle (centre 16, 64)
  · the gate at the opening to the main arena (z = 48, x 16.6-31.4): two pillars with braziers, a crossbar,
    crossed swords and a thin red veil you walk through
  · eight braziers around the ring, glowing red corner columns, war banners on the walls, a red border strip
Run: python3 blender/build_pvpzone.py → models/pvp_zone.glb
"""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa
from mythparts import tube, cone, card, fire_mat, torus, blade, add, lerp, mul, glowmat  # noqa
import numpy as np

CX, CZ = 16.0, 64.0
X0, X1, Z0, Z1 = 0.6, 31.4, 48.0, 78.3
GX0, GX1 = 16.6, 31.4

M = scene()
SIGIL = tmat(M, 'pvp_sigil', t_rune('pvp_sigil.png', '#FF1E3A', (1, 0.8, 0.6), n=1024, seed=21, petals=6), 5)
STONE = M.add('pvp_stone', '#2A1E22', 0.1, 0.8)
IRON = M.add('pvp_iron', '#1A1618', 0.85, 0.35)
GOLD = M.add('pvp_gold', '#C9A24A', 0.9, 0.3)
RED = M.add('pvp_red', '#8A0A16', 0.0, 0.7)
STEEL = M.add('pvp_steel', '#D8DEE8', 0.95, 0.15)
GLOW = glowmat(M, 'pvp_glow', '#FF2A3D', 6)
FIRE = fire_mat(M, 'pvp_fire', '#FF3A1A', '#FFE0A0', 6.0)
VEIL = M.add('pvp_veil', '#FF2A3D', 0.0, 0.4, '#FF1E3A', 1.6, alpha=0.22)
COL = tmat(M, 'pvp_column', t_band('pvp_column.png', '#FF2A3D', (1, 0.8, 0.7)), 3)
B = Builder(M)

# sigil over the old rune circle
B.quad((CX - 8.2, 0.07, CZ - 8.2), (CX + 8.2, 0.07, CZ - 8.2), (CX + 8.2, 0.07, CZ + 8.2), (CX - 8.2, 0.07, CZ + 8.2), SIGIL)

# glowing border strip along the whole zone
for (a, b) in (((X0, Z0), (X0, Z1)), ((X0, Z1), (X1, Z1)), ((X1, Z1), (X1, Z0)), ((X0, Z0), (GX0, Z0))):
    B.box((a[0] + b[0]) / 2, 0.06, (a[1] + b[1]) / 2, max(0.12, abs(a[0] - b[0])), 0.04, max(0.12, abs(a[1] - b[1])), GLOW)
# the threshold line at the gate
B.box((GX0 + GX1) / 2, 0.07, Z0 + 0.25, GX1 - GX0, 0.05, 0.35, GLOW)


def brazier(x, z, s=1.0):
    tube(B, (x, 0, z), (x, 0.9 * s, z), 0.12 * s, 0.09 * s, IRON, 8)
    B.cyl(x, 0.9 * s, z, 0.42 * s, 0.22 * s, IRON, seg=12, r_top=0.5 * s)
    torus(B, (x, 1.12 * s, z), (0, 1, 0), 0.5 * s, 0.05 * s, GOLD, 16, 4)
    for k in range(3):
        a = 2 * math.pi * k / 3
        tube(B, (x, 0.05, z), (x + math.cos(a) * 0.45 * s, 0.02, z + math.sin(a) * 0.45 * s), 0.05 * s, 0.04 * s, IRON, 5)
    card(B, (x, 1.0 * s, z), (x, 2.4 * s, z), 1.1 * s, FIRE, n=3)


# eight braziers around the ring
for k in range(8):
    a = 2 * math.pi * (k + 0.5) / 8
    brazier(CX + math.cos(a) * 9.6, CZ + math.sin(a) * 9.6, 0.9)

# the gate
for gx in (GX0 + 0.7, GX1 - 0.7):
    B.box(gx, 3.0, Z0, 1.0, 6.0, 1.0, STONE)
    B.box(gx, 6.15, Z0, 1.3, 0.3, 1.3, IRON)
    for k in range(4):
        B.box(gx, 0.8 + k * 1.4, Z0 - 0.52, 0.12, 0.6, 0.06, GLOW)
    tube(B, (gx, 6.3, Z0), (gx, 6.7, Z0), 0.45, 0.55, IRON, 10)
    card(B, (gx, 6.6, Z0), (gx, 8.4, Z0), 1.4, FIRE, n=3)
B.box((GX0 + GX1) / 2, 7.1, Z0, GX1 - GX0 - 1.0, 0.5, 0.6, IRON)
B.box((GX0 + GX1) / 2, 7.1, Z0 - 0.32, GX1 - GX0 - 1.4, 0.12, 0.04, GLOW)
# crossed swords over the gate (facing the main arena, -z)
mid = ((GX0 + GX1) / 2, 8.6, Z0 - 0.15)
for s in (-1, 1):
    p0 = add(mid, (s * 1.3, -1.3, 0))
    p1 = add(mid, (-s * 1.5, 1.5, 0))
    blade(B, p0, p1, 0.34, 0.06, STEEL, tip=0.12, side=(0, 0, 1))
    tube(B, add(p0, (s * 0.35, -0.35, 0)), p0, 0.07, 0.07, RED, 6)
    tube(B, add(p0, (-0.3, -0.3 * s, 0)), add(p0, (0.3, 0.3 * s, 0)), 0.06, 0.06, GOLD, 5)
B.sphere(mid[0], mid[1], mid[2] - 0.05, 0.4, GLOW, 10, 6)
# red veil across the opening (walk-through)
gx0, gx1 = GX0 + 1.2, GX1 - 1.2
B.quad((gx0, 0, Z0 + 0.05), (gx1, 0, Z0 + 0.05), (gx1, 6.8, Z0 + 0.05), (gx0, 6.8, Z0 + 0.05), VEIL)

B.emit('pvp_zone_base')

# war banners on the walls: red cloth with crossed swords
WB = Builder(M)


def banner(x, z, nx, nz):
    # cloth hangs from y 7.5 to 3.0, 1.6 m wide, facing (nx, nz) into the ring
    sx, sz = -nz, nx
    top, bot = 7.6, 3.0
    p = (x + nx * 0.08, z + nz * 0.08)
    c = [(p[0] - sx * 0.8, top, p[1] - sz * 0.8), (p[0] + sx * 0.8, top, p[1] + sz * 0.8)]
    WB.quad((c[0][0], bot + 0.4, c[0][2]), (c[1][0], bot + 0.4, c[1][2]), c[1], c[0], RED)
    WB.faces(WB.a(RED), [(c[0][0], bot + 0.4, c[0][2]), (c[1][0], bot + 0.4, c[1][2]), (p[0], bot, p[1])], [[0, 1, 2], [2, 1, 0]])
    tube(WB, (c[0][0] - sx * 0.15, top + 0.05, c[0][2] - sz * 0.15), (c[1][0] + sx * 0.15, top + 0.05, c[1][2] + sz * 0.15), 0.06, 0.06, GOLD, 6)
    m = (p[0] + nx * 0.03, 5.6, p[1] + nz * 0.03)
    for s in (-1, 1):
        blade(WB, (m[0] + sx * s * 0.45, m[1] - 0.55, m[2] + sz * s * 0.45), (m[0] - sx * s * 0.5, m[1] + 0.6, m[2] - sz * s * 0.5), 0.12, 0.02, STEEL, tip=0.2, side=(nx, 0, nz))
    WB.sphere(m[0], m[1], m[2], 0.12, GLOW, 8, 5)


for k in range(4):
    a = math.pi / 4 + k * math.pi / 2
    bx, bz = CX + math.cos(a) * 11.6, CZ + math.sin(a) * 11.6
    nx, nz = -math.cos(a), -math.sin(a)
    sx, sz = -nz, nx
    for s2 in (-1, 1):
        tube(WB, (bx + sx * s2 * 0.95, 0, bz + sz * s2 * 0.95), (bx + sx * s2 * 0.95, 8.0, bz + sz * s2 * 0.95), 0.08, 0.07, IRON, 6)
        cone(WB, (bx + sx * s2 * 0.95, 8.0, bz + sz * s2 * 0.95), (bx + sx * s2 * 0.95, 8.6, bz + sz * s2 * 0.95), 0.1, GOLD, 4)
    banner(bx, bz, nx, nz)
WB.emit('pvp_banners')
finish('pvp_zone')
print('PVPZONE', json.dumps(REPORT))
