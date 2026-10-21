"""Makes the shop's good-news sounds as WAV files in public/assets/sound,
the same each time. Run: python3 tools/make-sounds.py

  tick.wav     a small win: two quick, quiet notes
  chime.wav    a big moment, played with the confetti: a warm, soft chord
               with high notes twinkling down over it like the confetti
               falling, in a little room of reverb
  design/sounds/chime-warm.wav  the calmer choice (not used by the shop):
               three slow bell notes, no twinkle
  silent.wav   a moment of silence, to wake the player on a first tap
"""
import struct, wave
import numpy as np

RATE = 44100
OUT = 'public/assets/sound/'


def tone(freq, length, attack, tau, overtone=0.15):
    """One soft note: a sine with a touch of its octave, rising over `attack`
    seconds and fading with time constant `tau`."""
    t = np.arange(int(length * RATE)) / RATE
    env = np.where(t < attack, t / attack, np.exp(-(t - attack) / tau))
    return env * (np.sin(2 * np.pi * freq * t) + overtone * np.sin(4 * np.pi * freq * t))


def place(buf, note, at):
    s = int(at * RATE)
    end = min(len(buf), s + len(note))
    buf[s:end] += note[:end - s]


def reverb(x, mix):
    """A small room: four combs and two all-passes (Schroeder)."""
    def comb(sig, ms, fb):
        d = int(RATE * ms / 1000); y = np.copy(sig)
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

    wet = sum(comb(x, ms, 0.72) for ms in (29.7, 37.1, 41.1, 43.7)) / 4
    wet = allpass(allpass(wet, 5.0, 0.7), 1.7, 0.7)
    return (1 - mix) * x + mix * wet


def save(path, x, peak):
    x = x / (np.max(np.abs(x)) or 1) * peak
    fade = int(0.08 * RATE)
    x[-fade:] *= np.linspace(1, 0, fade)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(32767 * v)) for v in x))


# A small win: two quick notes.
tick = np.zeros(int(0.5 * RATE))
place(tick, tone(1046.5, 0.45, 0.012, 0.09), 0)
place(tick, tone(1318.5, 0.45, 0.012, 0.09), 0.06)
save(OUT + 'tick.wav', reverb(tick, 0.18), 0.35)

# The confetti chime: a C major 9 chord swelling in softly, and pentatonic
# twinkles falling over it for about a second and a half, quieter as they go.
chime = np.zeros(int(2.6 * RATE))
for f, at in ((261.63, 0.00), (392.00, 0.03), (493.88, 0.06), (659.25, 0.09), (587.33, 0.12)):
    place(chime, 0.55 * tone(f, 2.5, 0.09, 0.85, overtone=0.08), at)
twinkles = [(2093.0, 0.08), (1760.0, 0.20), (1568.0, 0.31), (2349.3, 0.43), (1318.5, 0.55), (1760.0, 0.68),
            (1174.7, 0.80), (1568.0, 0.94), (1046.5, 1.08), (1318.5, 1.24), (1174.7, 1.42)]
for i, (f, at) in enumerate(twinkles):
    place(chime, (0.32 - i * 0.02) * tone(f, 0.7, 0.004, 0.16, overtone=0.05), at)
save(OUT + 'chime.wav', reverb(chime, 0.32), 0.42)

# The calmer choice: three slow bells, G - C - E.
warm = np.zeros(int(2.6 * RATE))
for f, at in ((392.0, 0.0), (523.25, 0.18), (659.25, 0.36)):
    place(warm, tone(f, 2.2, 0.03, 0.7, overtone=0.12), at)
save('design/sounds/chime-warm.wav', reverb(warm, 0.3), 0.42)   # not used by the shop: for comparing

with wave.open(OUT + 'silent.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(b'\x00\x00' * 400)
