import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getOrder } from '../lib/api.js';
import { useShop } from '../store/ShopContext.jsx';
import Wordmark from '../components/Wordmark.jsx';
import StateMark from '../components/StateMark.jsx';
import StateArt, { useBadShake } from '../components/StateArt.jsx';
import { Copy, Check, Truck } from '../components/Icons.jsx';
import { FactCard } from '../components/Dialog.jsx';
import OrderResult, { when, deliveryWindow } from '../components/OrderResult.jsx';
import { gsap } from 'gsap';

/* Where Paystack sends the customer back to. Paystack appends both `trxref`
 * and `reference`; they carry the same value, so either will do.
 *
 * This page NEVER decides whether an order was paid — it only shows what the
 * server says. The money is confirmed by the webhook (and, if that has not
 * landed yet, by the server asking Paystack directly). A page that trusted
 * "Paystack sent me back here" would pay out on a forged redirect. */

const naira = (kobo) => '₦' + (kobo / 100).toLocaleString('en-NG');

const COPY = {
  paid:      { title: 'Payment received',  note: 'Your order is confirmed. A note goes out when it ships.' },
  pending:   { title: 'Still confirming',  note: 'Your bank has not finished telling us yet. This page updates itself.' },
  failed:    { title: 'Payment failed',    note: 'Nothing was taken. Your bag is still where you left it.' },
  abandoned: { title: 'Payment cancelled', note: 'Nothing was taken. Your bag is still where you left it.' },
  // Paid after the order lapsed, and the last one had gone. Say so plainly:
  // they have been charged, and they need to know they will get it back.
  unpaid:    { title: 'Payment not completed',
               note: 'Nothing was taken. Your bag is still here if you want to try again.' },
  sent:      { title: 'On its way',        note: 'Your order has left the studio.' },
  refunded:  { title: 'Refunded',          note: 'Your payment has been returned to the card or account you paid with. Banks can take a few working days to show it.' },
  refund_due:{ title: 'This piece sold out',
               note: 'Your payment came through after your order had timed out, and the last one had gone to someone else. You will be refunded in full to the card you paid with.' }
};

export default function OrderStatus() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';

  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  // Still pending after a few checks: the "Payment pending" panel says so.
  const [waited, setWaited] = useState(false);
  const [round, setRound] = useState(0);
  const { clearCart } = useShop();
  const cleared = useRef(false);

  // A gift card's payment comes back here when Paystack's own default is used.
  const isGift = reference.startsWith('gift-');

  useEffect(() => {
    if (isGift) return;
    if (!reference) { setError('No order reference in the link.'); return; }

    let live = true;
    let tries = 0;

    const check = async () => {
      try {
        const data = await getOrder(reference);
        if (!live) return;
        setOrder(data);

        // Only a confirmed payment empties the bag.
        if (data.status === 'paid' && !cleared.current) { cleared.current = true; clearCart(); }

        // The webhook is usually first, but not always. Give it a little while —
        // unless Paystack has already said the payment was not completed.
        if (data.status === 'pending' && data.payment !== 'not_completed') {
          if (++tries >= 3) setWaited(true);
          if (tries < 10) setTimeout(check, 3000);
        }
      } catch (err) {
        if (live) setError(err.message);
      }
    };

    check();
    return () => { live = false; };
  }, [reference, clearCart, isGift, round]);

  const status = order?.status === 'pending' && order.payment === 'not_completed'
    ? 'unpaid'
    : order?.status === 'paid' && order.sentAt ? 'sent'
    : (order?.status ?? 'pending');
  const copy = COPY[status] ?? COPY.pending;
  // The owner's panels: green once the money is in, red when it did not go
  // through, amber while it is being checked (or a refund is owed), blue once
  // refunded. Brush strokes on the green and red ones only.
  const tone = error || ['failed', 'abandoned', 'unpaid'].includes(status) ? 'bad'
    : ['paid', 'sent'].includes(status) ? 'ok'
    : status === 'refunded' ? 'info'
    : status === 'refund_due' ? 'warn' : 'wait';
  const shakeIt = useBadShake(tone);

  if (isGift) return <Navigate to={`/gift-card?reference=${encodeURIComponent(reference)}`} replace />;

  return (
    <div className="status">
      <header className="status__bar">
        <Link to="/" className="logo"><Wordmark /></Link>
      </header>

      <motion.main
        className={`status__panel status__panel--${tone}`}
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      >
        <StateArt tone={tone} />
        <motion.div className="status__inner" {...shakeIt}>
          <div className="status__head">
            <StateMark tone={tone} size="lg" burst={tone === 'ok'} delay={0.15} />
            {error ? (
              <>
                <h1 className="status__title">We could not find that order</h1>
                <p className="status__note">
                  {/not found|no order reference/i.test(error)
                    ? 'Check the link in the receipt Paystack emailed you, or use “Track an order” with the reference that starts masq-.'
                    : error}
                </p>
              </>
            ) : (
              <>
                <h1 className="status__title">{copy.title}</h1>
                <p className="status__note">{copy.note}</p>
              </>
            )}
          </div>

          {!error && (
            <>
              {(status === 'paid' || status === 'sent') && <OrderSteps at={status === 'sent' ? 2 : 1} />}
              <Reference value={reference} />
              {order && (order.paidAt || order.paymentMethod || order.createdAt) && (
                <FactCard rows={[
                  ['Date', when(order.paidAt ?? order.createdAt)],
                  order.paymentMethod && ['Payment method', order.paymentMethod],
                  order.failureReason && tone === 'bad' && ['Reason', order.failureReason],
                  ['Items', `${order.itemCount ?? order.items.length} ${(order.itemCount ?? order.items.length) === 1 ? 'item' : 'items'}`],
                  order.deliveryEstimate && ['Estimated delivery', deliveryWindow(order.deliveryEstimate)],
                  order.deliveryTo && ['Delivering to', order.deliveryTo]
                ]} />
              )}
              {status === 'paid' && (
                <div className="state-card state-card--note status__note">
                  <Truck />
                  <p><strong>No delivery updates yet</strong><span>We’ll email you when your order leaves the studio, with a tracking number.</span></p>
                </div>
              )}

              {status === 'sent' && (order.courier || order.tracking) && (
                <div className="status__tracking">
                  {order.courier && <p><span>Courier</span><span>{order.courier}</span></p>}
                  {order.tracking && <p><span>Tracking number</span><span className="status__track-no">{order.tracking}</span></p>}
                </div>
              )}

              {status === 'pending' && <div className="status__wait" aria-hidden="true" />}

              {order && (
                <>
                  <ul className="status__items">
                    {order.items.map((i, n) => (
                      <li key={n}>
                        <span>{i.qty}× {i.name} <em>{i.colour ? `${i.colour}, ${i.size}` : i.size}</em></span>
                        <span className="num">{naira(i.unitPriceKobo * i.qty)}</span>
                      </li>
                    ))}
                  </ul>
                  {order.discountKobo > 0 && (
                    <p className="status__line status__line--discount">
                      <span>Discount{order.discountCode ? ` (${order.discountCode})` : ''}</span>
                      <span className="num">−{naira(order.discountKobo)}</span>
                    </p>
                  )}
                  {order.shippingKobo > 0 && (
                    <p className="status__line">
                      <span>Delivery{order.deliveryTo ? ` to ${order.deliveryTo}` : ''}</span>
                      <span className="num">{naira(order.shippingKobo)}</span>
                    </p>
                  )}
                  <p className="status__total">
                    <span>Total</span><span className="num">{naira(order.totalKobo ?? order.subtotalKobo)}</span>
                  </p>
                  {order.giftKobo > 0 && (
                    <>
                      <p className="status__line status__line--discount">
                        <span>Paid by gift card</span><span className="num">−{naira(order.giftKobo)}</span>
                      </p>
                      <p className="status__line">
                        <span>Paid by card</span><span className="num">{naira(order.paidByCardKobo)}</span>
                      </p>
                    </>
                  )}
                  <p className="status__email">
                    {['paid', 'refunded'].includes(order.status) ? 'Receipt to' : 'Order for'} {order.email}
                  </p>
                </>
              )}
            </>
          )}

          {tone === 'bad' && !error ? (
            <>
              <Link className="btn btn--danger btn--block status__retry" to="/?bag=open">TRY AGAIN</Link>
              <Link className="btn btn--ghost btn--block" to="/">BACK TO THE SHOP</Link>
            </>
          ) : (
            <Link className="btn btn--contrast btn--block" to="/">{tone === 'ok' ? 'CONTINUE SHOPPING' : 'BACK TO THE SHOP'}</Link>
          )}
        </motion.div>
      </motion.main>
      {!error && <OrderResult order={order} status={status} waited={waited} reference={reference}
                              onRecheck={() => { setWaited(false); setRound(r => r + 1); }} />}
    </div>
  );
}

/* Where a paid order has got to: paid, being prepared, on its way. The line
 * between the steps fills to where the order is, after the panel lands (GSAP:
 * the dots arrive in turn, then the line runs). Already there with reduced
 * motion. */
const STEPS = ['Paid', 'Being prepared', 'On its way'];

function OrderSteps({ at }) {
  const ref = useRef(null);
  const reach = at / (STEPS.length - 1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const mm = gsap.matchMedia();
    mm.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.timeline({ delay: 0.55 })
        .from(el.querySelectorAll('.steps__dot'), { scale: 0.3, opacity: 0, duration: 0.35, stagger: 0.12, ease: 'back.out(1.6)' })
        .from(el.querySelectorAll('.steps__label'), { y: 6, opacity: 0, duration: 0.3, stagger: 0.12, ease: 'power3.out' }, '<0.05')
        .fromTo(el.querySelector('.steps__fill'), { scaleX: 0 }, { scaleX: reach, duration: 0.8, ease: 'power2.inOut' }, '-=0.15');
    });
    return () => mm.revert();
  }, [reach]);

  return (
    <ol className="steps" ref={ref} aria-label="Where your order is">
      <span className="steps__track" aria-hidden="true"><span className="steps__fill" style={{ transform: `scaleX(${reach})` }} /></span>
      {STEPS.map((label, i) => {
        const state = i < at || (i === at && at === STEPS.length - 1) ? 'done' : i === at ? 'now' : 'next';
        return (
          <li key={label} className={`steps__step is-${state}`} aria-current={state === 'now' ? 'step' : undefined}>
            <span className="steps__dot">{state === 'done' && <Check />}</span>
            <span className="steps__label">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* The order reference, with a button that copies it (and says so). */
function Reference({ value }) {
  const [copied, setCopied] = useState(false);
  const copyIt = async () => {
    try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };
  return (
    <div className="status__refbox">
      <span className="status__reflabel">Order reference</span>
      <span className="status__ref">{value}</span>
      <button type="button" className={`status__copy${copied ? ' is-done' : ''}`} onClick={copyIt}
              aria-label={copied ? 'Copied' : 'Copy the order reference'}>
        {copied ? <Check /> : <Copy />}<span aria-live="polite">{copied ? 'Copied' : ''}</span>
      </button>
    </div>
  );
}
