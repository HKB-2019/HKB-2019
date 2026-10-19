import { motion, useReducedMotion } from 'framer-motion';

/* The ringed mark from the owner's message design, in four tones:
 *   ok    a tick   (it worked)          green
 *   bad   a cross  (it did not)         red
 *   warn  a "!"    (worth a look)       amber
 *   info  an "i"   (news)               blue
 *   wait  a clock  (still happening)    amber
 * It draws itself in when it appears: the ring first, then the sign, as a pen
 * would. `burst` adds the short brand-coloured strokes either side, for the
 * big panels. Decoration only: the words beside it say the same. With
 * reduced motion it is simply there. */

const EASE = [0.23, 1, 0.32, 1];

const SIGNS = {
  ok:   ['M7.6 12.4l3 3 5.8-6.6'],
  bad:  ['M8.8 8.8l6.4 6.4', 'M15.2 8.8l-6.4 6.4'],
  warn: ['M12 7.2v6.2', 'M12 16.6v.2'],
  info: ['M12 10.8v6', 'M12 7.4v.2'],
  wait: ['M12 7.6V12l3 2']
};

// The strokes either side of a big mark: the logo's colours, as in the design.
const BURST = [
  ['#5a2be0', -1, -14], ['#f2a51d', -1, 0], ['#3fc1c9', -1, 14],
  ['#e8336f', 1, -14], ['#f2a51d', 1, 0], ['#7a4dff', 1, 14]
];

export default function StateMark({ tone, size, burst = false, delay = 0 }) {
  const calm = useReducedMotion();
  const paths = SIGNS[tone];
  if (!paths) return null;
  const draw = (at) => calm
    ? { initial: false }
    : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 },
        transition: { pathLength: { duration: 0.42, delay: delay + at, ease: EASE }, opacity: { duration: 0.01, delay: delay + at } } };

  return (
    <span className={`state-mark state-mark--${tone}${size === 'lg' ? ' state-mark--lg' : ''}${burst ? ' state-mark--burst' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <motion.circle cx="12" cy="12" r="10.6" strokeWidth={size === 'lg' ? 1.1 : 1.5} transform="rotate(-90 12 12)" {...draw(0)} />
        {paths.map((d, i) => (
          <motion.path key={d} d={d} strokeWidth={size === 'lg' ? 1.5 : 1.9} {...draw(0.28 + i * 0.1)} />
        ))}
      </svg>
      {burst && BURST.map(([colour, side, y], i) => (
        <motion.i key={i} className={`state-mark__ray state-mark__ray--${side < 0 ? 'l' : 'r'}`}
                  style={{ '--ray': colour, '--y': `${y}px`, rotate: side * y * 1.4 }}
                  initial={calm ? false : { opacity: 0, x: side * -8, scaleX: 0.3 }}
                  animate={{ opacity: 1, x: 0, scaleX: 1 }}
                  transition={{ duration: 0.4, delay: delay + 0.45 + (i % 3) * 0.05, ease: EASE }} />
      ))}
    </span>
  );
}
