"""Synthesized score + SFX + voice mix for TWO ROADS. Pure numpy/scipy, no samples.

Outputs build/music.wav, build/sfx.wav, build/voice.wav, build/mix.wav (48 kHz stereo)
"""
import os, sys
import numpy as np, soundfile as sf
import pyloudnorm as pyln
from scipy.signal import butter, sosfilt, sosfiltfilt, fftconvolve, resample_poly

sys.path.insert(0, os.path.dirname(__file__))
from events import Events, ROOT

SR = 48000
rng = np.random.default_rng(7)
EV = Events()
DUR = EV.total
N = int(DUR * SR)
BUILD = os.path.join(ROOT, "build")


# ------------------------------------------------------------------ helpers
def sos(kind, f, order=2):
    return butter(order, f, btype=kind, fs=SR, output="sos")


def lp(x, f, o=2): return sosfilt(sos("lowpass", f, o), x, axis=0)
def hp(x, f, o=2): return sosfilt(sos("highpass", f, o), x, axis=0)
def bp(x, lo, hi, o=2): return sosfilt(sos("bandpass", [lo, hi], o), x, axis=0)


def pan(mono, p):
    """equal-power pan, p in [-1, 1]; p may be an array."""
    a = (np.asarray(p) + 1) * np.pi / 4
    return np.stack([mono * np.cos(a), mono * np.sin(a)], axis=1)


def add(buf, sig, t0):
    i = int(round(t0 * SR))
    if i >= len(buf): return
    if i < 0: sig = sig[-i:]; i = 0
    n = min(len(sig), len(buf) - i)
    buf[i:i + n] += sig[:n]


def smooth_env(points, n=N):
    """piecewise-linear envelope from (time, value) points, then smoothed."""
    ts = np.array([p[0] for p in points]); vs = np.array([p[1] for p in points])
    t = np.arange(n) / SR
    env = np.interp(t, ts, vs)
    return env


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)


def ss(x):  # smoothstep
    x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)


# ------------------------------------------------------------------ instruments
def piano(f, dur=2.5, vel=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    B = 0.0003
    for k in range(1, 9):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 12000: break
        amp = vel / k ** 1.4
        dec = 1.2 + 0.9 * k
        out += amp * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6)) * np.exp(-dec * t * (0.7 + 220 / f / 3))
    out *= 1 - np.exp(-t / 0.004)
    ham = lp(rng.standard_normal(n) * np.exp(-t / 0.012), 2500) * 0.08 * vel
    out += ham
    out[-int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
    return out


def pluck(f, dur=1.2, vel=0.5):
    """warm nylon-guitar-like pluck (additive, bright attack, quick high decay)."""
    n = int(dur * SR); t = np.arange(n) / SR
    out = np.zeros(n)
    for k in range(1, 12):
        fk = f * k
        if fk > 10000: break
        amp = vel * (np.sin(np.pi * k * 0.18) ** 2 + 0.05) / k
        out += amp * np.sin(2 * np.pi * fk * t) * np.exp(-t * (2.5 + 1.8 * k))
    out *= 1 - np.exp(-t / 0.002)
    out[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return out


def saw_stack(freqs, n, detune=(-7, 0, 7), vib=0.0, t0=0.0):
    t = np.arange(n) / SR + t0
    out = np.zeros(n)
    for f in freqs:
        for d in detune:
            fd = f * 2 ** (d / 1200)
            ph = 2 * np.pi * fd * t + rng.uniform(0, 6)
            if vib:
                ph += vib * fd / 5.5 * 0.004 * np.sin(2 * np.pi * 5.5 * t + rng.uniform(0, 6)) * 2 * np.pi / (2 * np.pi)
            # band-limited-ish saw: first 10 harmonics
            s = np.zeros(n)
            for k in range(1, 11):
                if fd * k > 9000: break
                s += np.sin(k * ph) / k
            out += s
    return out / (len(freqs) * len(detune))


def kick(vel=1.0):
    n = int(0.45 * SR); t = np.arange(n) / SR
    f = 45 + 70 * np.exp(-t / 0.04)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return vel * np.sin(ph) * np.exp(-t / 0.16) * (1 - np.exp(-t / 0.002))


def shaker(vel=0.3):
    n = int(0.09 * SR); t = np.arange(n) / SR
    return vel * lp(hp(rng.standard_normal(n), 5000), 11000) * np.exp(-t / 0.025) * (1 - np.exp(-t / 0.006))


def tom(vel=0.6, f0=95):
    n = int(0.6 * SR); t = np.arange(n) / SR
    f = f0 * (1 + 0.3 * np.exp(-t / 0.05))
    return vel * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.22)


def reverb_ir(sec=2.8, decay=2.2, seed=1):
    r = np.random.default_rng(seed)
    n = int(sec * SR); t = np.arange(n) / SR
    ir = r.standard_normal((n, 2)) * np.exp(-t * 6.9 / decay)[:, None]
    ir = lp(ir, 6000)
    ir[: int(0.012 * SR)] = 0
    return ir / np.sqrt((ir ** 2).sum(0))


def reverb(x, wet=0.3, sec=2.8, decay=2.2):
    ir = reverb_ir(sec, decay)
    w = np.stack([fftconvolve(x[:, c], ir[:, c])[: len(x)] for c in range(2)], 1)
    return x * (1 - wet) + w * wet


# ------------------------------------------------------------------ score
BPM = 76
BEAT = 60 / BPM
BAR = 4 * BEAT
# chord roots/notes (MIDI). Key: D major.
CH = {
    "D": [50, 57, 62, 66, 69], "Bm": [47, 54, 59, 62, 66], "G": [43, 50, 55, 59, 62],
    "A": [45, 52, 57, 61, 64], "Em": [40, 47, 52, 55, 59], "Dsus": [50, 57, 62, 64, 69],
}


def chord_at(bar):
    t = bar * BAR
    if t >= EV.S["final"][0] - 0.5:
        seq = ["G", "A", "Bm", "G", "D", "D"]
        fb = int((EV.S["final"][0] - 0.5) // BAR)
        return seq[min(bar - fb, len(seq) - 1)]
    if t >= EV.S["drift"][0] - 0.5:
        return ["Em", "G", "A", "A"][bar % 4]
    return ["D", "Bm", "G", "A"][bar % 4]


def music():
    S = EV.S
    nb = int(np.ceil(DUR / BAR)) + 1
    L = N + 4 * SR
    piano_b = np.zeros((L, 2)); pluck_b = np.zeros((L, 2)); pad_b = np.zeros((L, 2))
    str_b = np.zeros((L, 2)); perc_b = np.zeros((L, 2))

    # --- pad: whole film, chord per bar, crossfaded
    for b in range(nb):
        t0 = b * BAR; n = int((BAR + 1.5) * SR)
        notes = [mtof(m) for m in CH[chord_at(b)][:4]]
        s = saw_stack(notes, n, detune=(-9, -3, 4, 10), t0=t0)
        tt = np.arange(n) / SR
        env = ss(tt / 1.2) * ss((BAR + 1.5 - tt) / 1.4)
        s = lp(s * env, 1400)
        add(pad_b, pan(s, -0.2) + pan(np.roll(s, 300), 0.2), t0)

    # --- left motif: airy high piano arpeggio (title + split + finale)
    motifL = [0, 2, 4, 3, 2, 4, 1, 2]  # indices into chord tones +12
    for b in range(nb):
        t0 = b * BAR
        if t0 > DUR - 3: break
        chord = CH[chord_at(b)]
        tones = sorted(set([m + 12 for m in chord[1:]] + [m + 24 for m in chord[1:3]]))
        for i, idx in enumerate(motifL):
            tt = t0 + i * BEAT / 2
            if tt < 0.8: continue
            if tt < S["b1"][0] and i % 2: continue      # sparse in the title
            m = tones[idx % len(tones)]
            vel = 0.30 + 0.08 * (i == 0)
            add(piano_b, pan(piano(mtof(m), 2.6, vel), -0.4), tt + rng.normal(0, 0.006))

    # --- right motif: warm syncopated pluck rhythm (split + finale)
    rhythm = [0, 0.75, 1.5, 2.0, 2.75, 3.5]  # in beats
    for b in range(nb):
        t0 = b * BAR
        if t0 < S["b1"][0] - BAR or t0 > DUR - 3: continue
        chord = CH[chord_at(b)]
        for j, r in enumerate(rhythm):
            tt = t0 + r * BEAT
            if tt < S["b1"][0]: continue
            m = chord[[0, 2, 3, 1, 2, 4][j]] + (12 if j in (2, 5) else 0)
            add(pluck_b, pan(pluck(mtof(m), 1.1, 0.42 if j in (0, 3) else 0.3), 0.4), tt + rng.normal(0, 0.005))

    # --- strings: swell from drift into finale
    for b in range(nb):
        t0 = b * BAR
        if t0 < S["drift"][0] - BAR - 0.5: continue
        notes = [mtof(m) for m in CH[chord_at(b)]] + [mtof(CH[chord_at(b)][2] + 12)]
        n = int((BAR + 2.0) * SR)
        s = saw_stack(notes, n, detune=(-12, -5, 0, 6, 13), vib=1.0, t0=t0)
        tt = np.arange(n) / SR
        env = ss(tt / 1.6) * ss((BAR + 2.0 - tt) / 1.8)
        s = lp(s * env, 2600)
        add(str_b, pan(s, -0.5) + pan(np.roll(s, 500), 0.5), t0)

    # --- percussion pulse: soft shaker from b3, kick from drift, toms in finale
    for b in range(nb):
        for k in range(8):
            tt = b * BAR + k * BEAT / 2
            if tt > DUR - 4: break
            if tt >= S["b3"][0] and k % 2 == 1:
                add(perc_b, pan(shaker(0.22), 0.25 if k % 4 == 1 else -0.25), tt)
            if tt >= S["drift"][0] + 2 and k in (0, 4):
                add(perc_b, pan(kick(0.9), 0), tt)
            if tt >= S["drift"][0] + 8 and k == 6:
                add(perc_b, pan(kick(0.5), 0), tt)
            if tt >= S["final"][0] - 2 and k in (3, 7):
                add(perc_b, pan(tom(0.55, 90 if k == 3 else 72), 0.2 if k == 3 else -0.2), tt)

    t = np.arange(L) / SR
    dS, fS = S["drift"][0], S["final"][0]
    focus = np.array([EV.focus(x) for x in t[::480]])
    focus = np.interp(t, t[::480], focus)
    split = (t >= S["b1"][0]) & (t < dS)
    # left/right motif follow the active panel during the split screen
    gL = np.where(split, 0.55 + 0.45 * focus, 1.0)
    gR = np.where(split, 0.55 + 0.45 * (1 - focus), 1.0)
    pad_env = smooth_env([(0, 0), (3, 0.9), (dS, 1.0), (fS, 1.25), (DUR - 4, 1.2), (DUR, 0.6), (DUR + 4, 0)], L)
    str_env = smooth_env([(0, 0), (dS - 2, 0), (dS + 8, 0.6), (fS, 1.0), (EV.roar_peak, 1.4), (DUR - 3, 1.0), (DUR + 2, 0)], L)
    perc_env = smooth_env([(0, 0), (S["b3"][0], 0.5), (dS, 0.7), (fS, 1.0), (EV.roar_peak + 4, 1.1), (DUR - 3, 0), (DUR + 4, 0)], L)
    pl_env = smooth_env([(0, 0), (S["b1"][0] - 1, 0), (S["b1"][0] + 1, 1), (DUR - 3, 1), (DUR, 0), (DUR + 4, 0)], L)
    pi_env = smooth_env([(0, 1), (DUR - 2.5, 1), (DUR + 1, 0), (DUR + 4, 0)], L)

    mix = (piano_b * (gL * pi_env)[:, None] * 0.9 + pluck_b * (gR * pl_env)[:, None] * 0.8
           + pad_b * pad_env[:, None] * 0.22 + str_b * str_env[:, None] * 0.30 + perc_b * perc_env[:, None] * 0.75)
    mix = reverb(mix, wet=0.32)
    mix = hp(mix, 35)
    return mix[:N]


# ------------------------------------------------------------------ SFX
def thump(vel=0.5, f=95, dur=0.25):
    n = int(dur * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * (1 + 0.6 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05)
    s += 0.4 * lp(rng.standard_normal(n), 1800) * np.exp(-t / 0.008)
    return vel * s


def whoosh(dur=1.1, vel=0.5, p0=-0.6, p1=0.6):
    n = int(dur * SR); t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    out = np.zeros(n)
    blk = 1024
    centers = 300 * (10 ** (np.sin(np.pi * t / dur) * 1.0))
    for i in range(0, n, blk):   # time-varying band-pass, block-wise
        c = centers[i]
        seg = bp(noise[max(0, i - 2048):i + blk], c * 0.6, min(c * 1.6, 20000))
        out[i:i + blk] = seg[-len(out[i:i + blk]):]
    env = np.sin(np.pi * t / dur) ** 2
    return pan(out * env * vel, np.linspace(p0, p1, n))


def sfx():
    S = EV.S
    out = np.zeros((N, 2))
    t = np.arange(N) / SR
    # ball roll on the title (soft rumble moving L->R)
    r0, r1 = EV.roll
    n = int((r1 - r0) * SR); tt = np.arange(n) / SR
    roll = lp(rng.standard_normal(n), 260) * (0.6 + 0.4 * np.sin(2 * np.pi * 3.1 * tt)) * ss(tt / 0.6) * ss((r1 - r0 - tt) / 0.6)
    add(out, pan(roll * 0.9, np.linspace(-0.8, 0.8, n)), r0)
    # whooshes at transitions
    for i, w in enumerate(EV.whooshes):
        p = (-0.6, 0.6) if i % 2 == 0 else (0.6, -0.6)
        add(out, whoosh(1.2, 0.30, *p), w - 0.6)
    # b1 small drop bounces both sides
    for i, b in enumerate(EV.b1_drop):
        v = 0.5 * 0.6 ** i
        add(out, pan(thump(v), -0.55), b); add(out, pan(thump(v, 105), 0.55), b + 0.05)
    # b2 juggling left / wall kicks right
    for b in EV.juggle_L:
        add(out, pan(thump(0.33, 120, 0.18), -0.55), b)
    for k in EV.wall_R:
        add(out, pan(thump(0.45, 85), 0.45), k)
        add(out, pan(thump(0.30, 140, 0.15), 0.75), k + 0.45)
    # b4 heartbeat right (lub-dub)
    for h in EV.heart_R:
        add(out, pan(thump(0.55, 52, 0.3), 0.45), h); add(out, pan(thump(0.35, 48, 0.3), 0.45), h + 0.16)
    # b4 plane left -> right (soft jet hiss)
    p0, p1 = EV.plane_L
    n = int((p1 - p0) * SR); tt = np.arange(n) / SR
    jet = bp(rng.standard_normal(n), 300, 2500) * np.sin(np.pi * tt / (p1 - p0)) ** 2
    add(out, pan(jet * 0.10, np.linspace(-0.9, -0.1, n)), p0)
    # ambiences: Rosario street (left), Madeira sea (right) during the split
    split_env = ss((t - S["b1"][0] + 0.5) / 1.5) * ss((S["drift"][0] + 3 - t) / 3)
    city = lp(np.cumsum(rng.standard_normal(N)) * 0.02, 500)
    city = hp(city, 40)
    city = city / (np.abs(city).max() + 1e-9)
    sea = lp(rng.standard_normal(N), 900) * (0.55 + 0.45 * np.sin(2 * np.pi * t / 7.5) ** 2)
    sea = sea / (np.abs(sea).max() + 1e-9)
    out += pan(city * 0.10 * split_env, -0.7) + pan(sea * 0.12 * split_env, 0.7)
    # birds (left: dusk city; right: coastal) — short synthesized chirps
    for k in range(18):
        tb = rng.uniform(S["b1"][0], S["b3"][0])
        n = int(0.09 * SR); tt = np.arange(n) / SR
        f = 3200 + 1800 * tt / 0.09 * rng.choice([1, -1])
        ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * tt / 0.09) ** 2 * 0.03
        add(out, pan(ch, rng.choice([-0.8, 0.8])), tb)
    # crowd murmur -> roar
    crowd = np.zeros((N, 2))
    for c in range(2):
        x = bp(rng.standard_normal(N), 250, 1800)
        am = lp(np.abs(rng.standard_normal(N)), 6) * 6
        crowd[:, c] = x * (0.6 + 0.4 * np.clip(am, 0, 2))
    crowd /= np.abs(crowd).max()
    roar = np.stack([bp(rng.standard_normal(N), 180, 5000) for _ in range(2)], 1)
    roar /= np.abs(roar).max()
    cs, rp = EV.crowd_start, EV.roar_peak
    c_env = smooth_env([(0, 0), (cs, 0), (cs + 6, 0.10), (S["final"][0], 0.16), (rp, 0.16), (DUR - 3, 0.12), (DUR, 0)])
    r_env = smooth_env([(0, 0), (S["final"][0], 0), (rp - 1.0, 0.05), (rp + 0.8, 0.30), (rp + 4.0, 0.16), (DUR - 2.5, 0.08), (DUR, 0)])
    out += crowd * c_env[:, None] + roar * r_env[:, None]
    # stadium lights switching on (deep clunk + hum)
    for lt in EV.lights_on:
        add(out, pan(thump(0.5, 60, 0.5), 0), lt)
    return out


# ------------------------------------------------------------------ voice
def voice():
    out = np.zeros(N)
    meter = pyln.Meter(SR)
    for l in EV.tl["lines"]:
        a, sr = sf.read(l["file"], dtype="float64")
        a = hp(a, 85)
        # gentle presence lift (+~3 dB around 3-5 kHz)
        a = a + 0.35 * bp(a, 2800, 5500)
        # light compression (RMS follower)
        env = np.sqrt(lp(a * a, 12) .clip(1e-9))
        g = np.minimum(1.0, (0.12 / env) ** 0.35)
        a = a * g
        lufs = meter.integrated_loudness(np.concatenate([a, np.zeros(SR // 2)]))
        a *= 10 ** ((-17.0 - lufs) / 20)
        add(out, a, l["start"])
    return out


def voice_activity():
    v = np.zeros(N)
    for l in EV.tl["lines"]:
        i0 = int((l["start"]) * SR); i1 = int(l["end"] * SR)
        v[i0:i1] = 1
    # attack 0.25 s ahead of speech, release 0.7 s after
    k_a = int(0.25 * SR); k_r = int(0.7 * SR)
    pre = np.convolve(v, np.ones(k_a), mode="full")[k_a - 1:k_a - 1 + N] > 0
    post = np.convolve(v, np.ones(k_r), mode="full")[:N] > 0
    d = (pre | post).astype(float)
    d = sosfiltfilt(sos("lowpass", 2.5, 1), d)
    return np.clip(d, 0, 1)


# ------------------------------------------------------------------ master
def true_peak_limit(x, ceiling_db=-1.5):
    c = 10 ** (ceiling_db / 20)
    up = resample_poly(x, 4, 1, axis=0)
    pk = np.abs(up).max(1).reshape(-1, 4).max(1)[: len(x)]
    pk = np.pad(pk, (0, len(x) - len(pk)), constant_values=0)
    need = np.minimum(1.0, c / np.maximum(pk, 1e-9))
    # look-ahead (5 ms) min-hold, then smooth release
    la = int(0.005 * SR)
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1)
    g = np.minimum(g, sosfiltfilt(sos("lowpass", 8, 1), g))
    g = np.minimum(g, minimum_filter1d(need, size=2 * la + 1))
    return x * g[:, None]


def main():
    meter = pyln.Meter(SR)
    print("music..."); m = music()
    m *= 10 ** ((-18.0 - meter.integrated_loudness(m)) / 20)       # music bed at -18 LUFS
    print("  music LUFS: %.2f" % meter.integrated_loudness(m))
    print("sfx..."); s = sfx()
    print("voice..."); v = voice()
    duck = voice_activity()
    duck_gain = 10 ** (-9.0 * duck / 20)                             # -9 dB under the voice
    vv = np.stack([v, v], 1)
    t = np.arange(N) / SR
    fade = np.clip((DUR - t) / 3.0, 0, 1) ** 1.5 * np.clip(t / 0.25, 0, 1)
    mix = (m * duck_gain[:, None] + s * (10 ** (-3 * duck / 20))[:, None] + vv * 1.0) * fade[:, None]
    for it in range(3):
        L = meter.integrated_loudness(mix)
        mix *= 10 ** ((-16.0 - L) / 20)
        mix = true_peak_limit(mix, -1.5)
    print("  final LUFS: %.2f  sample peak: %.2f dBFS" % (meter.integrated_loudness(mix), 20 * np.log10(np.abs(mix).max())))
    for name, x in (("music", m), ("sfx", s), ("voice", vv), ("mix", mix)):
        sf.write(os.path.join(BUILD, name + ".wav"), x.astype("float32"), SR, subtype="FLOAT" if name != "mix" else "PCM_24")


if __name__ == "__main__":
    main()
