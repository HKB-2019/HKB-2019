import { useLayoutEffect, useRef } from 'react';
import { iconIn } from '../lib/feel.js';

/* Wraps an icon (or a button's words) that changes with some state, the sun
 * and moon of the theme switch, ADD TO BAG and ADDED: when `swap` changes the
 * new one fades in (`play`, from src/lib/feel.js) rather than snapping. Not
 * on first showing. */
export default function SwapIcon({ swap, play = iconIn, children }) {
  const ref = useRef(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    play(ref.current);
  }, [swap]);
  return <span className="swap-icon" ref={ref}>{children}</span>;
}
