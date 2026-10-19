import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import { Close } from './Icons.jsx';
import StateMark from './StateMark.jsx';

/* The owner's design for messages: a dark card with a ringed tick (it
 * worked) or cross (it did not), the piece's photo when there is one, a title
 * and a line, a close button, and a thin bar along the foot that runs down
 * the time it has left. Resting the pointer on one, or tabbing into it, holds
 * the clock; the bar holds with it. */

function Toast({ t, onDone }) {
  const [held, setHeld] = useState(false);
  const left = useRef(t.ms);
  useEffect(() => {
    if (held) return;
    const from = Date.now();
    const timer = setTimeout(onDone, left.current);
    return () => { clearTimeout(timer); left.current -= Date.now() - from; };
  }, [held, onDone]);

  const hold = () => setHeld(true);
  const go = () => setHeld(false);
  return (
    <motion.div
      className={`toast${t.tone ? ` toast--${t.tone}` : ''}${t.img ? ' toast--photo' : ''}${held ? ' is-held' : ''}`}
      role={t.tone === 'bad' ? 'alert' : undefined}
      onPointerEnter={hold} onPointerLeave={go} onFocus={hold} onBlur={go}
      layout="position"
      // In with a settle and no bounce; out quicker and smaller than in,
      // so leaving never draws the eye.
      initial={{ opacity: 0, y: 14, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1, transition: { type: 'spring', duration: 0.35, bounce: 0 } }}
      exit={{ opacity: 0, y: 6, transition: { duration: 0.18, ease: [0.2, 0, 0, 1] } }}
    >
      <StateMark tone={t.tone} />
      {t.img && <img className="toast__img" src={t.img} alt="" />}
      <div className="toast__text">
        <p className="toast__title">{t.title}</p>
        {t.body && <p className="toast__body">{t.body}</p>}
      </div>
      <button type="button" className="toast__close" aria-label="Close message" onClick={onDone}><Close /></button>
      <span className="toast__time" style={{ animationDuration: `${t.ms}ms` }} aria-hidden="true" />
    </motion.div>
  );
}

export default function Toasts() {
  const { toasts, dismissToast } = useShop();
  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {toasts.map(t => <ToastSlot key={t.id} t={t} dismiss={dismissToast} />)}
      </AnimatePresence>
    </div>
  );
}

// Keeps `onDone` the same across renders, so a toast's clock is not restarted
// every time another arrives.
function ToastSlot({ t, dismiss }) {
  const done = useRef(() => dismiss(t.id));
  return <Toast t={t} onDone={done.current} />;
}

