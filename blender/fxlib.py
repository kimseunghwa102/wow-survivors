"""
WOW NIGHTSWARM — shared FX helpers (textures + quad builders). Formerly part of build_fx.py.
skill effect models (Blender / bpy).
Every skill has a base look and an ASCENDED look. All glow via emissive textures (alpha-blended quads + crystal meshes).
Sizes are authored at unit scale; view.ts scales them to the gameplay hit area.
Run: python3 blender/build_fx.py → models/fx_*.glb
"""
import bpy, json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
sys.path.insert(0, os.path.dirname(__file__))
from common import *  # noqa

REPORT = {}


def rgba(name, arr):
    path = os.path.join(TEX_DIR, name)
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), 'RGBA').save(path)
    return path


def hexc(h):
    h = h.lstrip('#')
    return np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)])


def glowmap(core, col, hot=(1, 1, 1), g1=6, g2=18, gain=1.4):
    """core: L-mode PIL image → RGBA array with coloured bloom and white-hot centre"""
    c = np.asarray(core, dtype=float) / 255
    b1 = np.asarray(core.filter(ImageFilter.GaussianBlur(g1)), dtype=float) / 255
    b2 = np.asarray(core.filter(ImageFilter.GaussianBlur(g2)), dtype=float) / 255
    glow = np.clip((b1 * 1.2 + b2) * gain, 0, 1)
    a = np.clip(c + glow, 0, 1)
    rgb = hexc(col) * np.clip(glow + 0.35, 0, 1)[..., None]
    rgb = rgb * (1 - c[..., None]) + np.array(hot) * c[..., None]
    return np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1)


# ───────────── textures ─────────────
def t_crescent(name, col, hot, n=512, double=False):
    """sweeping slash arc, bright leading edge fading to the tail"""
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n
    # arc centred below the quad: radius 0.75, band 0.18 thick
    cx, cy, R = 0.5, 1.15, 0.85
    r = np.hypot(xx - cx, yy - cy)
    th = np.arctan2(xx - cx, cy - yy)          # -pi..pi, 0 = straight up
    span = 0.62
    t = np.clip((th + span) / (2 * span), 0, 1)  # 0 tail → 1 tip
    inside = (np.abs(th) < span)
    width = 0.03 + 0.16 * np.sin(np.pi * t) ** 0.8
    band = np.clip(1 - np.abs(r - R) / width, 0, 1) * inside
    edge = np.clip(1 - np.abs(r - (R + width * 0.6)) / 0.025, 0, 1) * inside * t
    a = np.clip(band ** 1.2 * (0.25 + 0.75 * t) + edge, 0, 1)
    if double:
        band2 = np.clip(1 - np.abs(r - (R - 0.22)) / (width * 0.6), 0, 1) * inside
        a = np.clip(a + band2 * 0.6 * t, 0, 1)
    rgb = hexc(col)[None, None, :] * (0.6 + 0.4 * band[..., None]) * (1 - edge[..., None]) + np.array(hot) * edge[..., None]
    rgb = rgb * (1 - band[..., None] ** 3 * t[..., None] * 0.5) + np.array(hot) * band[..., None] ** 3 * t[..., None] * 0.5
    return rgba(name, np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1))


def t_radial(name, col, hot=(1, 1, 1), n=256, power=2.2, spikes=0):
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    r = np.hypot(xx, yy)
    th = np.arctan2(yy, xx)
    d = np.clip(1 - r, 0, 1) ** power
    if spikes:
        s = np.clip(1 - np.abs(np.sin(th * spikes / 2)) * 6 * r, 0, 1) * np.clip(1 - r, 0, 1)
        d = np.clip(d + s, 0, 1)
    core = np.clip(1 - r * 3.5, 0, 1)
    rgb = hexc(col) * (1 - core[..., None]) + np.array(hot) * core[..., None]
    rgb = np.broadcast_to(rgb, (n, n, 3)) if rgb.ndim == 1 else rgb
    return rgba(name, np.concatenate([rgb, d[..., None]], -1))


def t_shock(name, col, hot=(1, 1, 1), n=512, rings=1):
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    r = np.hypot(xx, yy)
    a = np.zeros((n, n))
    edge = np.zeros((n, n))
    for k in range(rings):
        R = 0.92 - k * 0.22
        a += np.clip(1 - np.abs(r - R) / 0.09, 0, 1) ** 1.5
        a += np.clip((R - r) / R, 0, 1) ** 4 * 0.35 * (k == 0)
        edge += np.clip(1 - np.abs(r - R) / 0.02, 0, 1)
    a = np.clip(a + edge, 0, 1) * (r < 1)
    rgb = hexc(col)[None, None, :] * (1 - np.clip(edge, 0, 1)[..., None]) + np.array(hot) * np.clip(edge, 0, 1)[..., None]
    return rgba(name, np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1))


def t_band(name, col, hot=(1, 1, 1), n=256):
    """vertical gradient for cylinder walls: bright at the bottom, fading up, with streaks"""
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n
    streak = 0.6 + 0.4 * fbm(n, 4, 5)
    a = np.clip((1 - yy) ** 1.8 * streak, 0, 1)
    hotm = np.clip((0.12 - yy) / 0.12, 0, 1)
    rgb = hexc(col)[None, None, :] * (1 - hotm[..., None]) + np.array(hot) * hotm[..., None]
    rgb = np.broadcast_to(rgb, (n, n, 3))
    return rgba(name, np.concatenate([rgb, a[..., None]], -1))


def t_lightning(name, col, hot=(1, 1, 1), w=192, h=1024, seed=1, forks=3):
    rng = np.random.default_rng(seed)
    img = Image.new('L', (w, h), 0)
    d = ImageDraw.Draw(img)

    def bolt(x, y0, y1, width, wander):
        y = y0
        while y < y1:
            ny = y + rng.integers(18, 40)
            nx = np.clip(x + rng.normal(0, wander), 20, w - 20)
            d.line([x, y, nx, ny], fill=255, width=width)
            if forks and rng.random() < 0.08 and width > 2:
                fx = x
                fy = y
                for _ in range(rng.integers(3, 7)):
                    nfx, nfy = np.clip(fx + rng.normal(0, 14) + (12 if rng.random() < 0.5 else -12), 4, w - 4), fy + rng.integers(14, 30)
                    d.line([fx, fy, nfx, nfy], fill=200, width=max(1, width - 3))
                    fx, fy = nfx, nfy
            x, y = nx, ny
    bolt(w / 2, 0, h, 7, 16)
    return rgba(name, glowmap(img, col, hot, 5, 14, 1.3))


def t_glaive(name, col, hot, n=512, blades=2):
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c = n / 2
    for k in range(blades):
        a0 = 2 * math.pi * k / blades
        pts = []
        for i in range(24):
            t = i / 23
            ang = a0 + t * 2.3
            r = n * (0.12 + 0.34 * math.sin(t * math.pi) ** 0.6)
            pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
        for i in range(23, -1, -1):
            t = i / 23
            ang = a0 + t * 2.3 - 0.25
            r = n * (0.12 + 0.18 * math.sin(t * math.pi) ** 0.8)
            pts.append((c + math.cos(ang) * r, c + math.sin(ang) * r))
        d.polygon(pts, fill=255)
    d.ellipse([c - n * 0.13, c - n * 0.13, c + n * 0.13, c + n * 0.13], fill=255)
    d.ellipse([c - n * 0.06, c - n * 0.06, c + n * 0.06, c + n * 0.06], fill=0)
    return rgba(name, glowmap(img, col, hot, 6, 16, 1.0))


def t_rune(name, col, hot, n=1024, seed=3, petals=8):
    rng = np.random.default_rng(seed)
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c, R = n / 2, n * 0.47
    for rr, w in [(1.0, 9), (0.94, 3), (0.62, 5)]:
        d.ellipse([c - R * rr, c - R * rr, c + R * rr, c + R * rr], outline=255, width=w)
    for k in range(petals):
        a = 2 * math.pi * k / petals
        pts = [(c + math.cos(a) * R * 0.94, c + math.sin(a) * R * 0.94), (c + math.cos(a + 0.35) * R * 0.5, c + math.sin(a + 0.35) * R * 0.5),
               (c, c), (c + math.cos(a - 0.35) * R * 0.5, c + math.sin(a - 0.35) * R * 0.5)]
        d.polygon(pts, outline=255, width=4)
    for k in range(36):
        a = 2 * math.pi * k / 36
        r0 = R * 0.7
        r1 = R * (0.78 + rng.random() * 0.1)
        d.line([c + math.cos(a) * r0, c + math.sin(a) * r0, c + math.cos(a) * r1, c + math.sin(a) * r1], fill=255, width=5)
    arr = glowmap(img, col, hot, 8, 24, 1.2)
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    r = np.hypot(xx, yy)
    fill = np.clip(1 - r, 0, 1) ** 0.6 * 0.22 * (r < 0.95)
    arr[..., 3] = np.clip(arr[..., 3] + fill, 0, 1)
    arr[..., :3] = np.where(fill[..., None] > arr[..., 3:4] * 0.9, hexc(col) * 0.6, arr[..., :3])
    return rgba(name, arr)


# ───────────── scene helpers ─────────────
def scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    return Mats()


def tmat(M, name, tex, strength=4.0):
    return M.add(name, tex=tex, emit_tex=True, strength=strength, tile=None)


def finish(name):
    out = os.path.join(MODELS, f'{name}.glb')
    export(out)
    REPORT[name] = {'tris': tri_count(), 'kb': os.path.getsize(out) // 1024}


def flat(B, w, d, m, y=0.0, x=0.0, z=0.0):
    B.quad((x - w / 2, y, z - d / 2), (x + w / 2, y, z - d / 2), (x + w / 2, y, z + d / 2), (x - w / 2, y, z + d / 2), m,
           uv=((0, 1), (1, 1), (1, 0), (0, 0)))


def open_cyl(B, r, h, m, seg=24, y0=0.0):
    for i in range(seg):
        a0, a1 = 2 * math.pi * i / seg, 2 * math.pi * (i + 1) / seg
        p0 = (math.cos(a0) * r, y0, math.sin(a0) * r)
        p1 = (math.cos(a1) * r, y0, math.sin(a1) * r)
        B.quad(p0, p1, (p1[0], y0 + h, p1[2]), (p0[0], y0 + h, p0[2]), m, uv=((i / seg, 0), ((i + 1) / seg, 0), ((i + 1) / seg, 1), (i / seg, 1)))


def cross3(B, s, m):
    """three axis-aligned glow quads (looks like a glow sphere from any angle)"""
    h = s / 2
    B.quad((-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0), m)
    B.quad((0, -h, -h), (0, -h, h), (0, h, h), (0, h, -h), m)
    B.quad((-h, 0, -h), (h, 0, -h), (h, 0, h), (-h, 0, h), m)


