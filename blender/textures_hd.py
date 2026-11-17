"""HD procedural textures for the NIGHTSWARM arena (numpy + PIL, no external assets)."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from common import TEX_DIR, fbm, save_img, save_normal

rng0 = np.random.default_rng(42)


def _rgba(name, arr):
    path = os.path.join(TEX_DIR, name)
    Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8), 'RGBA').save(path)
    return path


def _voronoi(n, cells, seed):
    rng = np.random.default_rng(seed)
    pts = (np.stack(np.meshgrid(np.arange(cells), np.arange(cells)), -1).reshape(-1, 2) + rng.random((cells * cells, 2)) * 0.8 + 0.1) / cells
    yy, xx = np.mgrid[0:n, 0:n] / n
    d1 = np.full((n, n), 9.0)
    d2 = np.full((n, n), 9.0)
    idx = np.zeros((n, n), int)
    for i, (px, py) in enumerate(pts):
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.hypot(xx - (px + ox), yy - (py + oy))
                closer = d < d1
                d2 = np.where(closer, d1, np.minimum(d2, d))
                idx = np.where(closer, i, idx)
                d1 = np.where(closer, d, d1)
    return d1, d2, idx, rng


def tex_flagstone(name, n=1024, seed=5, cells=5):
    """big worn flagstones, dark joints, hairline cracks, wet patches (tileable)"""
    d1, d2, idx, rng = _voronoi(n, cells, seed)
    edge = np.clip((d2 - d1) * cells * 9, 0, 1)
    tint = rng.random(cells * cells)[idx]
    hue = np.stack([0.30 + tint * 0.05, 0.29 + tint * 0.04, 0.33 + tint * 0.06], -1)
    noise = fbm(n, 6, seed + 1)
    grit = fbm(n, 7, seed + 2)
    col = hue * (0.65 + noise[..., None] * 0.55) * (0.85 + grit[..., None] * 0.3)
    # cracks: ridged noise
    rid = 1 - np.abs(fbm(n, 6, seed + 3) * 2 - 1)
    crack = np.clip((rid - 0.93) / 0.07, 0, 1) * (edge > 0.6)
    col *= (1 - crack[..., None] * 0.7)
    # joints
    col *= (0.18 + 0.82 * edge[..., None])
    # wet / dark patches + moss in joints
    wet = np.clip((fbm(n, 4, seed + 4) - 0.55) * 5, 0, 1)
    col *= (1 - wet[..., None] * 0.35)
    moss = (1 - edge) * np.clip((fbm(n, 5, seed + 6) - 0.45) * 4, 0, 1)
    col = col * (1 - moss[..., None] * 0.6) + np.array([0.10, 0.17, 0.09]) * moss[..., None] * 0.6
    h = np.sqrt(edge) * 0.75 + noise * 0.15 + grit * 0.1 - crack * 0.4
    return save_img(name, col), save_normal(name.replace('.jpg', '_n.jpg'), h, 7.0)


def tex_blocks(name, n=1024, seed=9, rows=6, base=(0.33, 0.31, 0.35)):
    """castle ashlar: staggered blocks with per-block tint, chipped edges, soot towards the top"""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n] / n
    row = (yy * rows).astype(int)
    cols = 3
    xs = xx * cols + 0.5 * (row % 2)
    colid = xs.astype(int) % cols
    bid = row * cols + colid
    tint = rng.random(rows * cols + cols)[bid]
    fy = (yy * rows) % 1
    fx = xs % 1
    chip = fbm(n, 5, seed + 1) * 0.04
    ey = np.clip((np.minimum(fy, 1 - fy) - 0.025 - chip) / 0.03, 0, 1)
    ex = np.clip((np.minimum(fx, 1 - fx) - 0.012 - chip * 0.5) / 0.015, 0, 1)
    face = ey * ex
    noise = fbm(n, 6, seed + 2)
    col = np.array(base) * (0.75 + 0.35 * tint[..., None]) * (0.7 + noise[..., None] * 0.6)
    col *= (0.25 + 0.75 * face[..., None])
    stain = np.clip((fbm(n, 4, seed + 3) - 0.5) * 3, 0, 1)
    col *= (1 - 0.3 * stain[..., None])
    h = face * 0.7 + noise * 0.3
    return save_img(name, col), save_normal(name.replace('.jpg', '_n.jpg'), h, 8.0)


def tex_slate(name, n=512, seed=12):
    yy, xx = np.mgrid[0:n, 0:n] / n
    rows = 8
    row = (yy * rows).astype(int)
    xs = (xx * 6 + 0.5 * (row % 2))
    fy = (yy * rows) % 1
    fx = xs % 1
    edge = np.clip(np.minimum(fx, 1 - fx) / 0.04, 0, 1) * np.clip((1 - fy) / 0.15, 0, 1)
    rng = np.random.default_rng(seed)
    tint = rng.random(rows * 8)[(row * 7 + xs.astype(int)) % (rows * 8)]
    noise = fbm(n, 5, seed)
    col = np.array([0.14, 0.15, 0.2]) * (0.7 + 0.5 * tint[..., None]) * (0.75 + noise[..., None] * 0.5)
    col *= 0.35 + 0.65 * edge[..., None]
    return save_img(name, col), save_normal(name.replace('.jpg', '_n.jpg'), edge * 0.8 + fy * 0.2, 6.0)


def tex_dark_marble(name, n=1024, seed=31):
    """black marble with molten-gold veins (safe zones)"""
    t = fbm(n, 6, seed)
    x = np.linspace(0, 2 * np.pi * 2, n)[None, :] + np.linspace(0, 2 * np.pi * 3, n)[:, None]
    v = 1 - np.abs(np.sin(x + t * 11.0)) ** 0.12
    v = np.clip((v - 0.55) * 3, 0, 1)
    base = np.array([0.05, 0.045, 0.07]) * (0.7 + fbm(n, 5, seed + 1)[..., None] * 0.6)
    gold = np.array([0.95, 0.68, 0.22])
    col = base * (1 - v[..., None]) + gold * v[..., None]
    return save_img(name, col)


def _glow(img, radius):
    return np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), dtype=float) / 255


def tex_rune_circle(name, color=(0.75, 0.35, 1.0), n=1024, seed=3):
    """glowing summoning circle with glyph band and hexagram (RGBA, emissive)"""
    rng = np.random.default_rng(seed)
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c = n / 2

    def circ(r, w):
        d.ellipse([c - r, c - r, c + r, c + r], outline=255, width=w)
    R = n * 0.48
    circ(R, 7); circ(R * 0.93, 3); circ(R * 0.70, 5); circ(R * 0.66, 2); circ(R * 0.22, 4)
    # glyph band
    for k in range(48):
        a0 = 2 * math.pi * k / 48
        if rng.random() < 0.15:
            continue
        for j in range(rng.integers(2, 5)):
            r0 = R * (0.73 + rng.random() * 0.17)
            r1 = r0 + R * rng.random() * 0.06
            a = a0 + (rng.random() - 0.5) * 0.08
            d.line([c + math.cos(a) * r0, c + math.sin(a) * r0, c + math.cos(a + 0.03) * r1, c + math.sin(a + 0.03) * r1], fill=255, width=4)
        d.ellipse([c + math.cos(a0) * R * 0.815 - 5, c + math.sin(a0) * R * 0.815 - 5, c + math.cos(a0) * R * 0.815 + 5, c + math.sin(a0) * R * 0.815 + 5], fill=255)
    # hexagram
    for off in (0, math.pi / 6 * 2):
        pts = [(c + math.cos(off + 2 * math.pi * i / 3 - math.pi / 2) * R * 0.66, c + math.sin(off + 2 * math.pi * i / 3 - math.pi / 2) * R * 0.66) for i in range(3)]
        d.polygon(pts, outline=255, width=5)
    # inner spokes
    for k in range(12):
        a = 2 * math.pi * k / 12
        d.line([c + math.cos(a) * R * 0.22, c + math.sin(a) * R * 0.22, c + math.cos(a) * R * 0.4, c + math.sin(a) * R * 0.4], fill=255, width=3)
    core = np.asarray(img, dtype=float) / 255
    glow = _glow(img, 10) * 1.6 + _glow(img, 26) * 1.2
    a = np.clip(core + glow, 0, 1)
    rgb = np.ones((n, n, 3)) * np.array(color) * np.clip(glow * 0.9 + 0.3, 0, 1)[..., None]
    rgb = rgb * (1 - core[..., None]) + np.array([1, 0.92, 1]) * core[..., None]
    return _rgba(name, np.concatenate([rgb, a[..., None]], -1))


def tex_rift_cracks(name, color=(0.6, 0.25, 1.0), n=1024, seed=8):
    """branching glowing fissures radiating from the centre (RGBA)"""
    rng = np.random.default_rng(seed)
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)

    def branch(x, y, ang, length, w, depth):
        for _ in range(int(length)):
            ang += (rng.random() - 0.5) * 0.5
            nx, ny = x + math.cos(ang) * 9, y + math.sin(ang) * 9
            d.line([x, y, nx, ny], fill=255, width=max(1, int(w)))
            x, y = nx, ny
            w *= 0.985
            if not (0 < x < n and 0 < y < n):
                return
            if depth < 3 and rng.random() < 0.06:
                branch(x, y, ang + (rng.random() - 0.5) * 1.6, length * 0.5, w * 0.7, depth + 1)
    for k in range(9):
        a = 2 * math.pi * k / 9 + rng.random() * 0.4
        branch(n / 2 + math.cos(a) * n * 0.2, n / 2 + math.sin(a) * n * 0.2, a, 28 + rng.random() * 14, 6, 0)
    core = np.asarray(img, dtype=float) / 255
    g = _glow(img, 6) * 1.5 + _glow(img, 18)
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    fade = np.clip(1.15 - np.hypot(xx, yy), 0, 1)
    a = np.clip(core + g, 0, 1) * fade
    rgb = np.array(color) * np.clip(g + 0.4, 0, 1)[..., None]
    rgb = rgb * (1 - core[..., None]) + np.array([1.0, 0.85, 1.0]) * core[..., None]
    return _rgba(name, np.concatenate([rgb, a[..., None]], -1))


def tex_flame(name, inner=(1.0, 0.95, 0.6), outer=(1.0, 0.35, 0.05), n=256, seed=4):
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n
    y = 1 - yy  # 0 bottom → 1 top
    width = 0.38 * np.sqrt(np.clip(1 - y, 0, 1)) * np.clip(y * 4, 0, 1) + 0.02
    wob = (fbm(n, 4, seed) - 0.5) * 0.18 * y
    dx = np.abs(xx - 0.5 - wob)
    body = np.clip(1 - dx / width, 0, 1)
    core = np.clip(1 - dx / (width * 0.45), 0, 1) * np.clip(1 - y * 1.3, 0, 1)
    a = np.clip(body ** 1.3 * (1 - y ** 3), 0, 1)
    rgb = np.array(outer) * (1 - core[..., None]) + np.array(inner) * core[..., None]
    return _rgba(name, np.concatenate([rgb, a[..., None]], -1))


def tex_fog(name, color=(0.55, 0.45, 0.8), n=256, seed=7):
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    d = np.clip(1 - np.hypot(xx, yy), 0, 1) ** 1.6
    a = d * (0.4 + 0.6 * fbm(n, 5, seed)) * 0.55
    rgb = np.ones((n, n, 3)) * np.array(color)
    return _rgba(name, np.concatenate([rgb, a[..., None]], -1))


def tex_banner(name, base=(0.32, 0.04, 0.14), trim=(0.95, 0.72, 0.25), n=256, seed=1):
    """hanging banner: velvet, gold border, crescent+star sigil, swallowtail cut (RGBA, alpha-clip)"""
    h = n * 2
    img = Image.new('RGBA', (n, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    vel = fbm(n, 5, seed)
    body = Image.fromarray((np.clip(np.array(base)[None, None, :] * (0.7 + vel[..., None] * 0.6), 0, 1) * 255).astype(np.uint8)).resize((n, h))
    mask = Image.new('L', (n, h), 0)
    md = ImageDraw.Draw(mask)
    md.polygon([(0, 0), (n, 0), (n, h), (n // 2, int(h * 0.86)), (0, h)], fill=255)
    img.paste(body, (0, 0), mask)
    T = tuple(int(c * 255) for c in trim) + (255,)
    d.line([(10, 0), (10, h - 14)], fill=T, width=8)
    d.line([(n - 11, 0), (n - 11, h - 14)], fill=T, width=8)
    d.rectangle([0, 0, n, 22], fill=T)
    d.line([(10, h - 14), (n // 2, int(h * 0.86) - 12), (n - 11, h - 14)], fill=T, width=8)
    # sigil: crescent + 4-point star
    cx, cy, r = n // 2, int(h * 0.38), int(n * 0.3)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=T)
    d.ellipse([cx - r + int(r * 0.45), cy - r - int(r * 0.15), cx + r + int(r * 0.45), cy + r - int(r * 0.15)], fill=tuple(int(c * 255) for c in base) + (255,))
    s = int(r * 0.5)
    sx, sy = cx - int(r * 0.15), cy + int(r * 0.05)
    d.polygon([(sx, sy - s), (sx + s // 4, sy - s // 4), (sx + s, sy), (sx + s // 4, sy + s // 4), (sx, sy + s), (sx - s // 4, sy + s // 4), (sx - s, sy), (sx - s // 4, sy - s // 4)], fill=T)
    d.text((cx - 22, int(h * 0.62)), 'W O W', fill=T)
    path = os.path.join(TEX_DIR, name)
    img.save(path)
    return path


def tex_rose_window(name, n=512, seed=2):
    rng = np.random.default_rng(seed)
    img = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c, R = n / 2, n * 0.49
    pal = [(140, 40, 255), (40, 200, 255), (255, 60, 110), (255, 190, 60), (80, 255, 170)]
    d.ellipse([c - R, c - R, c + R, c + R], fill=(20, 10, 30, 255))
    for ring, (r0, r1, k) in enumerate([(0.62, 0.97, 16), (0.3, 0.6, 8), (0.0, 0.28, 1)]):
        for i in range(k):
            a0, a1 = 360 * i / k, 360 * (i + 1) / k
            col = pal[(i + ring) % len(pal)] + (255,)
            d.pieslice([c - R * r1, c - R * r1, c + R * r1, c + R * r1], a0 + 1.5, a1 - 1.5, fill=col)
            if r0 > 0:
                d.pieslice([c - R * r0, c - R * r0, c + R * r0, c + R * r0], a0, a1, fill=(20, 10, 30, 255))
    for k in range(16):
        a = 2 * math.pi * k / 16
        d.line([c, c, c + math.cos(a) * R, c + math.sin(a) * R], fill=(15, 8, 20, 255), width=6)
    for r in (0.3, 0.62, 0.97):
        d.ellipse([c - R * r, c - R * r, c + R * r, c + R * r], outline=(15, 8, 20, 255), width=8)
    path = os.path.join(TEX_DIR, name)
    img.save(path)
    return path


def tex_portal(name, n=512, seed=6):
    yy, xx = (np.mgrid[0:n, 0:n] + 0.5) / n * 2 - 1
    r = np.hypot(xx, yy * 0.8)
    th = np.arctan2(yy, xx)
    swirl = np.sin(th * 5 + r * 14 + fbm(n, 4, seed) * 6) * 0.5 + 0.5
    a = np.clip(1.1 - r, 0, 1) ** 0.7
    rgb = np.stack([0.45 + swirl * 0.4, 0.1 + swirl * 0.2, 0.9 + swirl * 0.1], -1) * (0.5 + (1 - r)[..., None] * 0.8)
    return _rgba(name, np.concatenate([np.clip(rgb, 0, 1), np.clip(a, 0, 1)[..., None]], -1))


def tex_emblem(name, n=1024):
    """gold sanctuary floor sigil (RGBA)"""
    img = Image.new('L', (n, n), 0)
    d = ImageDraw.Draw(img)
    c = n / 2
    for r, w in [(0.48, 10), (0.44, 4), (0.30, 6)]:
        d.ellipse([c - n * r, c - n * r, c + n * r, c + n * r], outline=255, width=w)
    for k in range(8):
        a = 2 * math.pi * k / 8
        p = [(c + math.cos(a) * n * 0.44, c + math.sin(a) * n * 0.44), (c + math.cos(a + 0.12) * n * 0.30, c + math.sin(a + 0.12) * n * 0.30),
             (c + math.cos(a) * n * 0.12, c + math.sin(a) * n * 0.12), (c + math.cos(a - 0.12) * n * 0.30, c + math.sin(a - 0.12) * n * 0.30)]
        d.polygon(p, outline=255, width=6)
    core = np.asarray(img, dtype=float) / 255
    g = _glow(img, 8)
    a = np.clip(core + g * 0.8, 0, 1)
    rgb = np.array([1.0, 0.75, 0.3]) * np.clip(core + g, 0, 1)[..., None] + 0.0
    return _rgba(name, np.concatenate([np.clip(rgb, 0, 1), a[..., None]], -1))


def tex_lancet(name, n=128, seed=3):
    """tall stained-glass lancet window (RGBA, pointed top)"""
    w, h = n, n * 4
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(seed)
    pal = [(140, 40, 255), (40, 200, 255), (255, 60, 110), (255, 190, 60)]
    for y in range(0, h, 32):
        for x in range(0, w, 32):
            d.rectangle([x, y, x + 31, y + 31], fill=pal[rng.integers(0, 4)] + (255,))
    for y in range(0, h, 32):
        d.line([(0, y), (w, y)], fill=(15, 8, 20, 255), width=4)
    for x in range(0, w, 32):
        d.line([(x, 0), (x, h)], fill=(15, 8, 20, 255), width=4)
    m = Image.new('L', (w, h), 0)
    md = ImageDraw.Draw(m)
    md.rectangle([0, w // 2, w, h], fill=255)
    md.pieslice([-w // 2, 0, w // 2 + w // 2, w * 1.5], 270, 360, fill=255)
    md.pieslice([0, 0, w * 1.5 - w // 2, w * 1.5], 180, 270, fill=255)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    out.paste(img, (0, 0), m)
    path = os.path.join(TEX_DIR, name)
    out.save(path)
    return path
