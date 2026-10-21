"""Makes choices for the shop's confetti chime, to listen to and pick from,
in design/sounds (none is used by the shop until chosen).
Run: python3 tools/make-sound-options.py"""
import struct, wave
import numpy as np

RATE = 44100
OUT = 'design/sounds/'
rng = np.random.default_rng(7)          # the same sounds every run


def t_(length):
    return np.arange(int(length * RATE)) / RATE


def tone(freq, length, attack, tau, partials=((1, 1.0),)):
    """A note built from (multiple of freq, loudness) partials, rising over
    `attack` and fading with time constant `tau` (higher partials fade faster)."""
    t = t_(length)
    out = np.zeros_like(t)
    for k, amp in partials:
        env = np.where(t < attack, t / attack, np.exp(-(t - attack) / (tau / max(1, k ** 0.5))))
        out += amp * env * np.sin(2 * np.pi * freq * k * t)
    return out


def pluck(freq, length, damp=0.996):
    """A plucked string (Karplus–Strong): harp-like."""
    n = int(RATE / freq)
    buf = rng.uniform(-1, 1, n)
    out = np.zeros(int(length * RATE))
    for i in range(len(out)):
        out[i] = buf[i % n]
        buf[i % n] = damp * 0.5 * (buf[i % n] + buf[(i + 1) % n])
    return out


def place(buf, note, at, gain=1.0):
    s = int(at * RATE)
    end = min(len(buf), s + len(note))
    buf[s:end] += gain * note[:end - s]


def reverb(x, mix, size=1.0):
    def comb(sig, ms, fb):
        d = int(RATE * ms * size / 1000); y = np.copy(sig)
        for i in range(d, len(y)):
            y[i] += fb * y[i - d]
        return y

    def allpass(sig, ms, g):
        d = int(RATE * ms / 1000); y = np.zeros_like(sig)
        for i in range(len(sig)):
            xd = sig[i - d] if i >= d else 0.0
            yd = y[i - d] if i >= d else 0.0
            y[i] = -g * sig[i] + xd + g * yd
        return y

    wet = sum(comb(x, ms, 0.74) for ms in (29.7, 37.1, 41.1, 43.7)) / 4
    wet = allpass(allpass(wet, 5.0, 0.7), 1.7, 0.7)
    return (1 - mix) * x + mix * wet


def save(name, x, peak=0.42):
    x = x / (np.max(np.abs(x)) or 1) * peak
    fade = int(0.1 * RATE)
    x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(OUT + name, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(32767 * v)) for v in x))


L = 2.8
C4, D4, E4, G4, A4 = 261.63, 293.66, 329.63, 392.0, 440.0
C5, D5, E5, G5, A5 = 523.25, 587.33, 659.25, 783.99, 880.0
C6, D6, E6, G6, A6 = 1046.5, 1174.66, 1318.51, 1567.98, 1760.0

# 3. Kalimba: an African thumb piano playing a bright five-note rise.
x = np.zeros(int(L * RATE))
for i, f in enumerate((C5, E5, G5, A5, C6)):
    place(x, tone(f, 1.6, 0.003, 0.55, ((1, 1.0), (5.9, 0.28), (3.0, 0.08))), i * 0.11, 1 - i * 0.06)
place(x, tone(G5, 1.8, 0.003, 0.7, ((1, 1.0), (5.9, 0.2))), 0.62, 0.55)
save('3-kalimba.wav', reverb(x, 0.28))

# 4. Harp: a soft upward sweep of plucked strings, settling on a chord.
x = np.zeros(int(L * RATE))
for i, f in enumerate((C4, E4, G4, C5, E5, G5, C6, E6)):
    place(x, pluck(f, 2.2, 0.9965), i * 0.055, 0.9)
save('4-harp.wav', reverb(x, 0.35))

# 5. Music box: a delicate little tune, high and sweet.
x = np.zeros(int(L * RATE))
for f, at in ((E6, 0.0), (G6, 0.16), (C6 * 2, 0.32), (G6, 0.52), (A6, 0.68), (G6, 0.9)):
    place(x, tone(f, 1.4, 0.002, 0.45, ((1, 1.0), (2.0, 0.25), (4.1, 0.08))), at, 0.8)
save('5-music-box.wav', reverb(x, 0.3))

# 6. Wind chimes: crystal tubes knocked by a breeze, airy and slow.
x = np.zeros(int(L * RATE))
chimes = (D6, E6, G6, A6, C6 * 2, D6 * 2)
for i in range(14):
    f = chimes[rng.integers(len(chimes))]
    place(x, tone(f, 1.8, 0.002, 0.9, ((1, 1.0), (2.76, 0.35), (5.4, 0.12))), 0.05 + i * 0.1 + rng.uniform(0, 0.06),
          0.35 + 0.65 * (1 - i / 14))
save('6-wind-chimes.wav', reverb(x, 0.4, size=1.3))

# 7. Talking drum and bell: a soft drum note bending down, then a bright bell.
x = np.zeros(int(L * RATE))
t = t_(0.6)
bend = 170 * np.exp(-t * 3.0) + 95                      # the drum's pitch falls, as when it is squeezed
drum = np.sin(2 * np.pi * np.cumsum(bend) / RATE) * np.exp(-t / 0.22)
place(x, drum, 0.0, 1.0)
place(x, drum * 0.6, 0.18, 1.0)
place(x, tone(G5, 2.0, 0.004, 0.8, ((1, 1.0), (2.0, 0.3), (3.0, 0.1))), 0.36, 0.55)
place(x, tone(C6, 2.0, 0.004, 0.8, ((1, 1.0), (2.0, 0.3))), 0.48, 0.45)
save('7-talking-drum-bell.wav', reverb(x, 0.25))

# 8. Soft pop: a modern app "done" — two warm notes up, with a gentle low thump.
x = np.zeros(int(L * RATE))
t = t_(0.3)
place(x, np.sin(2 * np.pi * 110 * t) * np.exp(-t / 0.06), 0.0, 0.5)
place(x, tone(E5, 1.2, 0.006, 0.35, ((1, 1.0), (2.0, 0.2))), 0.0, 0.8)
place(x, tone(A5, 1.6, 0.006, 0.5, ((1, 1.0), (2.0, 0.2))), 0.1, 0.9)
save('8-soft-pop.wav', reverb(x, 0.22))


# ---- The softer set: no sharp starts, lower notes, the bright edges
# filtered off, quieter, and more room around them. ----

def lowpass(x, cutoff):
    """Takes the brightness off: a gentle two-pass low-pass filter."""
    a = np.exp(-2 * np.pi * cutoff / RATE)
    for _ in range(2):
        y = np.zeros_like(x)
        for i in range(1, len(x)):
            y[i] = (1 - a) * x[i] + a * y[i - 1]
        x = y
    return x


def swell(freq, length, rise, tau, partials=((1, 1.0), (2, 0.12)), vibrato=0.0):
    """A note that fades in slowly rather than being struck."""
    t = t_(length)
    env = np.where(t < rise, np.sin(np.pi / 2 * t / rise) ** 2, np.exp(-(t - rise) / tau))
    wob = 1 + vibrato * np.sin(2 * np.pi * 5.0 * t)
    return env * sum(a * np.sin(2 * np.pi * freq * k * np.cumsum(wob) / RATE) for k, a in partials)


SOFT = 0.3
G3, C3 = 196.0, 130.81

# 9. Soft swell: a warm chord that breathes in and out; no notes are struck.
x = np.zeros(int(3.0 * RATE))
for f, at in ((C4, 0.0), (G4, 0.05), (E5, 0.1), (D5, 0.15), (C5 * 0.5 * 2, 0.2)):
    place(x, swell(f, 2.8, 0.45, 0.8), at, 0.6)
save('9-soft-swell.wav', reverb(lowpass(x, 2200), 0.4, size=1.3), SOFT)

# 10. Felt piano: three muffled piano notes, as if played with the soft pedal.
x = np.zeros(int(3.0 * RATE))
for f, at in ((G4, 0.0), (C5, 0.22), (E5, 0.44)):
    place(x, tone(f, 2.4, 0.025, 0.9, ((1, 1.0), (2, 0.35), (3, 0.12), (4, 0.05))), at, 0.8)
save('10-felt-piano.wav', reverb(lowpass(x, 1400), 0.35), SOFT)

# 11. Glass: a rubbed wine glass, a pure note gently rising in with a slight shimmer.
x = np.zeros(int(3.0 * RATE))
place(x, swell(C5 * 1.5, 2.8, 0.35, 0.9, ((1, 1.0), (2.0, 0.05)), vibrato=0.0015), 0.0, 0.7)
place(x, swell(E5 * 1.5, 2.4, 0.4, 0.8, ((1, 1.0),), vibrato=0.0015), 0.3, 0.5)
save('11-glass.wav', reverb(lowpass(x, 3000), 0.4, size=1.2), SOFT)

# 12. Soft kalimba: the thumb piano an octave lower, muted with a thumb.
x = np.zeros(int(3.0 * RATE))
for i, f in enumerate((C4, E4, G4, C5)):
    place(x, tone(f, 1.8, 0.01, 0.6, ((1, 1.0), (5.9, 0.12))), i * 0.16, 1 - i * 0.1)
save('12-soft-kalimba.wav', reverb(lowpass(x, 1800), 0.32), SOFT)

# 13. Gentle chimes: a few wind chimes, slow and far away.
x = np.zeros(int(3.0 * RATE))
for i, (f, at) in enumerate(((G5, 0.0), (E5, 0.35), (C6, 0.7), (D5, 1.1), (G5, 1.5))):
    place(x, swell(f, 1.6, 0.03, 0.7, ((1, 1.0), (2.76, 0.15))), at, 0.9 - i * 0.12)
save('13-gentle-chimes.wav', reverb(lowpass(x, 2500), 0.45, size=1.4), SOFT)

# 14. Wooden marimba: two warm, round wooden notes with a soft mallet.
x = np.zeros(int(3.0 * RATE))
for f, at in ((G3 * 2, 0.0), (C4 * 2, 0.18), (E4 * 2, 0.36)):
    place(x, tone(f, 1.6, 0.008, 0.35, ((1, 1.0), (4.0, 0.15), (10.0, 0.03))), at, 0.9)
save('14-wooden-marimba.wav', reverb(lowpass(x, 1600), 0.3), SOFT)
