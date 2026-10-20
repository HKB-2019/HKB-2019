import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import { Close } from './Icons.jsx';
import StateMark from './StateMark.jsx';

/* The owner's message cards. One card in four tones (ok, bad, warn, info, or
 * none for plain news): the ringed mark drawing itself in, the piece's photo
 * when there is one, a title and a line, an optional action (Undo, View bag),
 * the MASQ. stripe, a close button, and a bar along the foot running down the
 * time it has left. They arrive from the top right (from the top on a phone,
 * one at a time), newest first; resting the pointer on one, or tabbing into it, holds its
 * clock. A card with no time (`ms: null`, "You're offline") stays until the
 * thing it is about is over. */

const EASE = [0.23, 1, 0.32, 1];

function Toast({ t, onDone, phone }) {
  const [held, setHeld] = useState(false);
  const left = useRef(t.ms);
  useEffect(() => {
    if (held || !t.ms) return;
    const from = Date.now();
    const timer = setTimeout(onDone, left.current);
    return () => { clearTimeout(timer); left.current -= Date.now() - from; };
  }, [held, onDone, t.ms]);

  const action = t.action && (
    <button type="button" className={`toast__action${t.img ? ' toast__action--under' : ''}`} onClick={() => { t.action.onClick(); onDone(); }}>
      {t.action.label}
    </button>
  );
  const hold = () => setHeld(true);
  const go = () => setHeld(false);
  const from = phone ? { y: -18 } : { x: 36 };
  return (
    <motion.div
      className={`toast${t.tone ? ` toast--${t.tone}` : ''}${held ? ' is-held' : ''}`}
      role={t.tone === 'bad' ? 'alert' : undefined}
      onPointerEnter={hold} onPointerLeave={go} onFocus={hold} onBlur={go}
      layout="position"
      // In: slides from its edge and settles, no bounce (300ms). Out: quicker
      // and shorter, so leaving never draws the eye (200ms).
      initial={{ opacity: 0, scale: 0.98, ...from }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: 0.3, ease: EASE } }}
      exit={{ opacity: 0, ...(phone ? { y: -10 } : { x: 24 }), transition: { duration: 0.2, ease: EASE } }}
    >
      <StateMark tone={t.tone} delay={0.08} />
      {t.img && <img className="toast__img" src={t.img} alt="" />}
      <div className="toast__text">
        <p className="toast__title">{t.title}</p>
        {t.body && <p className="toast__body">{t.body}</p>}
        {/* With a photo as well there is no room beside the words: under them. */}
        {t.action && t.img && action}
      </div>
      {t.action && !t.img && action}
      <span className="toast__stripe" aria-hidden="true"><i /><i /><i /></span>
      <button type="button" className="toast__close" aria-label="Close message" onClick={onDone}><Close /></button>
      {t.ms ? <span className="toast__time" style={{ animationDuration: `${t.ms}ms` }} aria-hidden="true" /> : null}
    </motion.div>
  );
}

function usePhone() {
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(max-width: 640px)');
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return phone;
}

export default function Toasts() {
  const { toasts, dismissToast } = useShop();
  const phone = usePhone();
  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {/* On a phone one at a time, the newest: three would cover the page. */}
        {[...toasts].reverse().slice(0, phone ? 1 : 3).map(t => <ToastSlot key={t.id} t={t} dismiss={dismissToast} phone={phone} />)}
      </AnimatePresence>
    </div>
  );
}

// Keeps `onDone` the same across renders, so a toast's clock is not restarted
// every time another arrives.
function ToastSlot({ t, dismiss, phone }) {
  const done = useRef(() => dismiss(t.id));
  return <Toast t={t} onDone={done.current} phone={phone} />;
}
