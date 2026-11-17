"""
WOW NIGHTSWARM — ARMORY (manual weapons) + boss/nuke effects (Blender / bpy).
Weapons are authored with the grip at the origin and the business end toward +z (DCL forward);
the game floats the weapon at the player's right side and swings it.
Run: python3 blender/build_armory.py → models/w_*.glb, models/fx_sw_*.glb, fx_tracer, fx_nuke, fx_slam*, fx_quake
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa


def done(name):
    finish(name)


def metal(M, name, col, rough=0.3, emit=None, s=0.0):
    return M.add(name, col, 0.9, rough, emit, s)


# ═════════════ WEAPONS ═════════════
# 0 fists: spectral gauntlet
M = scene()
STEEL = metal(M, 'gauntlet', '#B9B3D9', 0.25)
GL = M.add('knuckle_glow', '#E8E2FF', 0.0, 0.3, '#B49BFF', 5.0)
B = Builder(M)
B.box(0, 0, 0.0, 0.2, 0.18, 0.26, STEEL)
for k in range(4):
    B.box(-0.075 + k * 0.05, 0.02, 0.15, 0.045, 0.06, 0.08, STEEL)
    B.octa(-0.075 + k * 0.05, 0.06, 0.17, 0.018, 0.03, GL)
B.box(0, 0, -0.18, 0.22, 0.2, 0.12, STEEL)
B.box(0, 0.1, -0.05, 0.12, 0.02, 0.18, GL)
B.emit('w')
done('w_fist')

# 1 frying pan
M = scene()
PAN = metal(M, 'pan_iron', '#2A2A30', 0.35)
HAND = M.add('pan_handle', '#3A2416', 0.0, 0.7)
SHINE = metal(M, 'pan_rim', '#9A9AA8', 0.2)
B = Builder(M)
B.box(0, 0, 0.18, 0.05, 0.035, 0.42, HAND)
B.box(0, 0, 0.42, 0.06, 0.04, 0.1, SHINE)
B.cyl(0, -0.03, 0.72, 0.27, 0.06, PAN, seg=20)
B.ring(0, -0.03, 0.72, 0.25, 0.28, 0.085, SHINE, seg=20)
B.emit('w')
done('w_pan')

# 2 war hammer
M = scene()
WOODH = M.add('haft', '#4A2E1A', 0.0, 0.8)
HEAD = metal(M, 'hammer_head', '#5A5560', 0.35)
GOLDM = metal(M, 'hammer_gold', '#E9B949', 0.25, '#7A5200', 0.5)
RUNE = M.add('hammer_rune', '#FFD86A', 0.0, 0.3, '#FFB000', 5.0)
B = Builder(M)
B.box(0, 0, 0.45, 0.06, 0.06, 1.0, WOODH)
B.box(0, 0, 0.0, 0.08, 0.08, 0.14, GOLDM)
B.box(0, 0, 1.0, 0.5, 0.26, 0.26, HEAD)
B.box(0, 0, 1.0, 0.54, 0.29, 0.06, GOLDM)
for s in (-1, 1):
    B.box(s * 0.27, 0, 1.0, 0.04, 0.2, 0.2, GOLDM)
B.octa(0, 0.14, 1.0, 0.07, 0.04, RUNE)
B.emit('w')
done('w_hammer')

# 3 flame sword
M = scene()
BLADE = M.add('flame_blade', '#FF8A3A', 0.6, 0.2, '#FF4A00', 3.0)
EDGE = M.add('flame_edge', '#FFE27A', 0.0, 0.2, '#FFB000', 7.0)
HILT = metal(M, 'flame_hilt', '#1A1418', 0.4)
GEM = M.add('flame_gem', '#FF2A10', 0.0, 0.2, '#FF2A10', 6.0)
FL = tmat(M, 'flame_aura', t_band('w_flame_aura.png', '#FF6A1E', (1, 0.95, 0.6)), 3)
B = Builder(M)
B.box(0, 0, 0.05, 0.05, 0.05, 0.25, HILT)
B.box(0, 0, 0.2, 0.36, 0.06, 0.06, HILT)
B.octa(0, 0, 0.2, 0.05, 0.05, GEM)
# blade as a long tapered box + glowing edge
for k in range(6):
    z0 = 0.24 + k * 0.2
    w = 0.12 - k * 0.012
    B.box(0, 0, z0 + 0.1, w, 0.025, 0.2, BLADE)
    B.box(0, 0, z0 + 0.1, w + 0.02, 0.01, 0.2, EDGE)
B.octa(0, 0, 1.47, 0.05, 0.02, EDGE)
# licking flames along the blade (vertical band quads)
for k in range(3):
    z = 0.4 + k * 0.4
    B.quad((-0.12, 0.0, z - 0.2), (0.12, 0.0, z - 0.2), (0.12, 0.35, z + 0.15), (-0.12, 0.35, z + 0.15), FL, uv=((0, 0), (1, 0), (1, 1), (0, 1)))
B.emit('w')
done('w_flame')

# 4 reaper blade (scythe)
M = scene()
SH = metal(M, 'reaper_shaft', '#1A1020', 0.4)
BL = M.add('reaper_blade', '#3A1A5A', 0.85, 0.15, '#7B2BFF', 2.0)
ED = M.add('reaper_edge', '#E0C8FF', 0.0, 0.2, '#B07BFF', 7.0)
SK = M.add('reaper_skull', '#DCD3BC', 0.0, 0.5)
EY = M.add('reaper_eye', '#FF1030', 0.0, 0.3, '#FF1030', 8.0)
B = Builder(M)
B.box(0, 0, 0.75, 0.05, 0.05, 1.7, SH)
B.sphere(0, 0, 1.62, 0.09, SK, 8, 5)
for s in (-1, 1):
    B.sphere(s * 0.03, 0.03, 1.69, 0.018, EY, 5, 3)
# flat curved blade in the x/z plane at the top of the shaft
outer = [(0.05 + 0.9 * math.sin(math.radians(t * 95)), 1.55 - 0.55 * (1 - math.cos(math.radians(t * 95)))) for t in [i / 12 for i in range(13)]]
inner = [(0.05 + 0.62 * math.sin(math.radians(t * 95)), 1.48 - 0.32 * (1 - math.cos(math.radians(t * 95)))) for t in [i / 12 for i in range(13)]]
vs = [(x, -0.012, z) for x, z in outer] + [(x, -0.012, z) for x, z in inner]
vs2 = [(x, 0.012, z) for x, z in outer] + [(x, 0.012, z) for x, z in inner]
n = len(outer)
fs = [[i, i + 1, n + i + 1, n + i] for i in range(n - 1)]
B.faces(B.a(BL), vs + vs2, fs + [[2 * n + i, 2 * n + n + i, 2 * n + n + i + 1, 2 * n + i + 1] for i in range(n - 1)])
for i in range(n - 1):
    (x0, z0), (x1, z1) = outer[i], outer[i + 1]
    ln = math.hypot(x1 - x0, z1 - z0)
    B.box((x0 + x1) / 2, 0, (z0 + z1) / 2, ln + 0.01, 0.03, 0.03, ED, yaw=math.degrees(math.atan2(x1 - x0, z1 - z0)) + 90)
B.emit('w')
done('w_reaper')

# 5 storm minigun
M = scene()
BODY = metal(M, 'gun_body', '#2A3038', 0.35)
BAR = metal(M, 'gun_barrel', '#8A96A6', 0.2)
CY = M.add('gun_glow', '#7FE8FF', 0.0, 0.3, '#20C8FF', 6.0)
YEL = M.add('gun_stripe', '#FFD24A', 0.4, 0.3, '#B08000', 0.6)
B = Builder(M)
B.box(0, 0, 0.05, 0.3, 0.3, 0.55, BODY)
B.box(0, -0.2, -0.05, 0.08, 0.2, 0.1, BODY)
B.box(0, 0.2, 0.05, 0.06, 0.1, 0.35, BODY)
B.box(0.16, 0, 0.05, 0.02, 0.18, 0.5, YEL)
for k in range(6):
    a = 2 * math.pi * k / 6
    cx, cy = math.cos(a) * 0.09, math.sin(a) * 0.09
    # barrels along +z (use thin boxes)
    B.box(cx, cy, 0.85, 0.045, 0.045, 0.9, BAR)
B.box(0, 0, 0.55, 0.26, 0.26, 0.06, BODY)
B.box(0, 0, 1.15, 0.25, 0.25, 0.05, BODY)
B.box(0, 0, 0.75, 0.05, 0.05, 1.0, CY)
B.box(0, 0.16, 0.0, 0.2, 0.03, 0.3, CY)
B.emit('w')
done('w_minigun')

# 6 doomsday nuke (missile)
M = scene()
SHELL = metal(M, 'nuke_shell', '#C9CDD6', 0.35)
RED = M.add('nuke_red', '#D01A1A', 0.3, 0.4)
YELW = M.add('nuke_hazard', '#FFD000', 0.2, 0.4, '#806000', 0.3)
JET = tmat(M, 'nuke_jet', t_band('w_nuke_jet.png', '#FF7A1A', (1, 1, 0.8)), 6)
B = Builder(M)
# body as a lying cylinder: build along y then it's rotated by the game? keep it authored along +z with boxes + octa
for k in range(8):
    B.box(0, 0, 0.15 + k * 0.15, 0.3, 0.3, 0.155, SHELL if k % 3 else YELW)
B.faces(B.a(RED), [(-0.15, -0.15, 1.27), (0.15, -0.15, 1.27), (0.15, 0.15, 1.27), (-0.15, 0.15, 1.27), (0, 0, 1.75)], [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [3, 2, 1, 0]])
for s in (-1, 1):
    B.box(s * 0.25, 0, 0.18, 0.22, 0.03, 0.3, RED)
    B.box(0, s * 0.25, 0.18, 0.03, 0.22, 0.3, RED)
B.quad((-0.14, 0, 0.05), (0.14, 0, 0.05), (0.14, 0, -0.9), (-0.14, 0, -0.9), JET, uv=((0, 0), (1, 0), (1, 1), (0, 1)))
B.quad((0, -0.14, 0.05), (0, 0.14, 0.05), (0, 0.14, -0.9), (0, -0.14, -0.9), JET, uv=((0, 0), (1, 0), (1, 1), (0, 1)))
B.emit('w')
done('w_nuke')

# ═════════════ SWING / IMPACT FX ═════════════
SW = {
    'fist': ('#D9D2FF', (1, 1, 1), False),
    'pan': ('#FFB84A', (1, 1, 0.85), False),
    'hammer': ('#FFD86A', (1, 1, 0.9), False),
    'flame': ('#FF5A10', (1, 0.95, 0.6), True),
    'reaper': ('#8A3BFF', (1, 0.85, 1), True),
}
for k, (col, hot, dbl) in SW.items():
    M = scene()
    m1 = tmat(M, 'sw', t_crescent(f'fx_sw_{k}.png', col, hot, double=dbl), 5)
    B = Builder(M)
    flat(B, 1.0, 1.0, m1)
    B.quad((-0.5, -0.1, -0.45), (0.5, -0.1, -0.45), (0.5, 0.12, 0.5), (-0.5, 0.12, 0.5), m1, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    if k == 'pan':   # cartoon "bonk" star
        m2 = tmat(M, 'bonk', t_radial('fx_bonk.png', '#FFE27A', (1, 1, 1), spikes=5, power=3), 4)
        B.quad((-0.2, 0.0, 0.3), (0.2, 0.0, 0.3), (0.2, 0.4, 0.3), (-0.2, 0.4, 0.3), m2)
    B.emit('fx')
    done(f'fx_sw_{k}')

# hammer quake ring
M = scene()
qm = tmat(M, 'quake', t_shock('fx_quake.png', '#FFC84A', (1, 1, 0.9), rings=2), 4)
B = Builder(M)
flat(B, 1.0, 1.0, qm, y=0.04)
B.emit('fx')
done('fx_quake')

# minigun tracer: length 1 along +z (scaled by hit distance) + muzzle flash
M = scene()
tr = tmat(M, 'tracer', t_band('fx_tracer.png', '#7FE8FF', (1, 1, 0.9)), 6)
mf = tmat(M, 'muzzle', t_radial('fx_muzzle.png', '#FFD86A', (1, 1, 1), spikes=6, power=2.5), 6)
B = Builder(M)
w = 0.06
B.quad((-w, 0, 0), (w, 0, 0), (w, 0, 1), (-w, 0, 1), tr, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
B.quad((0, -w, 0), (0, w, 0), (0, w, 1), (0, -w, 1), tr, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
B.quad((-0.25, -0.25, 0.02), (0.25, -0.25, 0.02), (0.25, 0.25, 0.02), (-0.25, 0.25, 0.02), mf)
B.emit('fx')
done('fx_tracer')

# nuke detonation: ground shock (diameter 1) + fireball + rising column
M = scene()
sh = tmat(M, 'nuke_shock', t_shock('fx_nuke_shock.png', '#FF7A1A', (1, 1, 0.85), rings=3), 6)
fb = tmat(M, 'nuke_fire', t_radial('fx_nuke_fire.png', '#FF5A10', (1, 1, 0.8), power=1.2), 6)
col = tmat(M, 'nuke_column', t_band('fx_nuke_column.png', '#FF8A3A', (1, 1, 0.9)), 5)
B = Builder(M)
flat(B, 1.0, 1.0, sh, y=0.05)
open_cyl(B, 0.08, 0.9, col, seg=16)
for k in range(3):     # mushroom cap: stacked glow crosses
    y = 0.75 + k * 0.08
    s_ = 0.45 - k * 0.08
    B.quad((-s_, y, -s_), (s_, y, -s_), (s_, y, s_), (-s_, y, s_), fb)
cross3(B, 0.5, fb)
B.emit('fx')
done('fx_nuke')

# boss slam telegraph (red ring that fills) + slam blast
M = scene()
yy, xx = (np.mgrid[0:512, 0:512] + 0.5) / 512 * 2 - 1
r = np.hypot(xx, yy)
a = np.clip(1 - np.abs(r - 0.96) / 0.03, 0, 1) + (r < 0.96) * 0.22 + np.clip(1 - np.abs(r - 0.5) / 0.015, 0, 1) * 0.4
arr = np.zeros((512, 512, 4))
arr[..., 0], arr[..., 1], arr[..., 2], arr[..., 3] = 1.0, 0.12, 0.1, np.clip(a, 0, 1) * (r < 1)
wm = tmat(M, 'warn', rgba('fx_slam_warn.png', arr), 3)
B = Builder(M)
flat(B, 1.0, 1.0, wm, y=0.06)
B.emit('fx')
done('fx_slam_warn')

M = scene()
bm = tmat(M, 'slam', t_shock('fx_slam.png', '#FF3B1E', (1, 0.9, 0.7), rings=3), 6)
wl = tmat(M, 'slam_wall', t_band('fx_slam_wall.png', '#FF5A2E', (1, 0.9, 0.7)), 4)
B = Builder(M)
flat(B, 1.0, 1.0, bm, y=0.05)
open_cyl(B, 0.48, 0.25, wl, seg=32)
B.emit('fx')
done('fx_slam')

print('ARMORY', json.dumps(REPORT))
