import { useId, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import StateMark from './StateMark.jsx';
import { Close, Copy, Check } from './Icons.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';

/* Messages that stay where they are, from the owner's boards:
 *
 *   InlineNote   a line in a tinted box: info, ok, warn or bad (not about one field)
 *   ErrorBanner  a problem that stays until it is fixed or closed, with Retry
 *                and View details (the code, the words, the time, a reference)
 *                — as a strip ("banner") or a centred panel ("panel")
 *   Loader       a turning ring, or three dots, with what is being waited for
 *
 * Toasts (Toasts.jsx) are for news that passes; these are for what does not. */

export function InlineNote({ tone = 'info', compact = false, children, className = '' }) {
  return (
    <div className={`inline-note inline-note--${tone}${compact ? ' inline-note--compact' : ''} ${className}`}
         role={tone === 'bad' ? 'alert' : undefined}>
      <StateMark tone={tone} />
      <div className="inline-note__text">{children}</div>
    </div>
  );
}

/* Pictures for the panel kind, by what went wrong. */
const PICTURES = {
  offline: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M6 18a26 26 0 0 1 36 0M12 25a17 17 0 0 1 24 0M18 32a8 8 0 0 1 12 0" /><circle cx="24" cy="38" r="1.6" fill="currentColor" />
      <path d="M8 8l32 32" />
    </svg>
  ),
  server: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="8" y="8" width="32" height="10" rx="2" /><rect x="8" y="22" width="32" height="10" rx="2" />
      <path d="M14 13h6M14 27h6" /><circle cx="34" cy="13" r="1.2" fill="currentColor" /><circle cx="34" cy="27" r="1.2" fill="currentColor" />
      <path d="M16 36v4M32 36v4M12 40h24" />
    </svg>
  ),
  list: (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 6h18l8 8v28H12z" /><path d="M30 6v8h8M18 22h14M18 28h14M18 34h9" />
    </svg>
  )
};

const Retry = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.3h-3.3" />
  </svg>
);

/**
 * details: { code?, message?, time?, reference? } — shown on "View details",
 * so whoever the customer contacts can find out what happened.
 */
/* Under the details: copy the reference for whoever is helping, or ask us. */
function DetailActions({ reference, support }) {
  const { openOverlay } = useShop();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(reference); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* not allowed: nothing */ }
  };
  return (
    <div className="err-banner__help">
      {reference && (
        <button type="button" className="btn btn--ghost" onClick={copy}>
          {copied ? <Check /> : <Copy />} {copied ? 'Copied' : 'Copy reference'}
        </button>
      )}
      {support && <button type="button" className="btn btn--ghost" onClick={() => openOverlay({ info: 'CONTACT' })}>Contact support</button>}
    </div>
  );
}

export function ErrorBanner({
  title, text, onRetry, retryLabel = 'Try again', retrying = false, details, onClose,
  layout = 'banner', picture, action, className = '', support = true
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const rows = details && [
    details.code && ['Error code', details.code],
    details.message && ['Message', details.message],
    details.time && ['Time', new Date(details.time).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
    details.reference && ['Reference ID', details.reference]
  ].filter(Boolean);

  const buttons = (
    <div className="err-banner__actions">
      {onRetry && (
        <button type="button" className="btn btn--danger err-banner__retry" onClick={onRetry} disabled={retrying}>
          {retrying ? <span className="spinner" aria-hidden="true" /> : <Retry />} {retryLabel}
        </button>
      )}
      {action}
      {rows?.length > 0 && (
        <button type="button" className="btn btn--ghost err-banner__more" aria-expanded={open} aria-controls={id}
                onClick={() => setOpen(o => !o)}>{open ? 'Hide details' : 'View details'}</button>
      )}
    </div>
  );

  return (
    <motion.div className={`err-banner err-banner--${layout} ${className}`} role="alert"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: UI_IN, ease: EASE_OUT }}>
      {layout === 'panel'
        ? <span className="err-banner__picture" aria-hidden="true">{PICTURES[picture] ?? PICTURES.server}<i>!</i></span>
        : <span className="err-banner__mark" aria-hidden="true">!</span>}
      <div className="err-banner__text">
        <p className="err-banner__title">{title}</p>
        {text && <p className="err-banner__body">{text}</p>}
        {layout === 'panel' && buttons}
      </div>
      {layout !== 'panel' && buttons}
      {onClose && (
        <button type="button" className="err-banner__close" aria-label="Close" onClick={onClose}><Close /></button>
      )}
      <AnimatePresence initial={false}>
        {open && rows?.length > 0 && (
          <motion.div id={id} className="err-banner__details"
                     initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                     exit={{ opacity: 0, height: 0, transition: { duration: UI_OUT } }} transition={{ duration: UI_IN, ease: EASE_OUT }}>
            <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}:</dt><dd>{v}</dd></div>)}</dl>
            {(details.reference || support) && <DetailActions reference={details.reference} support={support} />}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Details for ErrorBanner from an error the API module threw. */
export const detailsOf = (err, reference) => err && {
  code: err.code ? String(err.code).toUpperCase() : err.status ? `HTTP_${err.status}` : 'NETWORK',
  message: err.message,
  time: err.at ?? Date.now(),
  reference
};

export function Loader({ title = 'Loading…', note, dots = false, className = '' }) {
  return (
    <div className={`loader ${className}`} role="status" aria-live="polite">
      {dots
        ? <span className="loader__dots" aria-hidden="true"><i /><i /><i /></span>
        : <span className="loader__ring" aria-hidden="true" />}
      <p className="loader__title">{title}</p>
      {note && <p className="loader__note">{note}</p>}
    </div>
  );
}
