import { useEffect, useState } from 'react';
import {
  AbsoluteFill, Sequence, Img, staticFile, useCurrentFrame, useVideoConfig,
  interpolate, Easing, random, delayRender, continueRender
} from 'remotion';

/* The MASQ. brand film: 40 seconds, 1920 × 1080, shot as if through one
 * camera: a 2.39:1 frame, fine grain, a vignette and one colour grade over
 * everything; words revealed from behind an edge, never faded; light moving
 * across thread and cloth. Silent: music is laid in later, once the owner has
 * a track they hold the rights to.
 *
 *  1  A line, then the five symbols drawn by hand        5s
 *  2  URBAN RITUALS · Drop 01                            3.5s
 *  3  We don't make clothes. / We create symbols.        6s
 *  4  The embroidery: People. Places. Patterns. Purpose. 5.5s
 *  5  The pieces, cut to a beat                          7.5s
 *  6  The model: Wear identity. Live culture.            7s
 *  7  The wordmark, under a sweep of light               5.5s
 */

export const FPS = 30;
const W = 1920, H = 1080;
const BAR = 138;                                  // letterbox: 2.39:1 inside 16:9

const INK = '#f2eee6';
const DIM = '#a9a3b8';
const VIOLET = '#7b54ff';
const SANS = 'Inter, Helvetica, Arial, sans-serif';
const SERIF = '"EB Garamond", Georgia, serif';
const OUT = Easing.bezier(0.16, 1, 0.3, 1);       // expo out: arrives, then settles
const SLOW = Easing.bezier(0.45, 0, 0.2, 1);      // camera moves
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };

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

/* ------------------------------------------------------- film surface */

/** Fine moving grain, a vignette and the letterbox: over every frame. */
function Surface() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.22 }}>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={f % 97} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grain)" />
      </svg>
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,0,.55) 100%)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: BAR, background: '#000' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: BAR, background: '#000' }} />
    </AbsoluteFill>
  );
}

/** Dust in the light: soft points drifting slowly, nearer ones larger and faster. */
function Dust({ count = 46, seed = 'd', strength = 1 }) {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
      {Array.from({ length: count }, (_, i) => {
        const near = random(`${seed}z${i}`);
        const x = random(`${seed}x${i}`) * W + Math.sin(f / 90 + i) * 18 * near;
        const y = (random(`${seed}y${i}`) * (H + 200) - f * (0.25 + near * 0.9)) % (H + 200);
        const size = 2 + near * 7;
        return (
          <div key={i} style={{
            position: 'absolute', left: x, top: (y + H + 200) % (H + 200) - 100, width: size, height: size, borderRadius: '50%',
            background: 'rgba(225,215,255,1)', opacity: (0.08 + near * 0.32) * strength, filter: `blur(${1 + (1 - near) * 2.5}px)`
          }} />
        );
      })}
    </AbsoluteFill>
  );
}

/** A band of light crossing what is under it, from `at` over `dur` frames. */
function Sweep({ at = 0, dur = 40, angle = 105, strength = 0.22, width = 14 }) {
  const f = useCurrentFrame();
  const p = interpolate(f - at, [0, dur], [-30, 130], { ...clamp, easing: SLOW });
  return (
    <AbsoluteFill style={{
      mixBlendMode: 'screen', pointerEvents: 'none',
      background: `linear-gradient(${angle}deg, rgba(255,255,255,0) ${p - width}%, rgba(200,180,255,${strength}) ${p}%, rgba(255,255,255,0) ${p + width}%)`
    }} />
  );
}

/** The violet light the shop's photographs carry, slowly breathing. */
function Glow({ x = '70%', y = '45%', size = 1100, strength = 0.3 }) {
  const f = useCurrentFrame();
  const breath = 1 + Math.sin(f / 45) * 0.08;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(${size * breath}px ${size * 0.75 * breath}px at ${x} ${y}, rgba(104,58,255,${strength}), rgba(70,25,190,0) 70%)`
    }} />
  );
}

/** One grade over every photograph: deeper blacks, a touch of violet in the shadows. */
const grade = { filter: 'contrast(1.12) saturate(1.06) brightness(.96)' };

/* ---------------------------------------------------------- typography */

/** Words that rise one by one from behind an edge (each word is clipped). */
function Words({ text, at = 0, stagger = 5, style, accent }) {
  const f = useCurrentFrame();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 0.26em', ...style }}>
      {text.split(' ').map((w, i) => {
        const t = interpolate(f - at - i * stagger, [0, 28], [0, 1], { ...clamp, easing: OUT });
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.14em', marginBottom: '-0.14em' }}>
            <span style={{
              display: 'inline-block', transform: `translateY(${(1 - t) * 108}%)`,
              color: accent && accent.includes(w) ? VIOLET : undefined
            }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
}

/** Tracked capitals that open out from tight to wide as they appear. */
function Track({ text, at = 0, size = 30, from = 0.9, to = 0.42, color = INK, style }) {
  const f = useCurrentFrame();
  const t = interpolate(f - at, [0, 40], [0, 1], { ...clamp, easing: OUT });
  return (
    <div style={{
      fontFamily: SANS, fontSize: size, textTransform: 'uppercase', color,
      letterSpacing: `${to + (from - to) * (1 - t)}em`, opacity: t, filter: `blur(${(1 - t) * 6}px)`,
      marginRight: `-${to}em`, ...style
    }}>{text}</div>
  );
}

/** Opacity for a scene: in over `inn`, out over `out` frames. */
function useFade(length, inn = 16, out = 16) {
  const f = useCurrentFrame();
  return interpolate(f, [0, inn, length - out, length], [0, 1, 1, 0], clamp);
}

/* -------------------------------------------------------------- symbols */

/* The five symbols of the logo, as strokes that can be drawn on. */
const SYMBOLS = [
  ['#22b8cc', [['M64 14 L114 64 L64 114 L14 64 Z'], ['M64 46 L82 64 L64 82 L46 64 Z', true]]],
  ['#f0461e', [['M64 16 L64 112'], ['M30 30 L98 98'], ['M98 30 L30 98'], ['M96 50 L110 64 L96 78'], ['M32 50 L18 64 L32 78']]],
  ['#f5a412', [['M64 18 A46 46 0 1 1 63.9 18'], ['M64 40 A24 24 0 1 1 63.9 40']]],
  ['#9b30f0', [['M64 16 L64 112'], ['M30 30 L98 98'], ['M98 30 L30 98'], ['M14 64 L34 64'], ['M94 64 L114 64']]],
  ['#8fcf1a', [['M64 32 A32 32 0 1 1 63.9 32'], ['M10 64 L118 64'], ['M64 54 A10 10 0 1 1 63.9 54', true]]]
];

function Symbol({ index, at, size = 128 }) {
  const f = useCurrentFrame();
  const [colour, paths] = SYMBOLS[index];
  return (
    <svg width={size} height={size} viewBox="0 0 128 128" style={{ overflow: 'visible', filter: `drop-shadow(0 0 10px ${colour}88)` }}>
      {paths.map(([d, filled], k) => {
        const t = interpolate(f - at - k * 4, [0, 26], [0, 1], { ...clamp, easing: OUT });
        return (
          <path key={k} d={d} pathLength={1} fill={filled ? colour : 'none'} fillOpacity={filled ? t : 0}
                stroke={colour} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round"
                strokeDasharray="1 1" strokeDashoffset={1 - t} />
        );
      })}
    </svg>
  );
}

/* --------------------------------------------------------------- scenes */

function Opening({ length }) {
  const f = useCurrentFrame();
  const fade = useFade(length, 1, 18);
  const line = interpolate(f, [8, 44], [0, 1], { ...clamp, easing: OUT });
  const lift = interpolate(f, [40, 70], [0, 1], { ...clamp, easing: OUT });
  const drift = interpolate(f, [0, length], [1, 1.05], clamp);
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade, alignItems: 'center', justifyContent: 'center' }}>
      <Glow x="50%" y="50%" size={1000} strength={0.16 * lift} />
      <Dust seed="o" count={30} strength={lift} />
      {/* a hairline of violet, then the symbols drawn above it */}
      <div style={{ position: 'absolute', top: 620, left: '50%', width: 760, height: 2, background: VIOLET,
                    transform: `translateX(-50%) scaleX(${line})`, opacity: 0.7 * (1 - lift * 0.6) }} />
      <div style={{ display: 'flex', gap: 70, transform: `translateY(${-30 + (1 - lift) * 20}px) scale(${drift})` }}>
        {SYMBOLS.map((_, i) => <Symbol key={i} index={i} at={44 + i * 12} size={120} />)}
      </div>
    </AbsoluteFill>
  );
}

function Title({ length }) {
  const fade = useFade(length, 12, 14);
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade, alignItems: 'center', justifyContent: 'center' }}>
      <Glow x="50%" y="52%" size={900} strength={0.14} />
      <Track text="Urban Rituals" at={2} size={64} from={1.1} to={0.5} />
      <Track text="Drop 01" at={26} size={22} from={0.8} to={0.5} color={VIOLET} style={{ marginTop: 34 }} />
    </AbsoluteFill>
  );
}

function Manifesto({ length }) {
  const f = useCurrentFrame();
  const fade = useFade(length, 10, 16);
  const second = 82;
  // the first line steps back as the second arrives
  const back = interpolate(f, [second - 6, second + 18], [1, 0.32], { ...clamp, easing: OUT });
  const serif = { fontFamily: SERIF, fontSize: 132, lineHeight: 1.06, color: INK, letterSpacing: '-0.012em' };
  return (
    <AbsoluteFill style={{ background: '#050309', opacity: fade, justifyContent: 'center', paddingLeft: 200 }}>
      <Glow x="22%" y="58%" size={1100} strength={0.16} />
      <Dust seed="m" count={24} strength={0.6} />
      <div style={{ opacity: back }}><Words text="We don’t make clothes." at={8} stagger={6} style={serif} /></div>
      <Words text="We create symbols." at={second} stagger={7} style={{ ...serif, fontWeight: 700 }} accent={['symbols.']} />
      <Sequence from={second + 34}><Sweep dur={44} strength={0.16} /></Sequence>
    </AbsoluteFill>
  );
}

function Embroidery({ length }) {
  const f = useCurrentFrame();
  const fade = useFade(length, 14, 14);
  const p = interpolate(f, [0, length], [0, 1], { ...clamp, easing: SLOW });
  const h = 820, w = Math.round(3800 * h / 548);
  const x = -(w - W) * (0.12 + p * 0.42);
  const scale = 1 + p * 0.04;
  const words = ['People.', 'Places.', 'Patterns.', 'Purpose.'];
  const each = Math.floor((length - 24) / words.length);
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade }}>
      {/* sharp in the middle, softer at the edges: a shallow lens */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: (H - h) / 2, height: h, overflow: 'hidden' }}>
        <Img src={staticFile('img/film-still.webp')} style={{ position: 'absolute', height: h, width: w, maxWidth: 'none', left: x, transform: `scale(${scale})`, ...grade, filter: 'blur(3px) contrast(1.1) brightness(.8)' }} />
        <div style={{ position: 'absolute', inset: 0, WebkitMaskImage: 'radial-gradient(ellipse 52% 70% at 55% 50%, #000 40%, transparent 80%)' }}>
          <Img src={staticFile('img/film-still.webp')} style={{ position: 'absolute', height: h, width: w, maxWidth: 'none', left: x, transform: `scale(${scale})`, ...grade }} />
        </div>
        <Sweep at={10} dur={length - 20} angle={100} strength={0.2} width={10} />
      </div>
      <AbsoluteFill style={{ background: 'linear-gradient(to right, rgba(0,0,0,.85) 0%, rgba(0,0,0,.2) 38%, rgba(0,0,0,0) 60%)' }} />
      <Dust seed="e" count={40} />
      {words.map((w, i) => (
        <Sequence key={w} from={12 + i * each} durationInFrames={each + (i === words.length - 1 ? 12 : 0)}>
          <Swap text={w} length={each + (i === words.length - 1 ? 12 : 0)} last={i === words.length - 1} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

/** One word in, then out, for the rhythm of People. Places. Patterns. Purpose. */
function Swap({ text, length, last }) {
  const f = useCurrentFrame();
  // out quickly before the next arrives; the last stays until the scene fades
  const out = last ? 0 : interpolate(f, [length - 7, length - 1], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 200, top: 470, opacity: 1 - out, transform: `translateY(${-out * 20}px)` }}>
      <div style={{ width: 64, height: 3, background: VIOLET, marginBottom: 30, transform: `scaleX(${interpolate(f, [0, 20], [0, 1], { ...clamp, easing: OUT })})`, transformOrigin: 'left' }} />
      <Words text={text} at={0} style={{ fontFamily: SERIF, fontSize: 104, color: INK }} />
    </div>
  );
}

const PIECES = [
  ['img/prod-tee@2x.webp', 'The Face Tee', '50% 35%'],
  ['img/prod-cap@2x.webp', 'The Mark Cap', '50% 55%'],
  ['img/prod-backpack@2x.webp', 'The Carrier Backpack', '50% 45%'],
  ['img/prod-scarf@2x.webp', 'The Pattern Scarf', '50% 50%']
];

function Piece({ length, src, name, position, index }) {
  const f = useCurrentFrame();
  // each cut opens a little close and eases out: a camera settling
  const s = interpolate(f, [0, length], [1.16, 1.05], { ...clamp, easing: OUT });
  const flash = interpolate(f, [0, 3], [0.55, 0], clamp);
  const slide = interpolate(f, [0, 14], [60, 0], { ...clamp, easing: OUT });
  return (
    <AbsoluteFill style={{ background: '#040404' }}>
      <div style={{ position: 'absolute', right: 120, top: 0, width: 1000, height: H, overflow: 'hidden' }}>
        <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: position, transform: `scale(${s}) translateX(${slide}px)`, ...grade }} />
        <AbsoluteFill style={{ background: 'linear-gradient(to right, #040404 0%, rgba(4,4,4,0) 30%, rgba(4,4,4,0) 80%, #040404 100%)' }} />
        <Sweep at={6} dur={length} strength={0.14} />
      </div>
      <Glow x="68%" y="42%" size={900} strength={0.18} />
      <div style={{ position: 'absolute', left: 200, top: 430 }}>
        <Track text={`0${index + 1} / 04`} at={2} size={20} from={0.7} to={0.4} color={VIOLET} style={{ marginBottom: 28 }} />
        <Words text={name} at={4} stagger={4} style={{ fontFamily: SERIF, fontSize: 92, color: INK, maxWidth: 700, lineHeight: 1.05 }} />
      </div>
      <AbsoluteFill style={{ background: VIOLET, opacity: flash * 0.35, mixBlendMode: 'screen' }} />
    </AbsoluteFill>
  );
}

function Pieces({ length }) {
  const each = Math.round(length / PIECES.length);
  return (
    <AbsoluteFill style={{ background: '#040404' }}>
      {PIECES.map(([src, name, position], i) => (
        <Sequence key={src} from={i * each} durationInFrames={each}>
          <Piece length={each} src={src} name={name} position={position} index={i} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

function Model({ length }) {
  const f = useCurrentFrame();
  const fade = useFade(length, 18, 18);
  const p = interpolate(f, [0, length], [0, 1], { ...clamp, easing: SLOW });
  // a slow push and a drift to the right: the camera walking in
  const s = 1.02 + p * 0.09;
  const x = -p * 1.4;
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade }}>
      <AbsoluteFill style={{ transform: `scale(${s}) translateX(${x}%)` }}>
        <Img src={staticFile('img/hero.webp')} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% 28%', ...grade }} />
      </AbsoluteFill>
      <Glow x="66%" y="40%" size={900} strength={0.12} />
      <Dust seed="h" count={36} strength={0.8} />
      <Sequence from={30}><Sweep dur={70} angle={95} strength={0.1} width={18} /></Sequence>
      <div style={{ position: 'absolute', left: 200, top: 360 }}>
        <Track text="Urban Rituals" at={18} size={22} from={0.8} to={0.42} color={VIOLET} style={{ marginBottom: 34 }} />
        <Words text="Wear identity." at={30} stagger={6} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 128, lineHeight: 1.02, color: INK }} />
        <Words text="Live culture." at={56} stagger={6} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 128, lineHeight: 1.02, color: VIOLET }} />
      </div>
    </AbsoluteFill>
  );
}

function End({ length }) {
  const f = useCurrentFrame();
  const fade = useFade(length, 14, 26);
  // the wordmark opens from its centre outward, then light crosses it
  const open = interpolate(f, [6, 40], [50, 0], { ...clamp, easing: OUT });
  const grow = interpolate(f, [0, length], [0.98, 1.03], clamp);
  return (
    <AbsoluteFill style={{ background: '#000', opacity: fade, alignItems: 'center', justifyContent: 'center' }}>
      <Glow x="50%" y="46%" size={1000} strength={0.14} />
      <Dust seed="w" count={28} strength={0.7} />
      <div style={{ position: 'relative', transform: `scale(${grow})`, clipPath: `inset(0 ${open}% 0 ${open}%)` }}>
        <Img src={staticFile('img/wordmark.webp')} style={{ width: 640, display: 'block' }} />
        <Sequence from={34}><Sweep dur={40} strength={0.5} width={8} /></Sequence>
      </div>
      <Track text="MASQ is a language — worn, not spoken." at={46} size={22} from={0.7} to={0.38} color={DIM} style={{ marginTop: 62 }} />
    </AbsoluteFill>
  );
}

/* ---------------------------------------------------------------- film */

const SCENES = [
  [Opening, 5], [Title, 3.5], [Manifesto, 6], [Embroidery, 5.5], [Pieces, 7.5], [Model, 7], [End, 5.5]
];
export const FILM_FRAMES = SCENES.reduce((n, [, sec]) => n + Math.round(sec * FPS), 0);

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
      <Surface />
    </AbsoluteFill>
  );
}
