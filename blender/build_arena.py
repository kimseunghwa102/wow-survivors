"""
WOW NIGHTSWARM — arena build (Blender / bpy)
Gothic rift-fortress fitted to the Wow Casino estate (12 parcels):
  • Sanctuary (safe lobby) ........ parcel -106,76
  • The Rift (arena R1) ........... -105..-104 × 76..78
  • Cathedral Court (arena R2) .... -106..-105 × 79..80
  • Hall of Legends (safe) ........ -103,78
High castle walls (7.5 m + battlements, invisible collider to 14 m) close every outside edge,
so neighbouring scenes can't spill in and players can't hop over.
Run:  python3 blender/build_arena.py   →  models/arena.glb, models/rift_core.glb
"""
import bpy, json, math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import *  # noqa
from textures_hd import *  # noqa

L = json.load(open(os.path.join(ROOT, 'layout.json')))
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)

M = Mats()
FLAG = M.add('flagstone', tex=tex_flagstone('flagstone.jpg'), rough=0.75, tile=5.0)
BLOCK = M.add('castle_block', tex=tex_blocks('castle_block.jpg'), rough=0.9, tile=3.2)
BLOCK_D = M.add('castle_block_dark', tex=tex_blocks('castle_block_dark.jpg', seed=19, base=(0.2, 0.19, 0.24)), rough=0.9, tile=2.4)
SLATE = M.add('slate_roof', tex=tex_slate('slate.jpg'), rough=0.6, tile=2.0)
DMARBLE = M.add('dark_marble', tex=tex_dark_marble('marble_dark.jpg'), rough=0.15, metal=0.1, tile=6.0)
IRON = M.add('iron', '#16141C', 0.85, 0.4)
GOLD = M.add('gold', '#E9B949', 0.9, 0.25, '#7A5200', 0.3)
FIRE = M.add('fire_core', '#FFC060', 0.0, 0.5, '#FF8A1E', 8.0)
SOUL = M.add('soul_glow', '#B07BFF', 0.0, 0.4, '#8A4BFF', 6.0)
CRYS = M.add('rift_crystal', '#9A5BFF', 0.2, 0.1, '#7B2BFF', 4.0)
CRYS_C = M.add('rift_crystal_cyan', '#5EF2FF', 0.2, 0.1, '#20C8FF', 4.0)
GRAVE = M.add('grave', '#5E5B66', 0.0, 0.9)
WOOD = M.add('dead_wood', '#241812', 0.0, 0.95)
DIRT = M.add('grave_dirt', '#1A1512', 0.0, 1.0)
SCREEN = M.add('screen', '#05060C', 0.0, 0.3, '#020309', 1.0)
# decal / textured-quad materials (explicit UVs, never mixed with box geometry)
RUNE = M.add('rune_circle', tex=tex_rune_circle('rune_circle.png'), emit_tex=True, strength=4.0, tile=None)
CRACK = M.add('rift_cracks', tex=tex_rift_cracks('rift_cracks.png'), emit_tex=True, strength=3.0, tile=None)
FLAME = M.add('flame', tex=tex_flame('flame.png'), emit_tex=True, strength=6.0, tile=None)
SFLAME = M.add('soul_flame', tex=tex_flame('soul_flame.png', inner=(0.9, 0.8, 1.0), outer=(0.5, 0.15, 1.0), seed=9), emit_tex=True, strength=6.0, tile=None)
FOG = M.add('ground_fog', tex=tex_fog('fog.png'), tile=None)
BANNER = M.add('banner', tex=tex_banner('banner.png'), clip=True, tile=None, rough=0.9)
BANNER_B = M.add('banner_blue', tex=tex_banner('banner_blue.png', base=(0.04, 0.08, 0.3), seed=4), clip=True, tile=None, rough=0.9)
ROSE = M.add('rose_window', tex=tex_rose_window('rose.png'), emit_tex=True, strength=2.5, tile=None)
PORTAL = M.add('boss_portal', tex=tex_portal('portal.png'), emit_tex=True, strength=4.0, tile=None)
EMBLEM = M.add('sanctuary_sigil', tex=tex_emblem('emblem.png'), emit_tex=True, strength=2.5, tile=None)
LANCET = M.add('lancet_glass', tex=tex_lancet('lancet.png'), emit_tex=True, strength=2.0, clip=True, tile=None)

B = Builder(M)
LB, LG = L['lobby'], L['legends']
WALL_H, COL_H, T = 7.5, 14.0, 1.2
CURTAIN_H = 24.0  # tall outer curtain wall: nothing outside the castle is visible

# ═══════════ GROUND ═══════════
B.box2(16.0, -0.3, 0.0, 48.0, 0.0, 48.0, FLAG)
B.box2(0.0, -0.3, 48.0, 32.0, 0.0, 80.0, FLAG)
B.box2(0.0, -0.3, 0.0, 16.0, 0.04, 16.0, DMARBLE)
B.box2(48.0, -0.3, 32.0, 64.0, 0.04, 48.0, DMARBLE)
for (cx, cz, r) in [(32, 24, 8.0), (16, 64, 7.0)]:
    B.decal(cx, 0.012, cz, r * 3.2, r * 3.2, CRACK, yaw=random.uniform(0, 360))
    B.decal(cx, 0.02, cz, r * 2, r * 2, RUNE)
# drifting ground fog near the walls
def _inside(x, z):
    return [math.floor(x / 16), math.floor(z / 16)] in L['parcels'] and 0.2 < x < 63.8 and 0.2 < z < 79.8


for (x, z, s) in [(21, 7, 9), (43, 8, 9), (22, 40, 9), (42, 42, 9), (6, 55, 9), (26, 56, 8), (7, 73, 9), (25, 73, 9), (32, 5, 8), (43, 24, 8)]:
    a = random.uniform(0, 360)
    while s > 2:
        cs = [rot(dx * s / 2, 0, dz * s / 2, a, 0, 0) for dx, dz in [(-1, -1), (1, -1), (1, 1), (-1, 1)]]
        if all(_inside(x + c[0], z + c[2]) for c in cs):
            break
        s -= 0.5
    B.decal(x, 0.25 + random.random() * 0.15, z, s, s, FOG, yaw=a)


# ═══════════ CASTLE WALLS ═══════════
def torch(x, y, z, face):
    """wall torch: iron bracket + crossed flame quads (face = direction the wall face looks)"""
    dx, dz = {'n': (0, 1), 's': (0, -1), 'e': (1, 0), 'w': (-1, 0)}[face]
    B.box(x + dx * 0.25, y - 0.25, z + dz * 0.25, 0.12, 0.5, 0.12, IRON)
    B.box(x + dx * 0.4, y, z + dz * 0.4, 0.3, 0.12, 0.3, IRON)
    B.box(x + dx * 0.4, y + 0.08, z + dz * 0.4, 0.16, 0.12, 0.16, FIRE)
    B.billboard_cross(x + dx * 0.4, y + 0.05, z + dz * 0.4, 0.55, 0.9, FLAME, n=2, yaw0=45)


def banner_on(x, y, z, face, mat=BANNER, w=1.4, h=2.8):
    off = 0.04
    B.vpanel(x, y, z, w, h, mat, face={'n': 'north', 's': 'south', 'e': 'east', 'w': 'west'}[face], off=off)
    # gold rod
    if face in ('n', 's'):
        B.box(x, y + h / 2 + 0.05, z + (0.06 if face == 'n' else -0.06), w + 0.3, 0.08, 0.08, GOLD)
    else:
        B.box(x + (0.06 if face == 'e' else -0.06), y + h / 2 + 0.05, z, 0.08, 0.08, w + 0.3, GOLD)


def wall(axis, b0, b1, s0, s1, inner, gaps=(), h=WALL_H, trim=None, deco=True, mat=None):
    """axis 'x' = wall runs along x (band b0..b1 in z); axis 'z' = runs along z (band in x).
    inner = face letter pointing into the playable side."""
    mat = mat or BLOCK
    segs, cur = [], s0
    for (g0, g1) in sorted(gaps):
        segs.append((cur, g0))
        cur = g1
    segs.append((cur, s1))
    for (a, b) in segs:
        if b - a < 0.05:
            continue
        if axis == 'x':
            B.box2(a, 0, b0, b, h, b1, mat)
            B.collider(a, 0, b0, b, COL_H, b1)
            B.box2(a - 0.05, h, b0 - 0.08, b + 0.05, h + 0.25, b1 + 0.08, BLOCK_D)   # coping
            if trim:
                B.box2(a, h - 0.35, b0 - 0.03, b, h - 0.25, b1 + 0.03, trim)
        else:
            B.box2(b0, 0, a, b1, h, b, mat)
            B.collider(b0, 0, a, b1, COL_H, b)
            B.box2(b0 - 0.08, h, a - 0.05, b1 + 0.08, h + 0.25, b + 0.05, BLOCK_D)
            if trim:
                B.box2(b0 - 0.03, h - 0.35, a, b1 + 0.03, h - 0.25, b, trim)
        # plinth on the inner face
        pi = {'n': 1, 'e': 1, 's': -1, 'w': -1}[inner]
        if axis == 'x':
            zf = b1 if pi > 0 else b0
            B.box2(a, 0, min(zf, zf + pi * 0.25), b, 0.6, max(zf, zf + pi * 0.25), BLOCK_D)
        else:
            xf = b1 if pi > 0 else b0
            B.box2(min(xf, xf + pi * 0.25), 0, a, max(xf, xf + pi * 0.25), 0.6, b, BLOCK_D)
        # merlons (battlements) along the outer half of the top
        n = int((b - a) / 1.6)
        for i in range(n):
            t = a + (i + 0.5) * (b - a) / n
            if axis == 'x':
                zo = b0 if pi > 0 else b1 - 0.55
                B.box2(t - 0.4, h + 0.25, zo, t + 0.4, h + 1.15, zo + 0.55, BLOCK)
            else:
                xo = b0 if pi > 0 else b1 - 0.55
                B.box2(xo, h + 0.25, t - 0.4, xo + 0.55, h + 1.15, t + 0.4, BLOCK)
        if not deco:
            continue
        # buttresses, torches and banners on the inner face
        k = 0
        t = a + 3.0
        while t < b - 2.5:
            if axis == 'x':
                zf = b1 if pi > 0 else b0
                B.box2(t - 0.45, 0, min(zf, zf + pi * 0.55), t + 0.45, h - 1.0, max(zf, zf + pi * 0.55), BLOCK)
                B.box2(t - 0.5, h - 1.0, min(zf, zf + pi * 0.6), t + 0.5, h - 0.8, max(zf, zf + pi * 0.6), BLOCK_D)
                if k % 2 == 0:
                    torch(t + 2.2, 3.2, zf, inner)
                else:
                    banner_on(t + 2.2, 4.2, zf, inner, BANNER if k % 4 == 1 else BANNER_B)
            else:
                xf = b1 if pi > 0 else b0
                B.box2(min(xf, xf + pi * 0.55), 0, t - 0.45, max(xf, xf + pi * 0.55), h - 1.0, t + 0.45, BLOCK)
                B.box2(min(xf, xf + pi * 0.6), h - 1.0, t - 0.5, max(xf, xf + pi * 0.6), h - 0.8, t + 0.5, BLOCK_D)
                if k % 2 == 0:
                    torch(xf, 3.2, t + 2.2, inner)
                else:
                    banner_on(xf, 4.2, t + 2.2, inner, BANNER if k % 4 == 1 else BANNER_B)
            k += 1
            t += 4.4


E = 0.12  # keep outer faces (and coping overhang) inside the parcel edge
# R1 — the Rift (x16–48, z0–48)
wall('x', E, T + E, 16 + E, 48 - E, 'n')                                                   # south
wall('z', 16 + E, 16 + T + E, E, 48.0, 'e', gaps=[(LB['gateZ0'], LB['gateZ1'])])            # west, sanctuary gate
wall('z', 48 - T - E, 48 - E, E, 48 - E, 'w', gaps=[(LG['gateZ0'], LG['gateZ1'])])          # east, legends gate
wall('x', 48 - T - E, 48 - E, 30.8, 48 - E, 's')                                           # north (x30.8–48)
# R2 — Cathedral Court (x0–32, z48–80)
wall('x', 48 + E, 48 + T + E, E, 16 + T + E, 'n')                                          # south (x0–17.3)
wall('z', E, T + E, 48 + E, 80 - E, 'e')                                                   # west
wall('z', 32 - T - E, 32 - E, 48.0, 80 - E, 'w')                                           # east
# Sanctuary (x0–16, z0–16): lower walls with gold trim; its east side is the R1 west wall
wall('x', E, T + E, E, 16 + E, 'n', h=6.0, trim=GOLD, deco=False, mat=BLOCK_D)
wall('z', E, T + E, E, 16 - E, 'e', h=6.0, trim=GOLD, deco=False, mat=BLOCK_D)
wall('x', 16 - T - E, 16 - E, E, 16 + E, 's', h=6.0, trim=GOLD, deco=False, mat=BLOCK_D)
# Hall of Legends (x48–64, z32–48); its west side is the R1 east wall
wall('x', 32 + E, 32 + T + E, 48 - E, 64 - E, 'n', h=6.0, trim=GOLD, deco=False, mat=BLOCK_D)
wall('z', 64 - T - E, 64 - E, 32 + E, 48 - E, 'w', h=6.0, trim=GOLD, deco=False, mat=BLOCK_D)
wall('x', 48 - T - E, 48 - E, 48 - E, 64 - E, 's', h=6.0, trim=GOLD, deco=False, mat=BLOCK_D)



# ═══════════ OUTER CURTAIN — a 24 m fortress wall around the whole estate (hides the world outside) ═══════════
def curtain():
    P = {tuple(p) for p in L['parcels']}
    segs = []  # (axis, line, a, b, inner_sign)
    for (px, pz) in P:
        x0, z0 = px * 16, pz * 16
        if (px, pz - 1) not in P: segs.append(('x', z0, x0, x0 + 16, 1))
        if (px, pz + 1) not in P: segs.append(('x', z0 + 16, x0, x0 + 16, -1))
        if (px - 1, pz) not in P: segs.append(('z', x0, z0, z0 + 16, 1))
        if (px + 1, pz) not in P: segs.append(('z', x0 + 16, z0, z0 + 16, -1))
    # merge collinear neighbours
    segs.sort()
    merged = []
    for sg in segs:
        if merged and merged[-1][0] == sg[0] and merged[-1][1] == sg[1] and merged[-1][4] == sg[4] and abs(merged[-1][3] - sg[2]) < 1e-6:
            merged[-1] = (sg[0], sg[1], merged[-1][2], sg[3], sg[4])
        else:
            merged.append(sg)
    TH, Y0, H = 0.9, 5.9, CURTAIN_H
    inside = lambda x, z: (math.floor(x / 16), math.floor(z / 16)) in P
    for (ax, ln, a, b, si) in merged:
        mid = ln + si * (E + TH / 2)
        # concave corner → extend into the corner; convex → stop short of the parcel edge
        def end(v, d):
            probe = v + d * 0.5
            ok = inside(probe, mid) if ax == 'x' else inside(mid, probe)
            return v + d * (E + TH) if ok else v - d * E
        a2, b2 = end(a, -1), end(b, 1)
        c0, c1 = sorted((ln + si * E, ln + si * (E + TH)))
        fi = c1 if si > 0 else c0           # inner face
        o = si                                # inward direction
        if ax == 'x':
            box = lambda u0, y0, u1, y1, w0, w1, m, col=False: B.box2(u0, y0, w0, u1, y1, w1, m, collide=col)
        else:
            box = lambda u0, y0, u1, y1, w0, w1, m, col=False: B.box2(w0, y0, u0, w1, y1, u1, m, collide=col)
        box(a2, Y0, b2, H, c0, c1, BLOCK)
        box(a2, 0, b2, H + 2.0, c0, c1, None, True)                       # collider (god-flight proof)
        # string courses + gold trim on the inner face
        for (y, hgt, m, d) in [(12.0, 0.45, BLOCK_D, 0.22), (18.0, 0.45, BLOCK_D, 0.22), (H - 0.6, 0.18, GOLD, 0.06)]:
            box(a2, y, b2, y + hgt, min(fi, fi + o * d), max(fi, fi + o * d), m)
        box(a2 - 0.1, H, b2 + 0.1, H + 0.35, c0 - 0.1, c1 + 0.1, BLOCK_D)  # coping
        n = int((b2 - a2) / 2.6)
        for i in range(n):
            t = a2 + (i + 0.5) * (b2 - a2) / n
            box(t - 0.65, H + 0.35, t + 0.65, H + 1.5, c0, c1, BLOCK)       # battlements
        # glowing arrow slits + giant banners on the inner face
        k = 0
        t = a2 + 4.0
        while t < b2 - 3.0:
            if k % 3 == 2:
                if ax == 'x':
                    banner_on(t, 15.0, fi, 'n' if o > 0 else 's', BANNER if k % 2 else BANNER_B, w=2.6, h=5.4)
                else:
                    banner_on(fi, 15.0, t, 'e' if o > 0 else 'w', BANNER if k % 2 else BANNER_B, w=2.6, h=5.4)
            else:
                box(t - 0.12, 14.0, t + 0.12, 16.2, min(fi, fi + o * 0.04), max(fi, fi + o * 0.04), SOUL)
            k += 1
            t += 5.2


curtain()

# ═══════════ TOWERS ═══════════
def tower(x, z, r=1.7, h=11.0, flame=SFLAME):
    B.cyl(x, 0, z, r, h, BLOCK, seg=14, collide=True, caps=False)
    B.cyl(x, 0, z, r + 0.25, 0.8, BLOCK_D, seg=14)
    B.cyl(x, h - 0.4, z, r + 0.25, 0.5, BLOCK_D, seg=14)
    for k in range(7):
        a = 2 * math.pi * k / 7
        B.box(x + math.cos(a) * (r + 0.05), h + 0.55, z + math.sin(a) * (r + 0.05), 0.75, 0.9, 0.45, BLOCK, yaw=-math.degrees(a) + 90)
    B.cyl(x, h + 0.1, z, r + 0.15, 4.2, SLATE, seg=14, r_top=0.0, smooth=False)
    B.cyl(x, h + 4.3, z, 0.06, 1.0, GOLD, seg=6)
    B.billboard_cross(x, h + 4.6, z, 0.9, 1.5, flame, n=2)
    # glowing arrow slits
    for k in range(3):
        a = 2 * math.pi * (k + 0.5) / 3
        B.box(x + math.cos(a) * (r + 0.01), h * 0.55, z + math.sin(a) * (r + 0.01), 0.18, 1.0, 0.05, SOUL, yaw=-math.degrees(a) + 90)


for (x, z) in [(18.4, 2.4), (45.6, 2.4), (45.6, 45.6), (2.3, 50.3), (2.3, 2.3), (2.3, 13.7), (61.7, 34.3), (61.7, 45.7)]:
    # towers crown the tall outer curtain
    tower(x, z, r=1.9 if x < 3 or x > 60 else 2.0, h=CURTAIN_H + 1.5 if x < 3 or x > 60 else CURTAIN_H + 3.0, flame=FLAME if x < 3 or x > 60 else SFLAME)


# ═══════════ GATEHOUSES ═══════════
def gatehouse(xc, z0, z1, label_side):
    """gate through a wall that runs along z, centred on x=xc, opening z0..z1"""
    for zc in (z0 - 1.0, z1 + 1.0):
        B.box2(xc - 1.1, 0, zc - 1.0, xc + 1.1, 10.0, zc + 1.0, BLOCK, collide=True)
        B.box2(xc - 1.25, 9.6, zc - 1.15, xc + 1.25, 10.2, zc + 1.15, BLOCK_D)
        for (dx, dz) in [(-0.85, -0.85), (0.85, -0.85), (-0.85, 0.85), (0.85, 0.85)]:
            B.box(xc + dx, 10.65, zc + dz, 0.5, 0.9, 0.5, BLOCK)
        for s in (-1, 1):
            B.billboard_cross(xc + s * 1.25, 4.6, zc, 0.5, 0.8, FLAME)
            B.box(xc + s * 1.2, 4.4, zc, 0.3, 0.12, 0.3, IRON)
    # pointed arch + lintel block above the opening
    zm, span = (z0 + z1) / 2, (z1 - z0) / 2
    B.box2(xc - 0.75, 7.0, z0, xc + 0.75, 9.6, z1, BLOCK)
    for k in range(12):
        t0, t1 = k / 12, (k + 1) / 12
        for s in (-1, 1):
            a0, a1 = t0 * math.pi / 2, t1 * math.pi / 2
            o0, o1 = s * span * math.cos(a0), s * span * math.cos(a1)
            y0, y1 = 4.6 + span * 0.95 * math.sin(a0), 4.6 + span * 0.95 * math.sin(a1)
            ln = math.hypot(o1 - o0, y1 - y0) + 0.08
            ang = math.degrees(math.atan2(y1 - y0, o1 - o0))
            B.box(xc, (y0 + y1) / 2, zm + (o0 + o1) / 2, 0.9, 0.4, ln, BLOCK_D, yaw=90, roll=ang)
    # raised portcullis teeth
    for k in range(7):
        zz = z0 + 0.35 + k * (z1 - z0 - 0.7) / 6
        B.box(xc, 6.6, zz, 0.08, 0.9, 0.08, IRON)
        B.box(xc, 6.1, zz, 0.12, 0.2, 0.12, IRON, pitch=45)
    B.box(xc, 7.05, zm, 0.1, 0.1, z1 - z0, IRON)


gatehouse(16 + T / 2 + E, LB['gateZ0'], LB['gateZ1'], 'w')
gatehouse(48 - T / 2 - E, LG['gateZ0'], LG['gateZ1'], 'e')


# ═══════════ RIFT CRYSTALS, GRAVES, TREES, LAMPS (edges only — the middle stays open for the swarm) ═══════════
def crystal(x, z, s=1.0, mat=CRYS, n=5):
    B.cyl(x, 0, z, 0.9 * s, 0.25, BLOCK_D, seg=8)
    for k in range(n):
        a = random.uniform(0, 2 * math.pi)
        d = 0 if k == 0 else random.uniform(0.25, 0.6) * s
        h = (2.6 if k == 0 else random.uniform(0.9, 1.8)) * s
        r = (0.32 if k == 0 else random.uniform(0.13, 0.22)) * s
        cx, cz = x + math.cos(a) * d, z + math.sin(a) * d
        tilt = 0 if k == 0 else random.uniform(10, 28)
        yaw = math.degrees(a)
        # hex prism + tip as boxes rotated (cheap): prism via cyl, tip via cone
        B.cyl(cx, 0.1, cz, r, h * 0.75, mat, seg=6, smooth=False) if tilt == 0 else None
        if tilt:
            # leaning shard as a stretched octahedron
            B.faces(B.a(mat), *_shard(cx, cz, r, h, yaw, tilt))
        else:
            B.cyl(cx, 0.1 + h * 0.75, cz, r, h * 0.25, mat, seg=6, r_top=0.0, smooth=False)


def _shard(cx, cz, r, h, yaw, tilt):
    pts = [(0, h, 0)] + [(math.cos(2 * math.pi * i / 5) * r, h * 0.2, math.sin(2 * math.pi * i / 5) * r) for i in range(5)] + [(0, 0, 0)]
    out = []
    for (x, y, z) in pts:
        x, y, z = rot(x, y, z, yaw, tilt, 0)
        out.append((cx + x, y + 0.05, cz + z))
    fs = [[0, 1 + (i + 1) % 5, 1 + i] for i in range(5)] + [[6, 1 + i, 1 + (i + 1) % 5] for i in range(5)]
    return out, fs


for (x, z, s, m) in [(20.5, 24, 1.2, CRYS), (44.0, 14, 1.0, CRYS_C), (43.5, 31.5, 0.9, CRYS), (25, 4.2, 0.9, CRYS_C), (39, 44, 1.0, CRYS),
                     (4.5, 63, 1.1, CRYS_C), (27.5, 60, 1.0, CRYS), (5, 76, 0.9, CRYS), (27, 76, 0.9, CRYS_C)]:
    crystal(x, z, s, m)


def grave(x, z, yaw):
    k = random.random()
    if k < 0.4:      # rounded headstone
        B.box(x, 0.5, z, 0.75, 1.0, 0.2, GRAVE, yaw=yaw)
        B.box(x, 1.02, z, 0.6, 0.12, 0.2, GRAVE, yaw=yaw)
        B.box(x, 0.06, z, 0.95, 0.12, 0.4, BLOCK_D, yaw=yaw)
    elif k < 0.7:    # celtic cross
        B.box(x, 0.75, z, 0.18, 1.5, 0.18, GRAVE, yaw=yaw)
        B.box(x, 1.12, z, 0.75, 0.18, 0.18, GRAVE, yaw=yaw)
        B.box(x, 0.06, z, 0.6, 0.12, 0.6, BLOCK_D, yaw=yaw)
    else:            # tomb
        B.box(x, 0.25, z, 1.1, 0.5, 2.1, GRAVE, yaw=yaw)
        B.box(x, 0.55, z, 0.95, 0.12, 1.9, BLOCK_D, yaw=yaw)
        B.box(x, 0.64, z, 0.12, 0.06, 1.2, GOLD, yaw=yaw)
    dx, _, dz = rot(0, 0, 0.75, yaw, 0, 0)
    B.box(x + dx, 0.03, z + dz, 0.85, 0.06, 1.3, DIRT, yaw=yaw)


def dead_tree(x, z, s=1.0):
    B.cyl(x, 0, z, 0.32 * s, 4.0 * s, WOOD, seg=7, r_top=0.14 * s)
    for k in range(4):     # roots
        a = k * 90 + random.uniform(-20, 20)
        B.box(x, 0.12, z, 0.16 * s, 0.14 * s, 1.4 * s, WOOD, yaw=a, pitch=8)
    for k in range(6):
        a = random.uniform(0, 360)
        y = (2.0 + k * 0.38) * s
        ln = random.uniform(1.1, 2.1) * s
        ox, _, oz = rot(0, 0, ln / 2, a, 0, 0)
        B.box(x + ox * 0.9, y + ln * 0.25, z + oz * 0.9, 0.11 * s, 0.11 * s, ln, WOOD, yaw=a, pitch=-32)


for z in [6, 14, 22, 30, 40]:
    grave(19.6, z + random.uniform(-1, 1), 90 + random.uniform(-8, 8))
    grave(44.3, z + 2, -90 + random.uniform(-8, 8))
for x in [22, 29, 36, 42]:
    grave(x, 3.4, random.uniform(-8, 8))
for z in [54, 60, 68, 72]:
    grave(3.6, z, 90 + random.uniform(-8, 8))
    grave(28.4, z + 1.5, -90 + random.uniform(-8, 8))
for (x, z, s) in [(20.5, 44.5, 1.2), (44.2, 6.5, 1.1), (4.0, 52.5, 1.2), (26.0, 52.0, 0.9)]:
    dead_tree(x, z, s)


def lamp(x, z, flame=FLAME):
    B.box(x, 0.2, z, 0.5, 0.4, 0.5, BLOCK_D)
    B.cyl(x, 0.4, z, 0.09, 3.6, IRON, seg=6)
    B.cyl(x, 3.9, z, 0.32, 0.12, IRON, seg=8)
    for s in (-1, 1):
        B.box(x + s * 0.28, 4.25, z, 0.04, 0.6, 0.04, IRON)
        B.box(x, 4.25, z + s * 0.28, 0.04, 0.6, 0.04, IRON)
    B.cyl(x, 4.55, z, 0.38, 0.35, IRON, seg=8, r_top=0.05)
    B.billboard_cross(x, 3.95, z, 0.45, 0.65, flame, n=2, yaw0=30)


for (x, z) in [(24, 10), (40, 10), (24, 38), (40, 38), (8, 58), (24, 58), (8, 70), (24, 70)]:
    lamp(x, z, SFLAME if (x + z) % 3 == 0 else FLAME)

# ═══════════ CATHEDRAL OF THE HOLLOW KING (north edge of R2) ═══════════
C = L['cathedral']
cz0, cz1 = C['z'], 80 - E
B.box2(E, 0, cz0, 32 - E, 10.0, cz1, BLOCK)
B.collider(E, 0, cz0, 32 - E, COL_H, cz1)
B.box2(E, 10.0, cz0 - 0.1, 32 - E, 10.4, cz1, BLOCK_D)
for i in range(int(32 / 1.6)):
    t = E + (i + 0.5) * 1.6
    if 9.6 < t < 22.4:
        continue
    B.box2(t - 0.4, 10.4, cz1 - 0.6, t + 0.4, 11.3, cz1, BLOCK)
# nave front + gable
B.box2(9.8, 0.0, cz0 - 0.3, 22.2, 17.0, cz1, BLOCK)
B.prism_xy([(9.6, 17.0), (22.4, 17.0), (16.0, 22.5)], cz0 - 0.3, cz1, BLOCK_D)
B.cyl(16, 22.3, cz0 + 0.3, 0.12, 2.4, GOLD, seg=6)
B.box(16, 24.0, cz0 + 0.3, 1.1, 0.14, 0.14, GOLD)
B.vpanel(16, 14.2, cz0 - 0.3, 5.6, 5.6, ROSE, 'south', off=0.03)
for k in range(16):
    a = 2 * math.pi * k / 16
    B.box(16 + math.cos(a) * 3.0, 14.2 + math.sin(a) * 3.0, cz0 - 0.42, 0.5, 0.5, 0.25, BLOCK_D, roll=math.degrees(a))
# boss portal with pointed arch frame
B.vpanel(16, 3.6, cz0 - 0.3, 4.2, 7.2, PORTAL, 'south', off=0.04)
for s in (-1, 1):
    B.box(16 + s * 2.45, 3.6, cz0 - 0.65, 0.7, 7.2, 0.9, BLOCK_D)
    for k in range(6):
        a0, a1 = k / 6 * math.pi / 2, (k + 1) / 6 * math.pi / 2
        o0, o1 = s * 2.45 * math.cos(a0), s * 2.45 * math.cos(a1)
        y0, y1 = 7.2 + 2.2 * math.sin(a0), 7.2 + 2.2 * math.sin(a1)
        ln = math.hypot(o1 - o0, y1 - y0) + 0.1
        B.box(16 + (o0 + o1) / 2, (y0 + y1) / 2, cz0 - 0.65, ln, 0.55, 0.9, BLOCK_D, roll=math.degrees(math.atan2(y1 - y0, o1 - o0)))
# steps
for k, (d, h) in enumerate([(2.4, 0.18), (1.6, 0.36), (0.8, 0.54)]):
    B.box2(10.5 + k * 0.4, 0, cz0 - d, 21.5 - k * 0.4, h, cz0, BLOCK_D, collide=True)
# twin spires
for sx in (6.5, 25.5):
    B.box2(sx - 1.8, 0, cz0 - 1.4, sx + 1.8, 18.0, cz1, BLOCK, collide=True)
    B.box2(sx - 2.0, 17.6, cz0 - 1.6, sx + 2.0, 18.3, cz1, BLOCK_D)
    for (dx, dz) in [(-1.6, -1.2), (1.6, -1.2), (-1.6, 1.2), (1.6, 1.2)]:
        B.cyl(sx + dx * 0.95, 18.3, (cz0 + cz1) / 2 - 0.7 + dz * 0.6, 0.22, 2.4, BLOCK_D, seg=6, r_top=0.0, smooth=False)
    # pyramid spire (4 tris)
    top = (sx, 29.0, (cz0 + cz1) / 2 - 0.7)
    q = [(sx - 1.6, 18.3, cz0 - 1.3), (sx + 1.6, 18.3, cz0 - 1.3), (sx + 1.6, 18.3, cz1 - 0.05), (sx - 1.6, 18.3, cz1 - 0.05)]
    B.faces(B.a(SLATE), q + [top], [[0, 1, 4], [1, 2, 4], [2, 3, 4], [3, 0, 4]])
    B.billboard_cross(sx, 28.6, top[2], 1.0, 1.8, SFLAME)
    for y in (4.5, 11.5):
        B.vpanel(sx, y, cz0 - 1.4, 1.3, 5.0, LANCET, 'south', off=0.03)
# side lancets on the low wings
for x in (2.6, 11.6, 20.4, 29.4):
    if 9.8 < x < 22.2:
        B.vpanel(x, 5.0, cz0 - 0.3, 1.1, 4.4, LANCET, 'south', off=0.03)
    else:
        B.vpanel(x, 5.0, cz0, 1.1, 4.4, LANCET, 'south', off=0.03)
for x in (12.6, 19.4):
    torch(x, 3.2, cz0 - 0.3, 's')

# ═══════════ SANCTUARY (safe lobby, cell -106,76) ═══════════
B.decal(8, 0.05, 8, 11.5, 11.5, EMBLEM)
fx, _, fz = L['shrine']   # Arcane Forge
B.cyl(fx, 0.04, fz, 1.4, 0.35, DMARBLE, seg=16, collide=True)
B.cyl(fx, 0.39, fz, 1.45, 0.08, GOLD, seg=16)
B.box(fx, 0.85, fz, 1.3, 0.9, 0.7, IRON)              # anvil body
B.box(fx, 1.38, fz, 1.7, 0.18, 0.75, IRON)            # anvil top
B.box(fx + 1.0, 1.36, fz, 0.6, 0.14, 0.4, IRON, roll=-12)  # horn
for k in range(4):
    a = math.radians(45 + k * 90)
    B.cyl(fx + math.cos(a) * 1.1, 0.4, fz + math.sin(a) * 1.1, 0.07, 2.0, GOLD, seg=6)
    B.octa(fx + math.cos(a) * 1.1, 2.55, fz + math.sin(a) * 1.1, 0.14, 0.25, CRYS_C)
B.ring(fx, 2.35, fz, 1.0, 1.1, 0.06, GOLD, seg=20)
# Armory pedestal (the equipped weapon floats above it at runtime)
ax_, az_ = 3.0, 7.6
B.cyl(ax_, 0.04, az_, 1.1, 0.5, DMARBLE, seg=16, collide=True)
B.cyl(ax_, 0.54, az_, 1.15, 0.06, GOLD, seg=16)
B.ring(ax_, 0.6, az_, 0.8, 0.95, 0.04, FIRE, seg=20)
for k in range(6):
    a = math.radians(k * 60)
    B.box(ax_ + math.cos(a) * 1.0, 1.2, az_ + math.sin(a) * 1.0, 0.08, 1.3, 0.08, IRON)
    B.octa(ax_ + math.cos(a) * 1.0, 1.95, az_ + math.sin(a) * 1.0, 0.09, 0.16, CRYS)
# how-to board
hx, _, hz = L['howto']
B.box(hx, 1.7, hz, 4.6, 3.4, 0.18, IRON)
B.box(hx, 1.7, hz - 0.1, 4.3, 3.1, 0.03, SCREEN)
B.box(hx, 3.5, hz, 4.9, 0.18, 0.3, GOLD)
for s in (-1, 1):
    B.cyl(hx + s * 2.1, 0, hz, 0.09, 1.3, IRON, seg=6)
# banners on the sanctuary walls
for z in (4.0, 12.0):
    banner_on(T + E, 3.3, z, 'e', BANNER_B, 1.3, 2.6)
for x in (4.0, 12.0):
    banner_on(x, 3.3, T + E, 'n', BANNER, 1.3, 2.6)
lamp(4.5, 3.0)

# ═══════════ HALL OF LEGENDS (safe, cell -103,78) ═══════════
lx, _, lz = L['leaderboard']
B.box(lx, 3.4, lz, 9.0, 6.4, 0.3, BLOCK_D)
B.box(lx, 3.4, lz - 0.17, 8.4, 5.8, 0.04, SCREEN)
B.box(lx, 6.75, lz, 9.4, 0.3, 0.5, GOLD)
for s in (-1, 1):
    B.box(lx + s * 4.8, 3.3, lz, 0.6, 6.6, 0.6, BLOCK)
    B.billboard_cross(lx + s * 4.8, 6.7, lz - 0.2, 0.6, 1.0, FLAME)
B.cyl(56, 0, 38, 1.5, 1.0, DMARBLE, seg=16, collide=True)
B.cyl(56, 1.0, 38, 1.55, 0.06, GOLD, seg=16)
B.ring(56, 2.6, 38, 0.45, 0.6, 0.35, GOLD, seg=12)
for k in range(6):
    a = math.radians(k * 60)
    B.octa(56 + math.cos(a) * 0.52, 3.05, 38 + math.sin(a) * 0.52, 0.08, 0.14, CRYS)
for z in (36.0, 43.0):
    banner_on(64 - T - E, 3.3, z, 'w', BANNER, 1.3, 2.6)
for (x, z) in [(51, 35), (61, 35)]:
    lamp(x, z)

# ═══════════ RIBBED DOMES WITH OPEN OCULUS (concept B) ═══════════
DGLASS = M.add('dome_glass', '#8A5BFF', 0.1, 0.1, '#5A2BCF', 1.2, alpha=0.55)
LANT = M.add('dome_lantern', '#FFC060', 0.0, 0.4, '#FF8A1E', 8.0)


def _se(t, a, b, p=4.0):
    c, s_ = math.cos(t), math.sin(t)
    return a * math.copysign(abs(c) ** (2 / p), c), b * math.copysign(abs(s_) ** (2 / p), s_)


def dome(cx, cz, a, b, y0=7.7, y1=21.0, inner=0.52, segs=64, rows=7):
    def P(i, j):
        t = 2 * math.pi * i / segs
        s_ = j / rows
        k = 1 - (1 - inner) * s_
        x, z = _se(t, a * k, b * k)
        return (cx + x, y0 + (y1 - y0) * math.sin(s_ * math.pi / 2), cz + z)
    for i in range(segs):
        for j in range(rows):
            m = DGLASS if (j in (2, 3) and i % 4 in (1, 2)) else SLATE
            B.faces(B.a(m), [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], [[0, 1, 2, 3]])
    for i in range(0, segs, 4):
        for j in range(rows):
            p0, p1 = P(i, j), P(i, j + 1)
            dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
            ln = math.sqrt(dx * dx + dy * dy + dz * dz)
            B.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.25, (p0[2] + p1[2]) / 2, 0.5, 0.5, ln + 0.1, BLOCK,
                  yaw=math.degrees(math.atan2(dx, dz)), pitch=-math.degrees(math.atan2(dy, math.hypot(dx, dz))))
        lx, ly, lz = P(i, rows)
        B.box(lx, ly - 2.2, lz, 0.05, 4.0, 0.05, GOLD)
        B.octa(lx, ly - 4.4, lz, 0.35, 0.5, LANT)
    for i in range(segs):
        p0, p1 = P(i, rows), P(i + 1, rows)
        dx, dz = p1[0] - p0[0], p1[2] - p0[2]
        B.box((p0[0] + p1[0]) / 2, p0[1] + 0.2, (p0[2] + p1[2]) / 2, 0.7, 0.6, math.hypot(dx, dz) + 0.05, GOLD, yaw=math.degrees(math.atan2(dx, dz)))


dome(32, 24, 15.3, 23.3)                       # the Rift
dome(16, 64, 15.3, 15.1, y1=19.0, inner=0.5)   # Cathedral Court

objs = B.emit('arena')


# ═══════════ CHECKS + EXPORT ═══════════
def parcel_ok(x, z):
    return [math.floor(x / 16), math.floor(z / 16)] in L['parcels']


bad, maxy = 0, 0.0
for ob in objs:
    for v in ob.data.vertices:
        x, z, y = -v.co.x, -v.co.y, v.co.z
        maxy = max(maxy, y)
        if not any(parcel_ok(x + dx, z + dz) for dx in (-0.02, 0.02) for dz in (-0.02, 0.02)) or not (-0.01 <= x <= 64.01 and -0.01 <= z <= 80.01):
            bad += 1
out = os.path.join(MODELS, 'arena.glb')
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT, 'blender', 'arena.blend'))
export(out)
rep = {'triangles': tri_count(objs), 'materials': len(M.m), 'out_of_parcel_vertices': bad, 'max_height': round(maxy, 2), 'kb': os.path.getsize(out) // 1024}
print('ARENA', json.dumps(rep))
json.dump(rep, open(os.path.join(ROOT, 'blender', 'arena_report.json'), 'w'))

# ═══════════ RIFT CORE (floating, rotated at runtime) ═══════════
bpy.ops.wm.read_factory_settings(use_empty=True)
M2 = Mats()
CORE = M2.add('rift_core', '#C79BFF', 0.3, 0.05, '#9A4BFF', 6.0)
RINGM = M2.add('rift_ring', '#FFD86A', 0.9, 0.2, '#B07A00', 1.5)
b = Builder(M2)
b.octa(0, 0, 0, 0.9, 1.6, CORE)
b.octa(0, 0, 0, 0.55, 2.3, CORE)
b.ring(0, -0.05, 0, 1.6, 1.75, 0.1, RINGM, seg=32)
for k in range(8):
    a = 2 * math.pi * k / 8
    b.octa(math.cos(a) * 2.3, 0.0, math.sin(a) * 2.3, 0.12, 0.3, CORE)
b.emit('rift_core')
export(os.path.join(MODELS, 'rift_core.glb'))
