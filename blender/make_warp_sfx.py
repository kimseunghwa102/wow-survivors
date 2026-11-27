"""GOD'S ASCENT warp: a rising vortex whoosh that sucks you in (1.1 s), then a golden bell chord + boom on arrival.
python3 blender/make_warp_sfx.py → sounds/warp.wav"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(__file__))
from make_sfx import SR, T, noise, sweep_filter, osc, sweep, expdec, bell, reverb, mix, at, save, note, lp  # noqa

D = 1.1
n = int(D * SR)
env = np.linspace(0, 1, n) ** 2.2
whoosh = sweep_filter(noise(D, 'pink'), 180, 5200, q=3.0) * env * 0.9
swirl = osc(sweep(90, 620, D), D) * env * 0.18 * (0.6 + 0.4 * np.sin(2 * np.pi * T(D) * (6 + 18 * T(D))))
suck = np.concatenate([whoosh + swirl])
# the gulp: short low thump as you're swallowed
gulp = osc(sweep(140, 38, 0.45), 0.45) * expdec(int(0.45 * SR), 9) * 0.9
# arrival: golden chord (C major 9 up high) + air
chord = sum(bell(note(m), 2.6, 0.9) * a for m, a in ((72, 0.30), (76, 0.24), (79, 0.22), (83, 0.16), (86, 0.14)))
air = lp(noise(1.6, 'pink'), 3000) * expdec(int(1.6 * SR), 3) * 0.12
x = mix(suck, at(gulp, D - 0.04), at(chord, D + 0.02), at(air, D))
x = reverb(x, 2.4, 0.38, 6000)
save('warp', x, peak_db=-1.0)
