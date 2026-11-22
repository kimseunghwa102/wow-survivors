"""
MYTHIC BOSS PATTERNS (Lv 350-1111) — effect models. view.ts places and scales them.
  fx_mring{i}_warn / fx_mring{i}  ring i of a ring blast (r0 = 2.2 + 4i, r1 = r0 + 2), warning band + eruption
  fx_rain_<kind>                   what falls in a rain volley (points down, impact at the origin, ~1.5 m)
                                   spear · cannon · kunai · fire · fist · bolt · star
  fx_mpillar                       judgment pillar (light column, 1 m wide, 9 m tall)
  fx_msun                          black sun (sphere with corona, diameter 1)
  fx_shade / fx_fox                homing shadow clone / foxfire
  fx_safe                          safe circle for LET THERE BE LIGHT (diameter 1)
  fx_godlight                      the light itself (huge dome, diameter 1)
  fx_chrono                        KHRONOS clock rune (diameter 1)
  fx_ascend_ring                   golden shockwave when a hunter becomes God (diameter 1)
Run: python3 blender/build_mythfx.py
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa
import numpy as np


def annulus(B, r0, r1, y, m, seg=56):
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        p = [(math.cos(a0) * r0, y, math.sin(a0) * r0), (math.cos(a0) * r1, y, math.sin(a0) * r1),
             (math.cos(a1) * r1, y, math.sin(a1) * r1), (math.cos(a1) * r0, y, math.sin(a1) * r0)]
        B.quad(p[0], p[1], p[2], p[3], m, uv=((i / seg, 0), (i / seg, 1), ((i + 1) / seg, 1), ((i + 1) / seg, 0)))


def t_bandring(name, col, hot, w=256, h=64, warn=False):
    """texture across an annulus: v = 0 inner edge, 1 outer edge"""
    yy, xx = (np.mgrid[0:h, 0:w] + 0.5)
    v = yy / h
    u = xx / w
    edge = np.clip(1 - np.minimum(v, 1 - v) / 0.12, 0, 1)
    if warn:
        stripes = (np.sin((u * 64 + v * 2) * math.pi) > 0).astype(float)
        a = np.clip(0.28 + 0.22 * stripes + edge * 0.7, 0, 1)
    else:
        core = np.clip(1 - np.abs(v - 0.5) / 0.5, 0, 1) ** 0.7
        a = np.clip(core * (0.75 + 0.25 * np.sin(u * 90)) + edge, 0, 1)
    rgb = hexc(col)[None, None, :] * (1 - edge[..., None]) + np.array(hot) * edge[..., None]
    return rgba(name, np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1))


# ── ring blasts (exact radii, so no stretching) ──
for i in range(6):
    r0 = 2.2 + 4 * i
    r1 = r0 + 2
    seg = 40 + 10 * i
    M = scene()
    wm = tmat(M, 'warn', t_bandring(f'fx_mring_warn.png', '#FF2A3D', (1, 0.8, 0.6), warn=True), 2.5)
    B = Builder(M)
    annulus(B, r0, r1, 0.06, wm, seg)
    B.emit('fx')
    finish(f'fx_mring{i}_warn')
    M = scene()
    bm = tmat(M, 'burst', t_bandring(f'fx_mring.png', '#FFB347', (1, 1, 0.9)), 6)
    B = Builder(M)
    annulus(B, r0, r1, 0.1, bm, seg)
    # a low wall of light rising from the band
    for k in range(seg):
        a0, a1 = 2 * math.pi * k / seg, 2 * math.pi * (k + 1) / seg
        rm = (r0 + r1) / 2
        p0 = (math.cos(a0) * rm, 0.1, math.sin(a0) * rm)
        p1 = (math.cos(a1) * rm, 0.1, math.sin(a1) * rm)
        B.quad(p0, p1, (p1[0], 1.6, p1[2]), (p0[0], 1.6, p0[2]), bm, uv=((0, 0.2), (1, 0.2), (1, 0.8), (0, 0.8)))
    B.emit('fx')
    finish(f'fx_mring{i}')


# ── rain kinds ──
def rain_glow(M, name, col, hot=(1, 1, 1), s=4.0):
    return tmat(M, name, t_radial(f'{name}.png', col, hot, spikes=6, power=2.0), s)


def trail(B, M, col, name, h=3.0, r=0.3):
    tm = tmat(M, name, t_band(f'{name}.png', col, (1, 1, 1)), 4)
    open_cyl(B, r, h, tm, seg=8, y0=0.6)


def spear():
    M = scene()
    gold = M.add('gold', '#FFE9A8', 0.9, 0.25, '#FFD86A', 2.5)
    light = tmat(M, 'spear_glow', t_radial('fx_spearglow.png', '#FFF6D8', (1, 1, 1), spikes=4), 6)
    B = Builder(M)
    B.cyl(0, 0.9, 0, 0.06, 2.6, gold, seg=6)
    B.octa(0, 0.45, 0, 0.16, 0.9, gold)                 # point down
    B.box(0, 1.3, 0, 0.5, 0.06, 0.06, gold)
    cross3(B, 1.6, light)
    trail(B, M, '#FFE9A8', 'spear_trail', 3.5, 0.22)
    B.emit('fx')
    finish('fx_rain_spear')


def cannon():
    M = scene()
    iron = M.add('iron', '#1C1F24', 0.8, 0.35)
    ember = tmat(M, 'cannon_glow', t_radial('fx_cannonglow.png', '#39FFB0', (0.9, 1, 0.95), spikes=6), 4)
    B = Builder(M)
    B.sphere(0, 0.55, 0, 0.55, iron, 10, 6)
    cross3(B, 1.8, ember)
    trail(B, M, '#2BD4C4', 'cannon_trail', 3.0, 0.4)
    B.emit('fx')
    finish('fx_rain_cannon')


def kunai():
    M = scene()
    steel = M.add('steel', '#C9CFDA', 0.9, 0.2)
    wrap = M.add('wrap', '#B0182E', 0.0, 0.6)
    glow = tmat(M, 'kunai_glow', t_radial('fx_kunaiglow.png', '#E03A5A', (1, 0.8, 0.85), spikes=4), 4)
    B = Builder(M)
    B.octa(0, 0.35, 0, 0.14, 0.7, steel)
    B.cyl(0, 0.75, 0, 0.05, 0.5, wrap, seg=6)
    B.ring(0, 1.3, 0, 0.07, 0.12, 0.05, steel, seg=10)
    cross3(B, 1.0, glow)
    trail(B, M, '#E03A5A', 'kunai_trail', 2.4, 0.12)
    B.emit('fx')
    finish('fx_rain_kunai')


def fire():
    M = scene()
    core = M.add('core', '#FFD27A', 0.0, 0.5, '#FFB347', 5)
    glow = tmat(M, 'fire_glow', t_radial('fx_fireglow.png', '#FF5A1E', (1, 0.95, 0.7), spikes=8, power=1.6), 6)
    B = Builder(M)
    B.sphere(0, 0.5, 0, 0.42, core, 8, 5)
    cross3(B, 2.2, glow)
    trail(B, M, '#FF5A1E', 'fire_trail', 3.5, 0.45)
    B.emit('fx')
    finish('fx_rain_fire')


def fist():
    M = scene()
    ki = M.add('ki', '#FF8A9A', 0.0, 0.4, '#FF3B4E', 4, alpha=0.85)
    glow = tmat(M, 'fist_glow', t_radial('fx_fistglow.png', '#FF3B4E', (1, 0.9, 0.9), spikes=10, power=1.8), 5)
    B = Builder(M)
    B.box(0, 0.6, 0, 0.9, 0.8, 0.7, ki)                 # an energy fist punching down
    for k in range(4):
        B.box(-0.33 + k * 0.22, 0.12, 0.12, 0.18, 0.25, 0.3, ki)
    B.box(0.5, 0.75, 0.15, 0.22, 0.5, 0.3, ki)
    B.cyl(0, 1.0, 0, 0.32, 0.9, ki, seg=8)
    cross3(B, 2.0, glow)
    trail(B, M, '#FF3B4E', 'fist_trail', 2.6, 0.5)
    B.emit('fx')
    finish('fx_rain_fist')


def bolt():
    M = scene()
    bm = tmat(M, 'bolt', t_lightning('fx_boltrain.png', '#FFD02B', (1, 1, 0.9), seed=7, forks=4), 7)
    glow = tmat(M, 'bolt_glow', t_radial('fx_boltglow.png', '#FFD02B', (1, 1, 0.9), spikes=8), 6)
    B = Builder(M)
    for k in range(3):
        a = math.radians(k * 60)
        dx, dz = math.cos(a) * 0.6, math.sin(a) * 0.6
        B.quad((-dx, 0, -dz), (dx, 0, dz), (dx, 9, dz), (-dx, 9, -dz), bm, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    cross3(B, 2.4, glow)
    B.emit('fx')
    finish('fx_rain_bolt')


def star():
    M = scene()
    core = M.add('core', '#FFFFFF', 0.0, 0.3, '#FFF6D8', 7)
    glow = tmat(M, 'star_glow', t_radial('fx_starglow.png', '#B9A8FF', (1, 1, 1), spikes=8, power=2.6), 6)
    B = Builder(M)
    B.octa(0, 0.5, 0, 0.35, 0.7, core)
    cross3(B, 2.2, glow)
    trail(B, M, '#8A6BFF', 'star_trail', 4.0, 0.3)
    B.emit('fx')
    finish('fx_rain_star')


for fn in (spear, cannon, kunai, fire, fist, bolt, star):
    fn()

# ── judgment pillar ──
M = scene()
pm = tmat(M, 'pillar', t_band('fx_mpillar.png', '#FFF2B0', (1, 1, 1)), 6)
gm = tmat(M, 'pillar_glow', t_radial('fx_mpillarglow.png', '#FFE9A8', (1, 1, 1), power=1.8), 5)
B = Builder(M)
open_cyl(B, 0.5, 9.0, pm, seg=12)
open_cyl(B, 0.32, 9.0, pm, seg=8)
flat(B, 2.2, 2.2, gm, y=0.08)
B.emit('fx')
finish('fx_mpillar')

# ── black sun ──
M = scene()
dark = M.add('void', '#050208', 0.0, 0.2)
cor = tmat(M, 'corona', t_radial('fx_msuncorona.png', '#B04BFF', (1, 0.7, 0.4), spikes=12, power=1.4), 7)
rim = tmat(M, 'rim', t_shock('fx_msunrim.png', '#FF6A1A', (1, 0.9, 0.6), rings=2), 6)
B = Builder(M)
B.sphere(0, 0, 0, 0.5, dark, 16, 10)
cross3(B, 1.9, cor)
B.quad((-0.75, -0.75, 0), (0.75, -0.75, 0), (0.75, 0.75, 0), (-0.75, 0.75, 0), rim)
B.quad((-0.75, 0, -0.75), (0.75, 0, -0.75), (0.75, 0, 0.75), (-0.75, 0, 0.75), rim)
B.emit('fx')
finish('fx_msun')

# ── homing shadow clone + foxfire ──
M = scene()
sh = M.add('shade', '#0A0610', 0.0, 0.8, '#3A0A2A', 1.2, alpha=0.85)
eye = M.add('eye', '#FF2A4A', 0.0, 0.3, '#FF2A4A', 8)
wisp = tmat(M, 'shade_wisp', t_radial('fx_shadewisp.png', '#5A1030', (1, 0.3, 0.4), spikes=5, power=1.4), 2.5)
B = Builder(M)
B.sphere(0, 1.55, 0, 0.28, sh, 8, 5)
B.cyl(0, 0.35, 0, 0.12, 1.05, sh, seg=8, r_top=0.32)
B.octa(0, 0.35, 0, 0.3, 0.6, sh)
for s in (-1, 1):
    B.box(s * 0.1, 1.6, 0.24, 0.07, 0.03, 0.03, eye)
    B.box(s * 0.42, 1.0, 0.1, 0.12, 0.6, 0.12, sh, roll=s * 25)
cross3(B, 1.8, wisp)
B.emit('fx')
finish('fx_shade')
M = scene()
ff = tmat(M, 'foxfire', t_radial('fx_foxfire.png', '#7FD8FF', (1, 1, 1), spikes=6, power=1.5), 7)
core = M.add('core', '#E8FBFF', 0.0, 0.3, '#7FD8FF', 6)
B = Builder(M)
B.octa(0, 1.0, 0, 0.22, 0.5, core)
cross3(B, 1.4, ff)
B.emit('fx')
finish('fx_fox')

# ── LET THERE BE LIGHT ──
M = scene()
sm = tmat(M, 'safe', t_shock('fx_safe.png', '#FFD86A', (1, 1, 1), rings=2), 5)
B = Builder(M)
flat(B, 1.0, 1.0, sm, y=0.1)
open_cyl(B, 0.5, 2.4, tmat(M, 'safe_wall', t_band('fx_safewall.png', '#FFE9A8', (1, 1, 1)), 3), seg=24)
B.emit('fx')
finish('fx_safe')
M = scene()
lm = tmat(M, 'godlight', t_band('fx_godlight.png', '#FFF6D8', (1, 1, 1)), 8)
B = Builder(M)
open_cyl(B, 0.5, 1.0, lm, seg=32)
open_cyl(B, 0.35, 1.0, lm, seg=24)
B.emit('fx')
finish('fx_godlight')

# ── KHRONOS: clock rune under the hunter ──
M = scene()
cm = tmat(M, 'chrono', t_rune('fx_chrono.png', '#8A6BFF', (0.85, 1, 1), n=512, seed=11, petals=12), 4)
B = Builder(M)
flat(B, 1.0, 1.0, cm, y=0.07)
B.emit('fx')
finish('fx_chrono')

# ── ascension: golden shockwave ──
M = scene()
am = tmat(M, 'ascend', t_shock('fx_ascendring.png', '#FFD86A', (1, 1, 1), rings=3), 7)
B = Builder(M)
flat(B, 1.0, 1.0, am, y=0.12)
B.emit('fx')
finish('fx_ascend_ring')

# ── Blade Fan / Shadow Kunai: a thrown knife flying along +z ──
M = scene()
steel = M.add('steel', '#E8EEF8', 0.95, 0.15, '#9FB4D0', 0.8)
edge = tmat(M, 'knife_glow', t_radial('fx_knifeglow.png', '#FF4A6A', (1, 0.85, 0.9), spikes=4, power=2.2), 4)
B = Builder(M)
B.faces(B.a(steel), [(0, 1.1, 0.55), (0.09, 1.1, 0.0), (0, 1.1, -0.15), (-0.09, 1.1, 0.0), (0, 1.13, 0.0), (0, 1.07, 0.0)],
        [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4], [1, 0, 5], [2, 1, 5], [3, 2, 5], [0, 3, 5]])
B.box(0, 1.1, -0.3, 0.05, 0.05, 0.3, steel)
B.quad((-0.25, 1.1, -0.6), (0.25, 1.1, -0.6), (0.25, 1.1, 0.4), (-0.25, 1.1, 0.4), edge)
B.emit('fx')
finish('fx_knife')

print('MYTHFX', json.dumps({k: v for k, v in REPORT.items()}))
