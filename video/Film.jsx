import { useEffect, useState } from 'react';
import {
  AbsoluteFill, Sequence, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, Easing, delayRender, continueRender
} from 'remotion';

/* The MASQ. brand film: 35 seconds, 1920 × 1080, silent (music is added
 * after, once the owner has a track they hold the rights to).
 *
 *  0  The symbols, then the mask        4s
 *  1  We don't make clothes. / We create symbols.   5s
 *  2  The embroidery, close; People, Places, Patterns, Purpose   5s
 *  3  Drop 01: the four pieces           8s
 *  4  The model: Wear identity. Live culture.   6s
 *  5  MASQ is a language — worn, not spoken.    3s
 *  6  The wordmark                       4s
 */

export const FPS = 30;
const s = (sec) => Math.round(sec * FPS);

const INK = '#f4f1eb';
const DIM = '#b9b4c7';
const VIOLET = '#7b54ff';
const SANS = 'Inter, Helvetica, Arial, sans-serif';
const SERIF = '"EB Garamond", Georgia, serif';
const ease = Easing.bezier(0.22, 0.61, 0.36, 1);
const slow = Easing.bezier(0.33, 0.02, 0.18, 1);

/* -------------------------------------------------------------- fonts */

const FONTS = [
  ['Inter', 'fonts/inter-latin-var.woff2', { weight: '100 900' }],
  ['EB Garamond', 'fonts/ebgaramond-latin-400.woff2', { weight: '400' }],
  ['EB Garamond', 'fonts/ebgaramond-latin-400-italic.woff2', { weight: '400', style: 'italic' }],
  ['EB Garamond', 'fonts/ebgaramond-latin-700.woff2', { weight: '700' }]
];

function useFonts() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(FONTS.map(([family, file, desc]) => {
      const f = new FontFace(family, `url(${staticFile(file)})`, desc);
      return f.load().then(() => document.fonts.add(f));
    })).then(() => continueRender(handle), () => continueRender(handle));
  }, [handle]);
}

/* ------------------------------------------------------------ helpers */

/** Opacity for a scene of `length` frames: in over `inn`, out over `out`. */
function useFade(length, inn = 18, out = 18) {
  const f = useCurrentFrame();
  return interpolate(f, [0, inn, length - out, length], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
}

/** A line that rises a little and fades in, `at` frames into its scene. */
function Rise({ at = 0, children, style }) {
  const f = useCurrentFrame();
  const t = interpolate(f - at, [0, 24], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  return <div style={{ opacity: t, transform: `translateY(${(1 - t) * 26}px)`, ...style }}>{children}</div>;
}

/** A photo that pushes in slowly across its scene. */
function Push({ src, length, from = 1.04, to = 1.14, x = [0, 0], y = [0, 0], position = 'center', dim = 0 }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, length], [0, 1], { extrapolateRight: 'clamp', easing: slow });
  const scale = from + (to - from) * p;
  const tx = x[0] + (x[1] - x[0]) * p, ty = y[0] + (y[1] - y[0]) * p;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <Img src={staticFile(src)} style={{
        width: '100%', height: '100%', objectFit: 'cover', objectPosition: position,
        transform: `translate(${tx}%, ${ty}%) scale(${scale})`
      }} />
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(0,0,0,${dim})` }} />}
    </AbsoluteFill>
  );
}

const caps = (size, spacing = 0.32) => ({
  fontFamily: SANS, fontSize: size, letterSpacing: `${spacing}em`, textTransform: 'uppercase', color: INK
});

/** A slow violet light in a corner, as in the shop's photography. */
function Glow({ x = '70%', y = '40%', size = 1100, strength = 0.32 }) {
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(${size}px ${size * 0.8}px at ${x} ${y}, rgba(110,60,255,${strength}), rgba(80,30,200,0) 70%)`
    }} />
  );
}

/* ------------------------------------------------------------- scenes */

function Opening({ length }) {
  const f = useCurrentFrame();
  const fade = useFade(length, 1, 20);
  // The symbol row is uncovered left to right, then the mask arrives above it.
  const reveal = interpolate(f, [10, 58], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  const mask = interpolate(f, [52, 92], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade, alignItems: 'center', justifyContent: 'center' }}>
      <Glow x="50%" y="46%" size={900} strength={0.22 * mask} />
      <Img src={staticFile('img/mask.webp')} style={{
        height: 470, opacity: mask, transform: `translateY(${-40 + (1 - mask) * 24}px) scale(${0.96 + mask * 0.04})`
      }} />
      <Img src={staticFile('img/symbols.webp')} style={{
        position: 'absolute', top: 820, width: 620, clipPath: `inset(0 ${100 - reveal}% 0 0)`
      }} />
    </AbsoluteFill>
  );
}

function Words({ length }) {
  const fade = useFade(length, 14, 18);
  const line = { fontFamily: SERIF, fontWeight: 400, fontSize: 120, lineHeight: 1.08, color: INK, letterSpacing: '-0.01em' };
  return (
    <AbsoluteFill style={{ background: '#05040a', opacity: fade, justifyContent: 'center', paddingLeft: 190 }}>
      <Glow x="18%" y="60%" size={1000} strength={0.18} />
      <Rise at={6}><div style={line}>We don’t make clothes.</div></Rise>
      <Rise at={54}>
        <div style={line}>We create <span style={{ color: VIOLET, fontWeight: 700 }}>symbols.</span></div>
      </Rise>
    </AbsoluteFill>
  );
}

function Strip({ length }) {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, length], [0, 1], { extrapolateRight: 'clamp', easing: slow });
  const h = 600, w = Math.round(3800 * h / 548);        // the strip at about its own size
  const x = -(w - 1920) * (0.15 + p * 0.55);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top: (1080 - h) / 2, height: h, overflow: 'hidden' }}>
      <Img src={staticFile('img/film-still.webp')} style={{ position: 'absolute', height: h, width: w, maxWidth: 'none', left: x }} />
    </div>
  );
}

function Craft({ length }) {
  const fade = useFade(length);
  const words = ['People', 'Places', 'Patterns', 'Purpose'];
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      {/* the close-up is a wide strip: shown as a band at its own sharpness, panning across */}
      <AbsoluteFill style={{ background: '#000' }} />
      <Strip length={length} />
      <AbsoluteFill style={{ background: 'linear-gradient(to right, rgba(0,0,0,.92) 0%, rgba(0,0,0,.35) 40%, rgba(0,0,0,0) 65%)' }} />
      <div style={{ position: 'absolute', left: 150, top: 330 }}>
        <div style={{ width: 70, height: 3, background: VIOLET, marginBottom: 40 }} />
        {words.map((w, i) => (
          <Rise key={w} at={14 + i * 18}><div style={{ ...caps(46, 0.34), lineHeight: 1.7 }}>{w}</div></Rise>
        ))}
      </div>
    </AbsoluteFill>
  );
}

const PIECES = [
  ['img/prod-tee@2x.webp', 'The Face Tee', '50% 40%'],
  ['img/prod-cap@2x.webp', 'The Mark Cap', '50% 55%'],
  ['img/prod-backpack@2x.webp', 'The Carrier Backpack', '50% 45%'],
  ['img/prod-scarf@2x.webp', 'The Pattern Scarf', '50% 50%']
];

function Piece({ length, src, name, position, index }) {
  const fade = useFade(length, 10, 10);
  return (
    <AbsoluteFill style={{ background: '#050505', opacity: fade }}>
      {/* the photo on the right half; the name on the left */}
      <div style={{ position: 'absolute', right: 0, top: 0, width: 1080, height: 1080 }}>
        <Push src={src} length={length} from={1.02} to={1.1} position={position} />
        <AbsoluteFill style={{ background: 'linear-gradient(to right, #050505 0%, rgba(5,5,5,0) 28%)' }} />
      </div>
      <Glow x="74%" y="40%" size={900} strength={0.2} />
      <div style={{ position: 'absolute', left: 150, top: 420 }}>
        <Rise at={4}><div style={{ ...caps(24, 0.34), color: VIOLET, marginBottom: 26 }}>Drop 01 — 0{index + 1}</div></Rise>
        <Rise at={10}><div style={{ fontFamily: SERIF, fontSize: 96, color: INK, lineHeight: 1.04 }}>{name}</div></Rise>
      </div>
    </AbsoluteFill>
  );
}

function Pieces({ length }) {
  const each = length / PIECES.length;
  return (
    <AbsoluteFill style={{ background: '#050505' }}>
      {PIECES.map(([src, name, position], i) => (
        <Sequence key={src} from={Math.round(i * each)} durationInFrames={Math.round(each)}>
          <Piece length={Math.round(each)} src={src} name={name} position={position} index={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function Model({ length }) {
  const fade = useFade(length);
  return (
    <AbsoluteFill style={{ opacity: fade }}>
      <Push src="img/hero.webp" length={length} from={1.0} to={1.08} position="70% 30%" />
      <div style={{ position: 'absolute', left: 150, top: 360 }}>
        <Rise at={16}><div style={{ ...caps(26, 0.34), color: VIOLET, marginBottom: 30 }}>Urban Rituals</div></Rise>
        <Rise at={26}><div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 120, lineHeight: 1.0, color: INK }}>Wear identity.</div></Rise>
        <Rise at={46}><div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 120, lineHeight: 1.0, color: VIOLET }}>Live culture.</div></Rise>
      </div>
    </AbsoluteFill>
  );
}

function Language({ length }) {
  const fade = useFade(length, 12, 16);
  return (
    <AbsoluteFill style={{ background: '#05040a', opacity: fade, alignItems: 'center', justifyContent: 'center' }}>
      <Glow x="50%" y="50%" size={900} strength={0.14} />
      <Rise at={4}><div style={{ ...caps(34, 0.36), color: DIM, textAlign: 'center' }}>MASQ is a language</div></Rise>
      <Rise at={22}><div style={{ ...caps(34, 0.36), textAlign: 'center', marginTop: 24 }}>— worn, not spoken.</div></Rise>
    </AbsoluteFill>
  );
}

function End({ length }) {
  const f = useCurrentFrame();
  const fade = useFade(length, 16, 1);
  const grow = interpolate(f, [0, length], [0.97, 1.02], { extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade, alignItems: 'center', justifyContent: 'center' }}>
      <Glow x="50%" y="48%" size={1000} strength={0.2} />
      <Img src={staticFile('img/wordmark.webp')} style={{ width: 620, transform: `scale(${grow})` }} />
      <Rise at={20} style={{ marginTop: 50 }}><div style={{ ...caps(26, 0.4) }}>Drop 01 — Urban Rituals</div></Rise>
      <Rise at={34} style={{ marginTop: 56 }}><Img src={staticFile('img/symbols.webp')} style={{ width: 380 }} /></Rise>
    </AbsoluteFill>
  );
}

/* ---------------------------------------------------------------- film */

const SCENES = [
  [Opening, 4], [Words, 5], [Craft, 5], [Pieces, 8], [Model, 6], [Language, 3], [End, 4]
];
export const FILM_FRAMES = SCENES.reduce((n, [, sec]) => n + s(sec), 0);

export function Film() {
  useFonts();
  const { fps } = useVideoConfig();
  let at = 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {SCENES.map(([Scene, sec], i) => {
        const len = Math.round(sec * fps);
        const from = at; at += len;
        return (
          <Sequence key={i} from={from} durationInFrames={len}>
            <Scene length={len} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
