"""
WOW NIGHTSWARM — effect models for the second wave of auto-skills (Frost Comet, Arc Chain, Moon Chakram,
Hex Mine, Prism Ray, Spirit Wisps). Same 4-tier scheme as build_fx.py: '', _t2, _t3, _asc.
Unit sizes; view.ts scales them. Run: python3 blender/build_fx2.py
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa
import numpy as np
from PIL import Image, ImageDraw

VARIANTS = {
    'comet': ('#8FE3FF', (0.92, 1, 1), '#E8FDFF', (1, 1, 1)),
    'arc': ('#7DF9FF', (0.95, 1, 1), '#C59BFF', (1, 0.95, 1)),
    'chakram': ('#D8DEFF', (1, 1, 1), '#FFB347', (1, 0.95, 0.8)),
    'rune': ('#FF4A8A', (1, 0.85, 0.92), '#9B2BFF', (1, 0.8, 1)),
    'beam': ('#FFF27A', (1, 1, 0.92), '#FF9A2A', (1, 1, 0.85)),
    'wisp': ('#7BFFB2', (0.92, 1, 0.95), '#FF7A3A', (1, 0.95, 0.7)),
}


def lighten(h, f):
    c = hexc(h)
    c = c + (1 - c) * f
    return '#' + ''.join(f'{int(round(x * 255)):02X}' for x in c)


def t_ice(name, col, hot, n=512, spikes=7, seed=1):
    """ground frost burst: shards radiating from the centre"""
    rng = np.random.default_rng(seed)
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c = n / 2
    for i in range(spikes * 3):
        a = 2 * math.pi * i / (spikes * 3) + rng.uniform(-0.08, 0.08)
        L = n * (0.47 if i % 3 == 0 else rng.uniform(0.2, 0.34))
        w = n * (0.03 if i % 3 == 0 else 0.016)
        tip = (c + math.cos(a) * L, c + math.sin(a) * L)
        l = (c + math.cos(a + 1.57) * w, c + math.sin(a + 1.57) * w)
        r = (c + math.cos(a - 1.57) * w, c + math.sin(a - 1.57) * w)
        d.polygon([l, tip, r], fill=230)
    d.ellipse([c - n * 0.42, c - n * 0.42, c + n * 0.42, c + n * 0.42], outline=150, width=max(2, n // 90))
    d.ellipse([c - n * 0.08, c - n * 0.08, c + n * 0.08, c + n * 0.08], fill=255)
    return rgba(name, glowmap(img, col, hot, g1=5, g2=16))


def t_disc(name, col, hot, n=512, teeth=6):
    """chakram: toothed ring"""
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c = n / 2
    pts = []
    for i in range(teeth * 2):
        a = 2 * math.pi * i / (teeth * 2)
        R = n * (0.46 if i % 2 == 0 else 0.33)
        a2 = a + (0.25 if i % 2 == 0 else 0)
        pts.append((c + math.cos(a2) * R, c + math.sin(a2) * R))
    d.polygon(pts, fill=235)
    d.ellipse([c - n * 0.2, c - n * 0.2, c + n * 0.2, c + n * 0.2], fill=0)
    d.ellipse([c - n * 0.24, c - n * 0.24, c + n * 0.24, c + n * 0.24], outline=255, width=max(2, n // 60))
    return rgba(name, glowmap(img, col, hot, g1=4, g2=12))


def t_hex(name, col, hot, n=512, rings=1):
    """hex mine: hexagram rune"""
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c = n / 2
    for k, R in enumerate([0.44, 0.34][:1 + (rings > 1)]):
        hexp = [(c + math.cos(math.pi / 3 * i) * n * R, c + math.sin(math.pi / 3 * i) * n * R) for i in range(6)]
        d.polygon(hexp, outline=220, width=max(2, n // 80))
    for off in (0, math.pi / 3):
        tri = [(c + math.cos(off + 2 * math.pi / 3 * i) * n * 0.3, c + math.sin(off + 2 * math.pi / 3 * i) * n * 0.3) for i in range(3)]
        d.polygon(tri, outline=255, width=max(2, n // 100))
    d.ellipse([c - n * 0.06, c - n * 0.06, c + n * 0.06, c + n * 0.06], fill=255)
    return rgba(name, glowmap(img, col, hot, g1=4, g2=14))


def t_beam(name, col, hot, w=128, h=512):
    """horizontal beam: white core along the length, soft edges, fades near the tip"""
    yy, xx = (np.mgrid[0:h, 0:w] + 0.5)
    u = np.abs(xx / w - 0.5) * 2
    v = yy / h
    core = np.clip(1 - u / 0.18, 0, 1)
    glow = np.clip(1 - u, 0, 1) ** 2
    fade = np.clip((1 - v) / 0.25, 0, 1) * np.clip(v / 0.05, 0, 1)
    a = np.clip((core + glow * 0.8) * (0.25 + 0.75 * fade), 0, 1)
    rgb = hexc(col)[None, None, :] * (1 - core[..., None]) + np.array(hot) * core[..., None]
    return rgba(name, np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1))


for tier in (0, 1, 2, 3):
    asc = tier == 3
    sfx_ = ['', '_t2', '_t3', '_asc'][tier]
    G = 1 + 0.35 * min(tier, 2)
    pick = (lambda v: (v[2], v[3]) if asc else (lighten(v[0], 0.12 * tier), v[1]))

    # ── FROST COMET: falling ice crystal with a streak trailing upward (y=0 is the crystal tip) ──
    col, hot = pick(VARIANTS['comet'])
    M = scene()
    cm = M.add('comet_ice', col, 0.2, 0.05, col, 5.0 * G)
    tm = tmat(M, 'comet_trail', t_band(f'fx_comettrail{sfx_}.png', col, hot), 4 * G)
    gm = tmat(M, 'comet_glow', t_radial(f'fx_cometglow{sfx_}.png', col, hot, spikes=6, power=2.4), 4 * G)
    B = Builder(M)
    s = 0.28 + 0.05 * tier
    B.octa(0, s * 1.4, 0, s, s * 1.6, cm)
    if tier >= 2:
        B.octa(0.25, s * 2.2, 0.1, s * 0.5, s * 0.9, cm)
        B.octa(-0.2, s * 2.6, -0.15, s * 0.45, s * 0.8, cm)
    open_cyl(B, 0.22 + 0.04 * tier, 3.5 + tier * 0.5, tm, seg=12, y0=s * 1.2)
    cross3(B, 1.4 + 0.2 * tier, gm)
    B.emit('fx')
    finish(f'fx_comet{sfx_}')

    # ground frost burst (diameter 1)
    M = scene()
    im = tmat(M, 'frost_burst', t_ice(f'fx_frostburst{sfx_}.png', col, hot, spikes=6 + 2 * tier, seed=2 + tier), 4 * G)
    sm = M.add('frost_spike', lighten(col, 0.3), 0.3, 0.05, col, 3.0 * G)
    B = Builder(M)
    flat(B, 1.0, 1.0, im, y=0.03)
    k = 5 + 2 * tier
    for i in range(k):
        a = 2 * math.pi * i / k
        r = 0.28 + 0.08 * (i % 2)
        B.octa(math.cos(a) * r, 0.08, math.sin(a) * r, 0.05, 0.12 + 0.03 * tier, sm)
    B.emit('fx')
    finish(f'fx_frost{sfx_}')

    # ── ARC CHAIN: one lightning segment, length 1 along +z (two crossed sheets) ──
    col, hot = pick(VARIANTS['arc'])
    M = scene()
    lm = tmat(M, 'arc', t_lightning(f'fx_arc{sfx_}.png', col, hot, seed=11 + tier, forks=2 + tier), 6 * G)
    B = Builder(M)
    W = 0.5 + 0.12 * tier
    B.quad((-W / 2, 0, 0), (W / 2, 0, 0), (W / 2, 0, 1), (-W / 2, 0, 1), lm, uv=((0, 0), (1, 0), (1, 1), (0, 1)))
    B.quad((0, -W / 2, 0), (0, W / 2, 0), (0, W / 2, 1), (0, -W / 2, 1), lm, uv=((0, 0), (1, 0), (1, 1), (0, 1)))
    B.emit('fx')
    finish(f'fx_arc{sfx_}')

    # ── MOON CHAKRAM: flat toothed disc (~1 m) ──
    col, hot = pick(VARIANTS['chakram'])
    M = scene()
    dm = tmat(M, 'chakram', t_disc(f'fx_chakram{sfx_}.png', col, hot, teeth=5 + tier), 4 * G)
    mm = M.add('chakram_metal', '#F2F4FF' if not asc else '#FFE3A8', 0.95, 0.12, col, 1.6)
    B = Builder(M)
    flat(B, 1.05 + 0.1 * tier, 1.05 + 0.1 * tier, dm)
    if tier >= 1:
        hm = tmat(M, 'chakram_halo', t_radial(f'fx_chakramhalo{sfx_}.png', col, hot, power=3.0), 2 * G)
        flat(B, 1.5 + 0.2 * tier, 1.5 + 0.2 * tier, hm, y=-0.02)
    B.cyl(0, -0.02, 0, 0.12, 0.05, mm, seg=10)
    B.emit('fx')
    finish(f'fx_chakram{sfx_}')

    # ── HEX MINE: armed rune on the ground (~1 m) + floating core ──
    col, hot = pick(VARIANTS['rune'])
    M = scene()
    rm = tmat(M, 'hex', t_hex(f'fx_hex{sfx_}.png', col, hot, rings=1 + (tier >= 2)), 3.5 * G)
    cm = M.add('hex_core', col, 0.1, 0.1, col, 6.0 * G)
    B = Builder(M)
    flat(B, 1.0, 1.0, rm, y=0.03)
    B.octa(0, 0.45, 0, 0.1 + 0.02 * tier, 0.18 + 0.03 * tier, cm)
    B.emit('fx')
    finish(f'fx_hex{sfx_}')

    # explosion (diameter 1): shock ring + rising fire column
    M = scene()
    sm = tmat(M, 'boom_ring', t_shock(f'fx_boomring{sfx_}.png', col, hot, rings=2 + min(2, tier)), 4.5 * G)
    wm = tmat(M, 'boom_wall', t_band(f'fx_boomwall{sfx_}.png', col, hot), 3.5)
    gm = tmat(M, 'boom_flash', t_radial(f'fx_boomflash{sfx_}.png', col, hot, spikes=8, power=2.0), 5)
    B = Builder(M)
    flat(B, 1.0, 1.0, sm, y=0.04)
    open_cyl(B, 0.3, 0.6 + 0.12 * tier, wm, seg=20)
    B.quad((-0.35, 0.1, 0), (0.35, 0.1, 0), (0.35, 0.8, 0), (-0.35, 0.8, 0), gm)
    B.quad((0, 0.1, -0.35), (0, 0.1, 0.35), (0, 0.8, 0.35), (0, 0.8, -0.35), gm)
    B.emit('fx')
    finish(f'fx_boom{sfx_}')

    # ── PRISM RAY: beam of length 1 along +z from the origin (crossed sheets + emitter star) ──
    col, hot = pick(VARIANTS['beam'])
    M = scene()
    bm = tmat(M, 'beam', t_beam(f'fx_beam{sfx_}.png', col, hot), 6 * G)
    em = tmat(M, 'beam_star', t_radial(f'fx_beamstar{sfx_}.png', col, hot, spikes=6 + 2 * tier, power=2.0), 5 * G)
    B = Builder(M)
    W = 0.7 + 0.15 * tier
    B.quad((-W / 2, 0, 0), (W / 2, 0, 0), (W / 2, 0, 1), (-W / 2, 0, 1), bm, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    B.quad((0, -W / 2, 0), (0, W / 2, 0), (0, W / 2, 1), (0, -W / 2, 1), bm, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    cross3(B, 0.9 + 0.15 * tier, em)
    B.emit('fx')
    finish(f'fx_beam{sfx_}')

    # ── SPIRIT WISP: glowing spirit with flame tail (~0.6 m) ──
    col, hot = pick(VARIANTS['wisp'])
    M = scene()
    wg = tmat(M, 'wisp_glow', t_radial(f'fx_wisp{sfx_}.png', col, hot, spikes=0 if tier < 2 else 5, power=2.2), 5 * G)
    wc = M.add('wisp_core', lighten(col, 0.5), 0.0, 0.2, col, 7.0 * G)
    wt = tmat(M, 'wisp_tail', t_band(f'fx_wisptail{sfx_}.png', col, hot), 3)
    B = Builder(M)
    B.sphere(0, 0, 0, 0.09 + 0.015 * tier, wc, 8, 6)
    cross3(B, 0.75 + 0.15 * tier, wg)
    # tail trailing backward (-z)
    for k in range(2):
        a = math.radians(90 * k)
        dx, dy = math.cos(a) * 0.12, math.sin(a) * 0.12
        B.quad((-dx, -dy, 0), (dx, dy, 0), (dx * 0.2, dy * 0.2, -0.7 - 0.15 * tier), (-dx * 0.2, -dy * 0.2, -0.7 - 0.15 * tier), wt,
               uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    if asc:
        # phoenix wings
        fm = tmat(M, 'wisp_wing', t_crescent('fx_wispwing.png', col, hot), 4)
        B.quad((0, 0, 0.1), (0.7, 0.25, -0.3), (0.7, -0.05, -0.5), (0, -0.05, -0.1), fm, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
        B.quad((0, 0, 0.1), (-0.7, 0.25, -0.3), (-0.7, -0.05, -0.5), (0, -0.05, -0.1), fm, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    B.emit('fx')
    finish(f'fx_wisp{sfx_}')

# ── upgrade bursts for the new skills ──
for name, col in [('frost', '#8FE3FF'), ('chain', '#7DF9FF'), ('chakram', '#D8DEFF'), ('mine', '#FF4A8A'), ('beam', '#FFF27A'), ('wisp', '#7BFFB2')]:
    M = scene()
    pm = tmat(M, 'up_pillar', t_band(f'fx_up_{name}.png', col, (1, 1, 1)), 5)
    rm2 = tmat(M, 'up_ring', t_shock(f'fx_upring_{name}.png', col, (1, 1, 1), rings=2), 4)
    sm2 = tmat(M, 'up_star', t_radial(f'fx_upstar_{name}.png', col, (1, 1, 1), spikes=8, power=2.0), 5)
    B = Builder(M)
    open_cyl(B, 0.5, 3.0, pm, seg=24)
    open_cyl(B, 0.3, 4.0, pm, seg=16)
    flat(B, 1.0, 1.0, rm2, y=0.05)
    B.quad((-0.6, 1.4, 0), (0.6, 1.4, 0), (0.6, 2.6, 0), (-0.6, 2.6, 0), sm2)
    B.quad((0, 1.4, -0.6), (0, 1.4, 0.6), (0, 2.6, 0.6), (0, 2.6, -0.6), sm2)
    B.emit('fx')
    finish(f'fx_up_{name}')

print('FX2', json.dumps(REPORT))
json.dump(REPORT, open(os.path.join(ROOT, 'blender', 'fx2_report.json'), 'w'), indent=1)
