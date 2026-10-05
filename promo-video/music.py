"""Procedural soundtrack for the Analyty promo: 30s, 120 BPM, synced to scene timings in scene.js.

Writes music.wav (48 kHz, 16-bit stereo). Requires numpy.
"""
import wave
from pathlib import Path

import numpy as np

SR = 48000
DUR = 30.0
BPM = 120
BEAT = 60 / BPM
N = int(SR * DUR)
rng = np.random.default_rng(3)

L = np.zeros(N)
Rch = np.zeros(N)
send_L = np.zeros(N)  # reverb send
send_R = np.zeros(N)


def add(sig, t0, gain=1.0, pan=0.0, rev=0.0):
    """Mix a mono signal in at time t0 with constant-power pan and a reverb send."""
    i = int(t0 * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    gl = np.cos((pan + 1) * np.pi / 4) * gain
    gr = np.sin((pan + 1) * np.pi / 4) * gain
    L[i : i + len(sig)] += sig * gl
    Rch[i : i + len(sig)] += sig * gr
    if rev:
        send_L[i : i + len(sig)] += sig * gl * rev
        send_R[i : i + len(sig)] += sig * gr * rev


def tt(d):
    return np.arange(int(d * SR)) / SR


def env_ad(n, a, d_curve):
    t = np.arange(n) / SR
    e = np.minimum(t / max(a, 1e-4), 1.0) * np.exp(-t * d_curve)
    return e


def smooth(x, k):
    if k <= 1:
        return x
    return np.convolve(x, np.ones(k) / k, mode="same")


def saw_additive(f, t, harmonics=14, bright=1.0):
    out = np.zeros_like(t)
    for h in range(1, harmonics + 1):
        if f * h > SR / 2.2:
            break
        out += np.sin(2 * np.pi * f * h * t) / h * np.exp(-(h - 1) * (0.28 / bright))
    return out


def note(n):  # MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


# ---------- harmony ----------
# Am - F - C - G, one chord per bar (2s); final section resolves to C(add9).
CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]
ROOTS = [45, 41, 48, 43]
FINAL = [55, 60, 64, 67, 74]


def chord_at(t):
    if t >= 27.0:
        return FINAL, 48
    i = int(t // (4 * BEAT)) % 4
    return CHORDS[i], ROOTS[i]


# ---------- pad ----------
bar = 4 * BEAT
starts = [b * bar for b in range(int(27 / bar) + 1)] + [27.0]
starts = sorted(set(s for s in starts if s < 27.0)) + [27.0]
for k, s in enumerate(starts):
    end = starts[k + 1] if k + 1 < len(starts) else DUR
    d = end - s + 1.2
    t = tt(d)
    notes, _ = chord_at(s + 0.01)
    sig_l = np.zeros_like(t)
    sig_r = np.zeros_like(t)
    for n in notes:
        f = note(n)
        sig_l += saw_additive(f * 1.003, t, bright=0.8) + 0.6 * saw_additive(f * 0.997 * 2, t, 8, 0.6)
        sig_r += saw_additive(f * 0.996, t, bright=0.8) + 0.6 * saw_additive(f * 1.002 * 2, t, 8, 0.6)
    a = 0.35
    env = np.minimum(t / a, 1.0) * np.clip((d - t) / 1.2, 0, 1)
    # slow filter-ish swell via tremolo
    env *= 0.85 + 0.15 * np.sin(2 * np.pi * 0.5 * t)
    level = 0.05 if s < 27 else 0.075
    i = int(s * SR)
    n_ = min(len(t), N - i)
    for ch, sig, snd in ((L, sig_l, send_L), (Rch, sig_r, send_R)):
        ch[i : i + n_] += (sig * env * level)[:n_]
        snd[i : i + n_] += (sig * env * level * 0.8)[:n_]

# Intro swell: pad fades in from silence
fade = np.clip(np.arange(N) / (SR * 1.4), 0, 1)
L *= fade
Rch *= fade
send_L *= fade
send_R *= fade

# ---------- drums ----------
def kick():
    t = tt(0.45)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t * 7.5)
    click = rng.standard_normal(len(t)) * np.exp(-t * 400) * 0.25
    return np.tanh((body + click) * 1.6)


def clap():
    t = tt(0.25)
    nz = rng.standard_normal(len(t))
    nz = nz - smooth(nz, 6)  # crude high-pass
    nz = smooth(nz, 2)
    e = np.exp(-t * 22) * (1 + 0.6 * (np.sin(t * 2 * np.pi * 90) > 0) * (t < 0.03))
    return nz * e * 0.7


def hat(open_=False):
    t = tt(0.25 if open_ else 0.06)
    nz = rng.standard_normal(len(t))
    nz = nz - smooth(nz, 3)
    return nz * np.exp(-t * (14 if open_ else 70)) * 0.35


KICK, CLAP = kick(), clap()
SIDECHAIN = np.ones(N)
duck = 1 - 0.65 * np.exp(-tt(0.4) * 9)


def drums_active(t):
    return (3.5 <= t < 26.75) and not (11.5 <= t < 12.0) and not (16.5 <= t < 17.0)


for b in range(int(DUR / BEAT)):
    t = b * BEAT
    if not drums_active(t):
        continue
    full = t >= 12.0
    add(KICK, t, 0.9)
    i = int(t * SR)
    seg_ = SIDECHAIN[i : i + len(duck)]
    SIDECHAIN[i : i + len(duck)] = np.minimum(seg_, duck[: len(seg_)])
    if full and b % 2 == 1:
        add(CLAP, t, 0.35, pan=0.05, rev=0.35)
    add(hat(open_=full and b % 4 == 3), t + BEAT / 2, 0.45 if full else 0.3, pan=0.25)
    if full:
        add(hat(), t + BEAT / 4, 0.16, pan=-0.3)
        add(hat(), t + 3 * BEAT / 4, 0.16, pan=-0.3)

# ---------- bass ----------
for s8 in range(int(DUR / (BEAT / 2))):
    t = s8 * BEAT / 2
    if not (3.5 <= t < 26.75):
        continue
    _, root = chord_at(t)
    f = note(root - 12 if root > 44 else root)
    d = BEAT / 2
    tb = tt(d)
    sig = np.sin(2 * np.pi * f * tb) + 0.35 * np.sin(2 * np.pi * 2 * f * tb) + 0.12 * np.sin(2 * np.pi * 3 * f * tb)
    e = np.minimum(tb / 0.005, 1) * np.exp(-tb * 5) * np.clip((d - tb) / 0.01, 0, 1)
    add(sig * e, t, 0.22 if t >= 12 else 0.15)

# ---------- arp ----------
delay_taps = []
for s16 in range(int(DUR / (BEAT / 4))):
    t = s16 * BEAT / 4
    if not (1.5 <= t < 27.0) or (11.5 <= t < 12.0):
        continue
    if t < 12 and s16 % 2 == 1:
        continue  # 8ths before the drop, 16ths after
    notes, _ = chord_at(t)
    seq = [notes[0] + 12, notes[1] + 12, notes[2] + 12, notes[1] + 24]
    n = seq[s16 % 4]
    ta = tt(0.35)
    f = note(n)
    sig = np.sin(2 * np.pi * f * ta) * 0.8 + 0.25 * np.sin(2 * np.pi * 2 * f * ta) + 0.1 * np.sin(2 * np.pi * 3 * f * ta)
    e = np.minimum(ta / 0.003, 1) * np.exp(-ta * 13)
    g = 0.07 if t < 3.5 else (0.075 if t < 12 else 0.09)
    pan = -0.35 if s16 % 2 else 0.35
    add(sig * e, t, g, pan=pan, rev=0.5)
    add(sig * e, t + 3 * BEAT / 4, g * 0.35, pan=-pan, rev=0.3)  # ping-pong echo

# ---------- FX ----------
def impact(gain=1.0):
    t = tt(2.5)
    f = 30 + 70 * np.exp(-t * 6)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 2.2)
    nz = smooth(rng.standard_normal(len(t)), 8) * np.exp(-t * 6) * 0.6
    return np.tanh((boom + nz) * 1.3) * gain


def riser(d, f0=250, f1=2400):
    t = tt(d)
    k = t / d
    f = f0 * (f1 / f0) ** (k**2)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    nz = rng.standard_normal(len(t))
    nz = smooth(nz, 3) - smooth(nz, 12)
    return (tone + nz * 0.45) * (k**2.2)


def whoosh(d=0.6):
    t = tt(d)
    nz = rng.standard_normal(len(t))
    nz = smooth(nz, 4) - smooth(nz, 40)
    e = np.sin(np.pi * t / d) ** 2
    return nz * e


def blip(f, d=0.25, kind="sine"):
    t = tt(d)
    w = np.sin(2 * np.pi * f * t)
    if kind == "square":
        w = np.tanh(w * 3) * 0.6
    return (w + 0.4 * np.sin(2 * np.pi * f * 1.5 * t)) * np.minimum(t / 0.002, 1) * np.exp(-t * 18)


def tick():
    t = tt(0.012)
    nz = rng.standard_normal(len(t))
    return (nz - smooth(nz, 3)) * np.exp(-t * 500)


# Intro: riser into the logo hit, sparkle on landing
add(riser(1.4, 150, 1800), 0.05, 0.22, rev=0.4)
add(impact(0.8), 1.45, 0.55, rev=0.5)
for i, n in enumerate([81, 84, 88, 93]):
    add(blip(note(n), 0.6), 1.5 + i * 0.06, 0.07, pan=(-0.4 + i * 0.27), rev=0.8)

# Scene transitions
add(riser(1.2), 2.3, 0.18, rev=0.3)
add(impact(), 3.5, 0.5, rev=0.4)
add(whoosh(0.7), 4.8, 0.3, pan=-0.2, rev=0.3)
add(whoosh(0.7), 6.3, 0.35, pan=0.2, rev=0.3)

# Chat: typing + reply + error
q_len = 42
for c in range(q_len):
    jitter = rng.uniform(-0.012, 0.012)
    add(tick(), 7.0 + c * (1.4 / q_len) + jitter, 0.22, pan=rng.uniform(-0.2, 0.2))
add(blip(note(76), 0.2), 8.42, 0.08, rev=0.4)  # send
add(blip(note(83), 0.3), 9.05, 0.08, pan=-0.2, rev=0.5)  # reply
for i in range(3):
    add(blip(note(88), 0.12), 9.3 + i * 0.16, 0.04, pan=0.3, rev=0.4)
add(whoosh(0.8), 10.0, 0.2, pan=0.3)
add(blip(330, 0.3, "square"), 10.75, 0.13, rev=0.3)
add(blip(247, 0.4, "square"), 10.9, 0.13, rev=0.4)
add(riser(1.4), 10.6, 0.22, rev=0.3)
add(impact(), 12.0, 0.55, rev=0.4)

# Scan: subtle data blips
for i in range(28):
    t0 = 13.1 + i * 0.12
    add(blip(note(rng.choice([88, 91, 93, 95, 100])), 0.08), t0, 0.025, pan=rng.uniform(-0.6, 0.6), rev=0.5)
for i, t0 in enumerate([15.6, 15.85, 16.1]):
    add(blip(note(84 + i * 3), 0.25), t0, 0.06, rev=0.5)

add(riser(0.9), 16.0, 0.16, rev=0.3)
add(impact(0.8), 17.0, 0.45, rev=0.4)
add(whoosh(0.6), 22.3, 0.3, pan=-0.3, rev=0.3)

# Recommendations: ascending success chimes + score bump sparkle
for i, t0 in enumerate([24.0, 24.7, 25.4]):
    base = [76, 79, 83][i]
    add(blip(note(base + 12), 0.45), t0 + 0.05, 0.11, pan=0.2, rev=0.6)
    add(blip(note(base + 19), 0.45), t0 + 0.11, 0.07, pan=-0.2, rev=0.6)
for i, n in enumerate([84, 88, 91, 96]):
    add(blip(note(n), 0.5), 26.0 + i * 0.05, 0.06, pan=(-0.3 + i * 0.2), rev=0.8)

# Outro
add(riser(1.6), 25.45, 0.24, rev=0.3)
add(impact(1.0), 27.05, 0.65, rev=0.6)
for i, n in enumerate([72, 76, 79, 84, 86]):
    add(blip(note(n), 1.2), 27.1 + i * 0.07, 0.05, pan=(-0.4 + i * 0.2), rev=0.9)
add(whoosh(0.5), 27.85, 0.25, rev=0.3)

# ---------- reverb (FFT convolution with a decaying noise IR) ----------
def reverb(x, seed, decay=2.4):
    r = np.random.default_rng(seed)
    t = tt(decay)
    ir = r.standard_normal(len(t)) * np.exp(-t * 6.5 / decay)
    ir = smooth(ir, 6)
    ir /= np.sqrt(np.sum(ir**2))
    n = len(x) + len(ir)
    nfft = 1 << (n - 1).bit_length()
    y = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return y


L = L * SIDECHAIN + reverb(send_L, 11) * 0.35
Rch = Rch * SIDECHAIN + reverb(send_R, 12) * 0.35

# ---------- master ----------
mix = np.stack([L, Rch], axis=1)
mix = np.tanh(mix * 1.2) / np.tanh(1.2)
end_fade = np.clip((DUR - np.arange(N) / SR) / 1.2, 0, 1) ** 1.5
mix *= end_fade[:, None]
mix *= 0.89 / np.max(np.abs(mix))  # ~ -1 dBFS
pcm = (mix * 32767).astype(np.int16)

out = Path(__file__).with_name("music.wav")
with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out)
