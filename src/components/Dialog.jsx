import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useFocusTrap } from '../lib/useFocusTrap.js';
import { Close } from './Icons.jsx';
import StateArt, { useBadShake } from './StateArt.jsx';
import StateMark from './StateMark.jsx';
import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';

/* One of the owner's big panels as a dialog that can open over anything — the
 * bag drawer (Remove this item?), the order page (Order placed!) — without
 * closing what is underneath. Tinted by tone, the brush strokes down both
 * edges for green and red, a short shake for red. Escape and the close
 * button answer `onClose`; so does a tap outside, unless `closeOutside` is
 * false (a question that needs an answer). */

function Panel({ tone, labelledBy, onClose, closeOutside, children }) {
  const ref = useFocusTrap(true);
  const shakeIt = useBadShake(tone);
  useEffect(() => {
    // Ahead of the page's own Escape (which closes the bag underneath).
    const onKey = (e) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={labelledBy} data-lenis-prevent
         onClick={(e) => { if (closeOutside && e.target === e.currentTarget) onClose(); }}>
      <motion.div ref={ref} className={`modal__panel modal__panel--state modal__panel--${tone}`}
                  initial={{ opacity: 0, y: 16, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: UI_OUT, ease: EASE_OUT } }}
                  transition={{ duration: UI_IN, ease: EASE_OUT }}>
        <StateArt tone={tone} />
        <button type="button" className="close-btn modal__close" data-close aria-label="Close" onClick={onClose}><Close /></button>
        <motion.div className="state-panel" {...shakeIt}>{children}</motion.div>
      </motion.div>
    </div>
  );
}

export default function Dialog({ open, tone = 'ok', labelledBy, onClose, closeOutside = true, children }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="dialog" className="dialog-root">
          <motion.div className="dialog-scrim" onClick={closeOutside ? onClose : undefined}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: UI_OUT } }} transition={{ duration: UI_IN, ease: EASE_OUT }} />
          <Panel tone={tone} labelledBy={labelledBy} onClose={onClose} closeOutside={closeOutside}>{children}</Panel>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/** The piece a dialog is about: its photo, name, options and price. */
export function PieceCard({ img, name, meta, price, aside }) {
  return (
    <div className="state-card state-card--piece">
      {img && <img src={img} alt="" />}
      <div className="state-card__piece">
        <p className="state-card__name">{name}</p>
        {meta && <p className="state-card__meta">{meta}</p>}
        {price && <p className="state-card__price">{price}</p>}
      </div>
      {aside && <span className="state-card__aside">{aside}</span>}
    </div>
  );
}

/** Rows of facts in a quiet card: [label, value, extra?]. */
export function FactCard({ rows }) {
  return (
    <dl className="state-card state-facts">
      {rows.filter(Boolean).map(([label, value, extra]) => (
        <div className="state-facts__row" key={label}>
          <dt>{label}</dt>
          <dd>{value}{extra}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The owner's generic error panel: for something that failed for a reason
 *  the customer cannot fix (the server, the connection). Try again, or ask. */
export function ErrorDialog({ open, onClose, onRetry, title = 'Something went wrong', text = 'We’re experiencing an issue. Please try again later.', onContact }) {
  return (
    <Dialog open={open} tone="bad" labelledBy="errTitle" onClose={onClose}>
      <StateMark tone="bad" size="lg" />
      <h2 className="state-panel__title" id="errTitle">{title}</h2>
      <p className="state-panel__note">{text}</p>
      {onRetry && <button type="button" className="btn btn--danger btn--block" onClick={onRetry}>TRY AGAIN</button>}
      {onContact && <button type="button" className="btn btn--ghost btn--block state-panel__second" onClick={onContact}>CONTACT SUPPORT</button>}
    </Dialog>
  );
}
