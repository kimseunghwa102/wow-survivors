"""
WOW NIGHTSWARM — sky gods, the bosses after NIGHTSWARM (Lv 220-300). Original designs.
They fly: the model's origin is the lowest point of the body; view.ts lifts them into the air.
  boss_seraph    — SERAPH OF RUIN (220): six wings, faceless mask, burning halo
  boss_stormbird — STORMHEART (240): thunderbird with a 12 m wingspan
  boss_oculus    — OCULUS PRIME (260): the floating eye inside three iron rings
  boss_skywyrm   — AZURE LEVIATHAN (280): sky serpent swimming through the air
  boss_aetherion — AETHERION, THE GOD-EATER (300): four-armed cosmic titan with orbiting worlds
Run: python3 blender/build_godbosses.py → models/boss_*.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from rig import *  # noqa
def cone(b, base, tip, r, m, seg=6):
    bx, by, bz = base
    tx, ty, tz = tip
    ax, ay, az = tx - bx, ty - by, tz - bz
    ln = math.sqrt(ax * ax + ay * ay + az * az) or 1
    ax, ay, az = ax / ln, ay / ln, az / ln
    ux, uy, uz = (0, 1, 0) if abs(ay) < 0.9 else (1, 0, 0)
    px, py, pz = ay * uz - az * uy, az * ux - ax * uz, ax * uy - ay * ux
    pl = math.sqrt(px * px + py * py + pz * pz)
    px, py, pz = px / pl, py / pl, pz / pl
    qx, qy, qz = ay * pz - az * py, az * px - ax * pz, ax * py - ay * px
    vs = []
    for i in range(seg):
        a = 2 * math.pi * i / seg
        c, s = math.cos(a) * r, math.sin(a) * r
        vs.append((bx + px * c + qx * s, by + py * c + qy * s, bz + pz * c + qz * s))
    vs.append(tip)
    fs = [[i, (i + 1) % seg, seg] for i in range(seg)] + [list(range(seg))[::-1]]
    b.faces(b.a(m), vs, fs)


def limb(b, p0, p1, r, m):
    dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
    ln = math.sqrt(dx * dx + dy * dy + dz * dz)
    yaw = math.degrees(math.atan2(dx, dz))
    pitch = -math.degrees(math.atan2(dy, math.hypot(dx, dz)))
    b.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, r, r, ln, m, yaw=yaw, pitch=pitch)




def wing_fan(b, M, root, s, span, drop, back, memb, bone, feathers=7, glow=None):
    """feathered wing: a fan of long feather quads from the root, s = ±1 side"""
    pts = []
    for k in range(feathers):
        t = k / (feathers - 1)
        a = math.radians(70 - t * 110)
        R = span * (0.55 + 0.45 * math.sin(t * math.pi * 0.9 + 0.3))
        tip = (root[0] + s * math.cos(a) * R, root[1] + math.sin(a) * R * 0.7 - drop * t, root[2] - back * (0.3 + t))
        pts.append(tip)
        limb(b, root, tip, 0.06 + 0.05 * (1 - t), bone)
        if glow is not None:
            b.octa(tip[0], tip[1], tip[2], 0.12, 0.25, glow)
    vs = [root] + pts
    fs = [[0, i, i + 1] for i in range(1, len(vs) - 1)]
    b.faces(b.a(memb), vs, fs + [f[::-1] for f in fs])


# ───────────────────────── SERAPH OF RUIN ─────────────────────────
def seraph():
    name = 'boss_seraph'
    M = new_scene()
    ROBE = skin(M, 'ser_robe', '#E9E2D0', 0.7, seed=71, scale=0.8, contrast=0.25)
    GOLD = M.add('ser_gold', '#E9B949', 0.95, 0.2, '#7A5200', 0.6)
    LIGHT = glowmat(M, 'ser_light', '#FFF2B0', 8.0)
    EYE = glowmat(M, 'ser_eye', '#FF3B2E', 12.0)
    FEATH = M.add('ser_feather', '#FFFFFF', 0.0, 0.5, '#FFE9A8', 1.6, alpha=0.92)
    b = Builder(M)
    b.cyl(0, 0, 0, 0.35, 2.6, ROBE, seg=14, r_top=1.1)                 # flowing robe (wide at the bottom? no: tail of light)
    cone(b, (0, 0.2, 0), (0, -1.6, 0), 0.45, LIGHT, seg=8)               # light tail under the robe
    b.sphere(0, 3.3, 0, 1.0, ROBE, 12, 7, ry=0.9, rz=0.7)                # chest
    b.box(0, 3.0, 0.45, 1.4, 0.9, 0.3, GOLD)                             # breastplate
    b.octa(0, 3.15, 0.62, 0.18, 0.3, LIGHT)
    b.sphere(0, 4.6, 0, 0.5, GOLD, 10, 6, ry=0.62)                       # faceless mask
    b.box(0, 4.65, 0.45, 0.6, 0.06, 0.06, EYE)                           # one burning slit
    for s in (-1, 1):
        limb(b, (s * 0.9, 3.8, 0), (s * 1.6, 2.8, 0.7), 0.28, ROBE)
        limb(b, (s * 1.6, 2.8, 0.7), (s * 1.9, 2.1, 1.5), 0.22, ROBE)
        b.box(s * 1.9, 2.0, 1.6, 0.3, 0.3, 0.3, GOLD)
    # spear of light in the right hand
    limb(b, (1.9, 0.2, 1.5), (1.9, 5.6, 1.7), 0.09, GOLD)
    cone(b, (1.9, 5.6, 1.7), (1.9, 6.9, 1.75), 0.22, LIGHT, seg=4)
    body = b.emit(f'{name}_body')
    parts = list(body)
    # halo (spins)
    hb = Builder(M)
    hb.ring(0, 5.25, -0.35, 0.75, 0.95, 0.08, LIGHT, seg=24)
    for k in range(12):
        a = 2 * math.pi * k / 12
        cone(hb, (math.cos(a) * 0.95, 5.29, -0.35 + math.sin(a) * 0.95), (math.cos(a) * 1.35, 5.29, -0.35 + math.sin(a) * 1.35), 0.06, GOLD, seg=4)
    halo = hb.emit(f'{name}_halo')
    hpv = pivot(f'{name}_halopv', (0, 5.3, -0.35), halo)
    key_rot(hpv, 'y', [(1, 0), (13, 180), (25, 360)])
    linear(hpv)
    parts.append(hpv)
    # three pairs of wings, each pair flapping with its own phase
    for wi, (y, span, drop, amp, ph) in enumerate([(4.0, 4.6, 0.6, 22, 0), (3.4, 3.6, 1.4, 26, 3), (2.6, 2.8, 2.0, 30, 6)]):
        for s in (-1, 1):
            wb = Builder(M)
            root = (s * 0.5, y, -0.45)
            wing_fan(wb, M, root, s, span, drop, 0.8, FEATH, GOLD, feathers=6, glow=LIGHT if wi == 0 else None)
            wobj = wb.emit(f'{name}_wing{wi}{s}')
            wpv = pivot(f'{name}_wingpv{wi}{s}', root, wobj)
            key_rot(wpv, 'y', [(1, s * amp), (13 - ph // 2, -s * amp * 0.5), (25, s * amp)])
            parts.append(wpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, 0.35), (25, 0)])
    finish(name)


# ───────────────────────── STORMHEART ─────────────────────────
def stormbird():
    name = 'boss_stormbird'
    M = new_scene()
    FEA = skin(M, 'sb_feather', '#22304A', 0.75, seed=81, scale=0.8, contrast=0.45)
    BEL = skin(M, 'sb_belly', '#D8E4F0', 0.8, seed=82, scale=0.8, contrast=0.3)
    GOLD = M.add('sb_beak', '#E9B949', 0.7, 0.3)
    BOLT = glowmat(M, 'sb_bolt', '#7DF9FF', 9.0)
    EYE = glowmat(M, 'sb_eye', '#FFE45A', 12.0)
    WING = M.add('sb_wing', '#1A2440', 0.0, 0.6, '#3A6AFF', 0.9, alpha=0.95)
    b = Builder(M)
    b.sphere(0, 1.6, 0, 1.2, FEA, 12, 7, ry=1.1, rz=2.2)
    b.sphere(0, 1.3, 0.4, 0.95, BEL, 10, 6, ry=0.8, rz=1.6)
    b.sphere(0, 2.6, 2.0, 0.75, FEA, 10, 6)                               # head
    cone(b, (0, 2.5, 2.6), (0, 2.1, 3.9), 0.35, GOLD, seg=6)             # beak
    for s in (-1, 1):
        b.sphere(s * 0.42, 2.8, 2.45, 0.13, EYE, 6, 4)
        cone(b, (s * 0.3, 3.1, 1.8), (s * 0.9, 4.4, 0.9), 0.16, BOLT, seg=4)   # crest of lightning
        limb(b, (s * 0.6, 0.6, 0.2), (s * 0.7, -0.6, 0.6), 0.2, GOLD)      # talons
        for c in (-1, 0, 1):
            cone(b, (s * 0.7 + c * 0.15, -0.6, 0.6), (s * 0.7 + c * 0.25, -0.9, 1.0), 0.05, GOLD, seg=4)
    for k in range(7):                                                    # tail fan
        a = math.radians(-45 + k * 15)
        tip = (math.sin(a) * 2.6, 1.4 + math.cos(a) * 0.4, -2.0 - math.cos(a) * 2.6)
        limb(b, (0, 1.5, -1.8), tip, 0.18, FEA)
        b.octa(tip[0], tip[1], tip[2], 0.12, 0.3, BOLT)
    body = b.emit(f'{name}_body')
    parts = list(body)
    for s in (-1, 1):
        wb = Builder(M)
        root = (s * 0.9, 2.0, 0.2)
        wing_fan(wb, M, root, s, 6.0, 0.5, 1.3, WING, FEA, feathers=8, glow=BOLT)
        wobj = wb.emit(f'{name}_wing{s}')
        wpv = pivot(f'{name}_wingpv{s}', root, wobj)
        key_rot(wpv, 'z', [(1, s * 30), (13, -s * 25), (25, s * 30)])
        parts.append(wpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0.3), (13, -0.2), (25, 0.3)])
    finish(name)


# ───────────────────────── OCULUS PRIME ─────────────────────────
def oculus():
    name = 'boss_oculus'
    M = new_scene()
    SCL = skin(M, 'oc_sclera', '#E8DCD0', 0.5, seed=91, scale=0.7, contrast=0.35)
    VEIN = M.add('oc_vein', '#8A1020', 0.0, 0.5, '#FF1A3A', 1.5)
    IRIS = glowmat(M, 'oc_iris', '#FF2A6A', 8.0)
    PUP = M.add('oc_pupil', '#050008', 0.0, 0.2)
    IRON = skin(M, 'oc_iron', '#3A3440', 0.5, metal=0.9, seed=92, scale=0.6, contrast=0.4)
    RUNE = glowmat(M, 'oc_rune', '#B05BFF', 7.0)
    b = Builder(M)
    b.sphere(0, 2.6, 0, 2.2, SCL, 18, 10)
    b.sphere(0, 2.6, 1.55, 1.15, IRIS, 14, 6, ry=1.15, rz=0.75)
    b.sphere(0, 2.6, 2.05, 0.5, PUP, 10, 5, ry=0.75, rz=0.3)
    for k in range(10):                                                   # veins
        a = 2 * math.pi * k / 10
        p0 = (math.cos(a) * 1.0, 2.6 + math.sin(a) * 1.0, 1.95)
        p1 = (math.cos(a) * 2.0, 2.6 + math.sin(a) * 2.0, 0.6)
        limb(b, p0, p1, 0.05, VEIN)
    for k in range(8):                                                    # tendrils hanging below
        a = 2 * math.pi * k / 8
        limb(b, (math.cos(a) * 1.2, 0.9, math.sin(a) * 1.2), (math.cos(a) * 1.8, -1.2, math.sin(a) * 1.8), 0.14, VEIN)
        b.octa(math.cos(a) * 1.8, -1.2, math.sin(a) * 1.8, 0.14, 0.3, RUNE)
    eye = b.emit(f'{name}_eye')
    parts = list(eye)
    for i, (r, tilt_axis, spd) in enumerate([(3.0, 'x', 1), (3.5, 'z', -1), (4.0, 'y', 1)]):
        rb = Builder(M)
        rb.ring(0, 2.5, 0, r - 0.18, r, 0.22, IRON, seg=36)
        for k in range(6):
            a = 2 * math.pi * k / 6
            rb.octa(math.cos(a) * r, 2.61, math.sin(a) * r, 0.16, 0.3, RUNE)
        robj = rb.emit(f'{name}_ring{i}')
        rpv = pivot(f'{name}_ringpv{i}', (0, 2.6, 0), robj)
        base = {'x': 35, 'z': -35, 'y': 0}[tilt_axis]
        if tilt_axis == 'y':
            key_rot(rpv, 'y', [(1, 0), (13, 180 * spd), (25, 360 * spd)])
        else:
            key_rot(rpv, tilt_axis, [(1, base), (13, base + 180 * spd), (25, base + 360 * spd)])
        linear(rpv)
        parts.append(rpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, 0.4), (25, 0)])
    finish(name)


# ───────────────────────── AZURE LEVIATHAN ─────────────────────────
def skywyrm():
    name = 'boss_skywyrm'
    M = new_scene()
    SC = skin(M, 'sw_scale', '#1E4E8A', 0.5, seed=101, scale=0.8, contrast=0.5)
    BEL = M.add('sw_belly', '#BFE8FF', 0.0, 0.5, '#5EC8FF', 0.8)
    HORN = M.add('sw_horn', '#E9E2D0', 0.2, 0.3)
    FIN = M.add('sw_fin', '#3FE6FF', 0.0, 0.4, '#3FE6FF', 2.5, alpha=0.85)
    EYE = glowmat(M, 'sw_eye', '#FFFFFF', 12.0)
    GLOW = glowmat(M, 'sw_glow', '#7DF9FF', 7.0)
    parts = []
    # body: 12 segments in an S curve, each with its own sway
    prev = None
    for k in range(12):
        t = k / 11
        z = 3.5 - k * 1.05
        x = math.sin(t * math.pi * 1.6) * 1.6
        y = 1.2 + math.sin(t * math.pi) * 1.2
        r = 0.95 - abs(t - 0.25) * 0.55
        sb = Builder(M)
        sb.sphere(x, y, z, r, SC, 10, 6, rz=r * 1.3)
        sb.sphere(x, y - r * 0.45, z, r * 0.75, BEL, 8, 4, ry=r * 0.4, rz=r * 1.2)
        cone(sb, (x, y + r * 0.8, z), (x, y + r * 0.8 + 0.7, z - 0.4), 0.18, FIN, seg=4)
        if k in (2, 6):
            for s in (-1, 1):
                cone(sb, (x + s * r, y, z), (x + s * (r + 2.2), y + 0.8, z - 1.0), 0.35, FIN, seg=4)
        sobj = sb.emit(f'{name}_seg{k}')
        spv = pivot(f'{name}_segpv{k}', (x, y, z), sobj)
        amp = 6 + k * 1.2
        key_rot(spv, 'y', [(1, amp if k % 2 else -amp), (13, -amp if k % 2 else amp), (25, amp if k % 2 else -amp)])
        key_loc(spv, [(1, 0), (7 + k % 6, 0.25), (25, 0)])
        parts.append(spv)
    # head at the front
    hb = Builder(M)
    hb.sphere(0, 2.0, 4.6, 0.9, SC, 10, 6, ry=0.7, rz=1.1)
    hb.box(0, 1.85, 5.7, 0.9, 0.5, 1.3, SC)
    hb.box(0, 1.55, 5.6, 0.75, 0.15, 1.1, GLOW)
    for s in (-1, 1):
        hb.sphere(s * 0.5, 2.25, 5.2, 0.14, EYE, 6, 4)
        cone(hb, (s * 0.4, 2.6, 4.4), (s * 1.3, 3.9, 3.1), 0.16, HORN, seg=5)
        cone(hb, (s * 0.45, 1.7, 6.2), (s * 1.6, 1.4, 6.6), 0.04, GLOW, seg=3)   # whiskers
    head = hb.emit(f'{name}_head')
    hpv = pivot(f'{name}_headpv', (0, 1.8, 4.0), head)
    key_rot(hpv, 'y', [(1, -10), (13, 10), (25, -10)])
    parts.append(hpv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, 0.5), (25, 0)])
    finish(name)


# ───────────────────────── AETHERION, THE GOD-EATER ─────────────────────────
def aetherion():
    name = 'boss_aetherion'
    M = new_scene()
    SKIN = skin(M, 'ae_skin', '#140C2A', 0.5, seed=111, scale=0.8, contrast=0.5)
    STAR = M.add('ae_star', '#2A1A5A', 0.0, 0.4, '#6A4AFF', 1.2)
    GOLD = M.add('ae_gold', '#E9B949', 0.95, 0.2, '#7A5200', 0.8)
    CORE = glowmat(M, 'ae_core', '#FFFFFF', 14.0)
    EYE = glowmat(M, 'ae_eye', '#FFD86A', 14.0)
    NEB = M.add('ae_nebula', '#7A2BFF', 0.0, 0.5, '#B05BFF', 3.0, alpha=0.6)
    PL1 = M.add('ae_planet1', '#FF6A1A', 0.0, 0.5, '#FF4A00', 2.5)
    PL2 = M.add('ae_planet2', '#3FE6FF', 0.0, 0.5, '#1A9AFF', 2.5)
    b = Builder(M)
    # nebula tail instead of legs
    for k in range(5):
        b.sphere(math.sin(k) * 0.4, 0.6 + k * 0.7, -0.2, 1.5 - k * 0.12, NEB, 10, 6, ry=0.6)
    b.sphere(0, 4.8, 0, 1.9, SKIN, 14, 8, ry=1.6, rz=1.3)                # torso
    b.sphere(0, 4.9, 0.9, 1.3, STAR, 12, 6, ry=1.2, rz=0.5)
    b.octa(0, 5.0, 1.4, 0.45, 0.8, CORE)                                   # star core
    b.ring(0, 4.75, 1.32, 0.55, 0.75, 0.5, GOLD, seg=12)
    b.box(0, 6.4, 0, 3.6, 0.9, 1.6, GOLD)                                  # pauldrons
    b.sphere(0, 7.4, 0.2, 0.85, SKIN, 12, 7)                               # head
    for s in (-1, 0, 1):
        b.sphere(s * 0.32, 7.55, 0.95, 0.12, EYE, 6, 4)                    # three eyes
    for k in range(9):                                                     # crown of spikes
        a = math.radians(-80 + k * 20)
        cone(b, (math.sin(a) * 0.75, 7.9, 0.2 + math.cos(a) * 0.3), (math.sin(a) * 1.2, 9.2 + (0.8 if k == 4 else 0), 0.0), 0.12, GOLD, seg=4)
    body = b.emit(f'{name}_body')
    parts = list(body)
    # four arms (upper pair raised, lower pair forward), each swinging
    for (s, up, ph) in [(-1, True, 0), (1, True, 6), (-1, False, 3), (1, False, 9)]:
        ab = Builder(M)
        sh = (s * 1.9, 6.0 if up else 4.6, 0)
        el = (s * 3.4, 7.4 if up else 4.2, 0.6 if up else 1.4)
        ha = (s * 4.2, 9.0 if up else 3.6, 1.2 if up else 2.8)
        limb(ab, sh, el, 0.55, SKIN)
        limb(ab, el, ha, 0.45, SKIN)
        ab.box(el[0], el[1], el[2], 0.75, 0.75, 0.75, GOLD)
        ab.sphere(ha[0], ha[1], ha[2], 0.55, SKIN, 8, 5)
        ab.octa(ha[0], ha[1] + (0.8 if up else 0), ha[2], 0.35, 0.6, CORE if up else EYE)
        aobj = ab.emit(f'{name}_arm{s}{int(up)}')
        apv = pivot(f'{name}_armpv{s}{int(up)}', sh, aobj)
        key_rot(apv, 'x', [(1, -8), (13 - ph // 3, 10), (25, -8)])
        parts.append(apv)
    # orbiting worlds
    ob = Builder(M)
    ob.sphere(6.0, 5.0, 0, 0.7, PL1, 10, 6)
    ob.ring(6.0, 4.95, 0, 0.9, 1.2, 0.05, GOLD, seg=16)
    ob.sphere(-5.2, 6.5, 2.5, 0.55, PL2, 10, 6)
    ob.sphere(0.5, 3.0, -5.6, 0.45, PL1, 8, 5)
    for k in range(16):
        a = 2 * math.pi * k / 16
        ob.octa(math.cos(a) * 7.0, 5.0 + math.sin(a * 3) * 0.6, math.sin(a) * 7.0, 0.1, 0.2, CORE)
    oobj = ob.emit(f'{name}_worlds')
    opv = pivot(f'{name}_worldspv', (0, 5, 0), oobj)
    key_rot(opv, 'y', [(1, 0), (13, 180), (25, 360)])
    linear(opv)
    parts.append(opv)
    root = pivot(name, (0, 0, 0), parts)
    key_loc(root, [(1, 0), (13, 0.4), (25, 0)])
    finish(name)


for fn in (seraph, stormbird, oculus, skywyrm, aetherion):
    fn()
print('GODBOSSES', json.dumps({k: v for k, v in REPORT.items() if k in ('boss_seraph', 'boss_stormbird', 'boss_oculus', 'boss_skywyrm', 'boss_aetherion')}))
