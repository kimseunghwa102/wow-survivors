"""Compose the 60s WOW NIGHTSWARM promo from rendered stills + real gameplay captures.
python3 compose.py [scene_index ...]  → out/sNN.mp4 ; then python3 compose.py --final"""
import os, sys, subprocess, math, random
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H, FPS = 1920, 1080, 30
BAR = 4 * 60 / 132
ST = os.environ.get('ST', '/home/claude/trailer/stills/')
UP = '/mnt/user-data/uploads/'
F = '/home/claude/wow-survivors/fonts/'
OUT = '/home/claude/trailer/out/'
os.makedirs(OUT, exist_ok=True)
TITLE = lambda s: ImageFont.truetype(F + 'Cinzel-Bold.ttf', s)
UI = lambda s: ImageFont.truetype(F + 'Oxanium-Bold.ttf', s)
UIM = lambda s: ImageFont.truetype(F + 'Oxanium-Medium.ttf', s)
GOLD = (255, 214, 106)

_cache = {}


def load(src):
    if src not in _cache:
        p = src if src.startswith('/') else ST + src + '.png'
        im = Image.open(p).convert('RGB')
        # cover-fit to 16:9 at 1.15x the frame so we can push in / pan
        sw, sh = int(W * 1.15), int(H * 1.15)
        r = max(sw / im.width, sh / im.height)
        im = im.resize((int(im.width * r + 0.5), int(im.height * r + 0.5)), Image.LANCZOS)
        l, t = (im.width - sw) // 2, (im.height - sh) // 2
        _cache[src] = im.crop((l, t, l + sw, t + sh))
    return _cache[src]


def kenburns(src, u, z0=1.0, z1=1.12, px=0.0, py=0.0):
    """u: 0..1 progress. zoom from z0→z1 (relative to the 1.15x plate), pan by px/py (fraction of slack)"""
    im = load(src)
    e = u * u * (3 - 2 * u) * 0.35 + u * 0.65
    z = z0 + (z1 - z0) * e
    cw, ch = im.width / (1.15 * z) * 1.0, im.height / (1.15 * z)
    cx = im.width / 2 + px * (im.width - cw) / 2 * (e * 2 - 1)
    cy = im.height / 2 + py * (im.height - ch) / 2 * (e * 2 - 1)
    box = (cx - cw / 2, cy - ch / 2, cx + cw / 2, cy + ch / 2)
    return im.transform((W, H), Image.EXTENT, box, Image.BICUBIC)


# ───────── overlays ─────────
rng = random.Random(7)
FLAKES = [(rng.random() * W, rng.random() * H, rng.uniform(1.2, 4.2), rng.uniform(40, 140), rng.random() * 6.28) for _ in range(170)]


def snow(img, t, amount=1.0):
    lay = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(lay)
    for (x, y, r, sp, ph) in FLAKES[: int(len(FLAKES) * amount)]:
        yy = (y + t * sp * (r / 2.5)) % (H + 20) - 10
        xx = (x + math.sin(t * 0.9 + ph) * 18 + t * 22 * (r / 3)) % W
        a = int(150 + 100 * (r / 4.2))
        d.ellipse((xx - r, yy - r, xx + r, yy + r), fill=a)
    lay = lay.filter(ImageFilter.GaussianBlur(1.1))
    white = Image.new('RGB', (W, H), (255, 255, 255))
    return Image.composite(white, img, lay.point(lambda v: int(v * 0.85)))


_vig = None


def vignette(img, k=0.55):
    global _vig
    if _vig is None:
        yy, xx = np.mgrid[0:H, 0:W]
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        _vig = np.clip(1 - k * np.clip(r - 0.45, 0, None) ** 1.6, 0, 1)[..., None].astype(np.float32)
    a = np.asarray(img).astype(np.float32) * _vig
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))


def grade(img, warm=0.06, contrast=1.08):
    a = np.asarray(img).astype(np.float32) / 255
    a = (a - 0.5) * contrast + 0.5
    a[..., 0] *= 1 + warm
    a[..., 2] *= 1 - warm * 0.3
    return Image.fromarray((a.clip(0, 1) * 255).astype(np.uint8))


def flash(img, amt):
    if amt <= 0:
        return img
    return Image.blend(img, Image.new('RGB', (W, H), (255, 248, 230)), min(1, amt))


def ease(x):
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def text_layer(lines, t, t_in=0.25, t_out=None, anchor='bl'):
    """lines: [(text, font, color, gap_after)]. animated slide-up/fade. returns RGBA layer"""
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    k = ease((t - t_in) / 0.4)
    if t_out is not None:
        k *= 1 - ease((t - t_out) / 0.3)
    if k <= 0:
        return lay
    d = ImageDraw.Draw(lay)
    hs = []
    for (s, f, c, g) in lines:
        bb = d.textbbox((0, 0), s, font=f)
        hs.append((bb[2] - bb[0], bb[3] - bb[1], bb))
    total = sum(h for _, h, _ in hs) + sum(l[3] for l in lines)
    if anchor == 'bl':
        x0, y = 110, H - 120 - total + (1 - k) * 40
    else:  # centred
        x0, y = None, (H - total) / 2 + (1 - k) * 30
    if anchor == 'bl':
        # gold accent bar
        d.rectangle((x0 - 28, y + 4, x0 - 20, y + total - 10), fill=GOLD + (int(255 * k),))
    for (s, f, c, g), (w, h, bb) in zip(lines, hs):
        x = x0 if anchor == 'bl' else (W - w) / 2
        for dx, dy, a in [(0, 5, 150), (3, 3, 120)]:
            d.text((x + dx - bb[0], y + dy - bb[1]), s, font=f, fill=(0, 0, 0, int(a * k)))
        d.text((x - bb[0], y - bb[1]), s, font=f, fill=c + (int(255 * k),), stroke_width=2, stroke_fill=(20, 8, 30, int(200 * k)))
        y += h + g
    return lay


def gold_title(s, size, t, t_in, centre_y, glow=True, t_out=None):
    """big Cinzel title with a vertical gold gradient and glow"""
    k = ease((t - t_in) / 0.6)
    if t_out is not None:
        k *= 1 - ease((t - t_out) / 0.4)
    lay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    if k <= 0:
        return lay
    f = TITLE(size)
    m = Image.new('L', (W, H), 0)
    d = ImageDraw.Draw(m)
    bb = d.textbbox((0, 0), s, font=f)
    tw, th = bb[2] - bb[0], bb[3] - bb[1]
    sc = 1.0 + (1 - k) * 0.08
    x, y = (W - tw) / 2 - bb[0], centre_y - th / 2 - bb[1]
    d.text((x, y), s, font=f, fill=255)
    if sc != 1.0:
        m = m.resize((int(W * sc), int(H * sc)), Image.BICUBIC).crop((int((W * sc - W) / 2), int((H * sc - H) / 2), int((W * sc - W) / 2) + W, int((H * sc - H) / 2) + H))
    grad = np.zeros((H, W, 3), np.float32)
    yy = np.linspace(0, 1, H)[:, None]
    rel = np.clip((yy * H - (centre_y - th / 2)) / max(1, th), 0, 1)
    grad[..., 0] = 255
    grad[..., 1] = (240 - 70 * rel)[:, :].repeat(W, 1)
    grad[..., 2] = (170 - 140 * rel)[:, :].repeat(W, 1)
    col = Image.fromarray(grad.astype(np.uint8))
    a = np.asarray(m).astype(np.float32) * k
    if glow:
        g = m.filter(ImageFilter.GaussianBlur(18))
        gl = Image.new('RGBA', (W, H), (255, 170, 60, 0))
        gl.putalpha(Image.fromarray((np.asarray(g).astype(np.float32) * 0.9 * k).astype(np.uint8)))
        lay = Image.alpha_composite(lay, gl)
    sh = m.filter(ImageFilter.GaussianBlur(4))
    shl = Image.new('RGBA', (W, H), (10, 0, 20, 0))
    shl.putalpha(Image.fromarray((np.asarray(sh).astype(np.float32) * 0.85 * k).astype(np.uint8)))
    lay = Image.alpha_composite(lay, shl.transform((W, H), Image.AFFINE, (1, 0, -4, 0, 1, -6)))
    tl = col.convert('RGBA')
    tl.putalpha(Image.fromarray(a.astype(np.uint8)))
    return Image.alpha_composite(lay, tl)


def badge(lay, s, t, t_in=0.1, pos=(110, 90), color=(255, 84, 104)):
    k = ease((t - t_in) / 0.3)
    if k <= 0:
        return lay
    d = ImageDraw.Draw(lay)
    f = UI(30)
    bb = d.textbbox((0, 0), s, font=f)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    x, y = pos
    d.rounded_rectangle((x - 18, y - 12, x + w + 18 + 26, y + h + 16), radius=12, fill=(14, 6, 24, int(210 * k)), outline=color + (int(255 * k),), width=3)
    if int(t * 2) % 2 == 0:
        d.ellipse((x - 2, y + h / 2 - 7, x + 12, y + h / 2 + 7), fill=color + (int(255 * k),))
    d.text((x + 26 - bb[0], y - bb[1]), s, font=f, fill=(255, 255, 255, int(255 * k)))
    return lay


_grid = None


def explode(img, t, fx, fy, t0):
    """nuclear fireball + shockwave composited over the shot"""
    global _grid
    u = (t - t0) / 1.1
    if u <= 0:
        return img
    if _grid is None:
        yy, xx = np.mgrid[0:270, 0:480]
        _grid = (xx, yy)
    xx, yy = _grid
    d = np.sqrt((xx - fx * 480) ** 2 + ((yy - fy * 270) * 1.25) ** 2) / 480
    R = 0.08 + 0.75 * ease(u)
    fade = max(0.25, 1 - max(0.0, u - 1.2) / 1.5)
    core = np.clip(1 - d / R, 0, 1) ** 0.8 * fade
    ring = np.exp(-((d - R * 1.25) / 0.025) ** 2) * fade * 0.8
    a = np.clip(core * 1.5 + ring, 0, 0.97)
    col = np.zeros((270, 480, 3), np.float32)
    col[..., 0] = 255
    col[..., 1] = 250 - 140 * np.clip(d / R, 0, 1)
    col[..., 2] = 230 - 210 * np.clip(d / R, 0, 1)
    lay = Image.fromarray(col.astype(np.uint8)).resize((W, H), Image.BILINEAR)
    al = Image.fromarray((a * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)
    out = Image.composite(lay, img, al)
    # whole-frame white-out at detonation
    k = max(0.0, 1 - abs(u - 0.12) / 0.18) * 0.85
    return Image.blend(out, Image.new('RGB', (W, H), (255, 246, 225)), k) if k > 0 else out


_shade = None


def shade():
    """dark gradient bottom-left so captions read over any shot"""
    global _shade
    if _shade is None:
        yy, xx = np.mgrid[0:H, 0:W]
        a = np.clip((yy / H - 0.55) / 0.45, 0, 1) ** 1.3 * np.clip(1.25 - xx / W, 0, 1) * 215
        _shade = Image.fromarray(np.dstack([np.full((H, W), 8), np.full((H, W), 3), np.full((H, W), 16), a]).astype(np.uint8), 'RGBA')
    return _shade


# ───────── scenes ─────────
def cap(a, b, c=None):
    ls = [(a, UI(78), GOLD, 18)]
    if b:
        ls.append((b, UIM(38), (240, 236, 255), 0))
    return ls


S = []  # (duration_bars, render(t, dur) -> Image)


def still_scene(src, lines, z=(1.0, 1.12), pan=(0.0, 0.0), snow_amt=0.8, badge_text=None, flash_in=0.6, boom=None):
    def r(t, dur):
        img = kenburns(src, t / dur, z[0], z[1], pan[0], pan[1])
        if boom:
            img = explode(img, t, *boom)
        img = grade(img)
        img = snow(img, t + len(S) * 3.1, snow_amt)
        img = vignette(img)
        img = img.convert('RGBA')
        if lines:
            img = Image.alpha_composite(img, shade())
            img = Image.alpha_composite(img, text_layer(lines, t))
        if badge_text:
            img = Image.alpha_composite(img, badge(Image.new('RGBA', (W, H), (0, 0, 0, 0)), badge_text, t))
        img = img.convert('RGB')
        return flash(img, flash_in * max(0, 1 - t / 0.18))
    return r


def title_scene():
    def r(t, dur):
        img = kenburns('aerial', t / dur, 1.0, 1.16, 0.1, -0.2)
        img = grade(img, 0.03)
        img = snow(img, t, 1.0)
        img = vignette(img, 0.7)
        fade = min(1, t / 0.6)
        img = Image.blend(Image.new('RGB', (W, H), (0, 0, 0)), img, fade)
        img = img.convert('RGBA')
        img = Image.alpha_composite(img, gold_title('WOW NIGHTSWARM', 150, t, 0.5, H / 2 - 40))
        img = Image.alpha_composite(img, text_layer([('A PvP SURVIVORS ARENA  ·  LIVE IN DECENTRALAND', UI(40), (240, 236, 255), 0)], t, 1.4, anchor='c').transform((W, H), Image.AFFINE, (1, 0, 0, 0, 1, -130)))
        return img.convert('RGB')
    return r


_band = None


def band():
    global _band
    if _band is None:
        yy = np.mgrid[0:H, 0:W][0]
        a = np.exp(-((yy - H / 2) / 120.0) ** 2) * 170
        _band = Image.fromarray(np.dstack([np.full((H, W), 10), np.full((H, W), 4), np.full((H, W), 20), a]).astype(np.uint8), 'RGBA')
    return _band


def montage_scene(cuts, words):
    beat2 = BAR / 2

    def r(t, dur):
        i = min(len(cuts) - 1, int(t / beat2))
        lt = t - i * beat2
        src, zz = cuts[i]
        img = kenburns(src, lt / beat2, zz, zz + 0.08, 0.3 * (1 if i % 2 else -1), 0)
        img = grade(img, 0.05, 1.12)
        img = snow(img, t + 40, 0.7)
        img = vignette(img)
        img = img.convert('RGBA')
        img = Image.alpha_composite(img, band())
        wi = min(len(words) - 1, int(t / (dur / len(words))))
        wt = t - wi * (dur / len(words))
        img = Image.alpha_composite(img, text_layer([(words[wi], UI(86), GOLD, 0)], wt, 0.05, anchor='c'))
        img = img.convert('RGB')
        return flash(img, 0.45 * max(0, 1 - lt / 0.12))
    return r


def end_scene():
    def r(t, dur):
        img = kenburns('aerial', 0.3 + t / dur * 0.4, 1.12, 1.2)
        img = img.filter(ImageFilter.GaussianBlur(6))
        img = Image.blend(img, Image.new('RGB', (W, H), (10, 4, 22)), 0.45)
        img = snow(img, t + 90, 1.0)
        img = vignette(img, 0.8).convert('RGBA')
        img = Image.alpha_composite(img, gold_title('WOW NIGHTSWARM', 132, t, 0.15, 330))
        img = Image.alpha_composite(img, text_layer([('PLAY FREE NOW', UI(84), (255, 255, 255), 18),
                                                     ('decentraland.org/play/?position=-106,76', UIM(44), GOLD, 26),
                                                     ('Daily rewards  ·  Global leaderboard  ·  Progress saved to your wallet', UIM(32), (210, 200, 240), 30),
                                                     ('@bitcoinisnotall', UI(46), (125, 230, 255), 0)], t, 0.7, anchor='c').transform((W, H), Image.AFFINE, (1, 0, 0, 0, 1, -150)))
        img = img.convert('RGB')
        if t > dur - 1.4:
            img = Image.blend(img, Image.new('RGB', (W, H), (0, 0, 0)), min(1, (t - (dur - 1.4)) / 1.4))
        return img
    return r


G1 = UP + '8b0c8ed0-image.png'   # latest gameplay capture (new UI)
G2 = UP + '0defcc2a-image.png'   # earlier capture
S += [
    (2, title_scene()),
    (2, still_scene('cathedral', cap('THE SWARM RISES AT NIGHT', 'Hold the rift. Break the swarm. Hunt your rivals.'), (1.0, 1.1), (0, -0.3))),
    (2, still_scene('hero', cap('SURVIVE THE SWARM', 'Endless waves of the undead'), (1.0, 1.13), (0.2, 0))),
    (2, still_scene('swarm', cap('HUNDREDS OF MONSTERS', 'Smooth, fast, relentless'), (1.04, 1.16), (0, 0.2))),
    (2, still_scene(G1, cap('REAL GAMEPLAY', 'Level up and stack skills every run'), (1.0, 1.08), (0.3, 0), 0.3, 'LIVE IN DECENTRALAND')),
    (2, still_scene('skills', cap('12 SKILLS · ALL EVOLVE', 'Every upgrade changes how it looks'), (1.0, 1.12), (0, -0.2))),
    (2, still_scene('armory', cap('FROM A FRYING PAN...', "...to Zeus' Atomic Thunder"), (1.0, 1.1), (0.5, 0))),
    (2, still_scene('boss', cap('DRAGON BOSSES', 'Ten of them. Up to level 200 and beyond'), (1.0, 1.15), (0, -0.4))),
    (2, still_scene('nuke', cap('DROP THE NUKE', 'Wipe the whole screen'), (1.0, 1.16), (0, 0), 0.6, None, 1.0, (0.48, 0.68, 0.45))),
    (2, still_scene('god', cap('BECOME A GOD', 'Divine form. Everything dies in one hit.'), (1.0, 1.12), (0, -0.2), 0.8, None, 0.9)),
    (2, still_scene(G2, cap('PvP ARENA', 'Hunt other players for their gold'), (1.0, 1.08), (-0.3, 0), 0.3, 'LIVE IN DECENTRALAND')),
    (4, montage_scene([('hero', 1.05), ('boss', 1.1), ('skills', 1.05), ('swarm', 1.08), ('nuke', 1.1), ('god', 1.05), ('cathedral', 1.02), ('armory', 1.05)],
                      ['DAILY REWARDS', 'GLOBAL LEADERBOARD', 'SAVED TO YOUR WALLET', 'FREE TO PLAY'])),
    (2, still_scene('treasury', cap('THE TREASURY', 'Forge permanent power. Fill your vault.'), (1.0, 1.12), (0.2, 0))),
]


def total_bars():
    return sum(b for b, _ in S)


END_DUR = 60.0 - total_bars() * BAR


def render_scene(i):
    if i < len(S):
        bars, fn = S[i]
        dur = bars * BAR
    else:
        fn, dur = end_scene(), END_DUR
    n = int(round(dur * FPS))
    tmp = OUT + f's{i:02d}.tmp.mp4'
    p = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', str(FPS), tmp], stdin=subprocess.PIPE)
    for k in range(n):
        p.stdin.write(fn(k / FPS, dur).tobytes())
    p.stdin.close()
    if p.wait() == 0:
        os.replace(tmp, OUT + f's{i:02d}.mp4')
    return n


def frame(i, t, path):
    bars, fn = S[i] if i < len(S) else (0, end_scene())
    dur = bars * BAR if i < len(S) else END_DUR
    fn(t, dur).save(path)


if __name__ == '__main__':
    args = sys.argv[1:]
    if args and args[0] == '--frame':
        frame(int(args[1]), float(args[2]), args[3])
    elif args and args[0] == '--final':
        n = len(S) + 1
        with open(OUT + 'list.txt', 'w') as f:
            for i in range(n):
                f.write(f"file 's{i:02d}.mp4'\n")
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', OUT + 'list.txt', '-c', 'copy', OUT + 'video.mp4'], check=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', OUT + 'video.mp4', '-i', '/home/claude/wow-survivors/sounds/music.mp3',
                        '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', 'afade=t=in:d=0.3,afade=t=out:st=57.6:d=2.4', '-c:a', 'aac', '-b:a', '192k',
                        '-t', '60', '-movflags', '+faststart', OUT + 'wow_nightswarm_trailer.tmp.mp4'], check=True)
        os.replace(OUT + 'wow_nightswarm_trailer.tmp.mp4', OUT + 'wow_nightswarm_trailer.mp4')
        print('final ok')
    else:
        idx = [int(a) for a in args] if args else list(range(len(S) + 1))
        for i in idx:
            print('scene', i, render_scene(i), 'frames', flush=True)
