import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog, { FactCard } from './Dialog.jsx';
import StateMark from './StateMark.jsx';
import { ArrowShort, CardIcon, Copy, Check } from './Icons.jsx';
import { confetti as confettiSound } from '../lib/sound.js';

/* The owner's panels for coming back from paying: "Order placed!" (with a
 * short burst of confetti in the logo's colours, and its sound), "Payment failed", "Card
 * declined", and "Payment pending" while the bank is still deciding. Each is
 * said once per order and outcome: reloading the order page, or opening it
 * again from the receipt, shows the page alone. The page under the panel
 * carries everything the panel says, so closing it loses nothing. */

const naira = (kobo) => '₦' + (kobo / 100).toLocaleString('en-NG');

export const when = (iso) => iso
  ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : null;

/** "21–23 Oct 2026", or "21 Oct – 2 Nov 2026" across a month. */
export function deliveryWindow(est) {
  if (!est) return null;
  const a = new Date(`${est.from}T12:00:00`), b = new Date(`${est.to}T12:00:00`);
  const day = (d, opts) => d.toLocaleDateString('en-GB', opts);
  if (est.from === est.to) return day(a, { day: 'numeric', month: 'short', year: 'numeric' });
  return a.getMonth() === b.getMonth()
    ? `${day(a, { day: 'numeric' })}–${day(b, { day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${day(a, { day: 'numeric', month: 'short' })} – ${day(b, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

/** Copies a value and says so, for the order number. */
export function CopyButton({ value, label = 'Copy the order number' }) {
  const [copied, setCopied] = useState(false);
  const copyIt = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return (
    <button type="button" className={`copy-btn${copied ? ' is-done' : ''}`} onClick={copyIt} aria-label={copied ? 'Copied' : label}>
      {copied ? <Check /> : <Copy />}
    </button>
  );
}

/** Which panel an order calls for, if any. */
export function resultFor(order, status, waited) {
  if (!order) return null;
  if (status === 'paid') return 'placed';
  if (['failed', 'abandoned', 'unpaid'].includes(status)) return order.failureReason ? 'declined' : 'failed';
  // Still pending after the first few checks: a transfer the bank has not
  // finished, most likely. Said once; the page keeps checking underneath.
  if (status === 'pending' && waited) return 'pending';
  return null;
}

const seen = (reference, kind) => {
  try { return sessionStorage.getItem(`masq:told:${reference}:${kind}`) === '1'; } catch { return false; }
};
const markSeen = (reference, kind) => {
  try { sessionStorage.setItem(`masq:told:${reference}:${kind}`, '1'); } catch { /* private window */ }
};

/* Confetti in the logo's colours, once, from both sides of the panel. Loaded
 * only when there is something to celebrate; not at all with reduced motion. */
function celebrate() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  import('canvas-confetti').then(({ default: lib }) => {
    // Drawn on the page itself, not in a background worker: the shop's
    // security policy allows no workers made on the fly.
    const confetti = lib.create(null, { resize: true, useWorker: false });
    const colors = ['#5a2be0', '#7a4dff', '#f2a51d', '#3fc1c9', '#e8336f', '#3ccf74'];
    const base = { colors, disableForReducedMotion: true, ticks: 180, gravity: 1.05, scalar: 0.9, zIndex: 150 };
    confetti({ ...base, particleCount: 60, spread: 62, startVelocity: 42, angle: 60, origin: { x: 0.12, y: 0.72 } });
    confetti({ ...base, particleCount: 60, spread: 62, startVelocity: 42, angle: 120, origin: { x: 0.88, y: 0.72 } });
  }).catch(() => {});
}

export default function OrderResult({ order, status, waited, reference, onRecheck }) {
  const kind = resultFor(order, status, waited);
  const [open, setOpen] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!kind || seen(reference, kind)) { if (open && open !== kind) setOpen(null); return; }
    markSeen(reference, kind);
    setOpen(kind);
    if (kind === 'placed') { setTimeout(celebrate, 380); setTimeout(confettiSound, 380); }
  }, [kind, reference]);   // eslint-disable-line react-hooks/exhaustive-deps

  const close = () => setOpen(null);
  const shown = open && order;
  const total = order ? (order.paidByCardKobo ?? order.totalKobo) : 0;
  const items = order?.itemCount ?? order?.items?.reduce((n, i) => n + i.qty, 0);
  const number = [<span key="n" className="state-facts__ref">{reference}</span>, <CopyButton key="c" value={reference} />];

  if (!shown) return <Dialog open={false} onClose={close} />;

  if (open === 'placed') {
    return (
      <Dialog open tone="ok" labelledBy="placedTitle" onClose={close}>
        <StateMark tone="ok" size="lg" burst />
        <h2 className="state-panel__title" id="placedTitle">Order placed!</h2>
        <p className="state-panel__note">Thank you for your order. We’ve received it and it’s being prepared.</p>
        <FactCard rows={[
          ['Order number', ...number],
          order.paidAt && ['Date', when(order.paidAt)],
          order.paymentMethod && ['Payment method', order.paymentMethod],
          ['Total paid', naira(order.totalKobo)],
          items && ['Items', `${items} ${items === 1 ? 'item' : 'items'}`],
          order.deliveryEstimate && ['Estimated delivery', deliveryWindow(order.deliveryEstimate)]
        ]} />
        <button type="button" className="btn btn--contrast btn--block" onClick={close}>
          VIEW ORDER <ArrowShort className="btn__arrow" />
        </button>
        <button type="button" className="btn btn--ghost btn--block state-panel__second" onClick={() => navigate('/')}>CONTINUE SHOPPING</button>
      </Dialog>
    );
  }

  if (open === 'pending') {
    return (
      <Dialog open tone="wait" labelledBy="pendingTitle" onClose={close}>
        <StateMark tone="wait" size="lg" />
        <h2 className="state-panel__title" id="pendingTitle">Payment pending</h2>
        <p className="state-panel__note">Your payment is being confirmed by your bank. This can take a few minutes for a transfer.</p>
        <FactCard rows={[
          ['Order number', ...number],
          ['Amount', naira(total)],
          ['Status', <span key="p" className="pill">Pending</span>]
        ]} />
        <p className="state-panel__small">We’ll show it here the moment it lands. You don’t need to pay again.</p>
        <button type="button" className="btn btn--contrast btn--block" onClick={() => { onRecheck(); close(); }}>CHECK AGAIN</button>
        <button type="button" className="btn btn--ghost btn--block state-panel__second" onClick={() => navigate('/')}>CONTINUE SHOPPING</button>
      </Dialog>
    );
  }

  // Failed, cancelled or declined: nothing was taken, the bag is as it was.
  const declined = open === 'declined';
  return (
    <Dialog open tone="bad" labelledBy="failedTitle" onClose={close}>
      <StateMark tone="bad" size="lg" />
      <h2 className="state-panel__title" id="failedTitle">
        {declined ? 'Card declined' : status === 'failed' ? 'Payment failed' : 'Payment not completed'}
      </h2>
      <p className="state-panel__note">
        {declined
          ? 'Your bank declined this payment. Please try again or use a different payment method.'
          : 'We couldn’t process your payment. Please try again or use a different payment method.'}
      </p>
      {declined ? (
        <FactCard rows={[
          ['Reason', order.failureReason],
          ['Order number', ...number],
          ['Amount', naira(total)]
        ]} />
      ) : (
        <div className="state-card state-card--note">
          <CardIcon />
          <p><strong>Transaction not completed</strong><span>No amount was charged to your account.</span></p>
        </div>
      )}
      <button type="button" className="btn btn--danger btn--block" onClick={() => navigate('/?bag=open')}>TRY AGAIN</button>
      <button type="button" className="btn btn--ghost btn--block state-panel__second" onClick={() => navigate('/?bag=checkout')}>
        USE A DIFFERENT PAYMENT METHOD
      </button>
      {declined && <p className="state-panel__small">No amount was charged. Your bag is still where you left it.</p>}
    </Dialog>
  );
}
