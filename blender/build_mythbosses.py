"""
WOW NIGHTSWARM — the mythic ladder (Lv 350-1111). Original designs, each in the spirit of a legend genre.
Origin at the feet (flyers: the lowest point; view.ts lifts them), facing +z, looping clip "Idle".
  350 boss_varkos     VARKOS — ki berserker wreathed in a crimson aura
  400 boss_drakkar    CAPTAIN DRAKKAR — drowned pirate emperor with an anchor and a cannon arm
  450 boss_kagerou    KAGEROU — shadow ninja with a ring of kunai and two shadow clones
  500 boss_solariel   SOLARIEL — archangel of judgment, flaming greatsword and sun shield
  550 boss_malgoroth  MALGOROTH — molten forge tyrant with ram horns and a forge hammer
  600 boss_zerath     ZERATH — star-devouring cosmic tyrant with a black hole for a heart
  650 boss_yorumi     YORUMI — white fox empress with nine foxfire tails
  700 boss_armada     THE DROWNED ARMADA — flying ghost galleon
  750 boss_raikou     RAIKOU — oni thunder shogun with a ring of storm drums
  800 boss_ophanos    OPHANOS — wheels within wheels, full of eyes and fire
  850 boss_nyxara     NYXARA — queen of the abyss on great bat wings
  900 boss_asurakh    ASURAKH — six-armed, three-faced wrath with a ring of fire
  950 boss_khronos    KHRONOS — the time devourer, clock-faced and hourglass-hearted
 1000 boss_morthael   MORTHAEL — the last demon king
 1111 boss_almighty   THE ALMIGHTY — God of all creation
       cos_god        Divine Radiance — six wings of light + halo, worn by those who beat God
Run: python3 blender/build_mythbosses.py [name ...]  → models/*.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from mythparts import *  # noqa


def skirt(b, y0, y1, r0, r1, m, gap=0.0, seg=18, z0=0.0, back=0.0):
    """cylinder wall y0 (r0) → y1 (r1), open at the front (+z) by `gap` radians, both sides; `back` pushes the hem back"""
    vs = []
    for i in range(seg + 1):
        a = gap / 2 + (2 * math.pi - gap) * i / seg
        for y, r, dz in ((y0, r0, -back), (y1, r1, 0.0)):
            vs.append((math.sin(a) * r, y, z0 + math.cos(a) * r + dz))
    fs = [[2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1] for i in range(seg)]
    b.faces(b.a(m), vs, fs + [f[::-1] for f in fs])


def sheet(b, top_l, top_r, bot_l, bot_r, m, cols=7, rows=5, bulge=(0, 0, 0), tatter=0.0):
    """cloth: bilinear patch with a bulge and a ragged bottom edge (capes, sails, banners)"""
    vs = []
    for r in range(rows):
        t = r / (rows - 1)
        for c in range(cols):
            u = c / (cols - 1)
            p = lerp(lerp(top_l, top_r, u), lerp(bot_l, bot_r, u), t)
            k = math.sin(u * math.pi) * math.sin(t * math.pi)
            p = add(p, mul(bulge, k))
            if r == rows - 1 and tatter:
                p = add(p, (0, tatter * (0.5 + 0.5 * math.cos(c * 2.7)) * (1 if c % 2 else 0.3), 0))
            vs.append(p)
    fs = [[r * cols + c, r * cols + c + 1, (r + 1) * cols + c + 1, (r + 1) * cols + c] for r in range(rows - 1) for c in range(cols - 1)]
    b.faces(b.a(m), vs, fs + [f[::-1] for f in fs])


def arm(b, sh, el, wr, r0, r1, m, joint=True):
    tube(b, sh, el, r0, r0 * 0.86, m, 10)
    if joint:
        b.sphere(el[0], el[1], el[2], r0 * 0.86, m, 8, 5)
    tube(b, el, wr, r0 * 0.84, r1, m, 10)


def leg(b, hip, knee, ank, r0, r1, m):
    tube(b, hip, knee, r0, r0 * 0.82, m, 10)
    b.sphere(knee[0], knee[1], knee[2], r0 * 0.8, m, 8, 5)
    tube(b, knee, ank, r0 * 0.8, r1, m, 10)


def part(M, name, fn):
    """build one animated piece into its own objects"""
    pb = Builder(M)
    fn(pb)
    return pb.emit(name)


# ════════════════════════════ 350 VARKOS ════════════════════════════
def varkos():
    name = 'boss_varkos'
    M = new_scene()
    SKIN = skin(M, 'vk_skin', '#C8875A', 0.6, seed=201, scale=0.7, contrast=0.25)
    GI = skin(M, 'vk_gi', '#7A1420', 0.8, seed=202, scale=0.7, contrast=0.35)
    BELT = M.add('vk_belt', '#16121C', 0.0, 0.6)
    BOOT = skin(M, 'vk_boot', '#1E2A44', 0.7, seed=203, scale=0.6, contrast=0.3)
    WRAP = M.add('vk_wrap', '#E8E0D0', 0.0, 0.7)
    HAIR = M.add('vk_hair', '#FF8A4A', 0.0, 0.35, '#FF3B2E', 3.5)
    EYE = glowmat(M, 'vk_eye', '#FFFFFF', 12)
    AURA = fire_mat(M, 'vk_aura', '#FF2A3D', '#FFD0D8', 4.0, soft=True, opacity=0.7)
    AURA2 = fire_mat(M, 'vk_aura2', '#FF7A8A', '#FFFFFF', 5.0, soft=True, opacity=0.55)
    BOLT = glowmat(M, 'vk_bolt', '#FFE6EA', 12)
    ROCK = skin(M, 'vk_rock', '#4A3A36', 0.9, seed=204, scale=0.6, contrast=0.5)
    b = Builder(M)
    for s in (-1, 1):
        hip, knee, ank = (s * 0.42, 2.35, 0), (s * 0.74, 1.3, 0.22), (s * 0.8, 0.55, 0.05)
        leg(b, hip, knee, ank, 0.42, 0.27, GI)
        tube(b, (ank[0], 0.6, ank[2]), (ank[0], 0.08, ank[2] + 0.05), 0.27, 0.25, BOOT, 10)
        b.box(ank[0], 0.1, ank[2] + 0.24, 0.4, 0.2, 0.66, BOOT)
        torus(b, (ank[0], 0.62, ank[2]), (0, 1, 0), 0.28, 0.05, WRAP, 12, 4)
    b.sphere(0, 2.42, 0, 0.78, GI, 12, 6, ry=0.42, rz=0.52)
    torus(b, (0, 2.7, 0), (0, 1, 0), 0.66, 0.09, BELT, 18, 5)
    b.box(0.28, 2.62, 0.62, 0.22, 0.28, 0.1, BELT)
    tube(b, (0.3, 2.55, 0.64), (0.44, 1.95, 0.7), 0.07, 0.04, BELT, 5)
    b.sphere(0, 3.05, 0.05, 0.64, SKIN, 12, 7, ry=0.55, rz=0.44)
    for i in range(3):
        for s in (-1, 1):
            b.sphere(s * 0.16, 2.8 + i * 0.2, 0.42, 0.13, SKIN, 6, 4, ry=0.09, rz=0.06)
    b.sphere(0, 3.7, 0.0, 1.02, SKIN, 14, 8, ry=0.62, rz=0.56)
    for s in (-1, 1):
        b.sphere(s * 0.43, 3.8, 0.38, 0.45, SKIN, 10, 6, ry=0.3, rz=0.22)
        b.sphere(s * 0.56, 4.16, -0.05, 0.42, SKIN, 8, 5, ry=0.26, rz=0.36)
    tube(b, (0, 4.05, 0), (0, 4.5, 0.08), 0.34, 0.28, SKIN, 10)
    b.sphere(0, 4.8, 0.1, 0.37, SKIN, 12, 7, ry=0.43, rz=0.39)
    b.box(0, 4.56, 0.3, 0.42, 0.22, 0.24, SKIN)
    for s in (-1, 1):
        b.box(s * 0.14, 4.84, 0.45, 0.14, 0.04, 0.03, EYE)
        b.box(s * 0.15, 4.93, 0.44, 0.18, 0.05, 0.06, SKIN, roll=-s * 14)
    for (dx, dy, dz) in [(0, 1.6, -0.1), (0.32, 1.3, -0.35), (-0.32, 1.3, -0.35), (0.52, 0.95, -0.15), (-0.52, 0.95, -0.15),
                         (0.16, 1.2, -0.65), (-0.16, 1.2, -0.65), (0.46, 0.7, 0.2), (-0.46, 0.7, 0.2), (0, 1.05, 0.32), (0, 0.9, -0.8)]:
        base = (dx * 0.45, 5.0, 0.05 + dz * 0.4)
        cone(b, base, (dx * 1.45, 5.0 + dy, dz * 1.25 - 0.15), 0.21, HAIR, seg=5)
    parts = list(b.emit(f'{name}_body'))
    for s, ph in ((-1, 0), (1, 12)):
        def mk(ab, s=s):
            sh, el, wr = (s * 1.1, 3.98, 0.0), (s * 1.48, 3.05, 0.2), (s * 1.4, 2.3, 0.62)
            ab.sphere(sh[0], sh[1], sh[2], 0.46, SKIN, 10, 6)
            arm(ab, sh, el, wr, 0.36, 0.25, SKIN)
            torus(ab, lerp(el, wr, 0.78), sub(wr, el), 0.27, 0.06, BOOT, 12, 4)
            ab.sphere(wr[0], wr[1] - 0.1, wr[2] + 0.12, 0.3, SKIN, 8, 6, ry=0.28, rz=0.32)
            zigzag(ab, el, add(wr, (0, -0.1, 0.1)), 4, 0.12, 0.025, BOLT, seed=3 + s)
        apv = pivot(f'{name}_armpv{s}', (s * 1.1, 3.98, 0.0), part(M, f'{name}_arm{s}', mk))
        sway(apv, 'z', 4 * s, phase=ph)
        parts.append(apv)

    def aura(au):
        # flames burn all around but thin out in front so the face and fists stay visible
        for k in range(16):
            a = 2 * math.pi * k / 16          # a = 90° is the front (+z)
            front = math.cos(a - math.pi / 2)
            if front > 0.55:
                continue
            R = 1.45 + 0.3 * math.sin(k * 1.7)
            base = (math.cos(a) * R, -0.1 + 0.25 * (k % 3), math.sin(a) * R * 0.85)
            h = 4.6 + 1.8 * ((k * 7) % 5) / 4
            card(au, base, add(base, (-math.cos(a) * 0.5, h, -math.sin(a) * 0.4)), 1.5 + 0.3 * (k % 2), AURA, n=1, roll=math.degrees(a) + 90)
        for k in range(7):
            a = math.pi * 1.5 + (k - 3) * 0.42
            base = (math.cos(a) * 0.9, 0.4, math.sin(a) * 0.7)
            card(au, base, add(base, (0, 4.0 + 0.6 * (k % 2), -0.2)), 1.2, AURA2, n=1, roll=math.degrees(a) + 90)
    apv = pivot(f'{name}_aurapv', (0, 0, 0), part(M, f'{name}_aura', aura))
    key_rot(apv, 'y', [(1, 0), (13, 10), (25, 0)])
    pulse(apv, 0.93, 1.07)
    parts.append(apv)
    for i in range(2):
        def bolts(lb, i=i):
            for k in range(4):
                a = 2 * math.pi * (k / 4 + i * 0.125)
                p0 = (math.cos(a) * 1.2, 1.0 + 1.2 * ((k + i) % 3), math.sin(a) * 1.0)
                p1 = (math.cos(a + 0.6) * 1.4, p0[1] + 1.4, math.sin(a + 0.6) * 1.1)
                zigzag(lb, p0, p1, 5, 0.18, 0.035, BOLT, seed=11 + k + i * 7)
        lpv = pivot(f'{name}_boltpv{i}', (0, 0, 0), part(M, f'{name}_bolt{i}', bolts))
        spin(lpv, 'y', 1, 1 if i else -1)
        parts.append(lpv)

    def rocks(rb):
        for k in range(7):
            a = 2 * math.pi * k / 7
            rb.octa(math.cos(a) * 2.5, 0.3 + 0.5 * (k % 3), math.sin(a) * 2.1, 0.22 + 0.07 * (k % 2), 0.3, ROCK)
    rpv = pivot(f'{name}_rockpv', (0, 0, 0), part(M, f'{name}_rocks', rocks))
    spin(rpv, 'y', 1, 1)
    bob(rpv, 0.25)
    parts.append(rpv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.12)
    finish(name)


# ════════════════════════════ 400 CAPTAIN DRAKKAR ════════════════════════════
def drakkar():
    name = 'boss_drakkar'
    M = new_scene()
    COAT = skin(M, 'dk_coat', '#123038', 0.7, seed=211, scale=0.8, contrast=0.4)
    TRIM = M.add('dk_trim', '#E9B949', 0.95, 0.25)
    SHIRT = skin(M, 'dk_shirt', '#D8CFB8', 0.8, seed=212, scale=0.6, contrast=0.3)
    FLESH = skin(M, 'dk_flesh', '#7FA597', 0.7, seed=213, scale=0.6, contrast=0.35)
    WEED = M.add('dk_weed', '#1F5A4A', 0.0, 0.6, '#2BD4C4', 0.8)
    HAT = skin(M, 'dk_hat', '#151618', 0.7, seed=214, scale=0.6, contrast=0.3)
    BOOT = M.add('dk_boot', '#0E0E10', 0.2, 0.45)
    CORAL = skin(M, 'dk_coral', '#FF6A5A', 0.7, seed=215, scale=0.4, contrast=0.4)
    IRON = M.add('dk_iron', '#2A3036', 0.85, 0.35)
    GHOST = fire_mat(M, 'dk_ghost', '#2BD4C4', '#E6FFFA', 4.0, soft=True, opacity=0.8)
    EYE = glowmat(M, 'dk_eye', '#5FFFE6', 12)
    BONE = skin(M, 'dk_bone', '#E8E0CC', 0.6, seed=216, scale=0.4, contrast=0.3)
    b = Builder(M)
    for s in (-1, 1):
        leg(b, (s * 0.4, 2.2, 0), (s * 0.5, 1.25, 0.12), (s * 0.52, 0.55, 0), 0.34, 0.24, COAT)
        tube(b, (s * 0.52, 1.2, 0), (s * 0.52, 0.05, 0), 0.3, 0.27, BOOT, 10)
        tube(b, (s * 0.52, 1.15, 0), (s * 0.52, 1.34, 0), 0.37, 0.4, BOOT, 10)
        b.box(s * 0.52, 0.1, 0.26, 0.42, 0.2, 0.72, BOOT)
    skirt(b, 1.0, 2.95, 1.1, 0.86, COAT, gap=0.7, seg=20, back=0.25)
    b.sphere(0, 3.55, 0, 1.0, COAT, 14, 8, ry=0.85, rz=0.7)
    b.box(0, 3.5, 0.6, 0.55, 1.1, 0.14, SHIRT)
    for k in range(5):
        b.sphere(0, 3.0 + k * 0.22, 0.69, 0.05, TRIM, 6, 4)
    torus(b, (0, 2.72, 0), (0, 1, 0), 0.92, 0.1, BOOT, 20, 5)
    b.box(0, 2.72, 0.98, 0.36, 0.3, 0.08, TRIM)
    for s in (-1, 1):
        b.box(s * 0.95, 4.3, 0, 0.62, 0.12, 0.62, TRIM)
        for k in range(6):
            tube(b, (s * (0.7 + k * 0.1), 4.24, 0.26), (s * (0.7 + k * 0.1), 3.92, 0.3), 0.025, 0.02, TRIM, 4)
        for k in range(3):
            cone(b, (s * (1.1 + 0.1 * k), 4.35, -0.2 + 0.15 * k), (s * (1.25 + 0.2 * k), 4.95 + 0.2 * k, -0.3 + 0.1 * k), 0.08, CORAL, 5)
        b.sphere(s * 0.7, 3.2, 0.62, 0.07, CORAL, 6, 4)
    tube(b, (0, 4.3, 0), (0, 4.6, 0.05), 0.3, 0.28, FLESH, 10)
    b.sphere(0, 4.95, 0.08, 0.44, FLESH, 12, 7, ry=0.5, rz=0.44)
    for s in (-1, 1):
        b.sphere(s * 0.16, 5.03, 0.45, 0.08, EYE, 6, 4)
    b.box(0, 4.86, 0.5, 0.1, 0.18, 0.1, FLESH)
    for k in range(7):
        a = math.radians(-60 + k * 20)
        p0 = (math.sin(a) * 0.3, 4.72, 0.3 + math.cos(a) * 0.1)
        chain(b, [p0, (p0[0] * 1.1, 4.3, 0.46), (p0[0] * 1.3, 3.9, 0.43 + 0.1 * math.cos(k)), (p0[0] * 1.2 + 0.05 * math.sin(k * 2), 3.52, 0.5)],
              [0.085, 0.065, 0.045, 0.02], WEED, 6)
    # captain's hat: flat brim folded up at front and back, skull badge, ghost plume
    b.cyl(0, 5.3, 0, 0.5, 0.55, HAT, seg=14, r_top=0.42)
    b.sphere(0, 5.36, 0, 1.12, HAT, 16, 6, ry=0.1, rz=0.72)
    for zz, pt in ((0.55, -55), (-0.55, 55)):
        b.box(0, 5.62, zz, 1.9, 0.62, 0.07, HAT, pitch=pt)
        b.box(0, 5.88, zz * 1.18, 1.95, 0.06, 0.09, TRIM, pitch=pt)
    b.sphere(0, 5.62, 0.63, 0.15, BONE, 8, 5, ry=0.16)
    for s in (-1, 1):
        b.box(s * 0.22, 5.55, 0.66, 0.42, 0.06, 0.04, BONE, roll=s * 35)
    for k in range(3):
        card(b, (0.15, 5.7, -0.1), (0.55 + 0.2 * k, 6.9 + 0.2 * k, -0.9 - 0.3 * k), 0.55 - 0.1 * k, GHOST, n=2)
    parts = list(b.emit(f'{name}_body'))

    def rarm(ab):
        sh, el, wr = (1.1, 4.1, 0), (1.45, 3.2, 0.3), (1.55, 2.55, 0.72)
        arm(ab, sh, el, wr, 0.3, 0.2, COAT)
        torus(ab, lerp(el, wr, 0.85), sub(wr, el), 0.23, 0.06, TRIM, 12, 4)
        ab.sphere(wr[0], wr[1], wr[2], 0.22, FLESH, 8, 5)
        top, bot = (1.55, 4.3, 0.78), (1.55, 0.6, 0.78)
        tube(ab, top, bot, 0.13, 0.13, IRON, 8)
        torus(ab, add(top, (0, 0.3, 0)), (1, 0, 0), 0.28, 0.07, IRON, 14, 5)
        tube(ab, (0.95, 3.75, 0.78), (2.15, 3.75, 0.78), 0.09, 0.09, IRON, 6)
        arc = [(1.55 + math.sin(t) * 1.05, 0.6 + (1 - math.cos(t)) * 0.95, 0.78) for t in [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2]]
        for i in range(len(arc) - 1):
            tube(ab, arc[i], arc[i + 1], 0.13, 0.13, IRON, 6)
        for tip, t in ((arc[0], -1.2), (arc[-1], 1.2)):
            cone(ab, tip, add(tip, (math.sin(t) * 0.5, 0.55, 0)), 0.22, IRON, 4)
        for k in range(5):
            torus(ab, lerp(add(top, (0, 0.3, 0)), (1.05, 4.25, -0.25), (k + 0.5) / 5), (1, 0, 0) if k % 2 else (0, 0, 1), 0.12, 0.035, IRON, 10, 4)
        for k in range(3):
            cone(ab, (1.55, 1.2 + k * 0.5, 0.9), (1.75, 1.45 + k * 0.5, 1.1), 0.07, CORAL, 4)
    apv = pivot(f'{name}_rarmpv', (1.1, 4.1, 0), part(M, f'{name}_rarm', rarm))
    sway(apv, 'x', 6)
    parts.append(apv)

    def larm(lb):
        sh, el = (-1.1, 4.1, 0), (-1.5, 3.3, 0.25)
        tube(lb, sh, el, 0.3, 0.27, COAT, 10)
        torus(lb, el, sub(el, sh), 0.3, 0.06, TRIM, 12, 4)
        m0, m1 = (-1.55, 3.15, 0.15), (-1.62, 3.0, 1.85)
        tube(lb, m0, m1, 0.36, 0.28, IRON, 12)
        torus(lb, m1, sub(m1, m0), 0.31, 0.08, IRON, 14, 5)
        disc(lb, add(m1, (0, 0, 0.03)), (0, 0, 1), 0.22, EYE, seg=12)
        for t in (0.3, 0.62):
            torus(lb, lerp(m0, m1, t), sub(m1, m0), 0.36 - 0.06 * t, 0.05, TRIM, 14, 4)
    lpv = pivot(f'{name}_larmpv', (-1.1, 4.1, 0), part(M, f'{name}_larm', larm))
    sway(lpv, 'x', 4, phase=6)
    parts.append(lpv)
    cpv = pivot(f'{name}_capepv', (0, 4.35, -0.55), part(M, f'{name}_cape', lambda cb: sheet(
        cb, (-1.15, 4.35, -0.55), (1.15, 4.35, -0.55), (-1.75, 0.7, -1.45), (1.75, 0.7, -1.45), COAT, cols=8, rows=6, bulge=(0, 0, -0.35), tatter=0.4)))
    sway(cpv, 'x', -5, phase=3)
    parts.append(cpv)

    def mist(gb):
        for k in range(10):
            a = 2 * math.pi * k / 10
            base = (math.cos(a) * 0.8, 0.0, math.sin(a) * 0.8)
            card(gb, base, (math.cos(a) * 1.9, 1.3 + 0.4 * (k % 2), math.sin(a) * 1.9), 1.0, GHOST, n=1, roll=math.degrees(a))
    gpv = pivot(f'{name}_mistpv', (0, 0, 0), part(M, f'{name}_mist', mist))
    spin(gpv, 'y', 1, 1)
    parts.append(gpv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.06)
    shadow(M, 1.4)
    finish(name)


# ════════════════════════════ 450 KAGEROU ════════════════════════════
def kagerou():
    name = 'boss_kagerou'
    M = new_scene()
    CLOTH = skin(M, 'kg_cloth', '#16172A', 0.8, seed=221, scale=0.6, contrast=0.35)
    WRAP = skin(M, 'kg_wrap', '#2E303C', 0.8, seed=222, scale=0.5, contrast=0.3)
    SCARF = skin(M, 'kg_scarf', '#B5122A', 0.75, seed=223, scale=0.5, contrast=0.35)
    PLATE = M.add('kg_plate', '#2B2F37', 0.85, 0.3)
    EYE = glowmat(M, 'kg_eye', '#FF2A4A', 14)
    STEEL = M.add('kg_steel', '#C9D0DC', 0.95, 0.18)
    HILT = M.add('kg_hilt', '#3A0A12', 0.2, 0.6)
    EDGE = glowmat(M, 'kg_edge', '#FF4A6A', 5)
    SHADE = M.add('kg_shade', '#0A0610', 0.0, 0.8, '#3A0A2A', 1.0, alpha=0.5)
    b = Builder(M)
    for s in (-1, 1):
        hip, knee, ank = (s * 0.35, 1.95, -0.05), (s * 0.62, 1.25, 0.48), (s * 0.56, 0.32, 0.08)
        leg(b, hip, knee, ank, 0.3, 0.17, CLOTH)
        for k in range(3):
            torus(b, lerp(knee, ank, 0.25 + 0.22 * k), sub(ank, knee), 0.2 - 0.02 * k, 0.04, WRAP, 10, 4)
        b.box(ank[0], 0.1, ank[2] + 0.18, 0.26, 0.18, 0.5, WRAP)
    b.sphere(0, 2.0, -0.02, 0.5, CLOTH, 10, 6, ry=0.32, rz=0.38)
    torus(b, (0, 2.22, 0.02), (0, 1, 0.15), 0.46, 0.07, SCARF, 16, 4)
    b.sphere(0, 2.65, 0.12, 0.48, CLOTH, 10, 6, ry=0.52, rz=0.36)
    b.sphere(0, 3.15, 0.2, 0.66, CLOTH, 12, 7, ry=0.45, rz=0.42)
    b.box(0, 3.12, 0.55, 0.7, 0.5, 0.1, PLATE, pitch=-12)
    for s in (-1, 1):
        b.sphere(s * 0.6, 3.35, 0.12, 0.26, PLATE, 8, 5, ry=0.18)
    tube(b, (0, 3.4, 0.22), (0, 3.62, 0.32), 0.2, 0.18, CLOTH, 8)
    b.sphere(0, 3.82, 0.36, 0.3, CLOTH, 10, 6, ry=0.34)
    b.sphere(0, 3.84, 0.28, 0.36, WRAP, 10, 6, ry=0.36, rz=0.38)       # hood
    b.box(0, 3.78, 0.62, 0.36, 0.2, 0.08, PLATE)                       # mask plate
    for s in (-1, 1):
        b.box(s * 0.1, 3.88, 0.66, 0.12, 0.035, 0.03, EYE, roll=s * 10)
        tube(b, (s * 0.12, 3.95, 0.1), (s * 0.5, 3.6, -0.75), 0.05, 0.02, SCARF, 4)   # hood ties
    tube(b, (-0.55, 2.55, -0.42), (0.72, 4.35, -0.38), 0.07, 0.07, HILT, 6)            # scabbard on the back
    torus(b, (0.5, 4.04, -0.38), (0.55, 0.8, 0), 0.12, 0.03, STEEL, 10, 4)
    tube(b, (0.52, 4.07, -0.38), (0.78, 4.45, -0.37), 0.045, 0.045, SCARF, 6)
    parts = list(b.emit(f'{name}_body'))

    def kunai(ab, hand, tip, r=0.05):
        tube(ab, sub(hand, mul(norm(sub(tip, hand)), 0.18)), hand, r * 0.6, r * 0.6, SCARF, 5)
        torus(ab, sub(hand, mul(norm(sub(tip, hand)), 0.24)), sub(tip, hand), 0.05, 0.015, STEEL, 8, 4)
        blade(ab, hand, tip, 0.13, 0.03, STEEL, tip=0.45)

    def larm(ab):
        sh, el, wr = (-0.58, 3.3, 0.15), (-0.8, 2.92, 0.78), (-0.58, 2.82, 1.32)
        arm(ab, sh, el, wr, 0.17, 0.12, CLOTH)
        torus(ab, lerp(el, wr, 0.6), sub(wr, el), 0.13, 0.03, WRAP, 10, 4)
        ab.sphere(wr[0], wr[1], wr[2], 0.12, WRAP, 6, 4)
        kunai(ab, add(wr, (0, 0, 0.08)), add(wr, (0.05, 0.05, 0.62)))
    apv = pivot(f'{name}_larmpv', (-0.58, 3.3, 0.15), part(M, f'{name}_larm', larm))
    sway(apv, 'x', 5)
    parts.append(apv)

    def rarm(ab):
        sh, el, wr = (0.58, 3.3, 0.15), (0.98, 2.75, -0.1), (1.1, 2.25, 0.32)
        arm(ab, sh, el, wr, 0.17, 0.12, CLOTH)
        ab.sphere(wr[0], wr[1], wr[2], 0.12, WRAP, 6, 4)
        kunai(ab, add(wr, (0, -0.06, 0)), add(wr, (0.1, -0.62, -0.2)))
    rpv = pivot(f'{name}_rarmpv', (0.58, 3.3, 0.15), part(M, f'{name}_rarm', rarm))
    sway(rpv, 'z', 6, phase=8)
    parts.append(rpv)
    spv = pivot(f'{name}_scarfpv', (0, 3.5, 0.1), part(M, f'{name}_scarf', lambda sb: (
        torus(sb, (0, 3.5, 0.24), (0, 1, 0.1), 0.25, 0.08, SCARF, 14, 5),
        sheet(sb, (-0.18, 3.55, -0.05), (0.18, 3.55, -0.05), (-0.35, 2.4, -2.3), (0.15, 2.0, -2.4), SCARF, cols=3, rows=7, bulge=(0.3, 0.45, 0), tatter=0.15),
        sheet(sb, (0.05, 3.5, -0.05), (0.3, 3.5, -0.05), (0.7, 2.9, -1.9), (0.9, 2.6, -1.8), SCARF, cols=3, rows=5, bulge=(-0.2, 0.3, 0), tatter=0.1))))
    sway(spv, 'y', 9, phase=4)
    parts.append(spv)

    def ring(kb):
        for k in range(8):
            a = 2 * math.pi * k / 8
            c = (math.cos(a) * 1.9, 2.5 + 0.25 * math.sin(a * 2), math.sin(a) * 1.9)
            t = (-math.sin(a), 0, math.cos(a))
            kunai(kb, sub(c, mul(t, 0.25)), add(c, mul(t, 0.4)), 0.04)
            kb.octa(c[0], c[1], c[2], 0.05, 0.08, EDGE)
    kpv = pivot(f'{name}_kunaipv', (0, 2.5, 0), part(M, f'{name}_kunai', ring))
    spin(kpv, 'y', 1, -1)
    parts.append(kpv)
    for s in (-1, 1):
        def clone(cb, s=s):
            ox, oz = s * 1.9, -1.1
            cb.sphere(ox, 1.9, oz, 0.45, SHADE, 8, 5, ry=0.32)
            for t in (-1, 1):
                tube(cb, (ox + t * 0.3, 1.9, oz), (ox + t * 0.55, 1.2, oz + 0.4), 0.26, 0.2, SHADE, 6)
                tube(cb, (ox + t * 0.55, 1.2, oz + 0.4), (ox + t * 0.5, 0.2, oz), 0.2, 0.14, SHADE, 6)
                tube(cb, (ox + t * 0.5, 3.2, oz + 0.1), (ox + t * 0.85, 2.6, oz + 0.6), 0.14, 0.1, SHADE, 6)
            cb.sphere(ox, 3.0, oz + 0.1, 0.58, SHADE, 8, 5, ry=0.55, rz=0.4)
            cb.sphere(ox, 3.75, oz + 0.25, 0.3, SHADE, 8, 5)
            for t in (-1, 1):
                cb.box(ox + t * 0.1, 3.8, oz + 0.53, 0.1, 0.03, 0.03, EYE)
        cpv = pivot(f'{name}_clonepv{s}', (s * 1.9, 0, -1.1), part(M, f'{name}_clone{s}', clone))
        bob(cpv, 0.18, phase=6 if s > 0 else 0)
        sway(cpv, 'y', 8 * s)
        parts.append(cpv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.05)
    shadow(M, 1.1)
    finish(name)


# ════════════════════════════ 500 SOLARIEL ════════════════════════════
def solariel():
    name = 'boss_solariel'
    M = new_scene()
    GOLD = M.add('so_gold', '#E9C46A', 0.95, 0.22, '#7A5200', 0.4)
    PLATE = M.add('so_plate', '#EDEBE4', 0.85, 0.25)
    CLOTH = skin(M, 'so_cloth', '#F6F2E8', 0.7, seed=231, scale=0.7, contrast=0.2)
    FEATH = M.add('so_feather', '#FFFFFF', 0.0, 0.5, '#FFF2D0', 1.4, alpha=0.95)
    LIGHT = glowmat(M, 'so_light', '#FFF2B0', 8)
    FIRE = fire_mat(M, 'so_fire', '#FF9A2A', '#FFF6D0', 6.0)
    VISOR = glowmat(M, 'so_visor', '#9FE8FF', 10)
    TRAIL = M.add('so_trail', '#FFF8E0', 0.0, 0.3, '#FFE9A8', 4.0, alpha=0.35)
    b = Builder(M)
    for s in (-1, 1):
        leg(b, (s * 0.32, 2.3, 0), (s * 0.36, 1.3, -0.12), (s * 0.34, 0.5, -0.3), 0.3, 0.18, PLATE)
        b.sphere(s * 0.36, 1.3, -0.04, 0.2, GOLD, 8, 5)
        cone(b, (s * 0.34, 0.55, -0.28), (s * 0.34, 0.0, -0.18), 0.17, GOLD, 6)
    skirt(b, 0.95, 2.5, 1.0, 0.72, CLOTH, gap=0.0, seg=18)
    for k in range(10):
        a = 2 * math.pi * k / 10
        b.box(math.sin(a) * 0.8, 2.15, math.cos(a) * 0.8, 0.42, 0.62, 0.06, GOLD if k % 2 else PLATE, yaw=math.degrees(a), pitch=-18)
    torus(b, (0, 2.55, 0), (0, 1, 0), 0.74, 0.07, GOLD, 18, 4)
    b.sphere(0, 3.55, 0.03, 0.86, PLATE, 14, 8, ry=0.74, rz=0.58)
    b.box(0, 3.62, 0.48, 0.5, 0.7, 0.14, GOLD)
    disc(b, (0, 3.75, 0.58), (0, 0, 1), 0.2, LIGHT, seg=14)
    rays(b, (0, 3.75, 0.59), (0, 0, 1), 0.22, 0.5, 12, 0.04, GOLD, alt=0.4)
    for s in (-1, 1):
        b.sphere(s * 0.98, 4.22, 0, 0.46, GOLD, 10, 6, ry=0.34)
        torus(b, (s * 0.98, 4.1, 0), (s * 0.35, 1, 0), 0.42, 0.05, PLATE, 14, 4)
    tube(b, (0, 4.25, 0), (0, 4.55, 0.04), 0.24, 0.22, PLATE, 8)
    b.sphere(0, 4.88, 0.06, 0.42, PLATE, 12, 7, ry=0.48)
    b.box(0, 4.86, 0.45, 0.42, 0.06, 0.06, VISOR)
    b.box(0, 4.74, 0.46, 0.06, 0.24, 0.05, VISOR)
    for k in range(3):
        b.box(0, 5.25 + 0.06 * k, -0.15 + 0.18 * k, 0.05, 0.5 - 0.1 * k, 0.5, GOLD)
    for s in (-1, 1):
        for k in range(3):
            cone(b, (s * 0.38, 4.95, 0.0 - 0.1 * k), (s * 0.75, 5.35 + 0.1 * k, -0.35 - 0.15 * k), 0.06, GOLD, 4)
    cone(b, (0, 0.95, 0), (0, -0.2, -0.2), 0.9, TRAIL, 8)
    parts = list(b.emit(f'{name}_body'))
    hpv = pivot(f'{name}_halopv', (0, 5.3, -0.42), part(M, f'{name}_halo', lambda hb: (
        torus(hb, (0, 5.3, -0.42), (0, 0.15, 1), 0.78, 0.06, LIGHT, 28, 5),
        rays(hb, (0, 5.3, -0.43), (0, 0.15, 1), 0.86, 1.35, 16, 0.05, GOLD, alt=0.45))))
    spin(hpv, 'z', 1, 1)
    parts.append(hpv)
    for wi, (y, span, lift, drop, amp, ph) in enumerate([(4.35, 4.4, 0.95, 0.5, 18, 0), (3.6, 3.2, 0.55, 1.3, 22, 3)]):
        for s in (-1, 1):
            root = (s * 0.36, y, -0.45)
            wpv = pivot(f'{name}_wingpv{wi}{s}', root, part(M, f'{name}_wing{wi}{s}', lambda wb, root=root, s=s, span=span, lift=lift, drop=drop, wi=wi:
                angel_wing(wb, root, s, span, lift + 0.4, 0.9, FEATH, GOLD, prim=9, sec=7, glow=LIGHT if wi == 0 else None, droop=0.8 + 0.4 * wi, thick=0.07)))
            key_rot(wpv, 'y', [(1, s * amp * 0.6), (13, -s * amp * 0.5), (25, s * amp * 0.6)])
            parts.append(wpv)

    def rarm(ab):
        sh, el, wr = (0.98, 4.15, 0), (1.38, 4.9, 0.35), (1.42, 5.6, 0.72)
        arm(ab, sh, el, wr, 0.26, 0.17, PLATE)
        torus(ab, lerp(el, wr, 0.7), sub(wr, el), 0.2, 0.05, GOLD, 12, 4)
        ab.sphere(wr[0], wr[1], wr[2], 0.2, GOLD, 8, 5)
        tube(ab, (1.42, 5.35, 0.7), (1.42, 5.95, 0.78), 0.07, 0.07, GOLD, 6)
        tube(ab, (1.0, 5.95, 0.78), (1.84, 5.95, 0.78), 0.06, 0.06, GOLD, 6)
        blade(ab, (1.42, 6.0, 0.78), (1.42, 8.9, 1.02), 0.38, 0.07, LIGHT, tip=0.12, side=(1, 0, 0))
        for k in range(7):
            t = 0.1 + k * 0.12
            p = lerp((1.42, 6.0, 0.78), (1.42, 8.9, 1.02), t)
            flame(ab, add(p, (0.2 if k % 2 else -0.2, 0, 0)), 0.6, 0.12, FIRE, n=2, yaw0=k * 40, lean=(0, 0, -0.2))
    rpv = pivot(f'{name}_rarmpv', (0.98, 4.15, 0), part(M, f'{name}_rarm', rarm))
    sway(rpv, 'x', 5)
    parts.append(rpv)

    def larm(ab):
        sh, el, wr = (-0.98, 4.15, 0), (-1.32, 3.4, 0.35), (-1.22, 3.0, 0.86)
        arm(ab, sh, el, wr, 0.26, 0.17, PLATE)
        c, n = (-1.27, 3.25, 1.08), (-0.2, 0.05, 1)
        disc(ab, c, n, 0.95, PLATE, seg=24)
        torus(ab, c, n, 0.95, 0.07, GOLD, 26, 5)
        rays(ab, add(c, mul(norm(n), 0.03)), n, 0.24, 0.85, 12, 0.05, GOLD, alt=0.4)
        disc(ab, add(c, mul(norm(n), 0.04)), n, 0.22, LIGHT, seg=14)
    lpv = pivot(f'{name}_larmpv', (-0.98, 4.15, 0), part(M, f'{name}_larm', larm))
    sway(lpv, 'x', 4, phase=8)
    parts.append(lpv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.3)
    finish(name)


# ════════════════════════════ 550 MALGOROTH ════════════════════════════
def malgoroth():
    name = 'boss_malgoroth'
    M = new_scene()
    ROCK = skin(M, 'mg_rock', '#241B19', 0.9, seed=241, scale=0.7, contrast=0.6)
    LAVA = glowmat(M, 'mg_lava', '#FF5A1E', 6)
    MAGMA = glowmat(M, 'mg_magma', '#FFB347', 9)
    IRON = M.add('mg_iron', '#2B2A2E', 0.85, 0.4)
    HORN = skin(M, 'mg_horn', '#D8C8A8', 0.6, seed=242, scale=0.4, contrast=0.4)
    FIRE = fire_mat(M, 'mg_fire', '#FF5A1E', '#FFE6A0', 6.0)
    b = Builder(M)
    for s in (-1, 1):
        leg(b, (s * 0.78, 2.2, 0), (s * 1.02, 1.25, 0.28), (s * 0.98, 0.45, 0.1), 0.62, 0.46, ROCK)
        b.box(s * 0.98, 0.2, 0.28, 0.75, 0.4, 0.95, ROCK)
        for k in range(3):
            cone(b, (s * (0.75 + k * 0.22), 0.15, 0.7), (s * (0.75 + k * 0.22), 0.05, 1.0), 0.09, HORN, 4)
        for k in range(3):
            b.box(s * (0.9 + 0.12 * k), 1.0 + 0.35 * k, 0.55, 0.05, 0.4, 0.05, LAVA, roll=s * (20 - 15 * k))
    b.sphere(0, 2.95, 0.25, 1.25, ROCK, 14, 8, ry=1.0, rz=1.0)
    b.sphere(0, 3.95, 0.08, 1.72, ROCK, 16, 9, ry=1.12, rz=1.18)
    b.octa(0, 3.85, 1.25, 0.36, 0.5, MAGMA)
    torus(b, (0, 3.85, 1.12), (0, 0.15, 1), 0.48, 0.08, LAVA, 16, 4)
    for k in range(9):
        a = math.radians(-160 + k * 40)
        p0 = (math.cos(a) * 0.5, 3.85 + math.sin(a) * 0.5, 1.12)
        p1 = (math.cos(a) * 1.25, 3.85 + math.sin(a) * 0.95, 0.85)
        tube(b, p0, p1, 0.05, 0.02, LAVA, 4)
    for s in (-1, 1):
        b.sphere(s * 1.78, 4.42, 0, 0.88, ROCK, 12, 7)
        b.box(s * 1.85, 4.95, 0, 1.2, 0.3, 1.25, IRON, roll=s * 12)
        for k in range(3):
            cone(b, (s * (1.45 + 0.35 * k), 5.05, -0.3 + 0.3 * k), (s * (1.6 + 0.45 * k), 5.85 + 0.15 * k, -0.4 + 0.3 * k), 0.17, IRON, 5)
    b.sphere(0, 4.72, 0.95, 0.58, ROCK, 12, 7, ry=0.52)
    b.box(0, 4.42, 1.25, 0.78, 0.34, 0.5, ROCK)
    b.box(0, 4.5, 1.47, 0.52, 0.1, 0.05, LAVA)
    for s in (-1, 1):
        b.box(s * 0.22, 4.82, 1.43, 0.18, 0.07, 0.05, MAGMA)
        cone(b, (s * 0.25, 4.38, 1.48), (s * 0.27, 4.12, 1.5), 0.06, HORN, 4)
        chain(b, [(s * 0.4, 5.02, 0.75), (s * 0.95, 5.6, 0.45), (s * 1.45, 5.4, -0.2), (s * 1.55, 4.75, 0.15), (s * 1.25, 4.45, 0.62)],
              [0.27, 0.22, 0.17, 0.11, 0.05], HORN, 8)
    for k in range(6):
        cone(b, (0, 4.4 - k * 0.42, -1.0 + k * 0.05), (0, 5.2 - k * 0.42, -1.75 + k * 0.05), 0.2, ROCK, 5)
        b.octa(0, 5.2 - k * 0.42, -1.75 + k * 0.05, 0.08, 0.14, LAVA)
    parts = list(b.emit(f'{name}_body'))

    def rarm(ab):
        sh, el, wr = (1.95, 4.3, 0), (2.38, 3.1, 0.5), (2.25, 2.15, 1.02)
        arm(ab, sh, el, wr, 0.58, 0.42, ROCK)
        ab.sphere(wr[0], wr[1] - 0.1, wr[2] + 0.1, 0.48, ROCK, 10, 6)
        tube(ab, (2.25, 0.35, 1.35), (2.25, 4.75, 0.82), 0.12, 0.12, IRON, 8)
        ab.box(2.25, 5.0, 0.8, 1.7, 0.95, 0.95, IRON)
        for x in (1.42, 3.08):
            ab.box(x, 5.0, 0.8, 0.12, 1.05, 1.05, ROCK)
        for k in range(3):
            ab.box(2.25, 4.72 + k * 0.28, 1.29, 1.2, 0.06, 0.03, LAVA)
        ab.box(2.25, 5.0, 1.3, 0.12, 0.6, 0.03, MAGMA)
    rpv = pivot(f'{name}_rarmpv', (1.95, 4.3, 0), part(M, f'{name}_rarm', rarm))
    sway(rpv, 'x', 5)
    parts.append(rpv)

    def larm(ab):
        sh, el, wr = (-1.95, 4.3, 0), (-2.45, 3.2, 0.42), (-2.32, 2.2, 0.92)
        arm(ab, sh, el, wr, 0.58, 0.42, ROCK)
        ab.sphere(wr[0], wr[1] - 0.1, wr[2] + 0.1, 0.48, ROCK, 10, 6)
        torus(ab, lerp(el, wr, 0.75), sub(wr, el), 0.48, 0.1, IRON, 14, 5)
        for k in range(5):
            torus(ab, (-2.32 + 0.05 * k, 1.8 - k * 0.3, 0.95 + 0.05 * k), (1, 0, 0) if k % 2 else (0, 0, 1), 0.15, 0.045, IRON, 10, 4)
    lpv = pivot(f'{name}_larmpv', (-1.95, 4.3, 0), part(M, f'{name}_larm', larm))
    sway(lpv, 'x', 4, phase=7)
    parts.append(lpv)

    def fires(fb):
        for s in (-1, 1):
            for k in range(3):
                flame(fb, (s * (1.5 + 0.4 * k), 5.1, -0.2 + 0.25 * k), 1.0 + 0.3 * (k % 2), 0.22, FIRE, n=3, yaw0=k * 30)
        for k in range(4):
            flame(fb, (0, 5.0 - k * 0.5, -1.4), 0.9, 0.2, FIRE, n=2, yaw0=k * 45, lean=(0, 0, -0.3))
        flame(fb, (0, 4.6, 1.5), 0.5, 0.14, FIRE, n=2)
    fpv = pivot(f'{name}_firepv', (0, 4.8, 0), part(M, f'{name}_fire', fires))
    pulse(fpv, 0.9, 1.1)
    parts.append(fpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, -0.08), (25, 0)])
    shadow(M, 2.0)
    finish(name)


# ════════════════════════════ 600 ZERATH ════════════════════════════
def zerath():
    name = 'boss_zerath'
    M = new_scene()
    SKIN = skin(M, 'zr_skin', '#2E1A5A', 0.6, seed=251, scale=0.7, contrast=0.35)
    ARMOR = M.add('zr_armor', '#B8892A', 0.9, 0.3)
    VOID = M.add('zr_void', '#050208', 0.0, 0.2)
    CRYS = glowmat(M, 'zr_crys', '#B9A8FF', 6)
    STAR = glowmat(M, 'zr_star', '#FFFFFF', 10)
    NEB = M.add('zr_neb', '#6A3AFF', 0.0, 0.4, '#8A6BFF', 2.5, alpha=0.55)
    EYE = glowmat(M, 'zr_eye', '#7FFFE8', 12)
    b = Builder(M)
    tube(b, (0, 2.7, 0), (0, 0.15, -0.15), 0.82, 0.12, SKIN, 14)
    for k in range(8):
        a = 2 * math.pi * k / 8
        p0 = (math.sin(a) * 0.82, 2.55, math.cos(a) * 0.82)
        cone(b, p0, (math.sin(a) * 0.35, 0.7, math.cos(a) * 0.35 - 0.1), 0.2, ARMOR, 4)
    torus(b, (0, 2.68, 0), (0, 1, 0), 0.84, 0.08, ARMOR, 18, 4)
    b.sphere(0, 3.6, 0, 1.0, SKIN, 14, 8, ry=0.78, rz=0.62)
    b.box(0, 3.35, 0.5, 0.9, 0.45, 0.14, ARMOR)
    b.sphere(0, 3.72, 0.58, 0.36, VOID, 12, 7)
    torus(b, (0, 3.72, 0.6), (0, 0.35, 1), 0.52, 0.06, CRYS, 22, 4)
    rays(b, (0, 3.72, 0.62), (0, 0.35, 1), 0.58, 0.95, 10, 0.03, STAR, alt=0.5)
    for s in (-1, 1):
        cone(b, (s * 1.0, 4.18, 0), (s * 2.05, 5.45, -0.32), 0.42, ARMOR, 6)
        cone(b, (s * 0.95, 4.05, 0.1), (s * 1.7, 4.95, 0.35), 0.28, ARMOR, 5)
        b.octa(s * 2.05, 5.45, -0.32, 0.1, 0.16, CRYS)
    tube(b, (0, 4.3, 0), (0, 4.55, 0.1), 0.26, 0.24, SKIN, 10)
    b.sphere(0, 4.82, 0.15, 0.42, SKIN, 12, 7, ry=0.56, rz=0.45)
    b.box(0, 4.52, 0.48, 0.34, 0.16, 0.18, SKIN)
    for s in (-1, 1):
        b.sphere(s * 0.15, 4.95, 0.52, 0.06, EYE, 6, 4)
        b.sphere(s * 0.26, 4.8, 0.48, 0.045, EYE, 6, 4)
    for x, h in ((0, 1.3), (0.22, 1.1), (-0.22, 1.1), (0.4, 0.8), (-0.4, 0.8)):
        cone(b, (x, 5.15, 0.0), (x * 1.6, 5.3 + h * 0.4, -1.3 - h * 0.3), 0.13, ARMOR, 5)
    parts = list(b.emit(f'{name}_body'))
    TL, TR, BL, BR = (-1.0, 4.25, -0.5), (1.0, 4.25, -0.5), (-1.9, 0.3, -1.7), (1.9, 0.3, -1.7)

    def cape(cb):
        sheet(cb, TL, TR, BL, BR, NEB, cols=8, rows=6, bulge=(0, 0, -0.4), tatter=0.3)
        for k in range(16):
            u, t = ((k * 37) % 11) / 10, 0.08 + 0.84 * ((k * 53) % 13) / 12
            p = add(lerp(lerp(TL, TR, u), lerp(BL, BR, u), t), mul((0, 0, -0.4), math.sin(u * math.pi) * math.sin(t * math.pi)))
            cb.octa(p[0], p[1], p[2] - 0.04, 0.04, 0.07, STAR)
    cpv = pivot(f'{name}_capepv', (0, 4.25, -0.5), part(M, f'{name}_cape', cape))
    sway(cpv, 'x', -4, phase=2)
    parts.append(cpv)

    def rarm(ab):
        sh, el, wr = (1.1, 4.1, 0), (1.55, 4.3, 0.45), (1.62, 4.85, 0.9)
        arm(ab, sh, el, wr, 0.25, 0.16, SKIN)
        torus(ab, lerp(sh, el, 0.5), sub(el, sh), 0.27, 0.05, ARMOR, 12, 4)
        ab.sphere(wr[0], wr[1], wr[2], 0.17, SKIN, 8, 5)
        ab.sphere(1.62, 5.32, 0.95, 0.3, STAR, 10, 6)
        rays(ab, (1.62, 5.32, 0.95), (0, 0, 1), 0.32, 0.7, 8, 0.04, CRYS, alt=0.4)
        rays(ab, (1.62, 5.32, 0.95), (1, 0, 0), 0.32, 0.6, 8, 0.04, CRYS, alt=0.4)
    rpv = pivot(f'{name}_rarmpv', (1.1, 4.1, 0), part(M, f'{name}_rarm', rarm))
    sway(rpv, 'z', 4)
    parts.append(rpv)

    def larm(ab):
        sh, el, wr = (-1.1, 4.1, 0), (-1.5, 3.4, 0.45), (-1.4, 3.05, 1.0)
        arm(ab, sh, el, wr, 0.25, 0.16, SKIN)
        torus(ab, lerp(sh, el, 0.5), sub(el, sh), 0.27, 0.05, ARMOR, 12, 4)
        ab.sphere(wr[0], wr[1], wr[2], 0.17, SKIN, 8, 5)
        for k in range(4):
            a = math.radians(-50 + k * 33)
            cone(ab, wr, add(wr, (math.sin(a) * 0.45, -0.1, 0.3 + math.cos(a) * 0.15)), 0.05, ARMOR, 4)
    lpv = pivot(f'{name}_larmpv', (-1.1, 4.1, 0), part(M, f'{name}_larm', larm))
    sway(lpv, 'x', 5, phase=7)
    parts.append(lpv)

    def orbit(ob):
        ob.sphere(3.0, 3.6, 0, 0.42, CRYS, 10, 6)
        torus(ob, (3.0, 3.6, 0), (0.3, 1, 0), 0.62, 0.04, ARMOR, 16, 4)
        ob.sphere(-2.6, 4.4, 1.4, 0.32, VOID, 10, 6)
        torus(ob, (-2.6, 4.4, 1.4), (0, 0.4, 1), 0.42, 0.04, CRYS, 14, 4)
        ob.sphere(0.4, 2.2, -3.0, 0.28, STAR, 8, 5)
        for k in range(20):
            a = 2 * math.pi * k / 20
            ob.octa(math.cos(a) * 3.6, 3.4 + 0.4 * math.sin(a * 3), math.sin(a) * 3.6, 0.09, 0.14, ARMOR if k % 3 else CRYS)
    opv = pivot(f'{name}_orbitpv', (0, 3.5, 0), part(M, f'{name}_orbit', orbit))
    spin(opv, 'y', 1, 1)
    parts.append(opv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.3)
    finish(name)


# ════════════════════════════ 650 YORUMI ════════════════════════════
def yorumi():
    name = 'boss_yorumi'
    M = new_scene()
    FUR = skin(M, 'yo_fur', '#EEF5FF', 0.8, seed=261, scale=0.6, contrast=0.25)
    FUR2 = skin(M, 'yo_fur2', '#BFE4FF', 0.8, seed=262, scale=0.6, contrast=0.3)
    MARK = glowmat(M, 'yo_mark', '#FF3B5A', 3)
    FIRE = fire_mat(M, 'yo_fire', '#4FC8FF', '#F0FFFF', 6.0)
    EYE = glowmat(M, 'yo_eye', '#FFD86A', 12)
    GOLD = M.add('yo_gold', '#E9B949', 0.95, 0.25)
    ROPE = skin(M, 'yo_rope', '#E8DCC0', 0.8, seed=263, scale=0.3, contrast=0.3)
    NOSE = M.add('yo_nose', '#14121A', 0.2, 0.4)
    b = Builder(M)
    b.sphere(0, 2.55, -0.1, 1.05, FUR, 14, 8, ry=0.98, rz=1.95)
    b.sphere(0, 2.45, 1.35, 0.95, FUR, 12, 7, ry=1.05, rz=0.75)
    b.sphere(0, 2.0, 0.2, 0.85, FUR2, 10, 6, ry=0.55, rz=1.4)
    tube(b, (0, 2.95, 1.35), (0, 3.75, 2.1), 0.62, 0.45, FUR, 12)
    b.sphere(0, 4.02, 2.38, 0.56, FUR, 12, 7, ry=0.5, rz=0.62)
    tube(b, (0, 3.88, 2.78), (0, 3.76, 3.5), 0.3, 0.12, FUR, 10)
    b.sphere(0, 3.78, 3.52, 0.09, NOSE, 6, 4)
    b.box(0, 3.62, 3.05, 0.3, 0.08, 0.6, FUR2)
    for s in (-1, 1):
        cone(b, (s * 0.32, 4.3, 2.25), (s * 0.58, 5.35, 1.98), 0.24, FUR, 6)
        cone(b, (s * 0.33, 4.4, 2.33), (s * 0.55, 5.15, 2.1), 0.12, FUR2, 5)
        b.sphere(s * 0.24, 4.1, 2.86, 0.09, EYE, 8, 5, ry=0.05)
        b.box(s * 0.22, 4.25, 2.9, 0.2, 0.035, 0.03, MARK, roll=-s * 25)
        b.box(s * 0.35, 3.85, 2.85, 0.24, 0.03, 0.03, MARK, roll=s * 15)
        for k in range(3):
            cone(b, (s * 0.45, 3.8 - k * 0.15, 2.45), (s * (0.95 + 0.1 * k), 3.6 - k * 0.2, 2.25), 0.12, FUR, 4)
    b.box(0, 4.45, 2.78, 0.06, 0.25, 0.03, MARK)
    for s in (-1, 1):
        leg(b, (s * 0.55, 2.0, 1.3), (s * 0.62, 1.0, 1.42), (s * 0.62, 0.22, 1.58), 0.32, 0.2, FUR)
        b.sphere(s * 0.62, 0.15, 1.7, 0.24, FUR2, 8, 5, ry=0.14)
        b.sphere(s * 0.62, 2.35, -1.3, 0.72, FUR, 10, 6)
        leg(b, (s * 0.65, 2.1, -1.35), (s * 0.78, 1.2, -1.72), (s * 0.66, 0.22, -1.25), 0.42, 0.2, FUR)
        b.sphere(s * 0.66, 0.15, -1.12, 0.25, FUR2, 8, 5, ry=0.14)
    torus(b, (0, 3.15, 1.72), (0, 0.65, 0.75), 0.6, 0.09, ROPE, 18, 5)
    for s in (-1, 0, 1):
        b.sphere(s * 0.42, 2.82, 2.05 - abs(s) * 0.2, 0.11, GOLD, 8, 5)
        b.box(s * 0.25 + 0.1, 2.88, 2.05 - abs(s) * 0.15, 0.08, 0.3, 0.02, ROPE, roll=20)
    parts = list(b.emit(f'{name}_body'))
    for i in range(9):
        fan = math.radians(-96 + i * 24)

        def tail(tb, fan=fan, i=i):
            root = (0, 2.85, -1.75)
            pts = [root]
            for k in range(1, 6):
                t = k / 5
                L = 0.85 * k
                x = math.sin(fan) * L * (0.8 + 0.4 * t)
                y = root[1] + math.cos(fan) * L * 0.75 + 0.95 * t - 0.6 * t * t * abs(math.sin(fan))
                z = root[2] - 0.7 * k + 0.55 * t * t
                pts.append((x, y, z))
            chain(tb, pts, [0.26, 0.42, 0.5, 0.44, 0.3, 0.12], FUR if i % 2 else FUR2, 8)
            flame(tb, pts[-1], 0.9, 0.24, FIRE, n=3, yaw0=i * 20)
        tpv = pivot(f'{name}_tailpv{i}', (0, 2.85, -1.75), part(M, f'{name}_tail{i}', tail))
        sway(tpv, 'z', 6, phase=i * 2.6)
        parts.append(tpv)

    def wisps(wb):
        for k in range(6):
            a = 2 * math.pi * k / 6
            flame(wb, (math.cos(a) * 3.2, 1.4 + 0.6 * (k % 3), math.sin(a) * 3.2), 0.7, 0.2, FIRE, n=3, yaw0=k * 15)
    wpv = pivot(f'{name}_wisppv', (0, 0, 0), part(M, f'{name}_wisp', wisps))
    spin(wpv, 'y', 1, -1)
    bob(wpv, 0.3)
    parts.append(wpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, 0.06), (25, 0)])
    shadow(M, 2.2)
    finish(name)


# ════════════════════════════ 700 THE DROWNED ARMADA ════════════════════════════
def armada():
    name = 'boss_armada'
    M = new_scene()
    WOOD = skin(M, 'ar_wood', '#2E3A33', 0.85, seed=271, scale=0.6, contrast=0.45)
    ROT = skin(M, 'ar_rot', '#1C2420', 0.9, seed=272, scale=0.6, contrast=0.5)
    SAIL = M.add('ar_sail', '#BFFFEA', 0.0, 0.5, '#39FFB0', 1.5, alpha=0.55)
    GHOST = fire_mat(M, 'ar_ghost', '#39FFB0', '#E6FFF4', 5.0)
    MIST = fire_mat(M, 'ar_mist', '#2ADFA0', '#CFFFEA', 3.0, soft=True, opacity=0.6)
    GLOW = glowmat(M, 'ar_glow', '#39FFB0', 9)
    IRON = M.add('ar_iron', '#22262A', 0.85, 0.35)
    BONE = skin(M, 'ar_bone', '#D8D2C0', 0.6, seed=273, scale=0.4, contrast=0.3)
    FLAG = M.add('ar_flag', '#0A0C0C', 0.0, 0.8)
    b = Builder(M)
    st = [(-4.2, 1.35, 1.1, 3.05), (-3.5, 1.62, 1.45, 2.9), (-2.5, 1.82, 1.65, 2.68), (-1.0, 1.88, 1.78, 2.56), (0.5, 1.88, 1.8, 2.55),
          (2.0, 1.72, 1.7, 2.6), (3.2, 1.32, 1.5, 2.76), (4.0, 0.72, 1.2, 2.95), (4.6, 0.08, 0.7, 3.12)]
    J = 8
    vs = []
    for (z, w, d, yd) in st:
        for j in range(J + 1):
            th = -math.pi / 2 + math.pi * j / J
            vs.append((w * math.sin(th), yd - d * math.cos(th), z))
    fs = []
    for i in range(len(st) - 1):
        for j in range(J):
            a = i * (J + 1) + j
            fs.append([a, a + 1, a + J + 2, a + J + 1])
    fs.append([j for j in range(J + 1)])
    b.faces(b.a(WOOD), vs, fs)
    dv = []
    for (z, w, d, yd) in st:
        dv += [(-w, yd, z), (w, yd, z)]
    b.faces(b.a(ROT), dv, [[2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2] for i in range(len(st) - 1)])
    for (z0, z1) in ((-4.2, -0.8), (-0.8, 4.3)):
        for s in (-1, 1):
            pts = [(s * w, yd + 0.35, z) for (z, w, d, yd) in st if z0 <= z <= z1]
            for i in range(len(pts) - 1):
                tube(b, pts[i], pts[i + 1], 0.06, 0.06, WOOD, 5)
    b.box(0, 3.55, -3.35, 3.0, 1.1, 1.7, WOOD)
    b.box(0, 4.15, -3.35, 3.2, 0.1, 1.9, ROT)
    for k in range(4):
        b.box(-1.05 + k * 0.7, 3.55, -4.22, 0.36, 0.5, 0.05, GLOW)
    for k in range(4):
        for s in (-1, 1):
            z = -2.0 + k * 1.4
            m0 = (s * 1.75, 2.0, z)
            m1 = (s * 2.45, 2.05, z)
            tube(b, m0, m1, 0.16, 0.14, IRON, 8)
            disc(b, add(m1, (s * 0.02, 0, 0)), (s, 0, 0), 0.1, GLOW, seg=10)
    tube(b, (0, 3.1, 4.5), (0, 4.2, 6.4), 0.12, 0.06, WOOD, 6)
    b.sphere(0, 2.55, 4.68, 0.42, BONE, 10, 6, ry=0.46)
    b.box(0, 2.18, 4.8, 0.42, 0.18, 0.3, BONE)
    for s in (-1, 1):
        b.sphere(s * 0.15, 2.62, 5.02, 0.09, GLOW, 6, 4)
    for (z, h) in ((2.2, 6.0), (0.0, 7.6), (-2.3, 5.6)):
        tube(b, (0, 2.5, z), (0, 2.5 + h, z), 0.16, 0.1, WOOD, 8)
        for k, yy in enumerate((0.42, 0.75)):
            y = 2.5 + h * yy
            wy = 1.9 - 0.5 * k
            tube(b, (-wy, y, z + 0.1), (wy, y, z + 0.1), 0.07, 0.07, WOOD, 5)
        tube(b, (-1.4, 2.5 + h * 0.95, z), (1.4, 2.5 + h * 0.95, z), 0.05, 0.05, WOOD, 5)
        for s in (-1, 1):
            tube(b, (0, 2.5 + h, z), (s * 1.8, 2.6, z - 0.3), 0.018, 0.018, ROT, 3)
        b.sphere(0, 2.5 + h + 0.05, z, 0.12, GLOW, 6, 4)
    for s in (-1, 1):
        for k in range(3):
            flame(b, (s * 1.6, 3.0, -1.5 + k * 1.8), 0.6, 0.14, GHOST, n=2, yaw0=k * 30)
    for k in range(12):
        a = 2 * math.pi * k / 12
        card(b, (math.cos(a) * 0.9, 1.4, math.sin(a) * 2.8), (math.cos(a) * 1.4, -0.3, math.sin(a) * 3.5), 1.6, MIST, n=1, roll=math.degrees(a))
    parts = list(b.emit(f'{name}_body'))

    def sails(sb):
        for (z, h) in ((2.2, 6.0), (0.0, 7.6), (-2.3, 5.6)):
            y0, y1 = 2.5 + h * 0.42, 2.5 + h * 0.75
            w0, w1 = 1.9, 1.4
            sheet(sb, (-w1, y1, z + 0.14), (w1, y1, z + 0.14), (-w0, y0 + 0.1, z + 0.14), (w0, y0 + 0.1, z + 0.14), SAIL, cols=6, rows=4, bulge=(0, 0, 0.55), tatter=0.35)
            sheet(sb, (-1.35, 2.5 + h * 0.93, z + 0.06), (1.35, 2.5 + h * 0.93, z + 0.06), (-w1, y1 + 0.1, z + 0.06), (w1, y1 + 0.1, z + 0.06), SAIL, cols=5, rows=3, bulge=(0, 0, 0.4), tatter=0.25)
        sheet(sb, (0, 3.2, 4.4), (0, 4.1, 6.2), (0, 2.8, 3.0), (0, 2.9, 3.2), SAIL, cols=3, rows=3, bulge=(0.3, 0, 0), tatter=0.2)
    spv = pivot(f'{name}_sailpv', (0, 3, 0), part(M, f'{name}_sail', sails))
    pulse(spv, 0.98, 1.02)
    parts.append(spv)
    fpv = pivot(f'{name}_flagpv', (0, 10.1, 0), part(M, f'{name}_flag', lambda fb: (
        sheet(fb, (0, 10.1, 0), (0, 10.1, -1.6), (0, 9.2, 0), (0, 9.3, -1.6), FLAG, cols=5, rows=3, bulge=(0.15, 0, 0), tatter=0.15),
        disc(fb, (0.03, 9.7, -0.8), (1, 0, 0), 0.25, GLOW, seg=10))))
    sway(fpv, 'y', 12)
    parts.append(fpv)
    root = pivot(name, (0, 0, 0), parts)
    key_rot3(root, [(k, (2.0 * math.sin(2 * math.pi * (k - 1) / 24 + 1.0), 0, 4.0 * math.sin(2 * math.pi * (k - 1) / 24))) for k in (1, 4, 7, 10, 13, 16, 19, 22, 25)])
    bob(root, 0.25)
    finish(name)


# ════════════════════════════ 750 RAIKOU ════════════════════════════
def raikou():
    name = 'boss_raikou'
    M = new_scene()
    LACQ = M.add('rk_lacq', '#5A0E14', 0.35, 0.3)
    LACQ2 = M.add('rk_lacq2', '#1A0A0C', 0.45, 0.35)
    CORD = M.add('rk_cord', '#FFD02B', 0.2, 0.5, '#AA7A00', 0.4)
    SKIN = skin(M, 'rk_skin', '#A8242A', 0.6, seed=281, scale=0.6, contrast=0.3)
    HORN = skin(M, 'rk_horn', '#E8DCC0', 0.6, seed=282, scale=0.4, contrast=0.35)
    STEEL = M.add('rk_steel', '#D8DEE8', 0.95, 0.15)
    BOLT = glowmat(M, 'rk_bolt', '#FFE45A', 12)
    DRUM = skin(M, 'rk_drum', '#7A3A1A', 0.7, seed=283, scale=0.5, contrast=0.35)
    HEAD = skin(M, 'rk_head', '#E8D8B0', 0.8, seed=284, scale=0.5, contrast=0.2)
    HAKAMA = skin(M, 'rk_hakama', '#16131C', 0.85, seed=285, scale=0.6, contrast=0.3)
    GOLD = M.add('rk_gold', '#E9B949', 0.95, 0.25)
    EYE = glowmat(M, 'rk_eye', '#FFE45A', 14)
    b = Builder(M)
    for s in (-1, 1):
        tube(b, (s * 0.55, 2.35, 0), (s * 0.95, 0.45, 0.12), 0.48, 0.74, HAKAMA, 12)
        b.box(s * 0.95, 0.14, 0.34, 0.46, 0.26, 0.8, LACQ2)
        b.box(s * 0.95, 0.85, 0.66, 0.42, 0.8, 0.08, LACQ, pitch=-8)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        b.box(math.sin(a) * 0.92, 2.25, math.cos(a) * 0.82, 0.62, 0.9, 0.08, LACQ, yaw=math.degrees(a), pitch=-16)
        for j in range(3):
            b.box(math.sin(a) * (0.95 + 0.04 * j), 2.0 + 0.25 * j, math.cos(a) * (0.85 + 0.04 * j), 0.62, 0.025, 0.1, CORD, yaw=math.degrees(a), pitch=-16)
    b.sphere(0, 3.5, 0, 1.06, LACQ, 14, 8, ry=0.88, rz=0.72)
    for k in range(5):
        y = 2.9 + k * 0.25
        rr = 1.0 * math.sqrt(max(0.05, 1 - ((y - 3.5) / 0.88) ** 2))
        torus(b, (0, y, 0), (0, 1, 0), rr * 1.02, 0.03, CORD, 22, 3)
    for s in (-1, 1):
        for k in range(4):
            b.box(s * 1.32, 4.3 - k * 0.3, 0.02, 0.95, 0.28, 0.1, LACQ if k % 2 == 0 else LACQ2, roll=s * 15, yaw=s * 8)
            b.box(s * 1.32, 4.3 - k * 0.3 - 0.14, 0.08, 0.95, 0.025, 0.03, CORD, roll=s * 15, yaw=s * 8)
    tube(b, (0, 4.25, 0), (0, 4.5, 0.05), 0.3, 0.28, SKIN, 10)
    b.sphere(0, 4.98, 0.05, 0.52, LACQ2, 12, 7, ry=0.44)
    for k in range(3):
        skirt(b, 4.95 - k * 0.22, 4.72 - k * 0.22, 0.56 + 0.12 * k, 0.68 + 0.14 * k, LACQ if k % 2 == 0 else LACQ2, gap=1.6, seg=14, z0=0.0)
    for s in (-1, 1):
        b.box(s * 0.55, 4.82, 0.4, 0.06, 0.32, 0.26, LACQ, yaw=s * 30)
        chain(b, [(s * 0.32, 5.25, 0.1), (s * 0.75, 5.75, -0.05), (s * 0.95, 6.35, -0.25)], [0.13, 0.09, 0.02], HORN, 6)
    arc = [(math.sin(t) * 0.95, 5.25 + (1 - math.cos(t)) * 1.0 + 0.1, 0.42 + 0.1 * (1 - math.cos(t))) for t in [-1.25, -0.9, -0.5, 0, 0.5, 0.9, 1.25]]
    for i in range(len(arc) - 1):
        tube(b, arc[i], arc[i + 1], 0.08 if 0 < i < len(arc) - 2 else 0.05, 0.08 if 0 < i < len(arc) - 2 else 0.05, GOLD, 5)
    b.box(0, 4.68, 0.47, 0.5, 0.42, 0.14, LACQ)
    for s in (-1, 1):
        b.box(s * 0.13, 4.8, 0.55, 0.13, 0.05, 0.03, EYE, roll=s * 16)
        cone(b, (s * 0.12, 4.52, 0.55), (s * 0.14, 4.32, 0.58), 0.05, HORN, 4)
        b.box(s * 0.12, 4.62, 0.56, 0.18, 0.05, 0.03, HAKAMA, roll=-s * 20)
    parts = list(b.emit(f'{name}_body'))

    def sword(ab):
        for s, sh, el, wr in ((1, (1.15, 4.15, 0), (1.35, 3.35, 0.55), (0.42, 3.3, 0.95)), (-1, (-1.15, 4.15, 0), (-1.05, 3.25, 0.65), (-0.12, 3.05, 0.95))):
            arm(ab, sh, el, wr, 0.3, 0.2, LACQ)
            ab.sphere(wr[0], wr[1], wr[2], 0.2, SKIN, 8, 5)
        tube(ab, (-0.3, 2.85, 0.92), (0.55, 3.45, 1.0), 0.07, 0.07, CORD, 6)
        torus(ab, (0.6, 3.5, 1.01), (0.85, 0.6, 0.05), 0.2, 0.04, GOLD, 12, 4)
        blade(ab, (0.65, 3.55, 1.02), (2.0, 7.4, 1.62), 0.2, 0.05, STEEL, tip=0.1, side=(0, 0, 1))
        zigzag(ab, (0.8, 4.0, 1.1), (2.0, 7.6, 1.7), 7, 0.25, 0.03, BOLT, seed=5)
        zigzag(ab, (0.75, 3.8, 1.05), (1.6, 6.5, 1.5), 6, 0.3, 0.025, BOLT, seed=9)
    wpv = pivot(f'{name}_swordpv', (0, 4.15, 0), part(M, f'{name}_sword', sword))
    sway(wpv, 'x', 3)
    parts.append(wpv)

    def drums(db):
        c = (0, 4.6, -1.0)
        torus(db, c, (0, 0, 1), 2.25, 0.09, GOLD, 32, 5)
        for k in range(8):
            a = 2 * math.pi * k / 8
            p = add(c, (math.cos(a) * 2.25, math.sin(a) * 2.25, 0))
            tube(db, add(p, (0, 0, -0.22)), add(p, (0, 0, 0.22)), 0.4, 0.4, DRUM, 12)
            disc(db, add(p, (0, 0, 0.23)), (0, 0, 1), 0.36, HEAD, seg=12)
            torus(db, add(p, (0, 0, 0.2)), (0, 0, 1), 0.4, 0.04, GOLD, 12, 3)
            disc(db, add(p, (0, 0, 0.25)), (0, 0, 1), 0.12, LACQ, seg=8)
            q = add(c, (math.cos(a + math.pi / 8) * 2.6, math.sin(a + math.pi / 8) * 2.6, 0.1))
            zigzag(db, p, q, 3, 0.15, 0.03, BOLT, seed=20 + k)
    dpv = pivot(f'{name}_drumpv', (0, 4.6, -1.0), part(M, f'{name}_drum', drums))
    spin(dpv, 'z', 1, 1)
    parts.append(dpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, -0.05), (25, 0)])
    shadow(M, 1.6)
    finish(name)


# ════════════════════════════ 800 OPHANOS ════════════════════════════
def ophanos():
    name = 'boss_ophanos'
    M = new_scene()
    GOLD = M.add('op_gold', '#E9B949', 0.95, 0.22, '#7A5200', 0.6)
    SCL = M.add('op_sclera', '#F8F4EC', 0.0, 0.3, '#FFFFFF', 0.6)
    IRIS = glowmat(M, 'op_iris', '#FFB347', 8)
    PUP = M.add('op_pupil', '#05040A', 0.0, 0.2)
    FIRE = fire_mat(M, 'op_fire', '#FF8A2A', '#FFF6D0', 6.0)
    CORE = glowmat(M, 'op_core', '#FFFFFF', 14)
    FEATH = M.add('op_feather', '#FFFFFF', 0.0, 0.5, '#FFE9C0', 2.0, alpha=0.85)
    C = (0, 3.6, 0)
    parts = []

    def wheel(wb, n, R, r, eyes):
        u, w = basis(n)
        torus(wb, C, n, R, r, GOLD, 40, 6)
        torus(wb, C, n, R - 0.28, r * 0.4, GOLD, 36, 4)
        for i in range(eyes):
            a = 2 * math.pi * i / eyes
            d = add(mul(u, math.cos(a)), mul(w, math.sin(a)))
            p = add(C, mul(d, R))
            look = norm(add(d, mul(norm(n), 0.6)))
            eye(wb, add(p, mul(look, r * 0.6)), look, r * 1.25, SCL, IRIS, PUP)
            q = add(C, mul(d, R - 0.28))
            wb.octa(q[0], q[1], q[2], 0.06, 0.1, CORE)
    for i, (n, R, r, eyes, ax, sg) in enumerate([((0, 0, 1), 3.05, 0.2, 12, 'z', 1), ((1, 0, 0), 2.6, 0.18, 10, 'x', -1), ((0, 1, 0), 2.15, 0.16, 8, 'y', 1)]):
        wpv = pivot(f'{name}_wheelpv{i}', C, part(M, f'{name}_wheel{i}', lambda wb, n=n, R=R, r=r, eyes=eyes: wheel(wb, n, R, r, eyes)))
        spin(wpv, ax, 1, sg)
        parts.append(wpv)

    def core(cb):
        cb.sphere(C[0], C[1], C[2], 0.65, CORE, 12, 7)
        eye(cb, add(C, (0, 0, 0.45)), (0, 0, 1), 0.42, SCL, IRIS, PUP)
        for k in range(14):
            a = 2 * math.pi * k / 14
            el = math.sin(k * 1.3) * 0.7
            d = (math.cos(a) * math.cos(el), math.sin(el), math.sin(a) * math.cos(el))
            card(cb, add(C, mul(d, 0.4)), add(C, mul(d, 1.7 + 0.3 * (k % 3))), 0.75, FIRE, n=2, roll=k * 20)
    cpv = pivot(f'{name}_corepv', C, part(M, f'{name}_core', core))
    pulse(cpv, 0.92, 1.08)
    parts.append(cpv)
    for wi, (dy, span, lift, drop) in enumerate([(0.4, 3.6, 1.0, 0.3), (-0.5, 3.0, 0.2, 1.6)]):
        for s in (-1, 1):
            root = (s * 0.3, C[1] + dy, -0.4)
            wpv = pivot(f'{name}_wingpv{wi}{s}', root, part(M, f'{name}_wing{wi}{s}', lambda wb, root=root, s=s, span=span, lift=lift, drop=drop:
                angel_wing(wb, root, s, span, lift + 0.3, 0.6, FEATH, GOLD, prim=8, sec=5, droop=0.8 + 0.5 * wi, thick=0.05)))
            key_rot(wpv, 'y', [(1, s * 14), (13, -s * 10), (25, s * 14)])
            parts.append(wpv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.35)
    finish(name)


# ════════════════════════════ 850 NYXARA ════════════════════════════
def nyxara():
    name = 'boss_nyxara'
    M = new_scene()
    SKIN = skin(M, 'ny_skin', '#2A1238', 0.55, seed=301, scale=0.6, contrast=0.3)
    DRESS = skin(M, 'ny_dress', '#130816', 0.7, seed=302, scale=0.7, contrast=0.35)
    SMOKE = fire_mat(M, 'ny_smoke', '#5A1A7A', '#C35BFF', 2.0, soft=True, opacity=0.75)
    NFIRE = fire_mat(M, 'ny_fire', '#C35BFF', '#FFE0FF', 6.0)
    GLOW = glowmat(M, 'ny_glow', '#C35BFF', 7)
    GOLD = M.add('ny_gold', '#9A7A3A', 0.9, 0.3)
    MEMB = M.add('ny_memb', '#1A0624', 0.0, 0.5, '#5A1A7A', 1.2, alpha=0.88)
    BONE = M.add('ny_bone', '#120A14', 0.5, 0.4)
    EYE = glowmat(M, 'ny_eye', '#FF5AD2', 14)
    HORN = M.add('ny_horn', '#0E0A10', 0.6, 0.3)
    HAIR = skin(M, 'ny_hair', '#0A0610', 0.6, seed=303, scale=0.4, contrast=0.3)
    VOID = M.add('ny_void', '#020104', 0.0, 0.2)
    b = Builder(M)
    tube(b, (0, 2.95, 0), (0, 0.85, -0.1), 0.52, 1.35, DRESS, 18)
    for k in range(10):
        a = 2 * math.pi * k / 10
        card(b, (math.sin(a) * 1.05, 1.15, math.cos(a) * 1.05 - 0.1), (math.sin(a) * 1.55, -0.2, math.cos(a) * 1.55 - 0.3), 1.0, SMOKE, n=1, roll=math.degrees(a) + 90)
    b.sphere(0, 3.45, 0, 0.56, DRESS, 12, 7, ry=0.7, rz=0.42)
    for y in (3.0, 3.3, 3.6):
        torus(b, (0, y, 0.02), (0, 1, 0), 0.52 - 0.08 * abs(y - 3.3), 0.025, GOLD, 18, 3)
    b.octa(0, 3.75, 0.42, 0.12, 0.2, GLOW)
    for s in (-1, 1):
        b.sphere(s * 0.5, 4.02, 0, 0.24, SKIN, 8, 5)
        for k in range(3):
            cone(b, (s * (0.45 + 0.08 * k), 4.15, -0.1 + 0.1 * k), (s * (0.75 + 0.2 * k), 4.75 - 0.1 * k, -0.3 + 0.1 * k), 0.07, HORN, 4)
    tube(b, (0, 4.05, 0), (0, 4.3, 0.04), 0.14, 0.12, SKIN, 8)
    b.sphere(0, 4.58, 0.06, 0.29, SKIN, 12, 7, ry=0.36)
    for s in (-1, 1):
        b.box(s * 0.1, 4.62, 0.33, 0.1, 0.035, 0.03, EYE, roll=-s * 12)
    b.box(0, 4.42, 0.33, 0.1, 0.03, 0.02, GLOW)
    for k in range(7):
        a = math.radians(-75 + k * 25)
        L = 0.9 + 0.5 * math.cos(a * 1.4)
        cone(b, (math.sin(a) * 0.22, 4.78, 0.05 + math.cos(a) * 0.08), (math.sin(a) * 0.55, 4.78 + L, -0.25), 0.07, HORN, 4)
    for s in (-1, 1):
        chain(b, [(s * 0.25, 4.75, -0.05), (s * 0.75, 5.25, -0.25), (s * 1.0, 5.9, -0.6), (s * 0.85, 6.4, -1.0)], [0.12, 0.09, 0.06, 0.02], HORN, 6)
    for k in range(6):
        x = -0.25 + k * 0.1
        sheet(b, (x - 0.06, 4.75, -0.2), (x + 0.06, 4.75, -0.2), (x * 1.6 - 0.08, 3.0, -0.65), (x * 1.6 + 0.08, 3.0, -0.65), HAIR, cols=2, rows=3, bulge=(0, 0, -0.15))
    parts = list(b.emit(f'{name}_body'))
    for s in (-1, 1):
        root = (s * 0.25, 4.0, -0.32)
        wpv = pivot(f'{name}_wingpv{s}', root, part(M, f'{name}_wing{s}', lambda wb, root=root, s=s: bat_wing(wb, root, s, 5.2, 1.7, 2.3, 0.85, MEMB, BONE, fingers=4, r=0.09, claw=HORN)))
        key_rot(wpv, 'y', [(1, s * 14), (13, -s * 16), (25, s * 14)])
        parts.append(wpv)

    def rarm(ab):
        sh, el, wr = (0.55, 4.05, 0), (0.95, 3.42, 0.25), (1.05, 2.92, 0.62)
        arm(ab, sh, el, wr, 0.14, 0.1, SKIN)
        torus(ab, lerp(el, wr, 0.6), sub(wr, el), 0.11, 0.025, GOLD, 10, 3)
        ab.sphere(wr[0], wr[1], wr[2], 0.1, SKIN, 6, 4)
        tube(ab, (1.05, 1.35, 0.72), (1.05, 4.6, 0.56), 0.05, 0.05, GOLD, 6)
        ab.sphere(1.05, 4.92, 0.55, 0.3, VOID, 10, 6)
        torus(ab, (1.05, 4.92, 0.55), (0.2, 1, 0.4), 0.42, 0.04, GLOW, 18, 4)
        for k in range(4):
            a = 2 * math.pi * k / 4
            cone(ab, (1.05 + math.cos(a) * 0.12, 4.62, 0.55 + math.sin(a) * 0.12), (1.05 + math.cos(a) * 0.32, 5.2, 0.55 + math.sin(a) * 0.32), 0.04, GOLD, 4)
    rpv = pivot(f'{name}_rarmpv', (0.55, 4.05, 0), part(M, f'{name}_rarm', rarm))
    sway(rpv, 'x', 4)
    parts.append(rpv)

    def larm(ab):
        sh, el, wr = (-0.55, 4.05, 0), (-1.08, 4.3, 0.4), (-1.3, 4.9, 0.72)
        arm(ab, sh, el, wr, 0.14, 0.1, SKIN)
        ab.sphere(wr[0], wr[1], wr[2], 0.1, SKIN, 6, 4)
        flame(ab, (-1.3, 4.98, 0.74), 0.85, 0.2, NFIRE, n=3)
    lpv = pivot(f'{name}_larmpv', (-0.55, 4.05, 0), part(M, f'{name}_larm', larm))
    sway(lpv, 'z', -5, phase=6)
    parts.append(lpv)

    def crystals(cb):
        for k in range(6):
            a = 2 * math.pi * k / 6
            cb.octa(math.cos(a) * 2.5, 2.2 + 1.2 * (k % 3), math.sin(a) * 2.5, 0.16, 0.38, GLOW if k % 2 else HORN)
    opv = pivot(f'{name}_crystalpv', (0, 0, 0), part(M, f'{name}_crystal', crystals))
    spin(opv, 'y', 1, -1)
    parts.append(opv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.28)
    finish(name)


# ════════════════════════════ 900 ASURAKH ════════════════════════════
def asurakh():
    name = 'boss_asurakh'
    M = new_scene()
    SKIN = skin(M, 'as_skin', '#A4432A', 0.55, seed=311, scale=0.7, contrast=0.3)
    GOLD = M.add('as_gold', '#E9B949', 0.95, 0.22)
    CLOTH = skin(M, 'as_cloth', '#E07A1A', 0.75, seed=312, scale=0.6, contrast=0.35)
    SASH = skin(M, 'as_sash', '#8A1A2A', 0.75, seed=313, scale=0.5, contrast=0.35)
    STEEL = M.add('as_steel', '#D0D6E0', 0.95, 0.18)
    FIRE = fire_mat(M, 'as_fire', '#FF6A2A', '#FFF0B0', 6.0)
    JEWEL = glowmat(M, 'as_jewel', '#3FE6FF', 8)
    EYE = glowmat(M, 'as_eye', '#FFE9A8', 12)
    HAIR = skin(M, 'as_hair', '#14100E', 0.6, seed=314, scale=0.4, contrast=0.3)
    WOOD = skin(M, 'as_wood', '#5A3A1E', 0.7, seed=315, scale=0.4, contrast=0.3)
    b = Builder(M)
    for s in (-1, 1):
        tube(b, (s * 0.5, 2.45, 0), (s * 0.78, 1.25, 0.15), 0.52, 0.42, CLOTH, 12)
        b.sphere(s * 0.78, 1.25, 0.15, 0.42, CLOTH, 8, 5)
        tube(b, (s * 0.78, 1.2, 0.15), (s * 0.82, 0.3, 0.05), 0.32, 0.22, SKIN, 10)
        torus(b, (s * 0.82, 0.38, 0.05), (0, 1, 0), 0.24, 0.05, GOLD, 12, 4)
        b.box(s * 0.82, 0.1, 0.25, 0.36, 0.2, 0.62, SKIN)
    b.sphere(0, 2.55, 0, 0.82, CLOTH, 12, 6, ry=0.45, rz=0.55)
    torus(b, (0, 2.85, 0), (0, 1, 0), 0.7, 0.1, SASH, 18, 5)
    b.sphere(0, 3.25, 0.05, 0.7, SKIN, 12, 7, ry=0.6, rz=0.5)
    b.sphere(0, 4.0, 0, 1.15, SKIN, 14, 8, ry=0.68, rz=0.6)
    for s in (-1, 1):
        b.sphere(s * 0.48, 4.08, 0.42, 0.48, SKIN, 10, 6, ry=0.32, rz=0.24)
    tube(b, (-0.9, 4.45, 0.3), (0.65, 2.9, 0.62), 0.1, 0.1, SASH, 6)
    torus(b, (0, 4.5, 0.15), (0, 1, 0.35), 0.55, 0.05, GOLD, 18, 4)
    b.octa(0, 4.2, 0.72, 0.1, 0.16, JEWEL)
    tube(b, (0, 4.45, 0), (0, 4.8, 0.06), 0.34, 0.3, SKIN, 10)
    b.sphere(0, 5.12, 0.12, 0.42, SKIN, 12, 7, ry=0.47)
    for s in (-1, 1):
        b.box(s * 0.14, 5.18, 0.5, 0.13, 0.05, 0.03, EYE, roll=-s * 15)
        b.sphere(s * 0.38, 5.06, -0.02, 0.33, SKIN, 10, 6, ry=0.4)
        b.box(s * 0.68, 5.12, 0.02, 0.03, 0.05, 0.12, EYE)
    b.box(0, 5.32, 0.52, 0.05, 0.1, 0.03, JEWEL)
    b.box(0, 4.92, 0.5, 0.18, 0.04, 0.03, HAIR)
    for k in range(3):
        b.cyl(0, 5.45 + k * 0.32, 0.05, 0.52 - k * 0.1, 0.32, GOLD, seg=12, r_top=0.46 - k * 0.1)
    b.octa(0, 6.6, 0.05, 0.18, 0.4, JEWEL)
    for k in range(7):
        a = math.radians(-70 + k * 23)
        cone(b, (math.sin(a) * 0.45, 5.6, 0.05 + math.cos(a) * 0.4), (math.sin(a) * 0.62, 6.2, 0.05 + math.cos(a) * 0.55), 0.06, GOLD, 4)
    parts = list(b.emit(f'{name}_body'))
    arms = [
        (1, (1.12, 4.55, 0), (1.95, 5.3, 0.1), (2.32, 6.15, 0.32), 'sword'),
        (-1, (-1.12, 4.55, 0), (-1.95, 5.3, 0.1), (-2.32, 6.15, 0.32), 'chakram'),
        (1, (1.18, 4.22, 0), (2.02, 3.92, 0.42), (2.82, 3.95, 0.82), 'axe'),
        (-1, (-1.18, 4.22, 0), (-2.02, 3.92, 0.42), (-2.82, 3.95, 0.82), 'mace'),
        (1, (1.02, 3.92, 0.12), (1.52, 3.2, 0.62), (1.42, 2.82, 1.3), 'spear'),
        (-1, (-1.02, 3.92, 0.12), (-1.52, 3.2, 0.62), (-1.42, 2.82, 1.3), 'flame'),
    ]
    for i, (s, sh, el, wr, wpn) in enumerate(arms):
        def mk(ab, s=s, sh=sh, el=el, wr=wr, wpn=wpn):
            ab.sphere(sh[0], sh[1], sh[2], 0.34, SKIN, 8, 5)
            arm(ab, sh, el, wr, 0.3, 0.2, SKIN)
            torus(ab, lerp(sh, el, 0.6), sub(el, sh), 0.29, 0.05, GOLD, 12, 4)
            torus(ab, lerp(el, wr, 0.8), sub(wr, el), 0.22, 0.04, GOLD, 12, 4)
            ab.sphere(wr[0], wr[1], wr[2], 0.22, SKIN, 8, 5)
            if wpn == 'sword':
                torus(ab, add(wr, (0, 0.2, 0)), (0, 1, 0.1), 0.18, 0.04, GOLD, 10, 4)
                blade(ab, add(wr, (0, 0.22, 0)), add(wr, (0.25, 2.6, 0.25)), 0.3, 0.06, STEEL, tip=0.15, side=(0, 0, 1))
            elif wpn == 'chakram':
                c = add(wr, (-0.2, 0.55, 0.15))
                torus(ab, c, (0, 0.3, 1), 0.55, 0.06, STEEL, 24, 4)
                rays(ab, c, (0, 0.3, 1), 0.58, 0.85, 12, 0.06, STEEL)
                disc(ab, c, (0, 0.3, 1), 0.16, JEWEL, seg=10)
            elif wpn == 'axe':
                tube(ab, add(wr, (0, -1.0, 0.05)), add(wr, (0, 1.3, -0.05)), 0.07, 0.07, WOOD, 6)
                top = add(wr, (0, 1.15, -0.05))
                ab.faces(ab.a(STEEL), [add(top, (0, 0.35, 0)), add(top, (0.75, 0.6, 0)), add(top, (0.85, -0.25, 0)), add(top, (0, -0.25, 0))], [[0, 1, 2, 3], [3, 2, 1, 0]])
            elif wpn == 'mace':
                tube(ab, add(wr, (0, -0.6, 0)), add(wr, (0, 1.0, 0)), 0.08, 0.08, GOLD, 6)
                c = add(wr, (0, 1.25, 0))
                ab.sphere(c[0], c[1], c[2], 0.36, GOLD, 10, 6)
                for k in range(8):
                    a = 2 * math.pi * k / 8
                    d = (math.cos(a), 0.35 * (1 if k % 2 else -1), math.sin(a))
                    cone(ab, add(c, mul(norm(d), 0.3)), add(c, mul(norm(d), 0.62)), 0.08, STEEL, 4)
            elif wpn == 'spear':
                tube(ab, add(wr, (0, -1.2, -0.3)), add(wr, (0, 2.6, 0.7)), 0.06, 0.06, WOOD, 6)
                blade(ab, add(wr, (0, 2.6, 0.7)), add(wr, (0, 3.5, 0.95)), 0.24, 0.05, STEEL, tip=0.5, side=(1, 0, 0))
                torus(ab, add(wr, (0, 2.6, 0.7)), (0, 1, 0.26), 0.1, 0.035, GOLD, 10, 4)
            else:
                flame(ab, add(wr, (0, 0.15, 0.05)), 0.85, 0.24, FIRE, n=3)
        apv = pivot(f'{name}_armpv{i}', sh, part(M, f'{name}_arm{i}', mk))
        sway(apv, 'z' if i < 4 else 'x', 5 * s if i < 4 else 4, phase=i * 4)
        parts.append(apv)

    def halo(hb):
        c = (0, 4.95, -0.95)
        torus(hb, c, (0, 0, 1), 2.6, 0.12, GOLD, 40, 5)
        torus(hb, c, (0, 0, 1), 2.25, 0.05, GOLD, 36, 4)
        for k in range(20):
            a = 2 * math.pi * k / 20
            p = add(c, (math.cos(a) * 2.6, math.sin(a) * 2.6, 0))
            card(hb, add(c, (math.cos(a) * 2.5, math.sin(a) * 2.5, 0)), add(c, (math.cos(a) * (3.55 + 0.3 * (k % 2)), math.sin(a) * (3.55 + 0.3 * (k % 2)), 0)), 0.62, FIRE, n=1, face=(0, 0, 1))
    hpv = pivot(f'{name}_halopv', (0, 4.95, -0.95), part(M, f'{name}_halo', halo))
    spin(hpv, 'z', 1, -1)
    parts.append(hpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, -0.06), (25, 0)])
    shadow(M, 1.7)
    finish(name)


# ════════════════════════════ 950 KHRONOS ════════════════════════════
def khronos():
    name = 'boss_khronos'
    M = new_scene()
    ROBE = skin(M, 'kh_robe', '#141C34', 0.75, seed=321, scale=0.7, contrast=0.35)
    TRIM = M.add('kh_trim', '#C9A24A', 0.9, 0.28)
    GLASS = M.add('kh_glass', '#DFF6FF', 0.1, 0.05, '#BFE8FF', 0.4, alpha=0.35)
    SAND = glowmat(M, 'kh_sand', '#FFD86A', 4)
    FACE = M.add('kh_face', '#F2E8D0', 0.0, 0.4, '#FFF2D0', 1.2)
    HANDS = M.add('kh_hands', '#1A1410', 0.6, 0.3)
    VOID = M.add('kh_void', '#020205', 0.0, 0.2)
    CYAN = glowmat(M, 'kh_cyan', '#7FD8FF', 8)
    GEAR = M.add('kh_gear', '#B8892A', 0.9, 0.3)
    b = Builder(M)
    tube(b, (0, 4.4, 0), (0, 0.45, -0.1), 0.98, 0.25, ROBE, 18)
    for k in range(9):
        a = 2 * math.pi * k / 9
        cone(b, (math.sin(a) * 0.4, 0.7, math.cos(a) * 0.4 - 0.1), (math.sin(a) * 0.5, 0.0, math.cos(a) * 0.5 - 0.15), 0.18, ROBE, 4)
    for y in (1.4, 2.4, 3.4):
        rr = 0.98 - (4.4 - y) / 3.95 * 0.73
        torus(b, (0, y, -0.05), (0, 1, 0.02), rr * 1.01, 0.03, TRIM, 22, 3)
    b.sphere(0, 4.62, 0, 1.32, ROBE, 14, 8, ry=0.56, rz=0.78)
    torus(b, (0, 4.85, 0), (0, 1, 0), 0.95, 0.09, TRIM, 22, 4)
    b.sphere(0, 5.42, -0.05, 0.68, ROBE, 12, 7, ry=0.78, rz=0.7)
    b.sphere(0, 5.32, 0.25, 0.48, VOID, 10, 6)
    disc(b, (0, 5.32, 0.7), (0, 0, 1), 0.38, FACE, seg=24)
    torus(b, (0, 5.32, 0.7), (0, 0, 1), 0.39, 0.035, TRIM, 24, 4)
    for k in range(12):
        a = 2 * math.pi * k / 12
        b.box(math.cos(a) * 0.31, 5.32 + math.sin(a) * 0.31, 0.72, 0.035 if k % 3 else 0.06, 0.07, 0.02, HANDS, roll=-math.degrees(a) + 90)
    hc = (0, 3.75, 1.05)
    for dy in (-0.55, 0.55):
        b.cyl(hc[0], hc[1] + dy - 0.05, hc[2], 0.42, 0.1, TRIM, seg=12)
    for k in range(4):
        a = 2 * math.pi * k / 4 + math.pi / 4
        tube(b, (math.cos(a) * 0.38, hc[1] - 0.5, hc[2] + math.sin(a) * 0.38), (math.cos(a) * 0.38, hc[1] + 0.5, hc[2] + math.sin(a) * 0.38), 0.04, 0.04, TRIM, 5)
    tube(b, (hc[0], hc[1] - 0.5, hc[2]), (hc[0], hc[1], hc[2]), 0.33, 0.04, GLASS, 12)
    tube(b, (hc[0], hc[1], hc[2]), (hc[0], hc[1] + 0.5, hc[2]), 0.04, 0.33, GLASS, 12)
    tube(b, (hc[0], hc[1] - 0.48, hc[2]), (hc[0], hc[1] - 0.25, hc[2]), 0.28, 0.1, SAND, 10)
    tube(b, (hc[0], hc[1] + 0.1, hc[2]), (hc[0], hc[1] + 0.35, hc[2]), 0.05, 0.2, SAND, 10)
    tube(b, (hc[0], hc[1] + 0.1, hc[2]), (hc[0], hc[1] - 0.25, hc[2]), 0.015, 0.015, SAND, 4)
    parts = list(b.emit(f'{name}_body'))
    for i, (turns, L, w) in enumerate([(2, 0.3, 0.035), (1, 0.21, 0.05)]):
        hpv = pivot(f'{name}_facehand{i}', (0, 5.32, 0.73), part(M, f'{name}_facehand{i}', lambda hb, L=L, w=w: hb.box(0, 5.32 + L / 2, 0.74 + 0.01 * w, w, L, 0.02, HANDS)))
        spin(hpv, 'z', turns, -1)
        parts.append(hpv)

    def rarm(ab):
        sh, el, wr = (1.25, 4.62, 0), (1.62, 3.85, 0.4), (1.52, 3.4, 0.85)
        tube(ab, sh, el, 0.34, 0.4, ROBE, 10)
        tube(ab, el, wr, 0.4, 0.5, ROBE, 10)
        torus(ab, wr, sub(wr, el), 0.5, 0.04, TRIM, 14, 3)
        ab.sphere(1.52, 3.4, 0.95, 0.16, HANDS, 6, 4)
        tube(ab, (1.52, 0.6, 1.05), (1.52, 6.6, 0.85), 0.07, 0.07, TRIM, 6)
        ab.sphere(1.52, 6.62, 0.85, 0.16, CYAN, 8, 5)
        blade(ab, (1.48, 6.55, 0.86), (-0.15, 7.05, 0.95), 0.32, 0.05, TRIM, tip=0.25, side=(0, 0, 1))
        ab.box(0.65, 6.86, 0.92, 1.2, 0.04, 0.06, CYAN, roll=-17)
    rpv = pivot(f'{name}_rarmpv', (1.25, 4.62, 0), part(M, f'{name}_rarm', rarm))
    sway(rpv, 'x', 4)
    parts.append(rpv)

    def larm(ab):
        sh, el, wr = (-1.25, 4.62, 0), (-1.75, 4.2, 0.45), (-1.9, 4.6, 0.95)
        tube(ab, sh, el, 0.34, 0.4, ROBE, 10)
        tube(ab, el, wr, 0.4, 0.48, ROBE, 10)
        torus(ab, wr, sub(wr, el), 0.48, 0.04, TRIM, 14, 3)
        ab.sphere(-1.9, 4.72, 1.02, 0.16, HANDS, 6, 4)
        torus(ab, (-1.9, 5.15, 1.05), (0, 1, 0.2), 0.35, 0.025, CYAN, 18, 3)
        ab.sphere(-1.9, 5.15, 1.05, 0.12, CYAN, 8, 5)
    lpv = pivot(f'{name}_larmpv', (-1.25, 4.62, 0), part(M, f'{name}_larm', larm))
    sway(lpv, 'z', -4, phase=7)
    parts.append(lpv)
    cc = (0, 5.25, -0.95)
    cpv = pivot(f'{name}_clockpv', cc, part(M, f'{name}_clock', lambda cb: (
        disc(cb, cc, (0, 0, 1), 2.65, FACE, seg=40, R0=2.15),
        torus(cb, cc, (0, 0, 1), 2.68, 0.08, TRIM, 44, 5),
        torus(cb, cc, (0, 0, 1), 2.12, 0.05, TRIM, 40, 4),
        [cb.box(cc[0] + math.cos(2 * math.pi * k / 12) * 2.4, cc[1] + math.sin(2 * math.pi * k / 12) * 2.4, cc[2] + 0.06, 0.12 if k % 3 else 0.2, 0.38, 0.05, HANDS, roll=-math.degrees(2 * math.pi * k / 12) + 90) for k in range(12)],
        disc(cb, cc, (0, 0, 1), 0.3, CYAN, seg=16))))
    key_rot(cpv, 'z', [(1, 0), (13, 6), (25, 0)])
    parts.append(cpv)
    for i, (turns, L, w) in enumerate([(2, 2.2, 0.1), (1, 1.5, 0.16)]):
        hpv = pivot(f'{name}_handpv{i}', cc, part(M, f'{name}_hand{i}', lambda hb, L=L, w=w, i=i: (
            hb.box(cc[0], cc[1] + L / 2 - 0.2, cc[2] + 0.12 + 0.04 * i, w, L, 0.05, HANDS),
            cone(hb, (cc[0], cc[1] + L - 0.2, cc[2] + 0.12 + 0.04 * i), (cc[0], cc[1] + L + 0.15, cc[2] + 0.12 + 0.04 * i), w * 1.4, HANDS, 4))))
        spin(hpv, 'z', turns, -1)
        parts.append(hpv)
    for i, (gc, R, teeth, sg) in enumerate([((1.85, 6.45, -0.6), 0.85, 12, 1), ((-2.05, 4.0, -0.55), 0.62, 10, -1), ((2.25, 3.0, -0.4), 0.45, 8, -1)]):
        gpv = pivot(f'{name}_gearpv{i}', gc, part(M, f'{name}_gear{i}', lambda gb, gc=gc, R=R, teeth=teeth: gear(gb, gc, (0, 0, 1), R, 0.12, teeth, GEAR)))
        spin(gpv, 'z', 1, sg)
        parts.append(gpv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.25)
    finish(name)


# ════════════════════════════ 1000 MORTHAEL ════════════════════════════
def morthael():
    name = 'boss_morthael'
    M = new_scene()
    ARMOR = M.add('mo_armor', '#141016', 0.75, 0.32)
    PLATE = skin(M, 'mo_plate', '#24181E', 0.5, seed=331, scale=0.6, contrast=0.4)
    RUNE = glowmat(M, 'mo_rune', '#FF2A3D', 8)
    GOLD = M.add('mo_gold', '#9A6A2A', 0.9, 0.3)
    CAPE = skin(M, 'mo_cape', '#4A0A12', 0.8, seed=332, scale=0.7, contrast=0.4)
    MEMB = M.add('mo_memb', '#2A0608', 0.0, 0.5, '#8A0A1A', 1.2, alpha=0.92)
    BONE = M.add('mo_bone', '#120C0E', 0.6, 0.35)
    FIRE = fire_mat(M, 'mo_fire', '#FF3A1A', '#FFD8A0', 6.0)
    EYE = glowmat(M, 'mo_eye', '#FF2A3D', 16)
    VOID = M.add('mo_void', '#030203', 0.0, 0.2)
    b = Builder(M)
    for s in (-1, 1):
        leg(b, (s * 0.45, 2.4, 0), (s * 0.55, 1.35, 0.1), (s * 0.52, 0.45, -0.05), 0.38, 0.26, ARMOR)
        cone(b, (s * 0.55, 1.35, 0.3), (s * 0.6, 1.5, 0.85), 0.14, BONE, 4)
        b.box(s * 0.52, 0.2, 0.12, 0.42, 0.32, 0.7, PLATE)
        for k in range(3):
            cone(b, (s * (0.4 + 0.12 * k), 0.12, 0.45), (s * (0.4 + 0.12 * k), 0.02, 0.72), 0.06, BONE, 4)
        b.box(s * 0.62, 1.8, 0.32, 0.05, 0.5, 0.04, RUNE, roll=s * 8)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        b.box(math.sin(a) * 0.85, 2.3, math.cos(a) * 0.72, 0.6, 0.85, 0.07, PLATE, yaw=math.degrees(a), pitch=-14)
        b.box(math.sin(a) * 0.9, 1.9, math.cos(a) * 0.77, 0.6, 0.04, 0.09, RUNE, yaw=math.degrees(a), pitch=-14)
    b.sphere(0, 3.75, 0, 1.25, ARMOR, 14, 8, ry=0.95, rz=0.78)
    b.box(0, 3.6, 0.62, 1.05, 1.1, 0.2, PLATE)
    for s in (-1, 1):
        b.box(s * 0.28, 3.75, 0.74, 0.05, 0.85, 0.04, RUNE, roll=s * 22)
    b.octa(0, 3.85, 0.82, 0.18, 0.3, RUNE)
    torus(b, (0, 3.85, 0.78), (0, 0, 1), 0.27, 0.04, GOLD, 14, 4)
    for s in (-1, 1):
        b.sphere(s * 1.35, 4.5, 0, 0.66, ARMOR, 12, 7, ry=0.52)
        torus(b, (s * 1.35, 4.32, 0), (s * 0.4, 1, 0), 0.62, 0.06, GOLD, 16, 4)
        for k in range(3):
            cone(b, (s * (1.2 + 0.25 * k), 4.85, -0.25 + 0.25 * k), (s * (1.5 + 0.45 * k), 6.0 - 0.2 * k, -0.5 + 0.25 * k), 0.17, BONE, 5)
        b.sphere(s * 1.55, 4.25, 0.5, 0.2, BONE, 8, 5)
        b.box(s * 1.55, 4.28, 0.68, 0.14, 0.05, 0.03, RUNE)
    tube(b, (0, 4.5, 0), (0, 4.75, 0.05), 0.3, 0.28, ARMOR, 10)
    b.sphere(0, 5.08, 0.1, 0.5, ARMOR, 12, 7, ry=0.56)
    b.box(0, 5.0, 0.52, 0.48, 0.3, 0.1, VOID)
    for s in (-1, 1):
        b.box(s * 0.13, 5.06, 0.58, 0.14, 0.05, 0.03, EYE, roll=-s * 18)
        chain(b, [(s * 0.35, 5.38, 0.05), (s * 0.9, 5.95, -0.2), (s * 1.38, 6.65, -0.5), (s * 1.48, 7.45, -0.95)], [0.24, 0.18, 0.1, 0.03], BONE, 8)
    for k in range(9):
        a = 2 * math.pi * k / 9
        cone(b, (math.sin(a) * 0.4, 5.48, 0.1 + math.cos(a) * 0.36), (math.sin(a) * 0.46, 5.85 + 0.15 * (k % 2), 0.1 + math.cos(a) * 0.42), 0.06, GOLD, 4)
    for k in range(6):
        flame(b, (math.cos(k) * 0.4, 0.2, math.sin(k) * 0.4 - 0.1), -1.0 - 0.3 * (k % 2), 0.25, FIRE, n=2, yaw0=k * 30)
    parts = list(b.emit(f'{name}_body'))
    for s in (-1, 1):
        root = (s * 0.35, 4.6, -0.55)
        wpv = pivot(f'{name}_wingpv{s}', root, part(M, f'{name}_wing{s}', lambda wb, root=root, s=s: bat_wing(wb, root, s, 6.2, 2.3, 2.7, 1.1, MEMB, BONE, fingers=5, r=0.13, claw=BONE)))
        key_rot(wpv, 'y', [(1, s * 12), (13, -s * 16), (25, s * 12)])
        parts.append(wpv)
    cpv = pivot(f'{name}_capepv', (0, 4.55, -0.6), part(M, f'{name}_cape', lambda cb: sheet(
        cb, (-1.1, 4.55, -0.62), (1.1, 4.55, -0.62), (-1.6, 0.4, -1.4), (1.6, 0.4, -1.4), CAPE, cols=8, rows=6, bulge=(0, 0, -0.3), tatter=0.45)))
    sway(cpv, 'x', -4, phase=3)
    parts.append(cpv)

    def sword(ab):
        for s in (-1, 1):
            sh, el, wr = (s * 1.25, 4.3, 0), (s * 1.05, 3.5, 0.62), (s * 0.24, 3.45, 1.18)
            arm(ab, sh, el, wr, 0.34, 0.22, ARMOR)
            torus(ab, lerp(el, wr, 0.75), sub(wr, el), 0.27, 0.05, GOLD, 12, 4)
            ab.sphere(wr[0], wr[1], wr[2], 0.22, PLATE, 8, 5)
        ab.octa(0, 3.82, 1.24, 0.16, 0.26, RUNE)
        tube(ab, (0, 3.62, 1.24), (0, 3.05, 1.26), 0.08, 0.08, BONE, 6)
        tube(ab, (-0.9, 3.0, 1.26), (0.9, 3.0, 1.26), 0.1, 0.1, GOLD, 6)
        for s in (-1, 1):
            cone(ab, (s * 0.9, 3.0, 1.26), (s * 1.05, 2.55, 1.28), 0.12, BONE, 4)
        blade(ab, (0, 2.95, 1.27), (0, -0.4, 1.35), 0.55, 0.1, PLATE, tip=0.12, side=(0, 0, 1))
        ab.box(0, 1.3, 1.33, 0.07, 3.0, 0.04, RUNE)
        for k in range(6):
            p = (0.3 if k % 2 else -0.3, 2.6 - k * 0.5, 1.3)
            flame(ab, p, 0.55, 0.11, FIRE, n=2, yaw0=k * 50)
    spv = pivot(f'{name}_swordpv', (0, 4.3, 0), part(M, f'{name}_sword', sword))
    sway(spv, 'x', 2)
    parts.append(spv)

    def gems(gb):
        for k in range(4):
            a = 2 * math.pi * k / 4
            gb.octa(math.cos(a) * 2.6, 3.4 + 0.6 * (k % 2), math.sin(a) * 2.6, 0.2, 0.42, RUNE)
            flame(gb, (math.cos(a) * 2.6, 3.0 + 0.6 * (k % 2), math.sin(a) * 2.6), 0.5, 0.12, FIRE, n=2)
    gpv = pivot(f'{name}_gempv', (0, 0, 0), part(M, f'{name}_gem', gems))
    spin(gpv, 'y', 1, 1)
    parts.append(gpv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.25)
    finish(name)


# ════════════════════════════ 1111 THE ALMIGHTY ════════════════════════════
def almighty():
    name = 'boss_almighty'
    M = new_scene()
    LIGHT = glowmat(M, 'al_light', '#FFFFFF', 7.0)
    ROBE = M.add('al_robe', '#FFF8EA', 0.0, 0.35, '#FFF2D6', 2.2)
    ROBE2 = M.add('al_robe2', '#FFE9C0', 0.0, 0.4, '#FFD9A0', 1.4)
    GOLD = M.add('al_gold', '#FFD86A', 0.95, 0.2, '#C08A20', 1.2)
    HALO = glowmat(M, 'al_halo', '#FFE9A8', 9)
    WING = M.add('al_wing', '#FFFFFF', 0.0, 0.4, '#FFF6E0', 3.0, alpha=0.82)
    BEAM = M.add('al_beam', '#FFF6D8', 0.0, 0.3, '#FFE9A8', 5.0, alpha=0.35)
    EARTH = M.add('al_earth', '#3A8AFF', 0.0, 0.4, '#2A6AFF', 2.5)
    LAND = M.add('al_land', '#3FDF8A', 0.0, 0.5, '#2ABF6A', 1.5)
    SUN = glowmat(M, 'al_sun', '#FFB347', 10)
    STAR = glowmat(M, 'al_star', '#FFFFFF', 12)
    b = Builder(M)
    tube(b, (0, 4.95, 0), (0, 1.6, 0), 1.0, 1.5, ROBE, 20)
    for k in range(12):
        a = 2 * math.pi * k / 12
        tube(b, (math.sin(a) * 1.0, 4.8, math.cos(a) * 1.0), (math.sin(a) * 1.52, 1.62, math.cos(a) * 1.52), 0.06, 0.09, ROBE2, 5)
    torus(b, (0, 1.6, 0), (0, 1, 0), 1.5, 0.09, LIGHT, 30, 5)
    cone(b, (0, 1.6, 0), (0, 0.0, 0), 1.42, BEAM, 16)
    cone(b, (0, 1.6, 0), (0, 0.35, 0), 0.55, LIGHT, 10)
    for s in (-1, 1):
        b.box(s * 0.32, 3.55, 1.05, 0.28, 2.6, 0.06, GOLD, pitch=-8)
        for k in range(4):
            disc(b, (s * 0.32, 2.6 + k * 0.6, 1.12 + 0.05 * k), (0, 0.1, 1), 0.08, HALO, seg=8)
    b.sphere(0, 5.2, 0, 1.28, ROBE, 16, 8, ry=0.72, rz=0.82)
    torus(b, (0, 5.68, 0.02), (0, 1, 0.1), 0.62, 0.1, GOLD, 22, 5)
    tube(b, (0, 5.6, 0), (0, 5.95, 0.04), 0.3, 0.28, LIGHT, 10)
    b.sphere(0, 6.38, 0.05, 0.5, LIGHT, 14, 8, ry=0.58)
    b.sphere(0, 6.45, -0.18, 0.62, ROBE, 12, 7, ry=0.72, rz=0.55)
    rays(b, (0, 6.42, -0.12), (0, 0, 1), 0.66, 1.4, 16, 0.07, HALO, alt=0.4)
    parts = list(b.emit(f'{name}_body'))

    def arms(ab):
        for s in (-1, 1):
            sh, el, wr = (s * 1.12, 5.35, 0), (s * 2.0, 5.05, 0.5), (s * 2.8, 5.25, 0.92)
            tube(ab, sh, el, 0.34, 0.4, ROBE, 10)
            tube(ab, el, wr, 0.4, 0.55, ROBE, 10)
            torus(ab, wr, sub(wr, el), 0.55, 0.06, GOLD, 16, 4)
            ab.sphere(wr[0] + s * 0.12, wr[1], wr[2] + 0.1, 0.2, LIGHT, 8, 5)
        c = (3.05, 5.6, 1.05)
        ab.sphere(c[0], c[1], c[2], 0.42, SUN, 12, 7)
        rays(ab, c, (0, 0, 1), 0.46, 0.95, 12, 0.06, HALO, alt=0.4)
        c = (-3.05, 5.6, 1.05)
        ab.sphere(c[0], c[1], c[2], 0.4, EARTH, 12, 7)
        for k in range(5):
            a = 2 * math.pi * k / 5
            ab.sphere(c[0] + math.cos(a) * 0.3, c[1] + math.sin(a * 2) * 0.18, c[2] + math.sin(a) * 0.3, 0.14, LAND, 6, 4)
        torus(ab, c, (0.4, 1, 0.2), 0.62, 0.025, GOLD, 20, 3)
    apv = pivot(f'{name}_armpv', (0, 5.35, 0), part(M, f'{name}_arms', arms))
    key_rot(apv, 'x', [(1, 0), (13, -3), (25, 0)])
    parts.append(apv)
    hc = (0, 6.25, -1.05)
    hpv = pivot(f'{name}_halopv', hc, part(M, f'{name}_halo', lambda hb: (
        rays(hb, hc, (0, 0, 1), 1.65, 3.9, 32, 0.12, HALO, alt=0.4),
        torus(hb, hc, (0, 0, 1), 1.58, 0.1, GOLD, 40, 5),
        torus(hb, hc, (0, 0, 1), 4.0, 0.06, HALO, 48, 4))))
    spin(hpv, 'z', 1, 1)
    parts.append(hpv)
    gpv = pivot(f'{name}_glyphpv', hc, part(M, f'{name}_glyph', lambda gb: (
        torus(gb, add(hc, (0, 0, 0.05)), (0, 0, 1), 2.65, 0.04, GOLD, 44, 4),
        [gb.octa(hc[0] + math.cos(2 * math.pi * k / 12) * 2.65, hc[1] + math.sin(2 * math.pi * k / 12) * 2.65, hc[2] + 0.06, 0.12, 0.2, STAR if k % 2 else GOLD) for k in range(12)])))
    spin(gpv, 'z', 1, -1)
    parts.append(gpv)
    for wi, (y, span, lift, drop, amp, ph) in enumerate([(5.7, 5.2, 0.95, 0.5, 12, 0), (5.0, 4.4, 0.6, 1.35, 14, 3), (4.3, 3.6, 0.3, 2.2, 16, 6)]):
        for s in (-1, 1):
            root = (s * 0.5, y, -0.75)
            wpv = pivot(f'{name}_wingpv{wi}{s}', root, part(M, f'{name}_wing{wi}{s}', lambda wb, root=root, s=s, span=span, lift=lift, drop=drop, wi=wi:
                angel_wing(wb, root, s, span, lift + 0.35, 1.0, WING, GOLD, prim=10, sec=7, glow=STAR if wi == 0 else None, droop=0.7 + 0.45 * wi, thick=0.08)))
            key_rot(wpv, 'y', [(1, s * amp * 0.6), (13 + ph // 2, -s * amp * 0.4), (25, s * amp * 0.6)])
            parts.append(wpv)
    for i, (n, R, sg) in enumerate([((0.3, 1, 0.2), 4.7, 1), ((-0.45, 1, -0.15), 5.3, -1)]):
        opv = pivot(f'{name}_orbitpv{i}', (0, 4.0, 0), part(M, f'{name}_orbit{i}', lambda ob, n=n, R=R: (
            torus(ob, (0, 4.0, 0), n, R, 0.05, HALO, 56, 4),
            [ob.octa(*add((0, 4.0, 0), add(mul(basis(n)[0], math.cos(2 * math.pi * k / 9) * R), mul(basis(n)[1], math.sin(2 * math.pi * k / 9) * R))), 0.12, 0.22, STAR) for k in range(9)])))
        spin(opv, 'y', 1, sg)
        parts.append(opv)
    root = pivot(name, (0, 0, 0), parts)
    bob(root, 0.3)
    finish(name)


# ════════════════════════════ Divine Radiance (the God skin) ════════════════════════════
def cos_god():
    name = 'cos_god'
    M = new_scene()
    GOLD = M.add('cg_gold', '#FFD86A', 0.95, 0.2, '#C08A20', 1.4)
    WING = M.add('cg_wing', '#FFFFFF', 0.0, 0.4, '#FFF6E0', 3.2, alpha=0.85)
    HALO = glowmat(M, 'cg_halo', '#FFE9A8', 9)
    STAR = glowmat(M, 'cg_star', '#FFFFFF', 12)
    parts = []
    core = Builder(M)
    core.octa(0, 0.04, -0.12, 0.06, 0.11, STAR)
    core.sphere(0, 0.04, -0.09, 0.08, GOLD, 8, 5)
    parts += core.emit('cg_core')
    for wi, (y, span, lift, drop, amp) in enumerate([(0.12, 1.0, 1.0, 0.15, 14), (0.0, 0.82, 0.7, 0.35, 16), (-0.13, 0.64, 0.45, 0.5, 18)]):
        for s in (-1, 1):
            root = (s * 0.07, y, -0.13)
            wpv = pivot(f'cg_wingpv{wi}{s}', root, part(M, f'cg_wing{wi}{s}', lambda wb, root=root, s=s, span=span, lift=lift, drop=drop, wi=wi:
                angel_wing(wb, root, s, span, lift + 0.3, 0.3, WING, GOLD, prim=7, sec=5, glow=STAR if wi == 0 else None, droop=0.8 + 0.4 * wi, thick=0.018)))
            key_rot(wpv, 'y', [(1, s * -6), (13, s * amp), (25, s * -6)])
            parts.append(wpv)
    c = (0, 0.66, -0.22)
    hpv = pivot('cg_halopv', c, part(M, 'cg_halo', lambda hb: (
        torus(hb, c, (0, 0, 1), 0.27, 0.022, GOLD, 28, 5),
        rays(hb, c, (0, 0, 1), 0.3, 0.52, 16, 0.028, HALO, alt=0.35))))
    spin(hpv, 'z', 1, 1)
    parts.append(hpv)
    mpv = pivot('cg_motespv', (0, 0, 0), part(M, 'cg_motes', lambda mb: [mb.octa(math.cos(2 * math.pi * k / 7) * 0.58, -0.25 + 0.18 * (k % 3), math.sin(2 * math.pi * k / 7) * 0.48 - 0.05, 0.03, 0.06, STAR) for k in range(7)]))
    spin(mpv, 'y', 1, 1)
    parts.append(mpv)
    pivot(name, (0, 0, 0), parts)
    finish(name)


ALL = [varkos, drakkar, kagerou, solariel, malgoroth, zerath, yorumi, armada, raikou, ophanos, nyxara, asurakh, khronos, morthael, almighty, cos_god]
want = set(sys.argv[1:])
for fn in ALL:
    if not want or fn.__name__ in want:
        fn()
print('MYTHBOSSES', json.dumps(REPORT))
