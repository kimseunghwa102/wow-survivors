"""WOW NIGHTSWARM — cozy Christmas jazz loop, fully synthesised (no third-party audio).
"Jingle Bells" (J. Pierpont, 1857 — public domain) in a swing-trio arrangement:
upright walking bass, Rhodes comping, vibraphone lead, brushes + ride, sleigh bells.
python3 blender/make_xmas_jazz.py → sounds/music.mp3 (seamless stereo loop)"""
import os, subprocess, wave, sys
import numpy as np
from scipy import signal

sys.path.insert(0, os.path.dirname(__file__))
from make_sfx import SR, OUT, adsr, expdec, osc, noise, bp, lp, hp, reverb, note  # noqa: E402

rng = np.random.default_rng(1225)
BPM = 132
BEAT = 60 / BPM
KEY = -7  # written in C, sounds in F major
SWING = 2 / 3


def sw(b):
    """swing a beat position: off-beat 8ths land on the triplet"""
    whole = np.floor(b + 1e-6)
    frac = b - whole
    if abs(frac - 0.5) < 1e-6:
        return whole + SWING
    return b


# ───────── form: 4-bar intro + two 16-bar choruses + loop-back ─────────
CH = {  # chord → (root pitch class, rootless voicing intervals)
    'maj7': [4, 7, 11, 14], '6': [4, 7, 9, 14], 'm7': [3, 7, 10, 14], '7': [4, 9, 10, 14],
    'm6': [3, 7, 9, 14], 'dim7': [3, 6, 9, 12]
}
R = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11, 'F#': 6}
intro = [[('D', 'm7'), ('G', '7')], [('E', 'm7'), ('A', '7')], [('D', 'm7'), ('G', '7')], [('D', 'm7'), ('G', '7')]]
chorus = [
    [('C', '6')], [('C', 'maj7'), ('A', 'm7')], [('D', 'm7'), ('G', '7')], [('C', 'maj7'), ('C', '7')],
    [('F', 'maj7')], [('C', 'maj7'), ('A', '7')], [('D', '7')], [('D', 'm7'), ('G', '7')],
    [('C', '6')], [('C', 'maj7'), ('A', 'm7')], [('D', 'm7'), ('G', '7')], [('C', 'maj7'), ('C', '7')],
    [('F', 'maj7')], [('F', 'm6')], [('D', 'm7'), ('G', '7')], [('C', '6'), ('A', '7')]
]
FORM = intro + chorus + chorus
BARS = len(FORM)
D = BARS * 4 * BEAT
N = int(SR * D)

# melody (written in C, MIDI, beats) — chorus of Jingle Bells
E, G_, C_, D_, F_ = 76, 79, 72, 74, 77
MEL = [
    [(E, 1), (E, 1), (E, 2)], [(E, 1), (E, 1), (E, 2)], [(E, 1), (G_, 1), (C_, 1.5), (D_, 0.5)], [(E, 4)],
    [(F_, 1), (F_, 1), (F_, 1.5), (F_, 0.5)], [(F_, 1), (E, 1), (E, 1), (E, 0.5), (E, 0.5)], [(E, 1), (D_, 1), (D_, 1), (E, 1)], [(D_, 2), (G_, 2)],
    [(E, 1), (E, 1), (E, 2)], [(E, 1), (E, 1), (E, 2)], [(E, 1), (G_, 1), (C_, 1.5), (D_, 0.5)], [(E, 4)],
    [(F_, 1), (F_, 1), (F_, 1.5), (F_, 0.5)], [(F_, 1), (E, 1), (E, 1), (E, 0.5), (E, 0.5)], [(G_, 1), (G_, 1), (F_, 1), (D_, 1)], [(C_, 4)]
]
# little vibes fills over the long notes in chorus 2 (bar index in chorus → (midi, beat, dur))
FILLS = {3: [(79, 2, 0.5), (81, 2.5, 0.5), (79, 3, 0.5), (76, 3.5, 0.5)],
         7: [(83, 2.5, 0.5), (86, 3, 0.5), (83, 3.5, 0.5)],
         11: [(79, 2, 0.5), (84, 2.5, 0.5), (83, 3, 0.5), (79, 3.5, 0.5)],
         15: [(76, 2, 0.5), (79, 2.5, 0.5), (84, 3, 0.5), (88, 3.5, 0.5)]}

L = np.zeros(N + SR * 4)
Rch = np.zeros(N + SR * 4)


def put(x, sec, pan=0.0, gain=1.0):
    """add a mono sound at time sec, equal-power pan -1..1; wraps past the loop end"""
    s = int(sec * SR)
    if s < 0:
        s += N
    a = np.cos((pan + 1) * np.pi / 4) * gain
    b = np.sin((pan + 1) * np.pi / 4) * gain
    e = min(len(L), s + len(x))
    L[s:e] += x[:e - s] * a
    Rch[s:e] += x[:e - s] * b


def t_of(bar, beat):
    return (bar * 4 + beat) * BEAT


# ───────── instruments ─────────
def upright(m, d):
    f = note(m)
    n = int(SR * (d + 0.25))
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + np.sin(4 * np.pi * f * t) * 0.45 * expdec(n, 9) + np.sin(6 * np.pi * f * t) * 0.2 * expdec(n, 16)
    x *= adsr(n, 0.006, 0.12, 0.55, 0.18, 4.0) * expdec(n, 1.6)
    thump = lp(noise(0.05), 600) * expdec(int(0.05 * SR), 70) * 0.5
    x[:len(thump)] += thump
    return lp(x, 1800)


def rhodes(m, d, vel=1.0):
    f = note(m)
    n = int(SR * (d + 0.6))
    t = np.arange(n) / SR
    idx = 1.6 * vel * np.exp(-t * 5)
    body = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    tine = 0.18 * vel * np.sin(2 * np.pi * f * 14.0 * t) * np.exp(-t * 28)
    trem = 1 + 0.12 * np.sin(2 * np.pi * 4.6 * t)
    env = adsr(n, 0.004, 0.25, 0.55, 0.45, 3.0)
    gate = np.ones(n)
    off = int(d * SR)
    gate[off:] = np.exp(-np.arange(n - off) / SR * 9)
    return (body + tine) * trem * env * gate * 0.5


def vibes(m, d, vel=1.0):
    f = note(m)
    n = int(SR * max(1.6, d + 1.0))
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.22 * np.sin(2 * np.pi * f * 4.0 * t) * np.exp(-t * 6) + 0.07 * np.sin(2 * np.pi * f * 10.0 * t) * np.exp(-t * 14)
    trem = 1 + 0.32 * np.sin(2 * np.pi * 5.2 * t)
    env = np.exp(-t * 1.5) * np.minimum(1, t / 0.002)
    damp = np.ones(n)
    off = int((d + 0.08) * SR)
    if off < n:
        damp[off:] = np.exp(-np.arange(n - off) / SR * 12)
    mallet = hp(noise(0.012), 2500) * np.linspace(1, 0, int(0.012 * SR)) * 0.08
    x = x * trem * env * damp * 0.55 * vel
    x[:len(mallet)] += mallet
    return x


def celesta(m, d):
    f = note(m)
    n = int(SR * 1.2)
    t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 3 * t) * np.exp(-t * 8)) * np.exp(-t * 3.5) * np.minimum(1, t / 0.002) * 0.3


def ride(acc=1.0):
    n = int(SR * 1.4)
    t = np.arange(n) / SR
    metal = sum(np.sin(2 * np.pi * f * t + rng.random() * 6) for f in (3120, 4350, 5270, 6810, 7930, 9480)) / 6
    x = (bp(rng.standard_normal(n), 4500, 14000) * 0.6 + metal * 0.5) * np.exp(-t * 3.2) * np.minimum(1, t / 0.0015)
    ping = np.sin(2 * np.pi * 760 * t) * np.exp(-t * 18) * 0.15
    return (x + ping) * 0.11 * acc


def brush_swish():
    n = int(SR * 0.42)
    t = np.arange(n) / SR
    env = np.sin(np.pi * np.minimum(1, t / 0.42)) ** 1.5
    return bp(noise(0.42, 'pink'), 1500, 9000)[:n] * env * 0.05


def brush_tap():
    n = int(SR * 0.18)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 900, 7000) * np.exp(-t * 30) * 0.09 + np.sin(2 * np.pi * 190 * t) * np.exp(-t * 35) * 0.05


def hat_chick():
    n = int(SR * 0.07)
    t = np.arange(n) / SR
    return bp(rng.standard_normal(n), 6000, 15000) * np.exp(-t * 70) * 0.06


def sleigh(gain=1.0):
    """a shake of jingle bells: many tiny inharmonic pellet bells"""
    n = int(SR * 0.35)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for _ in range(14):
        st = int(rng.random() * 0.06 * SR)
        f = rng.uniform(5200, 9800)
        ln = n - st
        tt = t[:ln]
        x[st:] += np.sin(2 * np.pi * f * tt) * np.exp(-tt * rng.uniform(18, 30)) * rng.uniform(0.3, 1.0)
    x += bp(rng.standard_normal(n), 7000, 14000) * np.exp(-t * 22) * 0.6
    return x * 0.045 * gain


def voicing(root, kind):
    notes = []
    for iv in CH[kind]:
        m = 48 + (R[root] + iv) % 12
        while m < 53:
            m += 12
        notes.append(m + KEY + 7)  # keep the comp in a warm middle register after transposition
    return sorted(notes)


# ───────── arrange ─────────
chords_by_beat = []
for bar, chs in enumerate(FORM):
    per = 4 / len(chs)
    for i, (root, kind) in enumerate(chs):
        chords_by_beat.append((bar * 4 + i * per, per, root, kind))

# walking bass
for ci, (b0, dur, root, kind) in enumerate(chords_by_beat):
    nxt = chords_by_beat[(ci + 1) % len(chords_by_beat)]
    r = 36 + R[root]
    if r > 45:
        r -= 12
    tones = [r, r + CH[kind][0], r + 7, r + CH[kind][2] - 12 if CH[kind][2] > 9 else r + 9]
    nr = 36 + R[nxt[2]]
    if nr > 45:
        nr -= 12
    beats = int(round(dur))
    line = []
    for k in range(beats):
        if k == 0:
            line.append(r)
        elif k == beats - 1:
            line.append(nr + (1 if rng.random() < 0.5 else -1))  # chromatic approach
        else:
            line.append(tones[1 + (k + int(rng.random() * 2)) % 3])
    for k, m in enumerate(line):
        bt = b0 + k
        put(upright(m + KEY + 12, BEAT * 0.95), bt * BEAT + rng.normal(0, 0.004), pan=0.0, gain=0.95 if k % 2 == 0 else 0.85)

# Rhodes comping (Charleston-ish, a little varied every bar)
for bar, chs in enumerate(FORM):
    per = 4 / len(chs)
    for i, (root, kind) in enumerate(chs):
        v = voicing(root, kind)
        base = bar * 4 + i * per
        hits = [(0, 0.55, 0.9), (1.5, 0.45, 0.7)] if per == 4 else [(0, 0.9, 0.85)]
        if per == 4 and rng.random() < 0.45:
            hits.append((3.5, 0.4, 0.6))
        if per == 2 and rng.random() < 0.4:
            hits = [(-0.5 if i == 1 else 0, 0.9, 0.8)]  # anticipation
        for (o, ln, vel) in hits:
            st = sw(base + o) if o >= 0 else base + o + (SWING - 0.5)
            for j, m in enumerate(v):
                put(rhodes(m, ln * BEAT * 1.6, vel), st * BEAT + j * 0.006, pan=-0.35, gain=0.18)

# melody: chorus 1 on vibes, chorus 2 vibes + celesta an octave up, with fills
for ch in (0, 1):
    for bi, notes in enumerate(MEL):
        bar = 4 + ch * 16 + bi
        pos = 0.0
        for (m, d) in notes:
            st = sw(bar * 4 + pos)
            ln = d * BEAT * (0.92 if d >= 1 else 0.8)
            # a touch of jazz phrasing: late, softer repeated notes
            human = rng.normal(0.01, 0.006)
            vel = 1.0 if pos == 0 else 0.85
            put(vibes(m + KEY + 12, ln, vel), st * BEAT + human, pan=0.3, gain=0.42)
            if ch == 1:
                put(celesta(m + KEY + 24, ln), st * BEAT + human + 0.004, pan=0.45, gain=0.35)
            pos += d
        if ch == 1 and bi in FILLS:
            for (m, b, d) in FILLS[bi]:
                put(vibes(m + KEY + 12, d * BEAT * 0.8, 0.75), sw(bar * 4 + b) * BEAT, pan=0.3, gain=0.34)

# intro: celesta twinkles over the vamp
for bar in range(4):
    for k, m in enumerate([84, 88, 91, 86] if bar % 2 == 0 else [83, 86, 89, 84]):
        put(celesta(m + KEY + 12, 0.4), sw(bar * 4 + k * 1.0 + 0.5) * BEAT, pan=0.5, gain=0.5)

# drums: ride "ding ding-a ding ding-a", brush swish on 2 & 4, hat chick on 2 & 4, light taps
for bar in range(BARS):
    for k in range(4):
        b = bar * 4 + k
        put(ride(1.0 if k % 2 == 1 else 0.8), b * BEAT, pan=0.55)
        if k % 2 == 1:
            put(ride(0.55), (b + SWING) * BEAT, pan=0.55)
            put(hat_chick(), b * BEAT, pan=-0.2)
            put(brush_tap(), b * BEAT, pan=-0.1)
        put(brush_swish(), b * BEAT, pan=-0.15, gain=0.9 if k % 2 == 1 else 0.6)
    if bar % 4 == 3:  # little snare comp at phrase ends
        put(brush_tap(), (bar * 4 + 3 + SWING) * BEAT, pan=-0.1, gain=0.8)

# sleigh bells: quarters in chorus 1, swung 8ths in chorus 2
for bar in range(4, BARS):
    second = bar >= 20
    for k in range(4):
        put(sleigh(1.0 if k % 2 == 0 else 0.7), (bar * 4 + k) * BEAT, pan=-0.6)
        if second:
            put(sleigh(0.45), (bar * 4 + k + SWING) * BEAT, pan=-0.6)

# ───────── mix, room, seamless loop, master ─────────
wetL = reverb(L, 1.9, 0.32, 5000)
wetR = reverb(Rch, 1.9, 0.32, 5000)


def wrap(x):
    loop = x[:N].copy()
    tail = x[N:]
    loop[:len(tail)] += tail
    return loop


outL, outR = wrap(wetL), wrap(wetR)
# gentle warmth: tilt down the highs, glue with soft compression
outL, outR = lp(outL, 11000), lp(outR, 11000)
peak = max(np.max(np.abs(outL)), np.max(np.abs(outR))) + 1e-9
outL, outR = np.tanh(outL / peak * 1.25) * 0.86, np.tanh(outR / peak * 1.25) * 0.86

path = os.path.join(OUT, 'music.wav')
st = np.stack([outL, outR], axis=1)
with wave.open(path, 'w') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((st * 32767).astype(np.int16).tobytes())
mp3 = os.path.join(OUT, 'music.mp3')
subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-codec:a', 'libmp3lame', '-b:a', '128k', mp3], check=True)
os.remove(path)
print(f'xmas jazz  {D:5.1f}s, {BARS} bars @ {BPM} bpm → music.mp3 ({os.path.getsize(mp3) // 1024} KB)')
