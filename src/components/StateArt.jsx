import { motion, useReducedMotion } from 'framer-motion';
import okLeft from '../assets/states/doodle-ok-left.webp';
import okRight from '../assets/states/doodle-ok-right.webp';
import badLeft from '../assets/states/doodle-bad-left.webp';
import badRight from '../assets/states/doodle-bad-right.webp';

/* The brush strokes down both edges of the owner's success and error panels
 * (cut from the owner's design, src/assets/states/). They sweep in from their
 * own edge just after the panel lands. Only the green and red panels carry
 * them; amber and blue stay plain. */

const ART = { ok: [okLeft, okRight], bad: [badLeft, badRight] };
const EASE = [0.23, 1, 0.32, 1];

export default function StateArt({ tone }) {
  const calm = useReducedMotion();
  const art = ART[tone];
  if (!art) return null;
  return art.map((src, i) => {
    const side = i === 0 ? -1 : 1;
    return (
      <motion.img key={src} src={src} alt="" aria-hidden="true" draggable="false"
                  className={`state-art state-art--${side < 0 ? 'l' : 'r'}`}
                  initial={calm ? false : { opacity: 0, x: side * 18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.6, delay: 0.12 + i * 0.06, ease: EASE }} />
    );
  });
}

/** One short, damped shake for a panel that brings bad news, after it lands. */
export function useBadShake(tone) {
  const calm = useReducedMotion();
  return tone === 'bad' && !calm
    ? { animate: { x: [0, -7, 6, -4, 2, 0] }, transition: { duration: 0.45, delay: 0.32, ease: 'easeOut' } }
    : {};
}
