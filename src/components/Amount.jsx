import { useEffect, useRef, useState } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

/* A sum that counts to its new value when it changes (a quantity up, a code
 * applied), so the eye sees which way it moved. Quick, and only once the
 * value is settled: with reduced motion it simply changes. */
export default function Amount({ value, format }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const calm = useReducedMotion();
  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (calm || start === value) { setShown(value); return; }
    const run = animate(start, value, { duration: 0.5, ease: [0.23, 1, 0.32, 1], onUpdate: setShown });
    return () => run.stop();
  }, [value, calm]);
  return <span className="amount">{format(shown)}</span>;
}
