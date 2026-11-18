"""Concept B: high ribbed roof ring with a big open oculus over each arena hall (preview only)."""
import bpy, math, os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
from common import *  # noqa
from textures_hd import tex_slate, tex_blocks

bpy.ops.wm.read_factory_settings(use_empty=True)
M = Mats()
SLATE = M.add('dome_slate', tex=tex_slate('slate.jpg'), rough=0.6, tile=2.5)
STONE = M.add('dome_rib', tex=tex_blocks('castle_block.jpg'), rough=0.9, tile=2.0)
GOLD = M.add('dome_gold', '#E9B949', 0.9, 0.25, '#7A5200', 0.5)
GLOW = M.add('dome_lantern', '#FFC060', 0.0, 0.4, '#FF8A1E', 8.0)
GLASS = M.add('dome_glass', '#8A5BFF', 0.1, 0.1, '#5A2BCF', 1.2, alpha=0.55)
B = Builder(M)


def superellipse(t, a, b, p=4.0):
    c, s = math.cos(t), math.sin(t)
    return a * math.copysign(abs(c) ** (2 / p), c), b * math.copysign(abs(s) ** (2 / p), s)


def dome(cx, cz, a, b, y0=7.7, y1=21.0, inner=0.52, segs=64, rows=7):
    def P(i, j):
        t = 2 * math.pi * i / segs
        s = j / rows
        k = 1 - (1 - inner) * s
        x, z = superellipse(t, a * k, b * k)
        y = y0 + (y1 - y0) * math.sin(s * math.pi / 2)
        return (cx + x, y, cz + z)
    for i in range(segs):
        for j in range(rows):
            m = GLASS if (j in (2, 3) and i % 4 in (1, 2)) else SLATE
            B.faces(B.a(m), [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], [[0, 1, 2, 3]])
    # ribs + lanterns
    for i in range(0, segs, 4):
        for j in range(rows):
            p0, p1 = P(i, j), P(i, j + 1)
            dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
            ln = math.sqrt(dx * dx + dy * dy + dz * dz)
            B.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.25, (p0[2] + p1[2]) / 2, 0.55, 0.55, ln + 0.1, STONE,
                  yaw=math.degrees(math.atan2(dx, dz)), pitch=-math.degrees(math.atan2(dy, math.hypot(dx, dz))))
        lx, ly, lz = P(i, rows)
        B.box(lx, ly - 2.2, lz, 0.05, 4.0, 0.05, GOLD)
        B.octa(lx, ly - 4.4, lz, 0.35, 0.5, GLOW)
    # golden oculus ring
    for i in range(segs):
        p0, p1 = P(i, rows), P(i + 1, rows)
        dx, dz = p1[0] - p0[0], p1[2] - p0[2]
        B.box((p0[0] + p1[0]) / 2, p0[1] + 0.2, (p0[2] + p1[2]) / 2, 0.7, 0.6, math.hypot(dx, dz) + 0.05, GOLD, yaw=math.degrees(math.atan2(dx, dz)))


dome(32, 24, 15.6, 23.6)   # the Rift (R1)
dome(16, 64, 15.6, 15.4, y1=19.0, inner=0.5)  # cathedral court (R2)
objs = B.emit('dome')
print('DOME tris', tri_count(objs))
export(os.path.join('/tmp', 'concept_dome.glb'))
