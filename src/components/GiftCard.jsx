import { useEffect, useId, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { naira } from '../lib/delivery.js';
import { EASE_OUT, EASE_SLOW } from '../lib/motion.js';
import maskUrl from '../assets/giftcard/mask.webp';
import wordmarkUrl from '../assets/giftcard/wordmark.webp';
import symbolsUrl from '../assets/giftcard/symbols.webp';

/* The MASQ. gift card, drawn as the physical card from the logo's own artwork
 * (src/assets/giftcard): the wordmark, a small mask and the amount on the
 * front; the symbol row, the motto and the code on the back; a faint hand-drawn
 * doodle behind both. The buyer chooses its colour, and the person given it
 * sees the same card (/gift/:code). */

/** The colours a card comes in. The names match DESIGNS in server/lib/giftcards.js. */
export const DESIGNS = [
  { id: 'violet', name: 'Violet', ground: '#371155' },
  { id: 'night', name: 'Night', ground: '#0e0b14' },
  { id: 'teal', name: 'Teal', ground: '#083f47' },
  { id: 'clay', name: 'Clay', ground: '#6a2412' },
  { id: 'rose', name: 'Rose', ground: '#5a0f3c' }
];
export const designOf = (id) => DESIGNS.find(d => d.id === id) ?? DESIGNS[0];
export const longDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/* Eyes, triangles, chevrons, hatching and rings, as if painted with a dry
 * brush: drawn once, faint, behind everything. The back is the front mirrored,
 * without the eye, which would sit behind the symbol row. */
function Doodle({ flip = false }) {
  const brush = `brush${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg className="giftcard__doodle" viewBox="0 0 1000 630" preserveAspectRatio="xMidYMid slice" aria-hidden="true"
         style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <defs>
        <filter id={brush} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" />
          <feDisplacementMap in="SourceGraphic" scale="9" />
        </filter>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${brush})`}>
        <path d="M38 64 L92 10 M70 92 L140 22 M104 118 L184 38 M140 140 L226 54" />
        <path d="M340 40 L420 120 M420 40 L340 120 M380 30 L380 130" />
        {!flip && <><path d="M430 182 Q500 122 570 182 Q500 242 430 182 Z" /><circle cx="500" cy="182" r="24" /></>}
        <path d="M770 52 L815 98 L860 52 M790 92 L815 118 L840 92" />
        <path d="M905 130 L985 50 M925 182 L1005 102 M945 234 L1015 164" />
        <path d="M26 300 L80 342 L26 384 M76 300 L130 342 L76 384" />
        <path d="M565 382 L642 222 L719 382 Z M612 352 L642 292 L672 352 Z" />
        <path d="M176 456 q22 -34 44 0 t44 0 t44 0" />
        <path d="M50 610 L120 486 L190 610" />
        <path d="M300 618 L332 572 L364 618 L396 572 L428 618 L460 572" />
        <path d="M640 498 L770 520 L694 618 Z" />
        <circle cx="905" cy="548" r="58" /><circle cx="905" cy="548" r="30" />
        <path d="M930 378 h44 M952 356 v44" />
      </g>
      <g fill="currentColor">
        {!flip && <circle cx="500" cy="182" r="8" />}<circle cx="905" cy="548" r="9" />
        <circle cx="236" cy="236" r="7" /><circle cx="262" cy="236" r="7" /><circle cx="288" cy="236" r="7" />
        <circle cx="236" cy="262" r="7" /><circle cx="262" cy="262" r="7" /><circle cx="288" cy="262" r="7" />
      </g>
    </svg>
  );
}

/**
 * The card. It turns over by a click, and once by itself when `revealed`
 * turns true (the code has arrived, or the person given it opens it).
 * `lines` replaces the gallery label's three lines under it.
 */
export default function GiftCard({ amountKobo, to, code, until, design, revealed = false, lines }) {
  const calm = useReducedMotion();
  const [back, setBack] = useState(revealed);
  useEffect(() => { if (revealed) setBack(true); }, [revealed]);
  // A slight tilt towards the pointer, on a computer: the card as an object.
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const sx = useSpring(rx, { stiffness: 140, damping: 18 }), sy = useSpring(ry, { stiffness: 140, damping: 18 });
  const rotateX = useTransform(sx, v => `${v}deg`), rotateY = useTransform(sy, v => `${v}deg`);
  const tilt = (e) => {
    if (calm || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const rest = () => { rx.set(0); ry.set(0); };
  const turn = () => setBack(b => !b);
  const d = designOf(design);
  const label = lines ?? [
    'MASQ. gift card',
    `${amountKobo ? naira(amountKobo) : 'Choose an amount'}${to ? ` · for ${to}` : ''}`,
    `${until ? `Use by ${until}` : 'Lasts twelve months'} · pieces and delivery`
  ];

  return (
    <div className="giftcard-wrap" style={{ '--card-ground': d.ground }}>
      <motion.div className="giftcard-tilt" style={{ rotateX, rotateY }} onPointerMove={tilt} onPointerLeave={rest} onClick={turn}>
        <motion.div
          className="giftcard-flip"
          initial={false}
          animate={{ rotateY: back ? 180 : 0 }}
          transition={calm ? { duration: 0 } : { duration: 1.1, ease: EASE_SLOW }}
        >
          <div className="giftcard giftcard--front" data-design={d.id} aria-hidden={back}>
            <Doodle />
            <img className="giftcard__wordmark" src={wordmarkUrl} alt="MASQ." />
            <span className="giftcard__kind">Gift card</span>
            <img className="giftcard__mask" src={maskUrl} alt="" />
            <div className="giftcard__amount" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={amountKobo ?? 'none'}
                  initial={calm ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={calm ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                >{amountKobo ? naira(amountKobo) : '₦—'}</motion.span>
              </AnimatePresence>
            </div>
            <span className="giftcard__for">{to ? `For ${to}` : 'For someone'}</span>
          </div>
          <div className="giftcard giftcard--back" aria-hidden={!back}>
            <Doodle flip />
            <img className="giftcard__symbols" src={symbolsUrl} alt="" />
            <p className="giftcard__motto">We wear identity. Unapologetically yours.</p>
            <span className={code ? 'giftcard__code' : 'giftcard__code giftcard__code--blank'}>{code ?? 'MASQ-••••-••••'}</span>
            <span className="giftcard__small">{until ? `Use by ${until}` : 'Use at checkout · Valid 12 months'} · Pieces and delivery</span>
          </div>
        </motion.div>
      </motion.div>
      <div className="giftcard__label">
        <span>{label[0]}</span>
        <span className="giftcard__label-line">{label[1]}</span>
        <span>{label[2]}</span>
        <button type="button" className="giftcard__turn" onClick={turn}>{back ? 'See the front' : 'Turn it over'}</button>
      </div>
    </div>
  );
}

/** The colours to choose from, as round swatches named beside the legend. */
export function DesignSwatches({ value, onChange }) {
  const onKeyDown = (e) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = DESIGNS.findIndex(x => x.id === value);
    const next = DESIGNS[(i + step + DESIGNS.length) % DESIGNS.length].id;
    onChange(next);
    e.currentTarget.querySelector(`[data-design="${next}"]`)?.focus();
  };
  return (
    <div className="swatches swatches--large gift__swatches" role="radiogroup" aria-label="Colour of the card" onKeyDown={onKeyDown}>
      {DESIGNS.map(x => (
        <button key={x.id} type="button" role="radio" aria-checked={value === x.id} tabIndex={value === x.id ? 0 : -1}
                data-design={x.id} aria-label={x.name} title={x.name}
                className={`swatch${value === x.id ? ' is-on' : ''}`} style={{ '--swatch': x.ground }}
                onClick={() => onChange(x.id)} />
      ))}
    </div>
  );
}
