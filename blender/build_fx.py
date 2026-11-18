"""
WOW NIGHTSWARM — skill effect models (Blender / bpy).
Every skill has a base look and an ASCENDED look. All glow via emissive textures (alpha-blended quads + crystal meshes).
Sizes are authored at unit scale; view.ts scales them to the gameplay hit area.
Run: python3 blender/build_fx.py → models/fx_*.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa

VARIANTS = {
    # id: (base colour, base hot, ascended colour, ascended hot)
    'scythe': ('#FF2E4A', (1, 0.85, 0.85), '#7A2BFF', (1, 0.86, 0.45)),
    'shard': ('#A26BFF', (0.95, 0.9, 1), '#FFC84A', (1, 1, 0.9)),
    'glaive': ('#3FE6FF', (0.9, 1, 1), '#E8FBFF', (1, 1, 1)),
    'bloom': ('#FF4FD2', (1, 0.85, 1), '#B0102E', (1, 0.55, 0.4)),
    'sigil': ('#7FD8FF', (0.95, 1, 1), '#FFE27A', (1, 1, 0.92)),
    'pulse': ('#FF7A1A', (1, 0.95, 0.6), '#FFE36A', (1, 1, 1)),
}

def lighten(h, f):
    c = hexc(h)
    c = c + (1 - c) * f
    return '#' + ''.join(f'{int(round(x * 255)):02X}' for x in c)


# tiers: 0 = Lv1-3, 1 = Lv4-6, 2 = Lv7-8, 3 = ASCENDED — every tier looks bigger / brighter / more ornate
for tier in (0, 1, 2, 3):
    asc = tier == 3
    sfx_ = ['', '_t2', '_t3', '_asc'][tier]
    G = 1 + 0.35 * min(tier, 2)          # emission gain
    pick = (lambda v: (v[2], v[3]) if asc else (lighten(v[0], 0.12 * tier), v[1]))

    # ── RIFT SCYTHE: crescent slash (unit square, +z = forward) ──
    col, hot = pick(VARIANTS['scythe'])
    M = scene()
    m1 = tmat(M, 'slash', t_crescent(f'fx_slash{sfx_}.png', col, hot, double=tier >= 2), 5 * G)
    B = Builder(M)
    flat(B, 1.0, 1.0, m1)
    # tilted second sheet for volume
    B.quad((-0.5, -0.12, -0.45), (0.5, -0.12, -0.45), (0.5, 0.15, 0.5), (-0.5, 0.15, 0.5), m1, uv=((0, 1), (1, 1), (1, 0), (0, 0)))
    if tier >= 1 and not asc:
        m3 = tmat(M, 'slash_core', t_radial(f'fx_slashcore{sfx_}.png', col, hot, spikes=4 + 2 * tier, power=2.4), 3 * G)
        B.decal(0, 0.02, 0.2, 0.3 + 0.1 * tier, 0.3 + 0.1 * tier, m3)
    if asc:
        m2 = tmat(M, 'eclipse', t_radial('fx_eclipse.png', '#7A2BFF', (1, 0.85, 0.4), spikes=8), 4)
        B.decal(0, 0.02, 0.15, 0.5, 0.5, m2)
    B.emit('fx')
    finish(f'fx_slash{sfx_}')

    # ── STAR SHARD: crystal star + glow (projectile, ~0.5 m) ──
    col, hot = pick(VARIANTS['shard'])
    M = scene()
    cm = M.add('shard_crystal', col, 0.3, 0.05, col, 6.0 * G)
    gm = tmat(M, 'shard_glow', t_radial(f'fx_star{sfx_}.png', col, hot, spikes=4 + tier, power=2.6 - 0.25 * tier), 4 * G)
    B = Builder(M)
    s = 0.16 + 0.015 * tier
    B.octa(0, 0, 0, s, s * 2.2, cm)
    B.octa(0, 0, 0, s * 2.0, s * 0.6, cm)
    cross3(B, 0.9 + 0.12 * tier, gm)
    B.emit('fx')
    finish(f'fx_shard{sfx_}')

    # ── HALO GLAIVE: spinning blade (flat, ~1 m) ──
    col, hot = pick(VARIANTS['glaive'])
    M = scene()
    gl = tmat(M, 'glaive', t_glaive(f'fx_glaive{sfx_}.png', col, hot, blades=3 if tier >= 2 else 2), 4 * G)
    mm = M.add('glaive_metal', '#C9F6FF' if not asc else '#FFFFFF', 0.9, 0.15, col, 1.5)
    B = Builder(M)
    flat(B, 1.1 + 0.1 * tier, 1.1 + 0.1 * tier, gl)
    if tier >= 1:
        halo = tmat(M, 'glaive_halo', t_radial(f'fx_glaivehalo{sfx_}.png', col, hot, power=3.0), 2 * G)
        flat(B, 0.7 + 0.2 * tier, 0.7 + 0.2 * tier, halo, y=-0.02)
    B.cyl(0, -0.03, 0, 0.1, 0.06, mm, seg=8)
    B.emit('fx')
    finish(f'fx_glaive{sfx_}')

    # ── VOID BLOOM: ground rune (diameter 1) + rising veil ──
    col, hot = pick(VARIANTS['bloom'])
    M = scene()
    rm = tmat(M, 'bloom_rune', t_rune(f'fx_bloom{sfx_}.png', col, hot, n=512, petals=8 + 2 * tier, seed=3 + 2 * tier), 3 * G)
    vm = tmat(M, 'bloom_veil', t_band(f'fx_veil{sfx_}.png', col, hot), 2)
    B = Builder(M)
    flat(B, 1.0, 1.0, rm, y=0.0)
    open_cyl(B, 0.5, 0.12 + 0.04 * tier, vm, seg=28)
    if tier >= 2:
        open_cyl(B, 0.32, 0.25 + 0.05 * tier, vm, seg=20)
    B.emit('fx')
    finish(f'fx_bloom{sfx_}')

    # ── STORM SIGIL: lightning column (12 m) + impact sigil (diameter 1) ──
    col, hot = pick(VARIANTS['sigil'])
    M = scene()
    lm = tmat(M, 'bolt', t_lightning(f'fx_lightning{sfx_}.png', col, hot, seed=1 + tier), 6 * G)
    im = tmat(M, 'impact', t_shock(f'fx_impact{sfx_}.png', col, hot, rings=1 + min(2, tier)), 4 * G)
    B = Builder(M)
    W = 0.7 + 0.08 * tier
    for k in range(3):
        a = math.radians(k * 60)
        dx, dz = math.cos(a) * W / 2, math.sin(a) * W / 2
        B.quad((-dx, 0, -dz), (dx, 0, dz), (dx, 12, dz), (-dx, 12, -dz), lm, uv=((0, 0), (1, 0), (1, 1), (0, 1)))
    flat(B, 1.0, 1.0, im, y=0.03)
    B.emit('fx')
    finish(f'fx_sigil{sfx_}')

    # ── EMBER PULSE: shockwave ring (diameter 1) + flame wall ──
    col, hot = pick(VARIANTS['pulse'])
    M = scene()
    sm = tmat(M, 'shock', t_shock(f'fx_shock{sfx_}.png', col, hot, rings=2 + (tier >= 2) + asc), 4 * G)
    wm = tmat(M, 'wall', t_band(f'fx_flamewall{sfx_}.png', col, hot), 3)
    B = Builder(M)
    flat(B, 1.0, 1.0, sm, y=0.04)
    open_cyl(B, 0.47, 0.16 + 0.05 * tier, wm, seg=32)
    B.emit('fx')
    finish(f'fx_pulse{sfx_}')

# ── upgrade bursts (played the moment you pick an upgrade) ──
for name, col in [('lash', '#FF2E4A'), ('bolt', '#A26BFF'), ('orbit', '#3FE6FF'), ('aura', '#FF4FD2'), ('thunder', '#7FD8FF'), ('nova', '#FF7A1A'), ('passive', '#FFD86A'), ('asc', '#FFFFFF')]:
    M = scene()
    pm = tmat(M, 'up_pillar', t_band(f'fx_up_{name}.png', col, (1, 1, 1)), 5)
    rm2 = tmat(M, 'up_ring', t_shock(f'fx_upring_{name}.png', col, (1, 1, 1), rings=2), 4)
    sm2 = tmat(M, 'up_star', t_radial(f'fx_upstar_{name}.png', col, (1, 1, 1), spikes=8, power=2.0), 5)
    B = Builder(M)
    open_cyl(B, 0.5, 3.0, pm, seg=24)
    open_cyl(B, 0.3, 4.0, pm, seg=16)
    flat(B, 1.0, 1.0, rm2, y=0.05)
    cross3(B, 0.0001, sm2)
    B.quad((-0.6, 1.4, 0), (0.6, 1.4, 0), (0.6, 2.6, 0), (-0.6, 2.6, 0), sm2)
    B.quad((0, 1.4, -0.6), (0, 1.4, 0.6), (0, 2.6, 0.6), (0, 2.6, -0.6), sm2)
    B.emit('fx')
    finish(f'fx_up_{name}')

# ── monster spawn (rift tear on the ground) + death (soul burst) ──
M = scene()
r1 = tmat(M, 'spawn_ring', t_shock('fx_spawn_ring.png', '#7A2BFF', (0.9, 0.7, 1), rings=2), 3)
w1 = tmat(M, 'spawn_wisp', t_band('fx_spawn_wisp.png', '#5A1AAA', (0.8, 0.6, 1)), 2)
B = Builder(M)
flat(B, 1.0, 1.0, r1, y=0.03)
open_cyl(B, 0.35, 0.9, w1, seg=16)
B.emit('fx')
finish('fx_spawn')

M = scene()
g1 = tmat(M, 'death_glow', t_radial('fx_death_glow.png', '#B98CFF', (1, 1, 1), spikes=6, power=2.2), 4)
r2 = tmat(M, 'death_ring', t_shock('fx_death_ring.png', '#C9A8FF', (1, 1, 1), rings=1), 3)
w2 = tmat(M, 'death_wisp', t_band('fx_death_wisp.png', '#9A6BFF', (1, 1, 1)), 3)
B = Builder(M)
flat(B, 1.0, 1.0, r2, y=0.04)
open_cyl(B, 0.22, 1.4, w2, seg=12)
B.quad((-0.4, 0.5, 0), (0.4, 0.5, 0), (0.4, 1.3, 0), (-0.4, 1.3, 0), g1)
B.quad((0, 0.5, -0.4), (0, 0.5, 0.4), (0, 1.3, 0.4), (0, 1.3, -0.4), g1)
B.emit('fx')
finish('fx_death')

# ── heal orb + level-up burst ──
M = scene()
hm = tmat(M, 'heal', t_radial('fx_heal.png', '#FF3B6B', (1, 0.9, 0.95), spikes=4), 4)
cm = M.add('heal_core', '#FF6B8B', 0.0, 0.2, '#FF2A5A', 4.0)
B = Builder(M)
B.sphere(0, 0, 0, 0.16, cm, 8, 6)
cross3(B, 0.9, hm)
B.emit('fx')
finish('fx_heal')

M = scene()
lm = tmat(M, 'lvl', t_band('fx_levelup.png', '#4DA3FF', (0.9, 1, 1)), 3)
rm = tmat(M, 'lvl_ring', t_shock('fx_levelring.png', '#8EC5FF', (1, 1, 1), rings=2), 3)
B = Builder(M)
open_cyl(B, 0.5, 2.2, lm, seg=24)
flat(B, 1.0, 1.0, rm, y=0.05)
B.emit('fx')
finish('fx_levelup')

print('FX', json.dumps(REPORT))
json.dump(REPORT, open(os.path.join(ROOT, 'blender', 'fx_report.json'), 'w'), indent=1)
