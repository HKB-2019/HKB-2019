import { useEffect, useState } from 'react';
import Dialog from './Dialog.jsx';
import { useShop } from '../store/ShopContext.jsx';

/* The owner's session-expiry warning, for the admin and for customer
 * accounts alike. Two minutes before a sign-in ends: "Your session expires
 * soon", a minutes : seconds countdown that turns from amber to orange in the
 * last minute and red in the last ten seconds, a bar running down with it,
 * STAY SIGNED IN and Sign out. Afterwards a message says what happened:
 * "Session extended", or "You've been signed out". */

export const WARN_MS = 2 * 60 * 1000;

const Warn = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3z" fill="currentColor" /><path d="M12 9.5v5M12 17.2v.3" stroke="#050407" strokeWidth="2" strokeLinecap="round" /></svg>
);
const Lock = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M7 10V8a5 5 0 0 1 10 0v2h1a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1zm2 0h6V8a3 3 0 0 0-6 0z" /></svg>
);

/**
 * expiresAt  when the sign-in ends (ms), or null when signed out
 * onStay     renews it; resolves to the new expiresAt
 * onSignOut  signs out now
 * onEnded    the time ran out
 * saved      a line on what staying keeps (customers: the bag)
 */
export default function SessionExpiry({ expiresAt, onStay, onSignOut, onEnded, saved }) {
  const { toast } = useShop();
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(null);       // null | 'staying' | 'leaving'
  const [error, setError] = useState(null);
  const left = expiresAt ? expiresAt - now : Infinity;

  useEffect(() => {
    if (!expiresAt) return;
    // Quiet until the warning, then every second.
    const wait = left > WARN_MS ? left - WARN_MS : 1000;
    const t = setTimeout(() => setNow(Date.now()), Math.min(wait, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [expiresAt, now]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (expiresAt && left <= 0) {
      toast({ key: 'session', title: 'You’ve been signed out.', body: 'For your security, your session has ended.', ms: 8000 });
      onEnded();
    }
  }, [expiresAt && left <= 0]);   // eslint-disable-line react-hooks/exhaustive-deps

  const stay = async () => {
    setBusy('staying'); setError(null);
    try {
      await onStay();
      toast({ key: 'session', tone: 'ok', title: 'Session extended', body: 'You’ll remain signed in.' });
    } catch (err) { setError(err.message || 'That didn’t work. Please sign in again.'); }
    setBusy(null);
  };
  const leave = async () => {
    setBusy('leaving');
    try { await onSignOut(); } finally { setBusy(null); }
    toast({ key: 'session', title: 'You’ve been signed out.', body: 'Come back any time.', ms: 6000 });
  };

  const secs = Math.max(0, Math.ceil(left / 1000));
  const stage = secs <= 10 ? 'critical' : secs < 60 ? 'late' : 'soon';
  const open = Boolean(expiresAt) && left > 0 && left <= WARN_MS;

  return (
    <Dialog open={open} tone={stage === 'critical' ? 'bad' : 'warn'} labelledBy="expiryTitle" closeOutside={false} onClose={stay}>
      <span className={`expiry__mark expiry__mark--${stage}`}><Warn /></span>
      <h2 className="state-panel__title" id="expiryTitle">Your session expires soon.</h2>
      <p className="state-panel__note">For your security, you’ll be signed out in</p>
      <div className={`expiry__count expiry__count--${stage}`} role="timer" aria-live="off"
           aria-label={`${Math.floor(secs / 60)} minutes ${secs % 60} seconds`}>
        <span><b>{String(Math.floor(secs / 60)).padStart(2, '0')}</b><small>Minutes</small></span>
        <i aria-hidden="true">:</i>
        <span><b>{String(secs % 60).padStart(2, '0')}</b><small>Seconds</small></span>
      </div>
      <span className={`expiry__bar expiry__bar--${stage}`} aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.min(1, Math.max(0, left / WARN_MS))})` }} />
      </span>
      {saved && <p className="state-card state-card--note expiry__saved"><Lock /><span>{saved}</span></p>}
      {error && <p className="field__error" role="alert">{error}</p>}
      <button type="button" className="btn btn--contrast btn--block" onClick={stay} disabled={Boolean(busy)}>
        {busy === 'staying' ? <><span className="spinner" aria-hidden="true" /> STAYING SIGNED IN…</> : 'STAY SIGNED IN'}
      </button>
      <button type="button" className="btn btn--ghost btn--block state-panel__second" onClick={leave} disabled={Boolean(busy)}>
        {busy === 'leaving' ? <><span className="spinner" aria-hidden="true" /> SIGNING OUT…</> : 'SIGN OUT'}
      </button>
    </Dialog>
  );
}
