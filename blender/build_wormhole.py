"""Walk-in wormhole between the two casinos: a vertical swirl (diameter 1, facing ±z, centred on the origin).
Run: python3 blender/build_wormhole.py → models/fx_wormhole.glb"""
import os, sys, math
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa
M = scene()
sw = tmat(M, 'wh_swirl', t_rune('fx_wh_swirl.png', '#9A4BFF', (1, 0.85, 1), n=512, petals=7, seed=33), 5)
rg = tmat(M, 'wh_ring', t_shock('fx_wh_ring.png', '#FFB040', (1, 1, 0.8), rings=2), 6)
core = M.add('wh_core', '#05000A', 0.0, 0.2, '#2A0050', 0.6)
B = Builder(M)
h = 0.5
for z, m in ((0.0, sw), (0.02, rg)):
    B.quad((-h, -h, z), (h, -h, z), (h, h, z), (-h, h, z), m)
    B.quad((h, -h, -z), (-h, -h, -z), (-h, h, -z), (h, h, -z), m)
B.sphere(0, 0, 0, 0.14, core, 10, 8, rz=0.04)
B.emit('fx')
finish('fx_wormhole')
print('ok')
