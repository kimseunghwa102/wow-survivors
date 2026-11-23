"""
WHO IS GOD? — the throne of the first hunter to defeat THE ALMIGHTY (Lv 1111).
Stands at the east end of the main arena, straight ahead of the gate from the Sanctuary (centre 44.2, 8.0),
facing west. The statue of the first God (their own avatar in the God skin) is placed on the dais by world.ts;
until someone wins, the dais is empty.
  · three marble tiers with gold rims, gold steps facing the gate
  · a golden throne with a tall back, a sunburst halo and a ring of light behind it
  · two pillars with braziers
Run: python3 blender/build_throne.py → models/god_throne.glb (placed at the scene origin, no collider)
"""
import os, sys, math, json
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa
from mythparts import tube, cone, card, fire_mat, torus, rays, disc, add, glowmat  # noqa

CX, CZ = 44.2, 8.0
TOP = 0.9  # dais top (the statue stands here)

M = scene()
MARBLE = M.add('thr_marble', '#E9E4DA', 0.05, 0.35)
VEIN = M.add('thr_vein', '#B9AE98', 0.1, 0.4)
GOLD = M.add('thr_gold', '#D4A63A', 0.95, 0.22)
DARK = M.add('thr_dark', '#2A2230', 0.3, 0.5)
VELVET = M.add('thr_velvet', '#6A0F2A', 0.0, 0.8)
GLOW = glowmat(M, 'thr_glow', '#FFD86A', 7)
SUN = tmat(M, 'thr_sun', t_radial('thr_sun.png', '#FFC94A', (1, 0.95, 0.8), n=512, power=1.6, spikes=24), 5)
FIRE = fire_mat(M, 'thr_fire', '#FFB02A', '#FFF4C8', 6.0)
B = Builder(M)

# three tiers
for i, (r, h) in enumerate(((3.1, 0.3), (2.55, 0.3), (2.0, 0.3))):
    y = i * 0.3
    B.cyl(CX, y, CZ, r, h, MARBLE, seg=40)
    torus(B, (CX, y + h, CZ), (0, 1, 0), r, 0.045, GOLD, 40, 5)
# gold step strip facing the gate (west)
for i in range(3):
    B.box(CX - 3.1 + i * 0.55 + 0.1, 0.06 + i * 0.3, CZ, 0.25, 0.04, 1.8, GOLD)
# floor inlay on top: a gold sun
disc(B, (CX, TOP + 0.01, CZ), (0, 1, 0), 1.7, VEIN, 40, 1.5)
rays(B, (CX, TOP + 0.015, CZ), (0, 1, 0), 0.5, 1.45, 16, 0.12, GOLD)

# the throne (behind the statue spot, its back to the east wall)
TX = CX + 1.25
B.box(TX, TOP + 0.25, CZ, 1.0, 0.5, 1.3, GOLD)            # base
B.box(TX - 0.05, TOP + 0.55, CZ, 0.9, 0.12, 1.15, VELVET)  # cushion
B.box(TX + 0.42, TOP + 1.9, CZ, 0.16, 2.9, 1.25, GOLD)     # tall back
B.box(TX + 0.33, TOP + 1.6, CZ, 0.04, 2.0, 0.95, VELVET)   # back cushion
for s in (-1, 1):                                          # arms + finials
    B.box(TX - 0.05, TOP + 0.85, CZ + s * 0.62, 0.9, 0.12, 0.12, GOLD)
    tube(B, (TX + 0.42, TOP, CZ + s * 0.62), (TX + 0.42, TOP + 3.5, CZ + s * 0.62), 0.07, 0.06, GOLD, 8)
    B.sphere(TX + 0.42, TOP + 3.6, CZ + s * 0.62, 0.13, GLOW, 10, 6)
cone(B, (TX + 0.42, TOP + 3.35, CZ), (TX + 0.42, TOP + 4.0, CZ), 0.22, GOLD, 8)

# sunburst halo + ring of light behind the throne
HX = TX + 0.62
B.quad((HX, TOP + 0.6, CZ + 2.4), (HX, TOP + 0.6, CZ - 2.4), (HX, TOP + 5.4, CZ - 2.4), (HX, TOP + 5.4, CZ + 2.4), SUN)
torus(B, (HX - 0.05, TOP + 3.0, CZ), (1, 0, 0), 2.05, 0.06, GLOW, 48, 5)
torus(B, (HX - 0.04, TOP + 3.0, CZ), (1, 0, 0), 2.3, 0.035, GOLD, 48, 4)
rays(B, (HX - 0.03, TOP + 3.0, CZ), (1, 0, 0), 2.35, 3.0, 24, 0.06, GOLD)

# two pillars with braziers flanking the dais
for s in (-1, 1):
    px, pz = CX + 0.4, CZ + s * 3.6
    B.box(px, 0.15, pz, 0.9, 0.3, 0.9, MARBLE)
    tube(B, (px, 0.3, pz), (px, 4.2, pz), 0.3, 0.26, MARBLE, 16)
    for k in range(3):
        torus(B, (px, 0.6 + k * 1.6, pz), (0, 1, 0), 0.31, 0.03, GOLD, 16, 4)
    B.cyl(px, 4.2, pz, 0.45, 0.25, GOLD, seg=16, r_top=0.55)
    card(B, (px, 4.4, pz), (px, 5.8, pz), 0.9, FIRE, n=3)

# (no light column: the arena has a roof over this end)

B.emit('god_throne')
finish('god_throne')
print('THRONE', json.dumps(REPORT))
