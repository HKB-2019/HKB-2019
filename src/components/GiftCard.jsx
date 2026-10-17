import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { naira } from '../lib/delivery.js';
import { EASE_OUT, EASE_SLOW } from '../lib/motion.js';
import maskUrl from '../assets/giftcard/mask.webp';
import wordmarkUrl from '../assets/giftcard/wordmark.webp';
import symbolsUrl from '../assets/giftcard/symbols.webp';
import doodleFrontUrl from '../assets/giftcard/doodle-front.webp';
import doodleBackUrl from '../assets/giftcard/doodle-back.webp';

/* The MASQ. gift card, laid out exactly as the owner's chosen design: the
 * wordmark, GIFT CARD, a small mask and the amount on the front; the symbol
 * row, the motto, the code and the small print on the back; behind both, the
 * design's own hand-drawn doodle (src/assets/giftcard/doodle-*.webp, lifted
 * from it and laid on in each colour's doodle tone). The logo pieces are cut
 * from the logo. The buyer chooses its colour, and the person given it sees
 * the same card (/gift/:code). */

/** The colours a card comes in. The names match DESIGNS in server/lib/giftcards.js. */
export const DESIGNS = [
  { id: 'violet', name: 'Violet', ground: '#371256', doodle: '#451a6b' },
  { id: 'night', name: 'Night', ground: '#0e0b14', doodle: '#1f1a29' },
  { id: 'teal', name: 'Teal', ground: '#083f47', doodle: '#13545d' },
  { id: 'clay', name: 'Clay', ground: '#6a2412', doodle: '#80341e' },
  { id: 'rose', name: 'Rose', ground: '#5a0f3c', doodle: '#6f1d4e' }
];
export const designOf = (id) => DESIGNS.find(d => d.id === id) ?? DESIGNS[0];
export const longDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

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
    <div className="giftcard-wrap" style={{ '--card-ground': d.ground, '--card-doodle': d.doodle }}>
      <motion.div className="giftcard-tilt" style={{ rotateX, rotateY }} onPointerMove={tilt} onPointerLeave={rest} onClick={turn}>
        <motion.div
          className="giftcard-flip"
          initial={false}
          animate={{ rotateY: back ? 180 : 0 }}
          transition={calm ? { duration: 0 } : { duration: 1.1, ease: EASE_SLOW }}
        >
          <div className="giftcard giftcard--front" data-design={d.id} aria-hidden={back}>
            <i className="giftcard__doodle" style={{ '--doodle': `url(${doodleFrontUrl})` }} />
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
            <i className="giftcard__doodle" style={{ '--doodle': `url(${doodleBackUrl})` }} />
            <img className="giftcard__symbols" src={symbolsUrl} alt="" />
            <p className="giftcard__motto">We wear identity. Unapologetically yours.</p>
            <span className={code ? 'giftcard__code' : 'giftcard__code giftcard__code--blank'}>{code ?? 'MASQ-••••-••••'}</span>
            <span className="giftcard__small">Use at masq.ng · Valid 12 months · Pieces and delivery</span>
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
