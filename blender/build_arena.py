"""
WOW SURVIVORS — arena build (Blender / bpy)
Night graveyard arena fitted to the Wow Casino estate (12 parcels):
  • Sanctuary (safe lobby) .......... parcel -106,76
  • Graveyard arena (R1) ............ -105..-104 × 76..78
  • Cathedral courtyard arena (R2) .. -106..-105 × 79..80
  • Hall of Legends (safe) .......... -103,78
Run:  python3 blender/build_arena.py   →  models/arena.glb (+ blender/arena.blend)
"""
import bpy, json, math, os, random, sys
sys.path.insert(0, os.path.dirname(__file__))
from common import *  # noqa

L = json.load(open(os.path.join(ROOT, 'layout.json')))
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)

M = Mats()
COBBLE = M.add('cobble', tex=tex_cobble('cobble.jpg'), rough=0.9, tile=4.0)
STONE = M.add('stone', tex=tex_stone('stone_dark.jpg'), rough=0.85, tile=3.0)
MARBLE = M.add('marble', tex=tex_marble('marble_pale.jpg', [0.85, 0.84, 0.86], [0.45, 0.42, 0.5], 4), rough=0.2, tile=3.0)
IRON = M.add('iron', '#16141C', 0.8, 0.45)
GOLD = M.add('gold', '#E9B949', 0.6, 0.3, '#7A5200', 0.4)
FIRE = M.add('lamp_fire', '#FFB347', 0.0, 0.5, '#FF8A1E', 6.0)
SOUL = M.add('soul_glow', '#A26BFF', 0.0, 0.4, '#7B3BFF', 5.0)
CYAN = M.add('cyan_glow', '#5EF2FF', 0.0, 0.4, '#20D8FF', 4.0)
BLOOD = M.add('blood_glow', '#FF2A3D', 0.0, 0.4, '#E0102A', 4.0)
GRAVE = M.add('grave', '#6E6B73', 0.0, 0.9)
WOOD = M.add('dead_wood', '#2A1D17', 0.0, 0.9)
GRASS = M.add('dark_grass', '#1D2A1B', 0.0, 1.0)
VELVET = M.add('velvet', '#5A0E2A', 0.0, 0.85)
GLASS = M.add('stained_glass', '#7B3BFF', 0.0, 0.3, '#5A22D0', 2.5)
SCREEN = M.add('screen', '#05060C', 0.0, 0.3, '#020309', 1.0)

B = Builder(M)
R1, R2 = L['arena']
LB, LG = L['lobby'], L['legends']

# ═══════════ GROUND ═══════════
B.box2(16.0, -0.2, 0.0, 48.0, 0.0, 48.0, COBBLE)
B.box2(0.0, -0.2, 48.0, 32.0, 0.0, 80.0, COBBLE)
B.box2(0.0, -0.2, 0.0, 16.0, 0.05, 16.0, MARBLE)
B.box2(48.0, -0.2, 32.0, 64.0, 0.05, 48.0, MARBLE)
# rune circles (glowing) at the centre of each arena
for (cx, cz, r) in [(32, 24, 7.0), (16, 64, 6.0)]:
    B.ring(cx, 0.005, cz, r - 0.15, r, 0.01, SOUL, seg=48)
    B.ring(cx, 0.005, cz, r * 0.62 - 0.1, r * 0.62, 0.01, SOUL, seg=40)
    for k in range(6):
        a = math.radians(k * 60)
        B.box(cx + math.sin(a) * r * 0.81, 0.008, cz + math.cos(a) * r * 0.81, 0.12, 0.01, r * 0.38, SOUL, yaw=k * 60)
    for k in range(3):
        a1, a2 = math.radians(k * 120), math.radians(k * 120 + 120)
        p1 = (cx + math.sin(a1) * r * 0.62, cz + math.cos(a1) * r * 0.62)
        p2 = (cx + math.sin(a2) * r * 0.62, cz + math.cos(a2) * r * 0.62)
        ln = math.hypot(p2[0] - p1[0], p2[1] - p1[1])
        yaw = math.degrees(math.atan2(p2[0] - p1[0], p2[1] - p1[1]))
        B.box((p1[0] + p2[0]) / 2, 0.009, (p1[1] + p2[1]) / 2, 0.1, 0.01, ln, SOUL, yaw=yaw)


# ═══════════ IRON FENCES around the arena ═══════════
def fence(x0, z0, x1, z1, gaps=()):
    """straight fence from (x0,z0) to (x1,z1); gaps = [(t0,t1)] in metres along the run"""
    ln = math.hypot(x1 - x0, z1 - z0)
    ux, uz = (x1 - x0) / ln, (z1 - z0) / ln
    yaw = math.degrees(math.atan2(ux, uz))
    segs, cur = [], 0.0
    for (g0, g1) in sorted(gaps):
        segs.append((cur, g0))
        cur = g1
    segs.append((cur, ln))
    for (s0, s1) in segs:
        if s1 - s0 < 0.05:
            continue
        mx, mz = x0 + ux * (s0 + s1) / 2, z0 + uz * (s0 + s1) / 2
        B.box(mx, 0.25, mz, 0.12, 0.5, s1 - s0, STONE, yaw=yaw, collide=False)
        B.box(mx, 2.05, mz, 0.06, 0.06, s1 - s0, IRON, yaw=yaw)
        B.box(mx, 0.75, mz, 0.06, 0.06, s1 - s0, IRON, yaw=yaw)
        B.box(mx, 1.2, mz, 0.4, 2.4, s1 - s0, None, yaw=yaw, collide=True)
        n = int((s1 - s0) / 0.45)
        for i in range(n + 1):
            t = s0 + (s1 - s0) * i / max(n, 1)
            px, pz = x0 + ux * t, z0 + uz * t
            B.box(px, 1.3, pz, 0.04, 1.6, 0.04, IRON)
            B.box(px, 2.18, pz, 0.08, 0.16, 0.08, IRON, yaw=45 + yaw, pitch=45)
        # stone pillars with fire lamps at segment ends
        for t in (s0, s1):
            px, pz = x0 + ux * t, z0 + uz * t
            B.box(px, 1.3, pz, 0.6, 2.6, 0.6, STONE)
            B.box(px, 2.65, pz, 0.75, 0.12, 0.75, STONE)
            B.box(px, 2.95, pz, 0.32, 0.45, 0.32, FIRE)
            B.box(px, 3.22, pz, 0.45, 0.08, 0.45, IRON)


I = 0.4  # inset from parcel edge (pillars are 0.75 wide)
# R1 (x16–48, z0–48)
fence(16 + I, 0 + I, 48 - I, 0 + I)                                                     # south
fence(16 + I, 0 + I, 16 + I, 48, gaps=[(LB['gateZ0'] - I, LB['gateZ1'] - I)])            # west (lobby gate)
fence(48 - I, 0 + I, 48 - I, 48 - I, gaps=[(LG['gateZ0'] - I, LG['gateZ1'] - I)])        # east (legends gate)
fence(32 + I, 48 - I, 48 - I, 48 - I)                                                   # north part (x32–48)
# R2 (x0–32, z48–80)
fence(0 + I, 48 + I, 16 + I, 48 + I)                                                    # south part (x0–16)
fence(0 + I, 48 + I, 0 + I, 80 - I)                                                     # west
fence(32 - I, 48 - I, 32 - I, 80 - I)                                                   # east
# north side of R2 is the cathedral


# ═══════════ GATE ARCHES ═══════════
def arch(x, z, along_x, w=5.0, h=5.0):
    """gothic gate: two pillars + pointed arch, opening along the given axis"""
    for s in (-1, 1):
        px, pz = (x, z + s * w / 2) if not along_x else (x + s * w / 2, z)
        B.box(px, h / 2, pz, 0.9, h, 0.9, STONE, collide=True)
        B.box(px, h + 0.4, pz, 0.5, 0.8, 0.5, STONE)
        B.box(px, h + 0.95, pz, 0.25, 0.3, 0.25, FIRE)
    span = w / 2
    for k in range(10):
        t0, t1 = k / 10, (k + 1) / 10
        for s in (-1, 1):
            a0, a1 = t0 * math.pi / 2, t1 * math.pi / 2
            o0, o1 = s * span * math.cos(a0), s * span * math.cos(a1)
            y0, y1 = h + span * 0.9 * math.sin(a0), h + span * 0.9 * math.sin(a1)
            mid, my = (o0 + o1) / 2, (y0 + y1) / 2
            ln = math.hypot(o1 - o0, y1 - y0) + 0.08
            ang = math.degrees(math.atan2(y1 - y0, o1 - o0))
            if along_x:
                B.box(x + mid, my, z, ln, 0.45, 0.8, STONE, roll=ang)
            else:
                B.box(x, my, z + mid, 0.8, 0.45, ln, STONE, yaw=90, roll=ang)
    B.box(x, h + span * 0.9 + 0.3, z, 0.4, 0.6, 0.4, SOUL)


arch(16.3, (LB['gateZ0'] + LB['gateZ1']) / 2, False)
arch(47.7, (LG['gateZ0'] + LG['gateZ1']) / 2, False)

# ═══════════ GRAVES, TREES, LAMPS (along the edges only — the middle stays open for the swarm) ═══════════
def grave(x, z, yaw):
    k = random.random()
    if k < 0.45:      # rounded headstone
        B.box(x, 0.45, z, 0.7, 0.9, 0.18, GRAVE, yaw=yaw)
        B.box(x, 0.92, z, 0.55, 0.12, 0.18, GRAVE, yaw=yaw)
    elif k < 0.75:    # cross
        B.box(x, 0.65, z, 0.16, 1.3, 0.16, GRAVE, yaw=yaw)
        B.box(x, 0.95, z, 0.65, 0.16, 0.16, GRAVE, yaw=yaw)
    else:             # tomb slab
        B.box(x, 0.2, z, 1.0, 0.4, 2.0, GRAVE, yaw=yaw)
        B.box(x, 0.45, z, 0.85, 0.1, 1.8, STONE, yaw=yaw)
    B.box(x, 0.02, z + 0.6, 0.9, 0.03, 1.4, GRASS, yaw=yaw)


def dead_tree(x, z, s=1.0):
    B.cyl(x, 0, z, 0.28 * s, 3.5 * s, WOOD, seg=7, r_top=0.15 * s)
    for k in range(5):
        a = random.uniform(0, 360)
        y = (1.8 + k * 0.4) * s
        ln = random.uniform(1.0, 1.9) * s
        ox, oz = rot(0, 0, ln / 2, a, 0, 0)[0], rot(0, 0, ln / 2, a, 0, 0)[2]
        B.box(x + ox * 0.9, y + ln * 0.25, z + oz * 0.9, 0.1 * s, 0.1 * s, ln, WOOD, yaw=a, pitch=-30)


for z in [3.5, 12, 20, 28, 36, 44]:
    grave(18.0, z, 90 + random.uniform(-8, 8))
    grave(46.0, z + 2, -90 + random.uniform(-8, 8))
for x in [21, 27, 37, 43]:
    grave(x, 1.8, random.uniform(-8, 8))
for z in [52, 58, 64, 70]:
    grave(1.8, z, 90 + random.uniform(-8, 8))
    grave(30.2, z + 1.5, -90 + random.uniform(-8, 8))
for (x, z, s) in [(19.0, 46.0, 1.2), (45.5, 4.0, 1.1), (45.8, 30.0, 1.0), (2.2, 50.5, 1.2), (29.8, 50.0, 0.9)]:
    dead_tree(x, z, s)


def lamp(x, z):
    B.cyl(x, 0, z, 0.08, 3.8, IRON, seg=6)
    B.box(x, 3.9, z, 0.45, 0.55, 0.45, IRON)
    B.box(x, 3.9, z, 0.32, 0.4, 0.32, FIRE)
    B.box(x, 4.25, z, 0.1, 0.25, 0.1, IRON)


for (x, z) in [(24, 10), (40, 10), (24, 38), (40, 38), (8, 58), (24, 58), (8, 70), (24, 70)]:
    lamp(x, z)

# ═══════════ CATHEDRAL RUIN (north edge of R2, boss entrance) ═══════════
C = L['cathedral']
cz = C['z']
B.box2(C['x0'], 0, cz, C['x1'], 1.0, cz + 0.8, STONE, collide=True)
for x in [2.5, 8.0, 13.0, 19.0, 24.0, 29.5]:
    h = 14 if x in (13.0, 19.0) else random.choice([9.0, 11.0, 7.5])
    B.box(x, h / 2, cz + 0.4, 1.4, h, 1.4, STONE, collide=True)
    B.box(x, h + 0.6, cz + 0.4, 0.6, 1.2, 0.6, STONE)
# central rose window + pointed portal
B.box2(13.6, 1.0, cz + 0.2, 18.4, 18.0, cz + 0.8, STONE)
for k in range(12):
    a = math.radians(k * 30)
    B.box(16 + math.sin(a) * 1.1, 13.0 + math.cos(a) * 1.1, cz + 0.12, 0.25, 1.9, 0.08, STONE, roll=-k * 30)
B.box(16, 13.0, cz + 0.15, 3.2, 3.2, 0.06, GLASS)
B.box(16, 4.0, cz + 0.12, 3.2, 6.0, 0.06, SOUL)        # glowing portal (boss gate)
for s in (-1, 1):
    B.box(16 + s * 1.8, 4.0, cz + 0.1, 0.4, 6.4, 0.5, STONE)
B.box(16, 7.4, cz + 0.1, 4.0, 0.5, 0.5, STONE)
# broken wall pieces between pillars
for (x0, x1, h) in [(3.2, 7.3, 4.0), (8.7, 12.3, 6.5), (19.7, 23.3, 5.5), (24.7, 28.8, 3.2)]:
    B.box2(x0, 1.0, cz + 0.1, x1, h, cz + 0.7, STONE, collide=True)
    B.box((x0 + x1) / 2, h * 0.6, cz + 0.05, 1.0, h * 0.5, 0.06, GLASS)

# ═══════════ SANCTUARY (safe lobby, cell -106,76) ═══════════
B.ring(8, 0.06, 8, 5.2, 5.6, 0.04, GOLD, seg=48)
B.ring(8, 0.06, 8, 2.0, 2.2, 0.04, CYAN, seg=36)
# walls (low) on south/west, open toward the arena gate on the east
for (x0, z0, x1, z1) in [(0.0, 0.0, 16.0, 0.4), (0.0, 0.0, 0.4, 16.0), (0.0, 15.6, 16.0, 16.0)]:
    B.box2(x0, 0, z0, x1, 1.2, z1, STONE, collide=True)
    B.box2(x0, 1.2, z0, x1, 1.3, z1, GOLD)
B.box2(15.6, 0, 0.0, 16.0, 1.2, LB['gateZ0'] - 0.3, STONE, collide=True)
B.box2(15.6, 0, LB['gateZ1'] - 0.3, 16.0, 1.2, 16.0, STONE, collide=True)
# shrine of power (meta upgrades)
sx, _, sz = L['shrine']
B.cyl(sx, 0.05, sz, 1.3, 0.4, MARBLE, seg=16, collide=True)
B.cyl(sx, 0.45, sz, 0.8, 1.0, MARBLE, seg=8, r_top=0.6)
B.octa(sx, 2.2, sz, 0.45, 0.7, CYAN)
B.ring(sx, 1.45, sz, 0.55, 0.65, 0.08, GOLD, seg=16)
# how-to board frame (text at runtime) facing south-west
hx, _, hz = L['howto']
B.box(hx, 1.6, hz, 4.4, 3.2, 0.15, IRON, yaw=0)
B.box(hx, 1.6, hz - 0.09, 4.2, 3.0, 0.03, SCREEN)
B.cyl(hx - 2.0, 0, hz, 0.08, 1.2, IRON, seg=6)
B.cyl(hx + 2.0, 0, hz, 0.08, 1.2, IRON, seg=6)
# banners
for (x, z) in [(1.0, 3.0), (1.0, 13.0)]:
    B.cyl(x, 0, z, 0.07, 5.0, IRON, seg=6)
    B.box(x + 0.02, 3.6, z, 0.03, 2.2, 1.0, VELVET)
    B.box(x + 0.04, 3.6, z, 0.02, 0.5, 0.5, GOLD)
lamp(4.0, 1.5)
lamp(13.0, 1.5)

# ═══════════ HALL OF LEGENDS (safe, cell -103,78) ═══════════
for (x0, z0, x1, z1) in [(48.0, 32.0, 64.0, 32.4), (63.6, 32.0, 64.0, 48.0), (48.0, 47.6, 64.0, 48.0)]:
    B.box2(x0, 0, z0, x1, 1.2, z1, STONE, collide=True)
    B.box2(x0, 1.2, z0, x1, 1.3, z1, GOLD)
lx, _, lz = L['leaderboard']
B.box(lx, 3.4, lz, 9.0, 6.4, 0.3, STONE)                  # board backing (text at runtime, faces south)
B.box(lx, 3.4, lz - 0.17, 8.4, 5.8, 0.04, SCREEN)
B.box(lx, 6.75, lz, 9.4, 0.3, 0.5, GOLD)
for s in (-1, 1):
    B.box(lx + s * 4.8, 3.3, lz, 0.6, 6.6, 0.6, STONE)
    B.box(lx + s * 4.8, 6.9, lz, 0.4, 0.5, 0.4, FIRE)
# champion statue plinth + floating crown
B.box(56, 0.5, 38, 2.4, 1.0, 2.4, MARBLE, collide=True)
B.box(56, 1.02, 38, 2.5, 0.05, 2.5, GOLD)
B.ring(56, 2.6, 38, 0.45, 0.6, 0.35, GOLD, seg=12)
for k in range(6):
    a = math.radians(k * 60)
    B.octa(56 + math.cos(a) * 0.52, 3.05, 38 + math.sin(a) * 0.52, 0.08, 0.14, BLOOD)
for (x, z) in [(50, 34), (62, 34)]:
    lamp(x, z)

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
