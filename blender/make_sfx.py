"""WOW NIGHTSWARM — studio-style synthesised sound effects + ambient music loop (no third-party audio).
44.1 kHz, layered oscillators / filtered noise / FM, convolution reverb, loudness-normalised.
python3 blender/make_sfx.py → sounds/*.wav + sounds/music.mp3"""
import os, subprocess, wave
import numpy as np
from scipy import signal

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'sounds')
os.makedirs(OUT, exist_ok=True)
SR = 44100
rng = np.random.default_rng(7)


# ───────────── building blocks ─────────────
def T(d):
    return np.arange(int(SR * d)) / SR


def adsr(n, a=0.005, d=0.05, s=0.6, r=0.1, curve=3.0):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sus = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, max(a, 1)) ** 0.7, s + (1 - s) * np.exp(-curve * np.linspace(0, 1, max(d, 1))),
                        np.full(sus, s), s * np.exp(-curve * np.linspace(0, 1, max(r, 1)))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def expdec(n, k):
    return np.exp(-k * np.arange(n) / SR)


def osc(f, d, kind='sin', phase=0.0):
    """f: scalar or array (Hz) → waveform"""
    n = int(SR * d)
    f = np.broadcast_to(np.asarray(f, float), (n,))
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    if kind == 'sin':
        return np.sin(ph)
    if kind == 'tri':
        return 2 / np.pi * np.arcsin(np.sin(ph))
    if kind == 'saw':   # band-limited-ish via polyblep-free soft saw
        return signal.sawtooth(ph) * 0.8
    if kind == 'sq':
        return signal.square(ph) * 0.6
    raise ValueError(kind)


def sweep(f0, f1, d, curve='exp'):
    n = int(SR * d)
    if curve == 'exp':
        return f0 * (f1 / f0) ** np.linspace(0, 1, n)
    return np.linspace(f0, f1, n)


def noise(d, color='white'):
    n = int(SR * d)
    x = rng.standard_normal(n)
    if color == 'pink':
        b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
        x = signal.lfilter(b, a, x) * 4
    if color == 'brown':
        x = np.cumsum(x)
        x = x - signal.savgol_filter(x, 2001 if n > 2001 else (n // 2) * 2 - 1, 1)
        x /= np.max(np.abs(x)) + 1e-9
    return x


def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)


def lp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'lowpass', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, 'highpass', fs=SR, output='sos'), x)


def sweep_filter(x, f0, f1, q=4.0, kind='bp', blocks=64):
    """time-varying filter by processing short overlapping blocks"""
    n = len(x)
    out = np.zeros(n)
    hop = max(256, n // blocks)
    win = np.hanning(hop * 2)
    fs = f0 * (f1 / f0) ** np.linspace(0, 1, n // hop + 2)
    for i, start in enumerate(range(0, n, hop)):
        seg = x[max(0, start - hop):start + hop]
        fc = np.clip(fs[i], 30, SR / 2 - 500)
        if kind == 'bp':
            sos = signal.butter(2, [fc / (1 + 1 / q), min(SR / 2 - 100, fc * (1 + 1 / q))], 'bandpass', fs=SR, output='sos')
        else:
            sos = signal.butter(2, fc, 'lowpass', fs=SR, output='sos')
        y = signal.sosfilt(sos, seg)
        w = win[:len(y)] if len(y) == len(win) else np.hanning(len(y))
        lo = max(0, start - hop)
        out[lo:lo + len(y)] += y * w
    return out


def fm(fc, fmod, index, d, idx_env=None):
    n = int(SR * d)
    t = np.arange(n) / SR
    ie = index * (idx_env if idx_env is not None else 1)
    return np.sin(2 * np.pi * fc * t + ie * np.sin(2 * np.pi * fmod * t))


def bell(f, d, bright=1.0):
    """inharmonic bell/crystal partials"""
    n = int(SR * d)
    x = np.zeros(n)
    for ratio, amp, k in [(1, 1, 3), (2.76, 0.5 * bright, 5), (5.4, 0.25 * bright, 8), (8.93, 0.12 * bright, 12), (0.5, 0.2, 2)]:
        x += amp * osc(f * ratio, d) * expdec(n, k / d * 1.2)
    return x


def softclip(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


_IR = {}


def reverb(x, size=1.6, wet=0.3, damp=4000, pre=0.012):
    key = (size, damp)
    if key not in _IR:
        n = int(SR * size)
        ir = rng.standard_normal(n) * np.exp(-6.9 * np.arange(n) / n)
        ir = lp(ir, damp)
        ir[:int(pre * SR)] = 0
        _IR[key] = ir / np.sqrt(np.sum(ir ** 2))
    tail = signal.fftconvolve(x, _IR[key])[:len(x) + int(SR * size * 0.7)]
    dry = np.pad(x, (0, len(tail) - len(x)))
    return dry * (1 - wet * 0.5) + tail * wet


def delay(x, t=0.18, fb=0.35, mix=0.3, reps=5):
    n = int(t * SR)
    out = np.pad(x, (0, n * reps))
    for k in range(1, reps + 1):
        out[n * k:n * k + len(x)] += x * mix * fb ** (k - 1)
    return out


def mix(*parts):
    n = max(len(p) for p in parts)
    return sum(np.pad(p, (0, n - len(p))) for p in parts)


def at(x, sec, total=None):
    pad = np.zeros(int(sec * SR))
    y = np.concatenate([pad, x])
    return y if total is None else np.pad(y, (0, max(0, int(total * SR) - len(y))))[:int(total * SR)]


def fade(x, fin=0.002, fout=0.02):
    a, b = int(fin * SR), int(fout * SR)
    x = x.copy()
    if a:
        x[:a] *= np.linspace(0, 1, a)
    if b:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def save(name, x, peak_db=-1.0, rms_db=None):
    x = x - np.mean(x)
    x = fade(x)
    if rms_db is not None:
        rms = np.sqrt(np.mean(x ** 2)) + 1e-9
        x *= 10 ** (rms_db / 20) / rms
    pk = np.max(np.abs(x)) + 1e-9
    lim = 10 ** (peak_db / 20)
    if pk > lim or rms_db is None:
        x *= lim / pk
    x = np.clip(x, -1, 1)
    idx = np.where(np.abs(x) > 10 ** (-55 / 20))[0]   # trim the silent reverb tail
    if len(idx):
        x = x[:min(len(x), idx[-1] + int(0.05 * SR))]
        fl = min(len(x) // 4, int(0.08 * SR))
        x[-fl:] *= np.linspace(1, 0, fl)
    with wave.open(os.path.join(OUT, f'{name}.wav'), 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    print(f'{name:10s} {len(x) / SR:5.2f}s')


def note(n):
    """midi note → Hz"""
    return 440 * 2 ** ((n - 69) / 12)


# ───────────── combat ─────────────
def s_hit():
    d = 0.16
    n = int(SR * d)
    body = osc(sweep(190, 55, d), d) * expdec(n, 28)
    crack = bp(noise(d), 1800, 6500) * expdec(n, 90) * 0.9
    thud = lp(noise(d, 'pink'), 600) * expdec(n, 40) * 0.8
    return softclip(body + crack + thud, 2.0)


def s_kill():
    d = 0.42
    n = int(SR * d)
    squelch = sweep_filter(noise(d, 'pink'), 2400, 300, q=3) * expdec(n, 12) * 1.4
    pop = osc(sweep(420, 90, 0.08), 0.08) * expdec(int(0.08 * SR), 40)
    shards = sum(bell(f, d, 1.4) * 0.12 for f in (1760, 2349, 3136))
    soul = osc(sweep(600, 1500, d), d, 'tri') * adsr(n, 0.01, 0.1, 0.2, 0.2) * 0.18
    return reverb(mix(softclip(squelch, 1.5), pop, shards * expdec(n, 10), soul), 0.9, 0.18)


def s_gem():
    d = 0.32
    n = int(SR * d)
    x = bell(1567.98, d, 1.2) * 0.7 + bell(2349.3, d, 0.8) * 0.35 * expdec(n, 9)
    x = mix(x, osc(sweep(2400, 4200, 0.05), 0.05) * expdec(int(0.05 * SR), 60) * 0.2)
    return reverb(x, 0.8, 0.2, 7000)


def s_coin():
    d = 0.5
    a = osc(988, 0.07, 'sq') * adsr(int(0.07 * SR), 0.001, 0.02, 0.7, 0.01)
    b = osc(1319, d - 0.07, 'sq') * expdec(int((d - 0.07) * SR), 7)
    x = lp(np.concatenate([a, b]), 6000) * 0.6
    x = mix(x, bell(2637, d, 1.0) * 0.25)
    return reverb(x, 0.7, 0.15, 8000)


def s_hurt():
    d = 0.38
    n = int(SR * d)
    growl = softclip(osc(sweep(140, 60, d), d, 'saw') * 1.5 + fm(110, 37, 6, d), 3) * expdec(n, 9) * 0.6
    impact = lp(noise(d, 'pink'), 900) * expdec(n, 25)
    dis = (osc(311, d, 'saw') + osc(330, d, 'saw')) * expdec(n, 10) * 0.2
    return reverb(mix(lp(growl + dis, 2500), impact), 0.6, 0.15)


def s_slash():
    d = 0.24
    n = int(SR * d)
    wh = sweep_filter(noise(d), 700, 5200, q=2.5) * np.sin(np.linspace(0, np.pi, n)) ** 1.5 * 1.6
    ring = osc(sweep(900, 1300, d), d, 'tri') * adsr(n, 0.02, 0.05, 0.3, 0.12) * 0.12
    return mix(wh, ring)


def s_shard():
    d = 0.22
    n = int(SR * d)
    env = expdec(n, 18)
    z = fm(sweep(2200, 900, d), 330, 4.0, d, idx_env=expdec(n, 10)) * env * 0.6
    sp = bp(noise(d), 4000, 12000) * expdec(n, 50) * 0.3
    return reverb(mix(z, sp, bell(2793, d, 0.6) * 0.2), 0.6, 0.18, 9000)


def s_sigil():
    d = 1.3
    n = int(SR * d)
    crack = hp(noise(d), 1500) * expdec(n, 40) * 1.4
    snap = osc(sweep(3000, 200, 0.03), 0.03) * 0.6
    rumble = lp(noise(d, 'brown'), 160, 4) * adsr(n, 0.04, 0.3, 0.5, 0.9) * 2.0
    sizzle = bp(noise(d), 3000, 9000) * expdec(n, 6) * 0.25 * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 37 * T(d))))
    return reverb(softclip(mix(crack, snap, rumble, sizzle), 1.6), 1.8, 0.3, 3000)


def s_pulse():
    d = 0.7
    n = int(SR * d)
    whoomp = sweep_filter(noise(d, 'pink'), 300, 1800, q=1.5, kind='lp') * adsr(n, 0.02, 0.15, 0.4, 0.45) * 1.5
    sub = osc(sweep(90, 40, d), d) * expdec(n, 6) * 0.9
    crackle = bp(noise(d), 2500, 8000) * (rng.random(n) > 0.985) * expdec(n, 4) * 2.0
    return reverb(softclip(mix(whoomp, sub, crackle), 1.4), 1.2, 0.22)


# ───────────── progression ─────────────
def s_levelup():
    d = 1.8
    x = np.zeros(int(SR * d))
    seq = [60, 64, 67, 71, 74, 79]  # Cmaj9 arpeggio up
    for i, m in enumerate(seq):
        t0 = i * 0.075
        nd = d - t0
        nn = int(nd * SR)
        tone = (bell(note(m + 12), nd, 1.0) * 0.5 + osc(note(m), nd, 'tri') * expdec(nn, 3) * 0.25)
        seg = x[int(t0 * SR):]
        seg[:len(tone)] += tone[:len(seg)]
    pad = sum(osc(note(m) * (1 + det), d, 'saw') for m in (60, 67, 71, 76) for det in (-0.004, 0.004)) * 0.05
    pad = lp(pad, 2500) * adsr(len(pad), 0.25, 0.3, 0.6, 0.8)
    sparkle = bp(noise(d), 6000, 14000) * adsr(int(d * SR), 0.3, 0.4, 0.2, 0.8) * 0.15
    return reverb(mix(x, pad, sparkle), 2.4, 0.35, 7000)


def s_evolve():
    d = 2.6
    n = int(SR * d)
    riser = sweep_filter(noise(1.2), 300, 9000, q=2) * np.linspace(0, 1, int(1.2 * SR)) ** 2 * 1.2
    riser = np.pad(riser, (0, n - len(riser)))
    up = osc(sweep(110, 880, 1.2), 1.2, 'saw') * np.linspace(0, 1, int(1.2 * SR)) ** 3 * 0.25
    up = np.pad(lp(up, 3000), (0, n - len(up)))
    boom = at(lp(noise(1.2, 'pink'), 400) * expdec(int(1.2 * SR), 4) * 1.5 + osc(sweep(80, 35, 1.2), 1.2) * expdec(int(1.2 * SR), 3), 1.2, d)
    chord = np.zeros(n)
    for m in (50, 57, 62, 66, 69, 74, 81):
        k = osc(note(m), d - 1.2, 'saw') + osc(note(m) * 1.006, d - 1.2, 'saw')
        seg = chord[int(1.2 * SR):]
        kk = lp(k, 4000) * adsr(len(k), 0.01, 0.4, 0.35, 0.7) * 0.06
        seg[:len(kk)] += kk[:len(seg)]
    bells = at(sum(bell(note(m), 1.4, 1.2) * 0.25 for m in (86, 90, 93)), 1.2, d)
    return reverb(softclip(mix(riser, up, boom, chord, bells), 1.3), 2.8, 0.38, 6000)


def s_jackpot():
    d = 2.9
    n = int(SR * d)
    x = np.zeros(n)
    # accelerating reel clicks for 2.2 s
    t, gap = 0.0, 0.11
    while t < 2.15:
        c = bp(noise(0.02), 1500, 6000) * expdec(int(0.02 * SR), 200) * 0.7 + osc(1800, 0.02) * expdec(int(0.02 * SR), 150) * 0.2
        x[int(t * SR):int(t * SR) + len(c)] += c
        t += gap
        gap = max(0.045, gap * 0.95) if t < 1.6 else gap * 1.12
    # win fanfare
    for i, m in enumerate([72, 76, 79, 84]):
        nd = d - 2.2 - i * 0.07
        k = osc(note(m), nd, 'sq') * 0.3 + bell(note(m + 12), nd, 1.0) * 0.4
        seg = x[int((2.2 + i * 0.07) * SR):]
        kk = lp(k, 7000) * expdec(len(k), 2.5)
        seg[:len(kk)] += kk[:len(seg)]
    coins = np.zeros(n)
    for k in range(18):
        st = 2.25 + rng.random() * 0.55
        c = bell(2400 + rng.random() * 1600, 0.25, 1.2) * 0.12
        seg = coins[int(st * SR):]
        seg[:len(c)] += c[:len(seg)]
    return reverb(mix(x, coins), 1.4, 0.22, 8000)


# ───────────── events ─────────────
def s_boss():
    d = 3.6
    n = int(SR * d)
    horn = sum(osc(f * (1 + det), d, 'saw') for f in (55, 82.4, 110) for det in (-0.006, 0, 0.006))
    horn = sweep_filter(horn, 150, 1400, q=1.2, kind='lp') * adsr(n, 0.4, 0.6, 0.7, 1.4) * 0.4
    choir = sum(osc(note(m), d, 'tri') * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * T(d))) for m in (45, 52, 57, 60))
    choir = bp(choir, 300, 2400) * adsr(n, 0.8, 0.5, 0.6, 1.2) * 0.25
    rumble = lp(noise(d, 'brown'), 90, 4) * adsr(n, 0.2, 0.5, 0.8, 1.2) * 1.4
    hit = osc(sweep(70, 30, 1.0), 1.0) * expdec(int(SR), 3) * 1.2
    return reverb(softclip(mix(horn, choir, rumble, hit), 1.5), 3.0, 0.4, 2500)


def s_elite():
    d = 1.6
    n = int(SR * d)
    horn = sum(osc(f * (1 + det), d, 'saw') for f in (98, 146.8) for det in (-0.005, 0.005))
    horn = lp(horn, 900) * adsr(n, 0.08, 0.3, 0.6, 0.6) * 0.5
    drum = lp(noise(0.5, 'pink'), 220) * expdec(int(0.5 * SR), 9) * 1.2 + osc(sweep(80, 40, 0.5), 0.5) * expdec(int(0.5 * SR), 7)
    return reverb(mix(horn, drum, at(drum * 0.8, 0.32)), 1.8, 0.32, 3000)


def s_ring():
    d = 2.0
    n = int(SR * d)
    swell = sum(osc(note(m) * (1 + det), d, 'saw') for m in (38, 41, 44, 47) for det in (-0.007, 0.007))
    swell = sweep_filter(swell, 200, 2200, q=1.2, kind='lp') * np.linspace(0, 1, n) ** 2 * 0.3
    whisper = bp(noise(d), 2500, 7000) * np.linspace(0, 1, n) ** 3 * 0.25 * (0.6 + 0.4 * np.sin(2 * np.pi * 7 * T(d)))
    return reverb(mix(swell, whisper), 2.0, 0.35)


def s_death():
    d = 3.2
    n = int(SR * d)
    fall = sum(osc(sweep(note(m), note(m) * 0.5, d) * (1 + det), d, 'saw') for m in (57, 60, 64) for det in (-0.006, 0.006))
    fall = lp(fall, 1800) * adsr(n, 0.02, 0.5, 0.5, 1.5) * 0.18
    boom = lp(noise(1.5, 'pink'), 300) * expdec(int(1.5 * SR), 3) * 1.4 + osc(sweep(60, 28, 1.5), 1.5) * expdec(int(1.5 * SR), 2.5)
    toll = bell(note(38), d, 0.7) * 0.6
    return reverb(softclip(mix(fall, boom, toll), 1.3), 3.2, 0.42, 2500)


def s_pvp():
    d = 1.5
    n = int(SR * d)
    clang = sum(osc(f, d) * expdec(n, k) * a for f, a, k in [(1180, 1, 6), (2470, 0.6, 9), (3710, 0.5, 12), (5230, 0.3, 16), (630, 0.4, 5)])
    hit = bp(noise(0.08), 2000, 9000) * expdec(int(0.08 * SR), 60) * 1.2
    brass = sum(osc(note(m) * (1 + det), 1.1, 'saw') for m in (55, 62, 67) for det in (-0.005, 0.005))
    brass = at(lp(brass, 2200) * adsr(len(brass), 0.03, 0.2, 0.6, 0.5) * 0.2, 0.12, d)
    return reverb(mix(clang * 0.5, hit, brass), 1.6, 0.3, 6000)


def s_click():
    d = 0.06
    n = int(SR * d)
    return osc(sweep(2400, 1200, d), d) * expdec(n, 70) * 0.6 + bp(noise(d), 3000, 8000) * expdec(n, 140) * 0.3


# ───────────── ambient music loop (seamless) ─────────────
def music(bars=16, bpm=84):
    beat = 60 / bpm
    d = bars * 4 * beat
    n = int(SR * d)
    t = T(d)
    out = np.zeros(n)
    prog = [(50, [50, 53, 57]), (46, [46, 50, 53]), (48, [48, 52, 55]), (45, [45, 49, 52])]  # Dm Bb C A
    for b in range(bars):
        root, ch = prog[(b // 2) % 4]
        s0 = int(b * 4 * beat * SR)
        L = int(4 * beat * SR)
        # pad: detuned saws, slow filter
        pad = sum(osc(note(m + 12) * (1 + det), 4 * beat, 'saw') for m in ch for det in (-0.005, 0.0, 0.005))
        pad = lp(pad, 1400) * adsr(L, 0.6, 0.5, 0.8, 0.8) * 0.045
        out[s0:s0 + L] += pad[:len(out[s0:s0 + L])]
        # pulsing bass (8ths with sidechain feel)
        for k in range(8):
            st = s0 + int(k * beat / 2 * SR)
            bl = int(beat / 2 * SR)
            bs = osc(note(root - 12), beat / 2, 'saw') * 0.5 + osc(note(root - 12), beat / 2) * 0.6
            bs = lp(bs, 380) * adsr(bl, 0.004, 0.08, 0.5, 0.06) * (0.18 if k % 2 == 0 else 0.12)
            out[st:st + bl] += bs[:len(out[st:st + bl])]
        # soft kick on 1 & 3, rim on 2 & 4
        for k in range(4):
            st = s0 + int(k * beat * SR)
            if k % 2 == 0:
                kk = osc(sweep(110, 40, 0.3), 0.3) * expdec(int(0.3 * SR), 14) * 0.35
            else:
                kk = bp(noise(0.12), 900, 5000) * expdec(int(0.12 * SR), 40) * 0.12
            out[st:st + len(kk)] += kk[:len(out[st:st + len(kk)])]
        # bell motif every other bar
        if b % 2 == 1:
            for j, m in enumerate([ch[2] + 24, ch[1] + 24, ch[0] + 24, ch[1] + 31]):
                st = s0 + int((j * 0.75) * beat * SR)
                bl = bell(note(m), 2.0, 0.8) * 0.06
                out[st:st + len(bl)] += bl[:len(out[st:st + len(bl)])]
    # wind / choir air
    out += bp(noise(d, 'pink'), 400, 2500) * (0.5 + 0.5 * np.sin(2 * np.pi * t / d * 4)) * 0.012
    wet = reverb(out, 3.0, 0.45, 3500)
    # wrap the reverb tail into the start → seamless loop
    loop = wet[:n].copy()
    tail = wet[n:]
    loop[:len(tail)] += tail
    loop = loop / (np.max(np.abs(loop)) + 1e-9) * 0.85
    path = os.path.join(OUT, 'music.wav')
    with wave.open(path, 'w') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((loop * 32767).astype(np.int16).tobytes())
    mp3 = os.path.join(OUT, 'music.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-codec:a', 'libmp3lame', '-b:a', '112k', mp3], check=True)
    os.remove(path)
    print(f'music      {d:5.1f}s → music.mp3 ({os.path.getsize(mp3) // 1024} KB)')


if __name__ == '__main__':
    for name, fn in [('hit', s_hit), ('kill', s_kill), ('gem', s_gem), ('coin', s_coin), ('hurt', s_hurt),
                     ('slash', s_slash), ('shard', s_shard), ('sigil', s_sigil), ('pulse', s_pulse),
                     ('levelup', s_levelup), ('evolve', s_evolve), ('jackpot', s_jackpot),
                     ('boss', s_boss), ('elite', s_elite), ('ring', s_ring), ('death', s_death), ('pvp', s_pvp), ('click', s_click)]:
        save(name, fn())
    music()
