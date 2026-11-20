"""
VOID WINGS — worn by hunters who slew NIGHTSWARM (Lv 200). Attached to the avatar's upper spine.
Origin = between the shoulder blades, wings spread along ±x, trailing to -z. Clip "Idle" = slow flap.
Run: python3 blender/build_slayer.py → models/cos_void_wings.glb
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from rig import *  # noqa

M = new_scene()
BONE = M.add('vw_bone', '#14101C', 0.6, 0.3, '#2A0A4A', 0.5)
GOLD = M.add('vw_gold', '#E9B949', 0.95, 0.2, '#7A5200', 0.6)
MEMB = M.add('vw_membrane', '#3A0A6A', 0.0, 0.5, '#9A2BFF', 2.2, alpha=0.85)
GLOW = M.add('vw_glow', '#FFD86A', 0.0, 0.3, '#FFC24A', 7.0)
parts = []
core = Builder(M)
core.octa(0, 0.05, -0.08, 0.07, 0.12, GLOW)
core.sphere(0, 0.05, -0.06, 0.1, GOLD, 8, 5)
parts += core.emit('vw_core')
for s in (-1, 1):
    b = Builder(M)
    sh = (s * 0.08, 0.05, -0.1)
    el = (s * 0.55, 0.42, -0.22)
    wr = (s * 1.05, 0.55, -0.3)
    tips = [(s * 1.25, 0.05, -0.38), (s * 1.0, -0.3, -0.36), (s * 0.65, -0.45, -0.3), (s * 0.3, -0.42, -0.22)]
    for p0, p1, r in [(sh, el, 0.035), (el, wr, 0.028)]:
        dx, dy, dz = p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]
        ln = math.sqrt(dx * dx + dy * dy + dz * dz)
        b.box((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, r, r, ln, BONE,
              yaw=math.degrees(math.atan2(dx, dz)), pitch=-math.degrees(math.atan2(dy, math.hypot(dx, dz))))
    for tp in tips:
        dx, dy, dz = tp[0] - wr[0], tp[1] - wr[1], tp[2] - wr[2]
        ln = math.sqrt(dx * dx + dy * dy + dz * dz)
        b.box((wr[0] + tp[0]) / 2, (wr[1] + tp[1]) / 2, (wr[2] + tp[2]) / 2, 0.018, 0.018, ln, GOLD,
              yaw=math.degrees(math.atan2(dx, dz)), pitch=-math.degrees(math.atan2(dy, math.hypot(dx, dz))))
        b.octa(tp[0], tp[1], tp[2], 0.03, 0.06, GLOW)
    b.octa(wr[0], wr[1] + 0.08, wr[2], 0.04, 0.12, GOLD)
    pts = [sh, el, wr] + tips + [(s * 0.1, -0.2, -0.15)]
    fs = []
    for i in range(2, len(pts) - 1):
        fs.append([0, i, i + 1])
    fs.append([0, 1, 2])
    # both windings so the membrane shows from front and back
    b.faces(b.a(MEMB), pts, fs + [f[::-1] for f in fs])
    obj = b.emit(f'vw_wing{s}')
    pv = pivot(f'vw_wingpv{s}', sh, obj)
    key_rot(pv, 'y', [(1, s * -8), (13, s * 22), (25, s * -8)])
    parts.append(pv)
root = pivot('cos_void_wings', (0, 0, 0), parts)
finish('cos_void_wings')
print('SLAYER', json.dumps(REPORT))
