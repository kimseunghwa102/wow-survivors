"""
Potion pickups: models/pot_hp.glb (Blood Potion), models/pot_rage.glb (Rage Elixir). ~0.7 m tall, bob/spin in view.ts.
Run: python3 blender/build_potions.py
"""
import os, sys, json, math
sys.path.insert(0, os.path.dirname(__file__))
from fxlib import *  # noqa

for name, col, hot in [('pot_hp', '#FF2A3D', (1, 0.75, 0.75)), ('pot_rage', '#FF8A1A', (1, 0.95, 0.7))]:
    M = scene()
    glass = M.add(f'{name}_glass', '#FFFFFF', 0.1, 0.05, '#FFFFFF', 0.3, alpha=0.35)
    liquid = M.add(f'{name}_liquid', col, 0.0, 0.2, col, 4.0)
    cork = M.add(f'{name}_cork', '#8A5A2A', 0.0, 0.9)
    gold = M.add(f'{name}_gold', '#E9B949', 0.95, 0.2, '#7A5200', 0.6)
    glow = tmat(M, f'{name}_glow', t_radial(f'{name}_glow.png', col, hot, spikes=6, power=2.2), 3.0)
    B = Builder(M)
    B.sphere(0, 0.28, 0, 0.2, liquid, 12, 8, ry=0.18)
    B.sphere(0, 0.3, 0, 0.24, glass, 12, 8, ry=0.23)
    B.cyl(0, 0.5, 0, 0.07, 0.16, glass, seg=10)
    B.cyl(0, 0.5, 0, 0.055, 0.1, liquid, seg=10)
    B.cyl(0, 0.64, 0, 0.08, 0.08, cork, seg=10)
    B.ring(0, 0.5, 0, 0.07, 0.1, 0.03, gold, seg=12)
    cross3(B, 0.9, glow)
    B.emit('fx')
    finish(name)
print('POTIONS', json.dumps(REPORT))
