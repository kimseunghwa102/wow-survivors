"""Raid audio for THE PALE SOVEREIGN — dread music loop + boss sound design (all synthesised).
python3 blender/make_raid_sfx.py → raid/sounds/*"""
import os, subprocess, sys, wave
import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
import make_sfx as S
from make_sfx import SR, T, adsr, expdec, osc, sweep, noise, bp, lp, hp, sweep_filter, softclip, reverb, mix, at, note, bell

OUT = os.path.join(S.ROOT, 'raid', 'sounds')
os.makedirs(OUT, exist_ok=True)
S.OUT = OUT
rng = np.random.default_rng(31)


def growl(d, f0=48, f1=30, rough=1.0):
    """throaty growl: low saws with jittered pitch + formant band + noisy rasp"""
    n = int(SR * d)
    t = T(d)
    jit = 1 + 0.03 * np.interp(t, np.linspace(0, d, int(d * 40)), rng.standard_normal(int(d * 40)))
    f = (f0 * (f1 / f0) ** (t / d)) * jit
    ph = 2 * np.pi * np.cumsum(f) / SR
    saw = sum((np.mod(ph * k / (2 * np.pi), 1) * 2 - 1) / k for k in (1, 2, 3, 5, 8))
    rasp = bp(noise(d, 'white'), 200, 1800) * (0.5 + 0.5 * np.sin(2 * np.pi * 34 * t)) * rough
    x = mix(bp(saw, 60, 900) * 1.0, rasp * 0.5)
    x = sweep_filter(x, 300, 1200, q=2, kind='bp') * 0.7 + x * 0.5
    return softclip(x * adsr(n, 0.15, 0.4, 0.8, d * 0.35), 2.2)


def r_roar():
    d = 4.5
    g = growl(d, 62, 34) + growl(d, 31, 22, 0.6) * 0.7
    sub = osc(sweep(55, 28, d), d) * adsr(int(SR * d), 0.3, 0.5, 0.7, 1.4) * 0.8
    choir = sum(osc(note(m), d, 'tri') for m in (38, 39, 45, 50)) * 0.12  # dissonant cluster
    choir = bp(choir, 150, 2000) * adsr(int(SR * d), 1.0, 0.5, 0.6, 1.5)
    return reverb(mix(g, sub, choir), 3.5, 0.45, 2200)


def r_laugh():
    """slow, deep 'heh… heh… heh…' made of growl pulses"""
    d = 3.2
    x = np.zeros(int(SR * d))
    for k, (st, f) in enumerate([(0.0, 70), (0.55, 64), (1.1, 58), (1.7, 52)]):
        g = growl(0.42, f, f * 0.85, 0.8) * (1 - k * 0.12)
        x = mix(x, at(g, st, d))
    return reverb(x, 3.0, 0.5, 2000)


def r_swing():
    d = 1.6
    n = int(SR * d)
    w = sweep_filter(noise(d, 'pink'), 180, 3200, q=3, kind='bp') * np.sin(np.pi * np.clip(T(d) / 0.9, 0, 1)) ** 2
    ring = sum(osc(f, d) * expdec(n, 3) for f in (1240, 1873, 2711)) * 0.08
    low = osc(sweep(90, 40, d), d) * np.sin(np.pi * np.clip(T(d) / 0.9, 0, 1)) * 0.6
    return reverb(mix(w * 1.3, at(ring, 0.55, d), low), 2.2, 0.3)


def r_slam():
    d = 3.2
    n = int(SR * d)
    boom = osc(sweep(80, 22, d), d) * expdec(n, 2.2) * 1.4
    crack = hp(noise(0.5, 'white'), 1500) * expdec(int(SR * 0.5), 9) * 0.6
    debris = lp(noise(d, 'brown'), 400, 2) * expdec(n, 1.3) * 1.2
    rocks = np.zeros(n)
    for _ in range(26):
        st = rng.uniform(0.15, 2.4)
        g = bp(noise(0.06, 'white'), rng.uniform(800, 3000), rng.uniform(3500, 7000)) * expdec(int(SR * 0.06), 30) * rng.uniform(0.1, 0.35)
        rocks = mix(rocks, at(g, st, d))
    return reverb(softclip(mix(boom, at(crack, 0, d), debris, rocks), 1.8), 3.0, 0.35, 3000)


def r_erupt():
    d = 2.2
    n = int(SR * d)
    whoosh = sweep_filter(noise(d, 'pink'), 120, 2400, q=1.4, kind='lp') * adsr(n, 0.05, 0.4, 0.6, 1.2) * 1.2
    bub = np.zeros(n)
    for _ in range(40):
        st = rng.uniform(0, 1.8)
        f = rng.uniform(90, 260)
        g = osc(sweep(f, f * 1.8, 0.08), 0.08) * expdec(int(SR * 0.08), 25) * 0.25
        bub = mix(bub, at(g, st, d))
    return reverb(mix(whoosh, bub, lp(noise(d, 'brown'), 150) * adsr(n, 0.02, 0.3, 0.6, 1.2)), 2.0, 0.3)


def r_bolt():
    d = 1.4
    n = int(SR * d)
    wail = osc(sweep(900, 420, d), d, 'sin') * (1 + 0.3 * np.sin(2 * np.pi * 7 * T(d))) * adsr(n, 0.05, 0.3, 0.6, 0.6) * 0.5
    wail2 = osc(sweep(1350, 610, d), d, 'tri') * adsr(n, 0.08, 0.3, 0.5, 0.6) * 0.25
    air = bp(noise(d, 'white'), 2000, 6000) * adsr(n, 0.05, 0.3, 0.4, 0.6) * 0.2
    return reverb(mix(wail, wail2, air), 2.5, 0.45)


def r_timestop():
    d = 3.0
    n = int(SR * d)
    tick = np.zeros(n)
    for k in range(8):
        st = k * 0.32 * (1 + k * 0.08)
        tick = mix(tick, at(bp(noise(0.02, 'white'), 2000, 6000) * expdec(int(SR * 0.02), 60) * 0.7, st, d))
    tone = osc(sweep(400, 90, d), d, 'tri') * adsr(n, 0.05, 0.5, 0.6, 1.0) * 0.3
    shimmer = sum(bell(f, d, 0.6) for f in (880, 1320, 1975)) * 0.15
    return reverb(mix(tick, tone, shimmer), 3.0, 0.5)


def r_hit():
    d = 0.35
    n = int(SR * d)
    thud = osc(sweep(160, 70, d), d) * expdec(n, 14) * 0.9
    bone = bp(noise(d, 'white'), 1200, 5000) * expdec(n, 30) * 0.5
    return reverb(mix(thud, bone), 0.8, 0.15)


def r_hurt():
    d = 0.6
    n = int(SR * d)
    return reverb(softclip(osc(sweep(220, 90, d), d, 'saw') * expdec(n, 6) * 0.6 + bp(noise(d, 'pink'), 300, 2000) * expdec(n, 9) * 0.4, 2), 1.0, 0.2)


def r_death():
    d = 9.0
    n = int(SR * d)
    g = growl(5.5, 70, 18, 1.2)
    scream = sweep_filter(osc(sweep(420, 60, 5.5), 5.5, 'saw'), 2500, 200, q=2, kind='lp') * adsr(int(SR * 5.5), 0.1, 0.6, 0.7, 2.5) * 0.35
    collapse = mix(at(r_slam(), 3.4, d), at(r_slam() * 0.7, 4.6, d))
    choir = sum(osc(note(m), d, 'tri') for m in (50, 57, 62, 66, 69)) * 0.1  # final, almost holy major chord
    choir = bp(choir, 200, 3000) * adsr(n, 3.0, 1.0, 0.7, 3.0)
    return reverb(mix(at(g, 0, d), at(scream, 0, d), collapse, at(choir, 3.0, d)), 4.0, 0.45, 2600)


def r_loot():
    d = 3.5
    n = int(SR * d)
    arp = np.zeros(n)
    for k, m in enumerate((62, 66, 69, 74, 78, 81, 86)):
        arp = mix(arp, at(bell(note(m), 1.6, 1.2) * 0.4, k * 0.09, d))
    pad = sum(osc(note(m), d, 'tri') for m in (50, 57, 62, 66)) * adsr(n, 0.4, 0.5, 0.6, 1.5) * 0.12
    coins = np.zeros(n)
    for _ in range(30):
        st = rng.uniform(0.2, 1.6)
        coins = mix(coins, at(bell(rng.uniform(2800, 4200), 0.25, 1.5) * 0.12, st, d))
    return reverb(mix(arp, pad, coins), 2.5, 0.4)


def r_portal():
    d = 2.4
    n = int(SR * d)
    sw = sweep_filter(noise(d, 'pink'), 200, 4000, q=5, kind='bp') * np.sin(np.pi * T(d) / d) * 0.9
    tone = sum(osc(sweep(f, f * 2, d), d, 'sin') for f in (110, 165, 220)) * np.sin(np.pi * T(d) / d) * 0.2
    return reverb(mix(sw, tone), 3.0, 0.5)


def music():
    """dread loop: 96 s. low drones, dissonant choir swells, slow heartbeat, a tolling bell, wind."""
    d = 96.0
    n = int(SR * d)
    t = T(d)
    L = np.zeros(n)
    R = np.zeros(n)
    # drones (D minor-ish with a b2): beating saws through a slow-moving lowpass
    for (m, det, pan) in [(26, 0.003, -0.4), (26.1, -0.004, 0.4), (33, 0.002, 0.0), (27, 0.0015, 0.2)]:
        f = note(m)
        x = osc(f * (1 + det), d, 'saw') * (0.6 if m != 27 else 0.25)
        cut = 180 + 140 * (0.5 + 0.5 * np.sin(2 * np.pi * t / 24 + m))
        x = lp(x, 260, 2) * (0.7 + 0.3 * np.sin(2 * np.pi * t / 17 + m))
        L += x * (1 - pan) * 0.5
        R += x * (1 + pan) * 0.5
    # choir swells: clusters of 'aah' (formant-filtered saws), one every 16 s
    for k, chord in enumerate([(50, 51, 57), (49, 53, 56), (50, 56, 57, 61), (46, 50, 51, 57), (50, 53, 59), (49, 50, 56)]):
        st = 4 + k * 16
        dd = 11
        nn = int(SR * dd)
        c = sum(osc(note(m) * (1 + 0.004 * np.sin(2 * np.pi * 5 * T(dd) + m)), dd, 'saw') for m in chord)
        c = bp(c, 500, 900) * 0.6 + bp(c, 1100, 1500) * 0.3 + bp(c, 2400, 2800) * 0.1
        c = c * np.sin(np.pi * np.clip(T(dd) / dd, 0, 1)) ** 2 * 0.22
        L += at(c, st, d) * (0.8 if k % 2 else 1.0)
        R += at(c, st, d) * (1.0 if k % 2 else 0.8)
    # heartbeat (lub-dub) at 50 bpm from 8 s, growing louder through each 32 s phrase
    beat = 60 / 50
    k = 0
    tt = 8.0
    while tt < d - 1:
        g = 0.4 + 0.6 * ((tt % 32) / 32)
        for (off, f, a) in ((0, 52, 1.0), (0.22, 44, 0.7)):
            h = osc(sweep(f * 1.6, f, 0.25), 0.25) * expdec(int(SR * 0.25), 14) * a * g * 0.9
            L += at(h, tt + off, d)
            R += at(h, tt + off, d)
        tt += beat
    # tolling funeral bell every 24 s
    for st in np.arange(2, d, 24):
        b = bell(note(38), 6.0, 0.8) * 0.4 + bell(note(50), 6.0, 0.6) * 0.15
        L += at(b, st, d) * 0.9
        R += at(b, st, d)
    # wind
    wind = sweep_filter(noise(d, 'pink'), 200, 900, q=2, kind='bp') * (0.5 + 0.5 * np.sin(2 * np.pi * t / 13)) * 0.18
    L += wind
    R += np.roll(wind, int(SR * 0.7))
    L, R = reverb(L, 4.0, 0.45, 2500), reverb(R, 4.0, 0.45, 2500)
    L, R = L[:n], R[:n]
    fl = int(SR * 3)
    for ch in (L, R):  # seamless loop: crossfade the tail into the head
        ch[:fl] = ch[:fl] * np.linspace(0, 1, fl) + ch[-fl:] * np.linspace(1, 0, fl)
    L, R = L[:n - fl], R[:n - fl]
    pk = max(np.abs(L).max(), np.abs(R).max())
    L, R = np.tanh(L / pk * 1.4) * 0.85, np.tanh(R / pk * 1.4) * 0.85
    path = os.path.join(OUT, 'raid_music.wav')
    with wave.open(path, 'w') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.stack([L, R], 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-b:a', '112k', os.path.join(OUT, 'raid_music.mp3')], check=True)
    os.remove(path)
    print('raid_music.mp3', round(len(L) / SR, 1), 's')


if __name__ == '__main__':
    for name, fn in [('r_roar', r_roar), ('r_laugh', r_laugh), ('r_swing', r_swing), ('r_slam', r_slam), ('r_erupt', r_erupt), ('r_bolt', r_bolt),
                     ('r_timestop', r_timestop), ('r_hit', r_hit), ('r_hurt', r_hurt), ('r_death', r_death), ('r_loot', r_loot), ('r_portal', r_portal)]:
        S.save(name, fn(), -1.0)
    music()
