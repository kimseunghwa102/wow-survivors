"""
GOD POWERS (Lv 200+) + sky-god boss attacks — effect models. Unit sizes; view.ts scales them.
  fx_kame[_max]     Celestial Cannon beam (length 1 along +z from the origin)
  fx_meteor[_max]   Heaven's Nuke meteor (rock at the origin, fire trail behind/up)
  fx_hole[_max]     Singularity (black hole, diameter 1)
  fx_lsword[_max]   Judgment Blade (tip at y=0, 4 m tall)
  fx_feather[_max]  Seraph feather projectile (~0.7 m, points +z)
  fx_bbeam          boss energy beam (length 1 along +z)
  fx_borb           boss orb
  cos_seraph_wings  golden wings worn while Seraph Wings is active
Run: python3 blender/build_godfx.py
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa
import numpy as np


def t_beam(name, col, hot, w=128, h=512, core_w=0.2):
    yy, xx = (np.mgrid[0:h, 0:w] + 0.5)
    u = np.abs(xx / w - 0.5) * 2
    v = yy / h
    core = np.clip(1 - u / core_w, 0, 1)
    glow = np.clip(1 - u, 0, 1) ** 1.6
    wave = 0.85 + 0.15 * np.sin(v * 60)
    fade = np.clip((1 - v) / 0.12, 0, 1)
    a = np.clip((core + glow * 0.9) * fade * wave, 0, 1)
    rgb = hexc(col)[None, None, :] * (1 - core[..., None]) + np.array(hot) * core[..., None]
    return rgba(name, np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1))


def beam_model(name, col, hot, rings, G):
    M = scene()
    bm = tmat(M, 'beam', t_beam(f'{name}.png', col, hot), 7 * G)
    om = tmat(M, 'orb', t_radial(f'{name}_orb.png', col, hot, spikes=8, power=1.8), 6 * G)
    rm = tmat(M, 'ring', t_shock(f'{name}_ring.png', col, hot, rings=1), 5 * G)
    B = Builder(M)
    W = 1.0
    for k in range(3):
        a = math.radians(k * 60)
        dx, dy = math.cos(a) * W / 2, math.sin(a) * W / 2
        B.quad((-dx, -dy, 0), (dx, dy, 0), (dx, dy, 1), (-dx, -dy, 1), bm, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    # rings along the beam (spiral feel)
    for i in range(rings):
        z = (i + 0.5) / rings
        s = 1.5 - 0.6 * z
        B.quad((-s / 2, -s / 2, z), (s / 2, -s / 2, z), (s / 2, s / 2, z), (-s / 2, s / 2, z), rm)
    cross3(B, 2.0, om)
    B.emit('fx')
    finish(name)


for mx in (False, True):
    sfx_ = '_max' if mx else ''
    G = 1.5 if mx else 1.0

    # ── CELESTIAL CANNON ──
    beam_model(f'fx_kame{sfx_}', '#5EF2FF' if not mx else '#FFD86A', (1, 1, 1), 6 if mx else 4, G)

    # ── HEAVEN'S NUKE meteor ──
    M = scene()
    rock = M.add('met_rock', '#2A1A12', 0.0, 0.9, '#FF4A00', 1.5)
    lava = M.add('met_lava', '#FF8A1A', 0.0, 0.5, '#FF6A00', 6.0 * G)
    tr = tmat(M, 'met_trail', t_band(f'fx_meteortrail{sfx_}.png', '#FF6A1A', (1, 0.95, 0.6)), 5 * G)
    gl = tmat(M, 'met_glow', t_radial(f'fx_meteorglow{sfx_}.png', '#FF7A1A', (1, 1, 0.8), spikes=6, power=2.0), 5 * G)
    B = Builder(M)
    B.sphere(0, 0.9, 0, 0.9, rock, 9, 6)
    for k in range(6):
        a = k * 1.05
        B.octa(math.cos(a) * 0.7, 0.9 + math.sin(a) * 0.5, math.sin(a) * 0.7, 0.25, 0.35, lava)
    open_cyl(B, 0.75, 6.0 if mx else 4.5, tr, seg=12, y0=0.8)
    cross3(B, 3.2 if mx else 2.6, gl)
    B.emit('fx')
    finish(f'fx_meteor{sfx_}')

    # ── SINGULARITY ──
    M = scene()
    dk = M.add('hole_void', '#000000', 0.0, 0.2)
    acc = tmat(M, 'hole_ring', t_shock(f'fx_holering{sfx_}.png', '#B05BFF' if not mx else '#FF4FD2', (1, 0.9, 1), rings=3), 5 * G)
    sw = tmat(M, 'hole_swirl', t_rune(f'fx_holeswirl{sfx_}.png', '#7A2BFF', (1, 0.8, 1), n=512, petals=6, seed=21), 4 * G)
    B = Builder(M)
    B.sphere(0, 0.9, 0, 0.32, dk, 12, 8)
    flat(B, 1.0, 1.0, acc, y=0.9)
    flat(B, 1.4, 1.4, sw, y=0.05)
    B.quad((-0.5, 0.4, 0), (0.5, 0.4, 0), (0.5, 1.4, 0), (-0.5, 1.4, 0), acc)
    B.emit('fx')
    finish(f'fx_hole{sfx_}')

    # ── JUDGMENT BLADE ──
    M = scene()
    bl = M.add('sword_blade', '#FFFFFF', 0.3, 0.1, '#FFF2B0' if not mx else '#FFD86A', 6.0 * G, alpha=0.9)
    hi = M.add('sword_hilt', '#E9B949', 0.95, 0.2, '#7A5200', 1.0)
    gw = tmat(M, 'sword_glow', t_band(f'fx_swordglow{sfx_}.png', '#FFE9A8', (1, 1, 1)), 4 * G)
    B = Builder(M)
    for (ax, az) in ((1, 0), (0, 1)):
        vs = [(0, 0, 0), (0.24 * ax, 0.7, 0.24 * az), (0.18 * ax, 3.2, 0.18 * az), (-0.18 * ax, 3.2, -0.18 * az), (-0.24 * ax, 0.7, -0.24 * az)]
        B.faces(B.a(bl), vs, [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]])
    B.box(0, 3.3, 0, 1.1, 0.16, 0.2, hi)
    B.box(0, 3.75, 0, 0.12, 0.8, 0.12, hi)
    B.octa(0, 4.25, 0, 0.14, 0.18, hi)
    open_cyl(B, 0.35, 3.0, gw, seg=10)
    B.emit('fx')
    finish(f'fx_lsword{sfx_}')

    # ── SERAPH FEATHER ──
    M = scene()
    fm = M.add('feather', '#FFFFFF', 0.0, 0.4, '#FFE9A8' if not mx else '#FFD86A', 5.0 * G, alpha=0.95)
    fg = tmat(M, 'feather_glow', t_radial(f'fx_featherglow{sfx_}.png', '#FFE9A8', (1, 1, 1), power=2.4), 3 * G)
    B = Builder(M)
    B.faces(B.a(fm), [(0, 0, 0.4), (0.12, 0, 0.0), (0.06, 0, -0.35), (0, 0, -0.4), (-0.06, 0, -0.35), (-0.12, 0, 0.0)],
            [[0, 1, 2, 3, 4, 5], [5, 4, 3, 2, 1, 0]])
    cross3(B, 0.8, fg)
    B.emit('fx')
    finish(f'fx_feather{sfx_}')

# ── boss attacks ──
beam_model('fx_bbeam', '#FF2A5A', (1, 0.85, 0.9), 4, 1.2)
M = scene()
oc = M.add('borb_core', '#1A0008', 0.0, 0.3, '#FF1A3A', 4.0)
og = tmat(M, 'borb_glow', t_radial('fx_borbglow.png', '#FF2A5A', (1, 0.8, 0.85), spikes=4, power=2.2), 5)
B = Builder(M)
B.sphere(0, 0, 0, 0.28, oc, 8, 6)
cross3(B, 1.3, og)
B.emit('fx')
finish('fx_borb')

# ── golden seraph wings (avatar, upper spine) ──
import bpy  # noqa
from rig import new_scene, pivot, key_rot, finish as rfinish  # noqa
M2 = new_scene()
GOLD = M2.add('sw_gold', '#E9B949', 0.95, 0.2, '#7A5200', 0.8)
FE = M2.add('sw_feather', '#FFFFFF', 0.0, 0.4, '#FFE9A8', 2.5, alpha=0.9)
GL = M2.add('sw_glow', '#FFF2B0', 0.0, 0.3, '#FFF2B0', 8.0)
parts = []
for s in (-1, 1):
    b = Builder(M2)
    root = (s * 0.08, 0.05, -0.12)
    pts = []
    for k in range(7):
        t = k / 6
        a = math.radians(75 - t * 120)
        R = 1.5 * (0.55 + 0.45 * math.sin(t * math.pi * 0.9 + 0.3))
        tip = (root[0] + s * math.cos(a) * R, root[1] + math.sin(a) * R * 0.8, root[2] - 0.25 - 0.2 * t)
        pts.append(tip)
        b.octa(tip[0], tip[1], tip[2], 0.04, 0.08, GL)
    vs = [root] + pts
    fs = [[0, i, i + 1] for i in range(1, len(vs) - 1)]
    b.faces(b.a(FE), vs, fs + [f[::-1] for f in fs])
    b.octa(root[0] + s * 0.12, root[1], root[2], 0.06, 0.1, GOLD)
    obj = b.emit(f'sw_wing{s}')
    pv = pivot(f'sw_wingpv{s}', root, obj)
    key_rot(pv, 'y', [(1, s * -10), (13, s * 25), (25, s * -10)])
    parts.append(pv)
pivot('cos_seraph_wings', (0, 0, 0), parts)
rfinish('cos_seraph_wings')

print('GODFX', json.dumps(REPORT))
