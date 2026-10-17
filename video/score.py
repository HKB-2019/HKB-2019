"""The brand film's score: an original piece made here, so the owner holds it
outright. Dark and cinematic with an Afro pulse: a deep pad in D minor, bell
notes as the symbols are drawn, a talking drum, shakers and a soft kick, and
an impact on every cut. Timed to video/Film.jsx (scene starts below).

    python3 video/score.py   ->  video/public/audio/score.wav
"""
import sys, wave
import numpy as np

SR = 44100
LENGTH = 41.5                          # seconds: the film's length
BPM = 96
BEAT = 60 / BPM
# Scene starts in video/Film.jsx (seconds).
OPENING, TITLE, MANIFESTO, EMBROIDERY, PIECES, MODEL, END = 0, 6.5, 10, 16, 21.5, 29, 36
PIECE_CUTS = [PIECES + i * 1.875 for i in range(4)]

rng = np.random.default_rng(7)
n = int(SR * LENGTH)
t = np.arange(n) / SR
L = np.zeros(n); R = np.zeros(n)


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def lowpass(x, cutoff):
    """A gentle low-pass, done in the frequency domain (the whole signal at once)."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** 4)
    return np.fft.irfft(X, len(x))


def highpass(x, cutoff):
    return x - lowpass(x, cutoff)


def add(sig, at, gain=1.0, pan=0.0):
    """Place a sound at `at` seconds, panned -1 (left) … 1 (right)."""
    i = int(at * SR)
    if i >= n:
        return
    sig = sig[: n - i] * gain
    L[i:i + len(sig)] += sig * np.sqrt((1 - pan) / 2) * 1.414
    R[i:i + len(sig)] += sig * np.sqrt((1 + pan) / 2) * 1.414


def env(length, attack=0.005, decay=0.3):
    k = np.arange(int(length * SR)) / SR
    return np.minimum(1, k / max(attack, 1e-4)) * np.exp(-k / decay)


# ------------------------------------------------------------------ sounds

def kick():
    k = np.arange(int(0.6 * SR)) / SR
    pitch = 44 + 80 * np.exp(-k / 0.035)
    return np.sin(2 * np.pi * np.cumsum(pitch) / SR) * np.exp(-k / 0.22)


def talking_drum(start=210, end=130, length=0.32):
    k = np.arange(int(length * SR)) / SR
    pitch = end + (start - end) * np.exp(-k / 0.07)          # the bend down, as a squeezed drum
    body = np.sin(2 * np.pi * np.cumsum(pitch) / SR) + 0.3 * np.sin(2 * np.pi * np.cumsum(pitch * 2.1) / SR)
    slap = rng.standard_normal(len(k)) * np.exp(-k / 0.008) * 0.4
    return (body + slap) * np.exp(-k / 0.12)


def shaker(length=0.09):
    s = highpass(rng.standard_normal(int(length * SR)), 5000)
    return s * env(length, 0.012, 0.03)


def bell(midi, length=2.6):
    k = np.arange(int(length * SR)) / SR
    f = hz(midi)
    s = (np.sin(2 * np.pi * f * k) + 0.45 * np.sin(2 * np.pi * f * 2.76 * k) * np.exp(-k / 0.4)
         + 0.2 * np.sin(2 * np.pi * f * 5.4 * k) * np.exp(-k / 0.15))
    return s * env(length, 0.002, 0.9)


def impact(length=3.5):
    k = np.arange(int(length * SR)) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 30 * np.exp(-k / 0.08)) / SR) * np.exp(-k / 0.9)
    air = lowpass(rng.standard_normal(len(k)), 900) * np.exp(-k / 0.5) * 0.5
    return boom + air


def riser(length=2.0):
    k = np.arange(int(length * SR)) / SR
    s = highpass(rng.standard_normal(len(k)), 1500) * (k / length) ** 2.5
    return s * 0.5


def pad(midis, start, length, cutoff=900, gain=0.1):
    """Detuned saws, softened, swelling in and out."""
    k = np.arange(int(length * SR)) / SR
    s = np.zeros(len(k))
    for m in midis:
        for det in (-0.08, 0.0, 0.07):
            f = hz(m + det)
            s += 2 * ((k * f) % 1) - 1
    s = lowpass(s / (len(midis) * 3), cutoff)
    shape = np.minimum(1, k / 0.8) * np.minimum(1, (length - k) / 0.8)
    return s * shape * gain


# ------------------------------------------------------------------- score

# The ground: D, low and long, from the first frame to the last.
add(pad([38, 45, 50], 0, LENGTH, cutoff=500, gain=0.11), 0)

# Opening: a bell for each symbol as it is drawn (Film.jsx: frame 44 + 12 each),
# then the mask uncovered under a rising air.
for i, m in enumerate([74, 77, 81, 79, 86]):
    add(bell(m), (44 + i * 12) / 30, 0.16, pan=-0.6 + i * 0.3)
add(riser(1.8), 118 / 30 - 0.4, 0.5)
add(bell(62, 4), 150 / 30, 0.18)
add(impact(), TITLE, 0.55)

# The chords, a bar each (D minor, B flat, G minor, A), from the manifesto on.
CHORDS = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]]
bar = 4 * BEAT
at, c = MANIFESTO, 0
while at < END:
    add(pad([m + 12 for m in CHORDS[c % 4]], at, bar + 0.4, cutoff=1400, gain=0.07), at, pan=0.0)
    at += bar; c += 1

# The pulse: kick, shakers and the talking drum, quiet in the manifesto and
# the embroidery, full under the pieces and the model, gone at the end.
beat_at = MANIFESTO
i = 0
while beat_at < END - 0.2:
    full = PIECES <= beat_at < END
    if i % 4 in (0, 2) or (full and i % 8 == 7):
        add(kick(), beat_at, 0.55 if full else 0.32)
    for s16 in range(4):
        add(shaker(), beat_at + s16 * BEAT / 4, (0.07 if s16 % 2 else 0.11) * (1 if full else 0.5), pan=0.35)
    if i % 4 == 1 or (full and i % 4 == 3):
        add(talking_drum(), beat_at + BEAT / 2, 0.22 if full else 0.14, pan=-0.3)
    if full and i % 8 == 5:
        add(talking_drum(260, 160, 0.25), beat_at + 3 * BEAT / 4, 0.16, pan=-0.3)
    beat_at += BEAT; i += 1

# A hit on every cut.
add(impact(2.2), EMBROIDERY, 0.32)
for cut in PIECE_CUTS:
    add(impact(1.6), cut, 0.3)
    add(bell(69, 1.2), cut, 0.08, pan=0.5)
add(riser(1.6), MODEL - 1.6, 0.35)
add(impact(), MODEL, 0.45)

# The end: the pulse stops, the wordmark opens on a low hit and a last bell.
add(riser(1.4), END - 1.4, 0.3)
add(impact(5), END + 0.2, 0.6)
add(bell(74, 5), END + 1.2, 0.18)
add(bell(81, 5), END + 1.25, 0.1, pan=0.4)

# ------------------------------------------------------------------ master

def reverb(x, seconds=2.4, mix=0.22):
    k = np.arange(int(seconds * SR)) / SR
    ir = rng.standard_normal(len(k)) * np.exp(-k / (seconds / 5))
    ir = lowpass(ir, 4000)
    ir /= np.sqrt(np.sum(ir ** 2))
    size = 1 << int(np.ceil(np.log2(len(x) + len(ir))))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x * (1 - mix) + wet * mix * 2.2


L, R = reverb(L), reverb(R)
fade = np.minimum(1, (LENGTH - t) / 2.5)                 # out over the last seconds
L *= fade; R *= fade
peak = max(np.max(np.abs(L)), np.max(np.abs(R)))
L, R = np.tanh(1.2 * L / peak) / np.tanh(1.2), np.tanh(1.2 * R / peak) / np.tanh(1.2)
pcm = (np.stack([L, R], axis=1) * 0.89 * 32767).astype('<i2')

out = sys.argv[1] if len(sys.argv) > 1 else 'video/public/audio/score.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('wrote', out, f'{LENGTH}s')
