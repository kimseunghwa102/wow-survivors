"""Synthesised sound effects (no third-party audio). python3 blender/make_sfx.py → sounds/*.wav"""
import os, wave
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'sounds')
os.makedirs(OUT, exist_ok=True)
SR = 22050
rng = np.random.default_rng(1)


def t(d):
    return np.linspace(0, d, int(SR * d), endpoint=False)


def env(x, a=0.005, r=0.1):
    n = len(x)
    e = np.ones(n)
    na, nr = max(1, int(SR * a)), max(1, int(SR * r))
    e[:na] = np.linspace(0, 1, na)
    e[-nr:] *= np.linspace(1, 0, nr)
    return x * e


def tone(f, d, kind='sin', vol=0.5):
    x = t(d)
    ph = 2 * np.pi * np.cumsum(np.broadcast_to(f, x.shape)) / SR if np.ndim(f) else 2 * np.pi * f * x
    if kind == 'sin':
        w = np.sin(ph)
    elif kind == 'sq':
        w = np.sign(np.sin(ph)) * 0.6
    elif kind == 'saw':
        w = 2 * ((ph / (2 * np.pi)) % 1) - 1
    else:
        w = np.sin(ph)
    return w * vol


def save(name, x):
    x = np.clip(x, -1, 1)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32000).astype(np.int16).tobytes())


# hit: short noisy thwack
d = 0.07
save('hit.wav', env(rng.uniform(-1, 1, len(t(d))) * 0.4 * np.exp(-t(d) * 40) + tone(np.linspace(220, 90, len(t(d))), d, 'sq', 0.3), 0.001, 0.03))
# kill: pop
d = 0.12
save('kill.wav', env(tone(np.linspace(600, 120, len(t(d))), d, 'sq', 0.35) * np.exp(-t(d) * 18), 0.001, 0.04))
# gem: bright blip
d = 0.09
save('gem.wav', env(tone(np.linspace(1300, 1900, len(t(d))), d, 'sin', 0.35), 0.002, 0.05))
# coin: two-tone ding
save('coin.wav', np.concatenate([env(tone(1568, 0.06, 'sq', 0.25), 0.001, 0.02), env(tone(2093, 0.16, 'sq', 0.25), 0.001, 0.12)]))
# level up: rising arpeggio
notes = [523, 659, 784, 1047, 1319]
save('levelup.wav', np.concatenate([env(tone(f, 0.09, 'sq', 0.3) + tone(f * 2, 0.09, 'sin', 0.1), 0.002, 0.03) for f in notes] + [env(tone(1568, 0.35, 'sq', 0.3), 0.002, 0.3)]))
# hurt
d = 0.18
save('hurt.wav', env(tone(np.linspace(300, 110, len(t(d))), d, 'saw', 0.4) + rng.uniform(-0.2, 0.2, len(t(d))), 0.001, 0.08))
# chest: slot-machine spin then jackpot
spin = np.concatenate([env(tone(880 + (i % 3) * 220, 0.05, 'sq', 0.22), 0.001, 0.015) for i in range(22)])
win = np.concatenate([env(tone(f, 0.12, 'sq', 0.3), 0.002, 0.03) for f in [784, 988, 1175, 1568, 1175, 1568, 2093]])
save('jackpot.wav', np.concatenate([spin, win, env(tone(2093, 0.5, 'sin', 0.3), 0.002, 0.45)]))
# death: falling drone
d = 1.2
save('death.wav', env(tone(np.linspace(220, 40, len(t(d))), d, 'saw', 0.4), 0.01, 0.6))
# boss: low roar
d = 1.5
x = tone(55 + 8 * np.sin(t(d) * 18), d, 'saw', 0.45) + rng.uniform(-0.25, 0.25, len(t(d))) * np.exp(-t(d) * 2)
save('boss.wav', env(x, 0.05, 0.8))
# pvp kill: sword clash + fanfare
clash = env(rng.uniform(-1, 1, len(t(0.15))) * np.exp(-t(0.15) * 25) * 0.6 + tone(2600, 0.15, 'sin', 0.3) * np.exp(-t(0.15) * 15), 0.001, 0.05)
save('pvp.wav', np.concatenate([clash, np.concatenate([env(tone(f, 0.1, 'sq', 0.28), 0.002, 0.03) for f in [392, 523, 659, 784]])]))
# evolution: shimmering sweep
d = 1.4
x = sum(tone(np.linspace(300 * k, 900 * k, len(t(d))), d, 'sin', 0.12) for k in (1, 1.5, 2, 3))
save('evolve.wav', env(x, 0.05, 0.6))
print('SFX', sorted(os.listdir(OUT)))
