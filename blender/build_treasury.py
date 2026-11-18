"""
WOW NIGHTSWARM — Treasury (gold shop) art.
  models/treasury.glb      overflowing chest kiosk + neon arch for the sanctuary (click to open the shop)
  images/pack_1..5.png     rendered gold piles for the 5 shop packs (transparent)
  images/shop_bg.png       ornate panel background for the shop window
Run: python3 blender/build_treasury.py
"""
import bpy, math, os, sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa  (Builder, Mats, scene, tmat, t_band, t_radial, finish, flat, open_cyl, cross3 ...)

IMG = os.path.join(ROOT, 'images')
os.makedirs(IMG, exist_ok=True)


def coin_pile(B, GOLDC, GEM, RUBY, cx, cz, n, spread, seed, chest=None, height=1.0, seg=10, y0=0.0):
    rnd = random.Random(seed)
    # heap: coins on a cone-ish mound
    for i in range(n):
        r = spread * math.sqrt(rnd.random())
        a = rnd.random() * 2 * math.pi
        y = y0 + (1 - r / spread) * height * 0.55 + rnd.random() * 0.05
        x, z = cx + math.cos(a) * r, cz + math.sin(a) * r
        B.cyl(x, y, z, 0.09, 0.025, GOLDC, seg=seg)
        if rnd.random() < 0.35:   # tilted coins break the regular look
            B.box(x, y + 0.03, z, 0.17, 0.02, 0.17, GOLDC, yaw=rnd.random() * 90, pitch=rnd.uniform(20, 70))
    # stacks
    for k in range(max(1, n // 40)):
        a = rnd.random() * 2 * math.pi
        r = spread * rnd.uniform(0.4, 0.9)
        h = rnd.randint(4, 10)
        for j in range(h):
            B.cyl(cx + math.cos(a) * r + rnd.uniform(-0.01, 0.01), y0 + j * 0.028, cz + math.sin(a) * r + rnd.uniform(-0.01, 0.01), 0.09, 0.026, GOLDC, seg=seg)
    for k in range(n // 60):
        a = rnd.random() * 2 * math.pi
        r = spread * rnd.uniform(0, 0.7)
        y = y0 + (1 - r / spread) * height * 0.55 + 0.08
        B.octa(cx + math.cos(a) * r, y, cz + math.sin(a) * r, 0.06, 0.09, GEM if k % 2 else RUBY)


def chest(B, WOODC, GOLDC, cx, cz, s=1.0, yaw=0, y0=0.0):
    B.box(cx, y0 + 0.25 * s, cz, 1.0 * s, 0.5 * s, 0.65 * s, WOODC, yaw=yaw)
    for dx in (-0.45, 0.45):
        B.box(cx + dx * s, y0 + 0.25 * s, cz, 0.06 * s, 0.52 * s, 0.67 * s, GOLDC, yaw=yaw)
    B.box(cx, y0 + 0.5 * s, cz, 1.02 * s, 0.05 * s, 0.67 * s, GOLDC, yaw=yaw)
    # open lid tilted back
    B.box(cx, y0 + 0.78 * s, cz - 0.36 * s, 1.0 * s, 0.6 * s, 0.08 * s, WOODC, yaw=yaw, pitch=-15)
    B.box(cx, y0 + 1.06 * s, cz - 0.43 * s, 1.02 * s, 0.06 * s, 0.1 * s, GOLDC, yaw=yaw, pitch=-15)


# ═════════════ 1) TREASURY KIOSK (GLB) ═════════════
M = scene()
GOLDC = M.add('treasure_gold', '#FFCB45', 1.0, 0.18, '#B07A00', 0.6)
WOODC = M.add('chest_wood', '#3A1050', 0.0, 0.5)
MARB = M.add('kiosk_marble', '#0C0A12', 0.2, 0.15)
GEM = M.add('gem_cyan', '#5EF2FF', 0.2, 0.05, '#20C8FF', 4.0)
RUBY = M.add('gem_ruby', '#FF2A5A', 0.2, 0.05, '#FF1040', 4.0)
NEON = M.add('neon_gold', '#FFE08A', 0.0, 0.3, '#FFB000', 9.0)
NEON_P = M.add('neon_purple', '#D49BFF', 0.0, 0.3, '#9A3BFF', 7.0)
BEAM = tmat(M, 'gold_beam', t_band('treasury_beam.png', '#FFC84A', (1, 1, 0.85)), 3)
SPARK = tmat(M, 'gold_spark', t_radial('treasury_spark.png', '#FFD86A', (1, 1, 1), spikes=4, power=2.8), 5)
B = Builder(M)
# stepped round platform
B.cyl(0, 0.0, 0, 2.0, 0.25, MARB, seg=24, collide=True)
B.cyl(0, 0.25, 0, 2.02, 0.05, GOLDC, seg=24)
B.cyl(0, 0.3, 0, 1.6, 0.2, MARB, seg=24)
B.ring(0, 0.5, 0, 1.55, 1.65, 0.05, NEON, seg=32)
# overflowing chest + piles
chest(B, WOODC, GOLDC, 0, 0.1, 1.1, y0=0.5)
coin_pile(B, GOLDC, GEM, RUBY, 0, 0.1, 34, 0.33, 1, height=0.9, seg=6, y0=1.08)   # coins spilling out of the chest top
coin_pile(B, GOLDC, GEM, RUBY, 0.85, 0.6, 30, 0.55, 2, height=0.6, seg=6, y0=0.5)
coin_pile(B, GOLDC, GEM, RUBY, -0.85, 0.55, 28, 0.5, 3, height=0.55, seg=6, y0=0.5)
# neon arch behind
for s in (-1, 1):
    B.box(s * 1.75, 2.0, -1.2, 0.25, 3.6, 0.25, MARB)
    B.box(s * 1.75, 2.0, -1.06, 0.06, 3.6, 0.04, NEON)
    B.octa(s * 1.75, 4.05, -1.2, 0.22, 0.35, GEM)
for k in range(13):
    a0, a1 = math.pi * k / 13, math.pi * (k + 1) / 13
    x0, y0 = math.cos(a0) * 1.75, 3.8 + math.sin(a0) * 1.1
    x1, y1 = math.cos(a1) * 1.75, 3.8 + math.sin(a1) * 1.1
    ln = math.hypot(x1 - x0, y1 - y0) + 0.02
    ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
    B.box((x0 + x1) / 2, (y0 + y1) / 2, -1.2, ln, 0.22, 0.25, MARB, roll=ang)
    B.box((x0 + x1) / 2, (y0 + y1) / 2, -1.06, ln, 0.06, 0.04, NEON_P if k % 2 else NEON, roll=ang)
B.box(0, 3.15, -1.15, 3.2, 0.7, 0.12, MARB)        # sign board (text drawn at runtime)
B.box(0, 3.15, -1.08, 3.3, 0.78, 0.02, NEON)
# light beam + sparkles
open_cyl(B, 0.9, 6.0, BEAM, seg=20, y0=0.5)
for k in range(10):
    a = 2 * math.pi * k / 10
    y = 1.2 + (k % 4) * 0.7
    B.quad((math.cos(a) * 1.1 - 0.15, y - 0.15, math.sin(a) * 1.1), (math.cos(a) * 1.1 + 0.15, y - 0.15, math.sin(a) * 1.1),
           (math.cos(a) * 1.1 + 0.15, y + 0.15, math.sin(a) * 1.1), (math.cos(a) * 1.1 - 0.15, y + 0.15, math.sin(a) * 1.1), SPARK)
B.emit('treasury')
finish('treasury')
print('TREASURY', REPORT['treasury'])

# ═════════════ 2) PACK ICONS (rendered) ═════════════
def render_pack(idx, n, spread, height, gems, with_chest, bars):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    M = Mats()
    GOLDC = M.add('g', '#FFD040', 1.0, 0.25, '#A07000', 0.15)
    WOODC = M.add('w', '#3A1050', 0.0, 0.5)
    GEM = M.add('c', '#5EF2FF', 0.2, 0.05, '#20C8FF', 3.0)
    RUBY = M.add('r', '#FF2A5A', 0.2, 0.05, '#FF1040', 3.0)
    B = Builder(M)
    if with_chest:
        chest(B, WOODC, GOLDC, 0, -0.15, 0.9)
    coin_pile(B, GOLDC, GEM, RUBY, 0, 0.15 if with_chest else 0, n, spread, 10 + idx, height=height)
    for k in range(bars):  # gold bars
        B.box(-0.5 + k * 0.33, 0.06 + (k % 2) * 0.1, 0.55, 0.3, 0.1, 0.14, GOLDC, yaw=10 * k)
    for k in range(gems):
        a = k * 2.4
        B.octa(math.cos(a) * spread * 0.8, 0.12 + 0.05 * k, math.sin(a) * spread * 0.8 + 0.1, 0.07, 0.12, GEM if k % 2 else RUBY)
    B.emit('pack')
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 40
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 384
    w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs[0].default_value = (1.0, 0.8, 0.4, 1)
    w.node_tree.nodes['Background'].inputs[1].default_value = 0.9
    for (rx, rz, e, c) in [(40, 30, 4.0, (1, 0.92, 0.75)), (60, 210, 1.5, (0.6, 0.5, 1.0))]:
        l = bpy.data.lights.new('s', 'SUN'); l.energy = e; l.color = c
        o = bpy.data.objects.new('s', l); sc.collection.objects.link(o); o.rotation_euler = (math.radians(rx), 0, math.radians(rz))
    cam = bpy.data.cameras.new('c'); cam.lens = 50
    co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co)
    d = 1.0 + spread * 2.1 + (0.8 if with_chest else 0)
    co.location = (0, -d, d * 0.62)
    co.rotation_euler = (math.radians(58), 0, 0)
    sc.camera = co
    sc.render.filepath = os.path.join(IMG, f'pack_{idx}.png')
    bpy.ops.render.render(write_still=True)


render_pack(1, 25, 0.28, 0.35, 0, False, 0)
render_pack(2, 55, 0.4, 0.55, 2, False, 0)
render_pack(3, 110, 0.55, 0.75, 4, False, 2)
render_pack(4, 170, 0.65, 0.95, 6, False, 4)
render_pack(5, 160, 0.6, 1.2, 8, True, 5)

# ═════════════ 3) SHOP PANEL BACKGROUND ═════════════
W, H = 1024, 640
yy, xx = np.mgrid[0:H, 0:W]
cx, cy = W / 2, H * 0.38
r = np.hypot((xx - cx) / W, (yy - cy) / H)
base = np.stack([0.09 + 0.10 * np.exp(-r * 5), 0.04 + 0.05 * np.exp(-r * 5), 0.14 + 0.12 * np.exp(-r * 5)], -1)
ang = np.arctan2(yy - cy, xx - cx)
rays = (np.sin(ang * 18) * 0.5 + 0.5) ** 6 * np.exp(-r * 3.2) * 0.25
img = np.clip(base + rays[..., None] * np.array([1.0, 0.75, 0.3]), 0, 1)
pil = Image.fromarray((img * 255).astype(np.uint8)).convert('RGBA')
d = ImageDraw.Draw(pil)
G1, G2 = (255, 205, 90, 255), (150, 100, 30, 255)
for k, col in [(6, G2), (12, G1), (18, G2)]:
    d.rounded_rectangle([k, k, W - k, H - k], radius=28, outline=col, width=3 if col == G1 else 2)
for (x, y) in [(28, 28), (W - 28, 28), (28, H - 28), (W - 28, H - 28)]:
    d.regular_polygon((x, y, 16), 4, rotation=45, fill=G1)
    d.regular_polygon((x, y, 8), 4, rotation=45, fill=(255, 245, 200, 255))
glow = pil.filter(ImageFilter.GaussianBlur(6))
out = Image.alpha_composite(glow, pil)
out.convert('RGB').save(os.path.join(IMG, 'shop_bg.jpg'), quality=88)
print('ICONS OK')
