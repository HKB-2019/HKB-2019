"""Makes the shop's two good-news sounds (and a moment of silence) as WAV
files in public/assets/sound: soft bell notes, the same each time.
Run: python3 tools/make-sounds.py"""
import math, struct, wave

RATE = 44100
OUT = 'public/assets/sound/'


def render(path, notes, volume, ring):
    length = int(RATE * (max(a for _, a in notes) + ring + 0.06))
    buf = [0.0] * length
    for freq, at in notes:
        s0 = int(at * RATE)
        for i in range(int((ring + 0.05) * RATE)):
            t = i / RATE
            if s0 + i >= length:
                break
            # a soft 12 ms attack, then a bell-like fade
            env = t / 0.012 if t < 0.012 else math.exp(-(t - 0.012) * (6.9 / ring))
            # a touch of the octave above for a bell colour
            buf[s0 + i] += env * (math.sin(2 * math.pi * freq * t) + 0.18 * math.sin(4 * math.pi * freq * t))
    peak = max(abs(x) for x in buf) or 1
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(32767 * volume * x / peak)) for x in buf))


# A small win: two quick notes. A big moment: three rising notes of the major chord.
render(OUT + 'tick.wav', [(1046.5, 0), (1318.5, 0.06)], 0.35, 0.35)
render(OUT + 'chime.wav', [(523.25, 0), (659.25, 0.11), (1046.5, 0.22)], 0.5, 0.9)
with wave.open(OUT + 'silent.wav', 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(b'\x00\x00' * 400)
