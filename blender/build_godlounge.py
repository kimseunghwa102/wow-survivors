"""
2F GOD LOUNGE — a floating sky island 40 m above the arena (parcels -105..-104 × 76..77, x16–48 z0–32),
only for hunters who became GOD (defeated THE ALMIGHTY at Lv 1111). Reached from the Sanctuary's GOD'S ASCENT
well with no loading screen (movePlayerTo inside the same scene).

  · an octagonal obsidian floor with a glowing gold mandala, white-marble rim, gold trim
  · a floating rock island underneath with hanging crystals (seen from the arena below)
  · 8 marble pillars with gold braziers, gold-framed glass balustrade, tall invisible walls (gods can fly)
  · NORTH: the sealed GATE TO THE LAND OF THE GODS (-27,128) — obelisks, a golden ring, chains and a seal
  · EAST:  THE DIVINE VAULT — five glass cases with back-lit black silhouettes of god-only wearables (unrevealed)
  · WEST:  a sunken conversation pit with curved white sofas, THE PANTHEON stele (names of every God)
  · SOUTH: the arrival dais and the DESCENT well back to the Sanctuary

Outputs (all in DCL metres):
  models/god_lounge.glb      static island, placed at the scene origin (with collider)
  models/god_portal_fx.glb   the sealed gate's swirl (centred on the origin, facing ±z, Ø 7.6) — spun in TS
  models/ascent_well.glb     the well rim + light column (centred on the origin, floor level)
  models/ascent_fx.glb       the well's horizontal swirl (Ø 3.2) — spun in TS
  models/god_orrery.glb      three gold rings floating over the lounge centre — spun in TS
  images/warp/v0..v7.png     UI frames of the vortex that swallows the screen during the warp
Run: python3 blender/build_godlounge.py
"""
import os, sys, math, json
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa
from fxlib import open_cyl  # noqa
from mythparts import tube, cone, card, fire_mat, torus, rays, disc, add, sub, mul, norm, angel_wing  # noqa

Y = 40.0                 # floor top
CX, CZ = 32.0, 16.0      # lounge centre
AP = 14.6                # octagon apothem
RO = AP / math.cos(math.radians(22.5))
PORTAL = (32.0, 23.6)    # gate centre (x, z), faces south
VAULT_R = 10.6           # display cases on an arc around the centre, east side
PIT = (23.0, 16.5)       # conversation pit
DESCENT = (24.0, 8.5)    # well back down
ARRIVE = (32.0, 5.4)     # arrival dais
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))


def oct_pts(r, y):
    return [(CX + math.cos(math.radians(22.5 + 45 * k)) * r, y, CZ + math.sin(math.radians(22.5 + 45 * k)) * r) for k in range(8)]


def yaw_of(p0, p1):
    return math.degrees(math.atan2(-(p1[2] - p0[2]), p1[0] - p0[0]))


# ═══════════════ textures ═══════════════
def gold_glow(img, col='#F2C24E', hot=(1, 0.97, 0.86), blur=(3, 10), gain=1.25):
    c = np.asarray(img, dtype=float) / 255
    g1 = np.asarray(img.filter(ImageFilter.GaussianBlur(blur[0])), dtype=float) / 255
    g2 = np.asarray(img.filter(ImageFilter.GaussianBlur(blur[1])), dtype=float) / 255
    a = np.clip(c + g1 * 0.8 + g2 * 0.55, 0, 1) * gain
    a = np.clip(a, 0, 1)
    rgb = hexc(col)[None, None, :] * (1 - c[..., None]) + np.array(hot)[None, None, :] * c[..., None]
    return np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1)


def t_mandala(name, n=2048, seed=4):
    rng = np.random.default_rng(seed)
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c, R = n / 2, n * 0.49

    def circ(f, w):
        d.ellipse([c - R * f, c - R * f, c + R * f, c + R * f], outline=255, width=w)

    def P(f, a):
        return (c + math.cos(a) * R * f, c + math.sin(a) * R * f)
    for f, w in ((0.995, 6), (0.965, 3), (0.80, 7), (0.775, 3), (0.52, 6), (0.495, 3), (0.22, 5), (0.20, 2)):
        circ(f, w)
    # outer band: ticks + 12 diamonds
    for k in range(144):
        a = 2 * math.pi * k / 144
        d.line([P(0.80, a), P(0.80 + (0.05 if k % 12 == 0 else 0.025 if k % 3 == 0 else 0.013), a)], fill=255, width=3)
    for k in range(12):
        a = 2 * math.pi * (k + 0.5) / 12
        m = 0.88
        d.polygon([P(m - 0.05, a), P(m, a + 0.05), P(m + 0.05, a), P(m, a - 0.05)], outline=255, width=4)
        d.ellipse([P(m, a)[0] - 6, P(m, a)[1] - 6, P(m, a)[0] + 6, P(m, a)[1] + 6], fill=255)
    # middle band: 12 constellations
    for k in range(12):
        a0 = 2 * math.pi * k / 12
        pts = []
        for j in range(rng.integers(4, 7)):
            pts.append(P(0.56 + rng.random() * 0.17, a0 + 0.07 + rng.random() * 0.36))
        d.line(pts, fill=200, width=2)
        for p in pts:
            s = rng.integers(5, 11)
            d.ellipse([p[0] - s, p[1] - s, p[0] + s, p[1] + s], fill=255)
        d.line([P(0.52, a0), P(0.775, a0)], fill=255, width=3)
    # inner: sun rays
    for k in range(32):
        a = 2 * math.pi * k / 32
        L = 0.49 if k % 2 == 0 else 0.38
        d.polygon([P(0.22, a - 0.045), P(L, a), P(0.22, a + 0.045)], outline=255, width=3)
    # centre: 8-point star
    st = []
    for k in range(16):
        a = 2 * math.pi * k / 16 - math.pi / 2
        st.append(P(0.18 if k % 2 == 0 else 0.07, a))
    d.polygon(st, outline=255, width=5)
    circ(0.035, 4)
    return rgba(name, gold_glow(img))


def t_swirl(name, n, arms, twist, inner, outer, hot=(1, 1, 1), phase=0.0, edge=0.97, haze=0.35):
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    r = np.hypot(xx, yy) + 1e-4
    th = np.arctan2(yy, xx)
    s = 0.5 + 0.5 * np.sin(arms * (th + phase) + twist * np.log(r))
    s2 = 0.5 + 0.5 * np.sin(arms * 2 * (th - phase * 0.7) + twist * 1.6 * np.log(r) + 1.3)
    band = np.clip(s, 0, 1) ** 2.4 * 0.8 + np.clip(s2, 0, 1) ** 5 * 0.45
    fall = np.clip((edge - r) / 0.12, 0, 1)
    core = np.clip(1 - r / 0.28, 0, 1) ** 1.5
    a = np.clip(band * (0.35 + 0.65 * r) + core + haze * (1 - r), 0, 1) * fall
    t = np.clip(r, 0, 1)[..., None]
    rgb = np.array(hexc(inner))[None, None] * (1 - t) + np.array(hexc(outer))[None, None] * t
    rgb = rgb * (1 - core[..., None]) + np.array(hot)[None, None] * core[..., None]
    rgb = np.clip(rgb * (0.65 + 0.55 * band[..., None]), 0, 1)
    return rgba(name, np.concatenate([rgb, a[..., None]], -1))


def t_rock(name, n=1024):
    t = fbm(n, 6, 77)
    t2 = fbm(n, 4, 12)
    base = np.array([0.16, 0.13, 0.2])
    col = base[None, None] * (0.55 + t[..., None] * 0.9)
    vein = np.clip(1 - np.abs(t2 - 0.5) * 22, 0, 1)[..., None]
    col = col * (1 - vein) + np.array([0.55, 0.32, 0.95])[None, None] * vein
    return save_img(name, col)


def t_vignette(name, n=512):
    """soft back-light for the display cases (warm core, wide halo)"""
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    r = np.hypot(xx, yy * 0.8)
    a = np.clip(1 - r, 0, 1) ** 1.4
    rays_ = 0.5 + 0.5 * np.cos(np.arctan2(yy, xx) * 18)
    a = np.clip(a * (0.8 + 0.25 * rays_), 0, 1)
    core = np.clip(1 - r * 2.2, 0, 1)
    rgb = hexc('#FFB43A')[None, None] * (1 - core[..., None]) + np.array([1, 0.96, 0.82])[None, None] * core[..., None]
    return rgba(name, np.concatenate([rgb, a[..., None]], -1))


TX = {
    'mandala': t_mandala('gl_mandala.png'),
    'portal': t_swirl('gl_portal_swirl.png', 1024, 5, 3.2, '#FFFFFF', '#E8A62A', phase=0.3, haze=0.45),
    'well': t_swirl('gl_well_swirl.png', 1024, 4, 2.6, '#FFE7A8', '#7A3BFF', phase=0.0, haze=0.3),
    'rock': t_rock('gl_rock.jpg'),
    'obs': tex_marble('gl_obsidian.jpg', (0.04, 0.035, 0.07), (0.46, 0.36, 0.16), 7, sharp=12),
    'marble': tex_marble('gl_marble.jpg', (0.93, 0.91, 0.87), (0.66, 0.62, 0.55), 11, sharp=7),
    'back': t_vignette('gl_backlight.png'),
    'seal': t_rune('gl_seal.png', '#FF5A3A', (1, 0.9, 0.6), n=1024, seed=9, petals=6),
    'beam': t_band('gl_beam.png', '#C9A2FF', (1, 0.95, 0.8)),
    'beam_gold': t_band('gl_beam_gold.png', '#FFD36A', (1, 1, 0.9)),
    'sun': t_radial('gl_sun.png', '#FFC94A', (1, 0.96, 0.82), n=512, power=1.6, spikes=24),
}

# UI frames for the warp (8 phases of a spinning vortex, square, alpha at the rim)
os.makedirs(os.path.join(ROOT, 'images', 'warp'), exist_ok=True)
for k in range(8):
    p = t_swirl(f'_warp{k}.png', 512, 6, 6.0, '#FFE2A0', '#4A12C8', phase=2 * math.pi * k / 48, edge=0.99, haze=0.22)
    Image.open(p).save(os.path.join(ROOT, 'images', 'warp', f'v{k}.png'), optimize=True)


def mats():
    M = scene()
    D = {}
    D['obs'] = M.add('gl_obsidian', '#FFFFFF', 0.25, 0.14, tex=TX['obs'], tile=7.0)
    D['marble'] = M.add('gl_marble', '#FFFFFF', 0.02, 0.32, tex=TX['marble'], tile=3.0)
    D['gold'] = M.add('gl_gold', '#D9A93E', 1.0, 0.2, '#5A3A00', 0.25)
    D['goldglow'] = M.add('gl_goldglow', '#FFD86A', 0.0, 0.3, '#FFC13A', 6.0)
    D['rock'] = M.add('gl_rock', '#FFFFFF', 0.05, 0.85, tex=TX['rock'], tile=6.0)
    D['crys'] = M.add('gl_crystal', '#B98CFF', 0.1, 0.1, '#8A4BFF', 4.5)
    D['crys_g'] = M.add('gl_crystal_g', '#FFE2A0', 0.1, 0.1, '#FFB52A', 4.5)
    D['glass'] = M.add('gl_glass', '#FFE9B8', 0.2, 0.05, '#3A2A10', 0.2, alpha=0.18)
    D['mandala'] = tmat(M, 'gl_mandala', TX['mandala'], 2.6)
    D['fire'] = fire_mat(M, 'gl_fire', '#FFB02A', '#FFF4C8', 6.0)
    D['velvet'] = M.add('gl_velvet', '#2A0A3A', 0.0, 0.85)
    D['leather'] = M.add('gl_leather', '#F3EEE6', 0.0, 0.55)
    D['sil'] = M.add('gl_silhouette', '#050307', 0.9, 0.12)
    D['silgold'] = M.add('gl_silgold', '#6A4A10', 0.8, 0.3, '#B07A10', 0.8)
    D['back'] = tmat(M, 'gl_backlight', TX['back'], 3.2)
    D['seal'] = tmat(M, 'gl_seal', TX['seal'], 4.0)
    D['beam'] = tmat(M, 'gl_beam', TX['beam'], 2.5)
    D['beamg'] = tmat(M, 'gl_beam_gold', TX['beam_gold'], 2.5)
    D['sun'] = tmat(M, 'gl_sun', TX['sun'], 4.0)
    D['red'] = M.add('gl_rope', '#8A0F22', 0.1, 0.5)
    return M, D


# ═══════════════ 1. THE LOUNGE ═══════════════
M, D = mats()
B = Builder(M)

# ── floor slab (octagon) ──
top = oct_pts(RO, Y)
B.faces(B.a(D['obs']), top, [list(range(8))[::-1]])
B.decal(CX, Y + 0.02, CZ, 26.5, 26.5, D['mandala'])
for k in range(8):                                     # rim: gold band + marble face
    p0, p1 = top[k], top[(k + 1) % 8]
    o0 = oct_pts(RO + 0.03, Y + 0.04)[k]
    o1 = oct_pts(RO + 0.03, Y + 0.04)[(k + 1) % 8]
    B.quad((o0[0], Y - 0.16, o0[2]), (o1[0], Y - 0.16, o1[2]), (o1[0], Y + 0.04, o1[2]), (o0[0], Y + 0.04, o0[2]), D['gold'])
    B.quad((p0[0], Y - 0.75, p0[2]), (p1[0], Y - 0.75, p1[2]), (p1[0], Y - 0.16, p1[2]), (p0[0], Y - 0.16, p0[2]), D['marble'])
B.collider(CX - AP, Y - 0.6, CZ - AP, CX + AP, Y, CZ + AP)

# ── floating island underneath ──
rng = np.random.default_rng(5)
SEG = 32
rings_ = [(-0.75, 1.0), (-1.9, 0.94), (-3.6, 0.8), (-5.9, 0.62), (-8.4, 0.44), (-10.8, 0.27), (-12.7, 0.12)]
verts, faces_ = [], []
for j, (dy, f) in enumerate(rings_):
    for i in range(SEG):
        a = 2 * math.pi * i / SEG
        # octagon perimeter at the top ring, rounding into a rough cone below
        oct_r = AP / max(0.01, math.cos(((a - math.radians(22.5)) % math.radians(45)) - math.radians(22.5)))
        base_r = oct_r * (1 - min(1, j / 2)) + (AP * 1.02) * min(1, j / 2)
        nz = 0 if j == 0 else (rng.random() - 0.5) * 0.22
        r = base_r * f * (1 + nz)
        verts.append((CX + math.cos(a) * r, Y + dy + (0 if j == 0 else (rng.random() - 0.5) * 0.6), CZ + math.sin(a) * r))
for j in range(len(rings_) - 1):
    for i in range(SEG):
        a0, a1 = j * SEG + i, j * SEG + (i + 1) % SEG
        faces_.append([a0, a1, a1 + SEG, a0 + SEG])
tip = len(verts)
verts.append((CX + 0.6, Y - 14.6, CZ - 0.4))
for i in range(SEG):
    faces_.append([(len(rings_) - 1) * SEG + i, (len(rings_) - 1) * SEG + (i + 1) % SEG, tip])
B.faces(B.a(D['rock']), verts, faces_)
for k in range(16):                                    # hanging crystals
    a = rng.random() * 2 * math.pi
    rr = 3 + rng.random() * 9
    yy = Y - 2.5 - (1 - rr / 13) * 8 - rng.random() * 1.5
    h = 0.8 + rng.random() * 1.6
    B.octa(CX + math.cos(a) * rr, yy, CZ + math.sin(a) * rr, 0.25 + rng.random() * 0.25, h, D['crys'] if k % 3 else D['crys_g'])
for k in range(10):                                    # crystal clusters on the rim, pointing out
    a = 2 * math.pi * (k + 0.3) / 10
    B.octa(CX + math.cos(a) * (AP + 0.3), Y - 1.6, CZ + math.sin(a) * (AP + 0.3), 0.35, 1.1, D['crys'])
torus(B, (CX, Y - 0.9, CZ), (0, 1, 0), AP * 1.0, 0.12, D['goldglow'], 48, 4)   # glowing ring under the rim

# ── pillars + braziers at the octagon corners, glass balustrade between them ──
PR = RO - 0.75
pil = oct_pts(PR, Y)
for (px, _, pz) in pil:
    B.box(px, Y + 0.2, pz, 1.25, 0.4, 1.25, D['marble'])
    B.box(px, Y + 0.45, pz, 1.05, 0.1, 1.05, D['gold'])
    B.cyl(px, Y + 0.5, pz, 0.42, 6.1, D['marble'], seg=16)
    for h in (1.2, 3.5, 5.8):
        torus(B, (px, Y + 0.5 + h, pz), (0, 1, 0), 0.43, 0.035, D['gold'], 16, 4)
    B.cyl(px, Y + 6.6, pz, 0.44, 0.35, D['gold'], seg=16, r_top=0.62)
    B.box(px, Y + 7.05, pz, 1.35, 0.18, 1.35, D['gold'])
    B.cyl(px, Y + 7.14, pz, 0.38, 0.4, D['gold'], seg=12, r_top=0.62)
    card(B, (px, Y + 7.45, pz), (px, Y + 9.0, pz), 1.05, D['fire'], n=3)
for k in range(8):
    p0, p1 = pil[k], pil[(k + 1) % 8]
    mx, mz = (p0[0] + p1[0]) / 2, (p0[2] + p1[2]) / 2
    L = math.hypot(p1[0] - p0[0], p1[2] - p0[2]) - 1.3
    yw = yaw_of(p0, p1)
    B.box(mx, Y + 0.12, mz, L, 0.24, 0.42, D['marble'], yaw=yw)
    B.box(mx, Y + 0.75, mz, L, 1.05, 0.05, D['glass'], yaw=yw)
    B.box(mx, Y + 1.32, mz, L, 0.1, 0.22, D['gold'], yaw=yw)
    # invisible walls: gods can fly, so they go up 28 m
    q0, q1 = oct_pts(RO - 0.6, Y)[k], oct_pts(RO - 0.6, Y)[(k + 1) % 8]
    B.box((q0[0] + q1[0]) / 2, Y + 14, (q0[2] + q1[2]) / 2, math.hypot(q1[0] - q0[0], q1[2] - q0[2]) + 0.6, 28, 0.5, None, yaw=yaw_of(q0, q1), collide=True)

# ── gold inlay paths (arrival → centre → gate) ──
B.decal(CX, Y + 0.03, (ARRIVE[1] + PORTAL[1] - 4) / 2, 0.5, PORTAL[1] - 4 - ARRIVE[1], D['goldglow'])

# ── arrival dais (south) ──
ax, az = ARRIVE
B.cyl(ax, Y, az, 2.4, 0.14, D['marble'], seg=40)
torus(B, (ax, Y + 0.14, az), (0, 1, 0), 2.4, 0.05, D['gold'], 40, 4)
disc(B, (ax, Y + 0.155, az), (0, 1, 0), 2.1, D['sun'], 32)

# ── DESCENT well (south-west) ──
dx_, dz_ = DESCENT
B.ring(dx_, Y - 0.02, dz_, 1.75, 2.15, 0.16, D['gold'], seg=40)
B.cyl(dx_, Y - 0.04, dz_, 1.75, 0.03, D['velvet'], seg=40)
for k in range(6):
    a = 2 * math.pi * k / 6
    B.octa(dx_ + math.cos(a) * 2.45, Y + 0.9, dz_ + math.sin(a) * 2.45, 0.12, 0.28, D['crys'])

# ── NORTH: THE GATE TO THE LAND OF THE GODS (sealed) ──
gx, gz = PORTAL
for i, r in enumerate((4.9, 4.2, 3.5)):
    B.cyl(gx, Y + i * 0.3, gz + 1.0, r, 0.3, D['marble'], seg=48)
    torus(B, (gx, Y + i * 0.3 + 0.3, gz + 1.0), (0, 1, 0), r, 0.04, D['gold'], 48, 4)
GT = Y + 0.9                    # gate floor
GC = (gx, GT + 4.7, gz)         # ring centre
torus(B, GC, (0, 0, 1), 4.15, 0.38, D['gold'], 64, 10)
torus(B, GC, (0, 0, 1), 4.75, 0.12, D['gold'], 64, 6)
torus(B, GC, (0, 0, 1), 3.72, 0.07, D['goldglow'], 64, 5)
rays(B, (GC[0], GC[1], gz + 0.02), (0, 0, 1), 4.85, 6.2, 36, 0.12, D['gold'], alt=0.35)
rays(B, (GC[0], GC[1], gz - 0.02), (0, 0, -1), 4.85, 6.2, 36, 0.12, D['gold'], alt=0.35)
for k in range(12):             # runes around the ring
    a = 2 * math.pi * k / 12
    B.octa(GC[0] + math.cos(a) * 4.15, GC[1] + math.sin(a) * 4.15, gz - 0.42, 0.14, 0.22, D['crys_g'])
# sun crown on top
cc = (gx, GC[1] + 5.4, gz)
disc(B, cc, (0, 0, 1), 1.0, D['gold'], 24)
rays(B, cc, (0, 0, 1), 1.0, 2.1, 16, 0.16, D['gold'], alt=0.4)
rays(B, cc, (0, 0, -1), 1.0, 2.1, 16, 0.16, D['gold'], alt=0.4)
B.octa(cc[0], cc[1], gz - 0.1, 0.45, 0.7, D['crys_g'])
B.quad((gx - 3.6, cc[1] - 3.6, gz + 0.3), (gx + 3.6, cc[1] - 3.6, gz + 0.3), (gx + 3.6, cc[1] + 3.6, gz + 0.3), (gx - 3.6, cc[1] + 3.6, gz + 0.3), D['sun'])
# base of the ring: two gold claws grip the steps
for s in (-1, 1):
    tube(B, (gx + s * 1.4, GT, gz), (gx + s * 2.6, GT + 1.4, gz), 0.32, 0.22, D['gold'], 10)
# obelisks
for s in (-1, 1):
    ox = gx + s * 6.4
    B.box(ox, GT + 0.3, gz, 1.8, 0.6, 1.8, D['marble'])
    B.box(ox, GT + 0.65, gz, 1.5, 0.1, 1.5, D['gold'])
    B.cyl(ox, GT + 0.7, gz, 0.62, 9.2, D['marble'], seg=4, r_top=0.4)
    for h in (2.0, 5.0, 8.0):
        B.cyl(ox, GT + 0.7 + h, gz, 0.6 - h * 0.024, 0.14, D['gold'], seg=4, r_top=0.59 - h * 0.024)
    cone(B, (ox, GT + 9.9, gz), (ox, GT + 11.4, gz), 0.45, D['gold'], 4)
    B.octa(ox, GT + 12.4, gz, 0.32, 0.6, D['crys_g'])
    tube(B, (ox - s * 0.4, GT + 7.0, gz), (gx + s * 4.6, GC[1] + 1.2, gz), 0.1, 0.07, D['gold'], 6)
# the seal: two crossed chains + a red sigil in the middle
def chain(p0, p1, n, r):
    for i in range(n):
        t = (i + 0.5) / n
        c = (p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, p0[2] + (p1[2] - p0[2]) * t)
        d = norm(sub(p1, p0))
        side = (0, 0, 1) if i % 2 == 0 else norm((d[1], -d[0], 0))
        torus(B, c, side, r, r * 0.28, D['gold'], 10, 4)
zf = gz - 0.55
for (a, b) in (((-3.0, -3.0), (3.0, 3.0)), ((-3.0, 3.0), (3.0, -3.0))):
    chain((GC[0] + a[0], GC[1] + a[1], zf), (GC[0] + b[0], GC[1] + b[1], zf), 18, 0.2)
B.quad((GC[0] + 1.35, GC[1] - 1.35, zf - 0.05), (GC[0] - 1.35, GC[1] - 1.35, zf - 0.05), (GC[0] - 1.35, GC[1] + 1.35, zf - 0.05), (GC[0] + 1.35, GC[1] + 1.35, zf - 0.05), D['seal'])
torus(B, (GC[0], GC[1], zf - 0.06), (0, 0, 1), 0.75, 0.09, D['gold'], 24, 5)
B.collider(gx - 4.9, Y, gz - 0.8, gx + 4.9, Y + 11, gz + 0.8)        # can't walk through the gate (yet)

# ── EAST: THE DIVINE VAULT ──
VA = [-40, -20, 0, 20, 40]
# curved velvet backdrop with gold pilasters
BR = VAULT_R + 2.3
segs = 14
for i in range(segs):
    a0 = math.radians(-54 + 108 * i / segs)
    a1 = math.radians(-54 + 108 * (i + 1) / segs)
    p0 = (CX + math.cos(a0) * BR, CZ + math.sin(a0) * BR)
    p1 = (CX + math.cos(a1) * BR, CZ + math.sin(a1) * BR)
    B.quad((p1[0], Y, p1[1]), (p0[0], Y, p0[1]), (p0[0], Y + 5.2, p0[1]), (p1[0], Y + 5.2, p1[1]), D['velvet'])
    B.quad((p0[0] + 0.25, Y, p0[1]), (p1[0] + 0.25, Y, p1[1]), (p1[0] + 0.25, Y + 5.2, p1[1]), (p0[0] + 0.25, Y + 5.2, p0[1]), D['marble'])
    if i % 2 == 0:
        B.box(p0[0] - 0.05, Y + 2.6, p0[1], 0.3, 5.2, 0.3, D['gold'], yaw=-math.degrees(a0))
# gold top rail along the backdrop arc
for i in range(segs):
    a0 = math.radians(-54 + 108 * i / segs)
    a1 = math.radians(-54 + 108 * (i + 1) / segs)
    p0 = (CX + math.cos(a0) * BR, CZ + math.sin(a0) * BR)
    p1 = (CX + math.cos(a1) * BR, CZ + math.sin(a1) * BR)
    B.box((p0[0] + p1[0]) / 2, Y + 5.25, (p0[1] + p1[1]) / 2, math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.05, 0.3, 0.55, D['gold'], yaw=yaw_of((p0[0], 0, p0[1]), (p1[0], 0, p1[1])))
# sign plate over the vault (text goes on it at runtime)
sp = (CX + BR - 0.3, Y + 6.2, CZ)
B.box(sp[0] + 0.1, sp[1], sp[2], 0.25, 1.5, 8.6, D['velvet'])
B.box(sp[0], sp[1] + 0.8, sp[2], 0.35, 0.12, 8.9, D['gold'])
B.box(sp[0], sp[1] - 0.8, sp[2], 0.35, 0.12, 8.9, D['gold'])


def case(cx, cz, face_yaw, item):
    """pedestal + glass case; the item is a black silhouette back-lit by a warm glow card"""
    B.cyl(cx, Y, cz, 0.78, 0.18, D['gold'], seg=24)
    B.cyl(cx, Y + 0.18, cz, 0.66, 0.95, D['obs'], seg=24, r_top=0.6)
    torus(B, (cx, Y + 1.13, cz), (0, 1, 0), 0.62, 0.04, D['gold'], 24, 4)
    B.cyl(cx, Y + 1.13, cz, 0.72, 0.08, D['gold'], seg=24)
    h0, h1, w = Y + 1.21, Y + 3.15, 1.3
    B.box(cx, (h0 + h1) / 2, cz, w, h1 - h0, w, D['glass'], yaw=face_yaw)
    for sx in (-1, 1):
        for sz in (-1, 1):
            ox, _, oz = rot(sx * w / 2, 0, sz * w / 2, face_yaw, 0, 0)
            B.box(cx + ox, (h0 + h1) / 2, cz + oz, 0.05, h1 - h0, 0.05, D['gold'])
    for yy in (h0, h1):
        for k in range(4):
            a = face_yaw + 90 * k
            ox, _, oz = rot(0, 0, w / 2, a, 0, 0)
            B.box(cx + ox, yy, cz + oz, w, 0.05, 0.05, D['gold'], yaw=a)
    B.box(cx, h1 + 0.08, cz, w + 0.12, 0.12, w + 0.12, D['gold'], yaw=face_yaw)
    # back-light card (behind the item as seen from the lounge centre)
    bx, _, bz = rot(0.55, 0, 0, face_yaw, 0, 0)
    ux, _, uz = rot(0, 0, 0.7, face_yaw, 0, 0)
    c0 = (cx + bx, cz + bz)
    B.quad((c0[0] - ux, h0 + 0.05, c0[1] - uz), (c0[0] + ux, h0 + 0.05, c0[1] + uz), (c0[0] + ux, h1 - 0.05, c0[1] + uz), (c0[0] - ux, h1 - 0.05, c0[1] - uz), D['back'])
    B.quad((c0[0] + ux, h0 + 0.05, c0[1] + uz), (c0[0] - ux, h0 + 0.05, c0[1] - uz), (c0[0] - ux, h1 - 0.05, c0[1] - uz), (c0[0] + ux, h1 - 0.05, c0[1] + uz), D['back'])
    item(cx, Y + 2.15, cz, face_yaw)


S, SG = D['sil'], D['silgold']


def it_crown(x, y, z, yw):
    torus(B, (x, y - 0.25, z), (0, 1, 0), 0.34, 0.06, S, 24, 6)
    B.cyl(x, y - 0.3, z, 0.36, 0.22, S, seg=24, r_top=0.4)
    for k in range(8):
        a = 2 * math.pi * k / 8
        px, pz = x + math.cos(a) * 0.38, z + math.sin(a) * 0.38
        cone(B, (px, y - 0.1, pz), (px + math.cos(a) * 0.06, y + (0.42 if k % 2 == 0 else 0.26), pz + math.sin(a) * 0.06), 0.07, S, 5)
        B.sphere(px + math.cos(a) * 0.06, y + (0.46 if k % 2 == 0 else 0.3), pz + math.sin(a) * 0.06, 0.04, SG, 6, 4)
    torus(B, (x, y - 0.12, z), (0, 1, 0), 0.39, 0.02, SG, 24, 4)


def it_wings(x, y, z, yw):
    for s in (-1, 1):
        # wings spread across the case, facing the viewer (local x = case width)
        root = (0, -0.05, 0)
        bb = Builder(M)
        tipw = angel_wing(bb, root, s, 0.48, 1.0, 0.14, S, S, prim=7, sec=5, droop=0.8, thick=0.025)
        for m_, a_ in bb.acc.items():
            vs = []
            for (vx, vy, vz) in a_.v:
                rx, ry, rz = rot(-vz, vy, vx, yw, 0, 0)     # wing span runs along the case's sideways axis
                vs.append((x + rx, y + ry, z + rz))
            B.faces(B.a(m_), vs, [f for f, _, _ in a_.f], smooth=False)
    B.sphere(x, y - 0.05, z, 0.07, SG, 8, 5)


def it_robe(x, y, z, yw):
    # a draped robe on an invisible stand: lathe of a flowing gown + hood
    prof = [(0.0, 0.62), (0.16, 0.56), (0.28, 0.45), (0.33, 0.25), (0.3, 0.05), (0.36, -0.2), (0.44, -0.55), (0.52, -0.86)]
    seg = 20
    vs, fs = [], []
    for (r, dy) in prof:
        for i in range(seg):
            a = 2 * math.pi * i / seg
            wob = 1 + 0.06 * math.sin(a * 5 + dy * 7)
            vs.append((x + math.cos(a) * r * wob, y + dy, z + math.sin(a) * r * wob * 0.8))
    for j in range(len(prof) - 1):
        for i in range(seg):
            a0, a1 = j * seg + i, j * seg + (i + 1) % seg
            fs.append([a0, a1, a1 + seg, a0 + seg])
    B.faces(B.a(S), vs, fs, smooth=True)
    torus(B, (x, y + 0.27, z), (0, 1, 0), 0.31, 0.025, SG, 20, 4)       # gold collar
    tube(B, (x, y + 0.25, z), (x, y - 0.8, z), 0.02, 0.02, SG, 4)           # gold seam


def it_staff(x, y, z, yw):
    tube(B, (x, y - 0.85, z), (x, y + 0.45, z), 0.035, 0.03, S, 8)
    B.sphere(x, y + 0.6, z, 0.14, S, 12, 8)
    torus(B, (x, y + 0.6, z), (0, 0, 1), 0.24, 0.02, SG, 24, 4)
    torus(B, (x, y + 0.6, z), (1, 0, 0), 0.24, 0.02, SG, 24, 4)
    for k in range(6):
        a = 2 * math.pi * k / 6
        cone(B, (x + math.cos(a) * 0.1, y + 0.42, z + math.sin(a) * 0.1), (x + math.cos(a) * 0.2, y + 0.85, z + math.sin(a) * 0.2), 0.03, S, 4)
    torus(B, (x, y + 0.38, z), (0, 1, 0), 0.06, 0.02, SG, 12, 4)


def it_halo(x, y, z, yw):
    nx, _, nz = rot(1, 0, 0, yw, 0, 0)
    torus(B, (x, y + 0.1, z), (nx, 0, nz), 0.42, 0.045, S, 36, 6)
    torus(B, (x, y + 0.1, z), (nx, 0, nz), 0.5, 0.012, SG, 36, 4)
    rays(B, (x, y + 0.1, z), (nx, 0, nz), 0.47, 0.72, 24, 0.022, S, alt=0.45)
    B.octa(x, y - 0.5, z, 0.12, 0.3, S)


ITEMS = [it_staff, it_wings, it_crown, it_robe, it_halo]
for a_deg, fn in zip(VA, ITEMS):
    a = math.radians(a_deg)
    cx, cz = CX + math.cos(a) * VAULT_R, CZ + math.sin(a) * VAULT_R
    case(cx, cz, -a_deg + 0, fn)
# velvet-rope stanchions in front of the vault (not open yet)
RR = VAULT_R - 2.2
posts = []
for i in range(7):
    a = math.radians(-48 + 96 * i / 6)
    px, pz = CX + math.cos(a) * RR, CZ + math.sin(a) * RR
    posts.append((px, pz))
    B.cyl(px, Y, pz, 0.2, 0.05, D['gold'], seg=12)
    B.cyl(px, Y + 0.05, pz, 0.05, 0.95, D['gold'], seg=8)
    B.sphere(px, Y + 1.04, pz, 0.08, D['gold'], 8, 5)
for i in range(6):
    (x0, z0), (x1, z1) = posts[i], posts[i + 1]
    mid = ((x0 + x1) / 2, Y + 0.68, (z0 + z1) / 2)
    tube(B, (x0, Y + 0.95, z0), mid, 0.035, 0.035, D['red'], 6)
    tube(B, mid, (x1, Y + 0.95, z1), 0.035, 0.035, D['red'], 6)
    B.collider(min(x0, x1) - 0.05, Y, min(z0, z1) - 0.05, max(x0, x1) + 0.05, Y + 1.1, max(z0, z1) + 0.05)

# ── WEST: the conversation pit + THE PANTHEON stele ──
px_, pz_ = PIT
B.cyl(px_, Y + 0.001, pz_, 4.4, 0.06, D['marble'], seg=48)
torus(B, (px_, Y + 0.06, pz_), (0, 1, 0), 4.4, 0.05, D['gold'], 48, 4)
disc(B, (px_, Y + 0.065, pz_), (0, 1, 0), 2.0, D['sun'], 32)
# three curved sofas (gap toward the lounge centre)
for (a0, a1) in ((70, 160), (180, 270), (290, 340)):
    n = 7
    for i in range(n):
        t0 = math.radians(a0 + (a1 - a0) * i / n)
        t1 = math.radians(a0 + (a1 - a0) * (i + 1) / n)
        tm = (t0 + t1) / 2
        ln = 2 * 3.2 * math.sin((t1 - t0) / 2) + 0.04
        yw = -math.degrees(tm) + 90
        sx, sz = px_ + math.cos(tm) * 3.2, pz_ + math.sin(tm) * 3.2
        B.box(sx, Y + 0.28, sz, ln, 0.44, 0.95, D['leather'], yaw=yw)
        bx, bz = px_ + math.cos(tm) * 3.72, pz_ + math.sin(tm) * 3.72
        B.box(bx, Y + 0.72, bz, ln + 0.08, 0.9, 0.24, D['leather'], yaw=yw)
        gx2, gz2 = px_ + math.cos(tm) * 3.86, pz_ + math.sin(tm) * 3.86
        B.box(gx2, Y + 1.19, gz2, ln + 0.1, 0.05, 0.1, D['gold'], yaw=yw)
        B.box(sx, Y + 0.05, sz, ln, 0.1, 0.85, D['gold'], yaw=yw)
# low round table with a floating sun orb (the orb bobs in TS? no — static glow)
B.cyl(px_, Y, pz_, 0.25, 0.4, D['gold'], seg=12)
B.cyl(px_, Y + 0.4, pz_, 1.05, 0.08, D['obs'], seg=32)
torus(B, (px_, Y + 0.48, pz_), (0, 1, 0), 1.05, 0.03, D['gold'], 32, 4)
B.collider(px_ - 1.0, Y, pz_ - 1.0, px_ + 1.0, Y + 0.5, pz_ + 1.0)
# a floating sun over the table (THE PANTHEON names circle it at runtime)
B.sphere(px_, Y + 2.3, pz_, 0.32, D['goldglow'], 14, 9)
torus(B, (px_, Y + 2.3, pz_), (0, 1, 0), 0.55, 0.025, D['gold'], 32, 4)
rays(B, (px_, Y + 2.3, pz_), (0, 0, 1), 0.36, 0.8, 12, 0.05, D['gold'], alt=0.4)
rays(B, (px_, Y + 2.3, pz_), (1, 0, 0), 0.36, 0.8, 12, 0.05, D['gold'], alt=0.4)

B.emit('god_lounge')
finish('god_lounge')

# ═══════════════ 2. gate swirl (origin, faces ±z) ═══════════════
M, D = mats()
B = Builder(M)
SW = tmat(M, 'gl_portal_swirl', TX['portal'], 3.0)
h = 3.8
for z, m in ((0.0, SW),):
    B.quad((-h, -h, z), (h, -h, z), (h, h, z), (-h, h, z), m)
    B.quad((h, -h, -0.01), (-h, -h, -0.01), (-h, h, -0.01), (h, h, -0.01), m)
B.emit('fx')
finish('god_portal_fx')

# ═══════════════ 3. well rim + light column (origin) ═══════════════
M, D = mats()
B = Builder(M)
B.cyl(0, 0, 0, 2.3, 0.1, D['marble'], seg=40)
B.ring(0, 0.1, 0, 1.75, 2.15, 0.12, D['gold'], seg=40)
torus(B, (0, 0.22, 0), (0, 1, 0), 1.95, 0.05, D['goldglow'], 40, 4)
for k in range(8):
    a = 2 * math.pi * k / 8
    B.octa(math.cos(a) * 2.05, 0.3, math.sin(a) * 2.05, 0.08, 0.16, D['crys_g'])
open_cyl(B, 1.6, 9.0, D['beam'], seg=24, y0=0.12)
open_cyl(B, 1.1, 14.0, D['beamg'], seg=20, y0=0.12)
B.emit('well')
finish('ascent_well')

# ═══════════════ 4. well swirl (origin, horizontal) ═══════════════
M, D = mats()
B = Builder(M)
WS = tmat(M, 'gl_well_swirl', TX['well'], 3.2)
r = 1.75
B.quad((-r, 0, r), (r, 0, r), (r, 0, -r), (-r, 0, -r), WS)
B.quad((-r * 0.7, 0.35, r * 0.7), (r * 0.7, 0.35, r * 0.7), (r * 0.7, 0.35, -r * 0.7), (-r * 0.7, 0.35, -r * 0.7), WS)
B.emit('fx')
finish('ascent_fx')

# ═══════════════ 5. orrery (origin) ═══════════════
M, D = mats()
B = Builder(M)
torus(B, (0, 0, 0), (0, 1, 0), 2.6, 0.07, D['gold'], 64, 6)
torus(B, (0, 0, 0), (1, 0, 0.35), 2.15, 0.05, D['gold'], 56, 6)
torus(B, (0, 0, 0), (0.3, 0.2, 1), 1.7, 0.05, D['gold'], 48, 6)
torus(B, (0, 0, 0), (0, 1, 0), 2.6, 0.02, D['goldglow'], 64, 4)
B.sphere(0, 0, 0, 0.55, D['goldglow'], 16, 10)
for k in range(6):
    a = 2 * math.pi * k / 6
    B.sphere(math.cos(a) * 2.6, 0, math.sin(a) * 2.6, 0.12, D['crys_g'], 8, 5)
B.emit('orrery')
finish('god_orrery')

print('GODLOUNGE', json.dumps(REPORT))
