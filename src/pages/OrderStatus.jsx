import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getOrder } from '../lib/api.js';
import { useShop } from '../store/ShopContext.jsx';

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
  abandoned: { title: 'Payment cancelled', note: 'Nothing was taken. Your bag is still where you left it.' }
};

export default function OrderStatus() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';

  const [order, setOrder] = useState(null);
  const [error, setError] = useState(null);
  const { clearCart } = useShop();
  const cleared = useRef(false);

  useEffect(() => {
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

        // The webhook is usually first, but not always. Give it a little while.
        if (data.status === 'pending' && ++tries < 10) setTimeout(check, 3000);
      } catch (err) {
        if (live) setError(err.message);
      }
    };

    check();
    return () => { live = false; };
  }, [reference, clearCart]);

  const status = order?.status ?? 'pending';
  const copy = COPY[status] ?? COPY.pending;

  return (
    <div className="status">
      <header className="status__bar">
        <Link to="/" className="logo">MASQ<span>.</span></Link>
      </header>

      <motion.main
        className="status__panel"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {error ? (
          <>
            <p className="eyebrow">Order</p>
            <h1 className="status__title">We could not find that order</h1>
            <p className="status__note">{error}</p>
          </>
        ) : (
          <>
            <p className="eyebrow">Your order</p>
            <h1 className="status__title">{copy.title}</h1>
            <p className="status__note">{copy.note}</p>
            <p className="status__ref">{reference}</p>

            {status === 'pending' && !error && <div className="status__wait" aria-hidden="true" />}

            {order && (
              <>
                <ul className="status__items">
                  {order.items.map((i, n) => (
                    <li key={n}>
                      <span>{i.qty}× {i.name} <em>{i.size}</em></span>
                      <span className="num">{naira(i.unitPriceKobo * i.qty)}</span>
                    </li>
                  ))}
                </ul>
                <p className="status__total">
                  <span>Total</span><span className="num">{naira(order.subtotalKobo)}</span>
                </p>
                <p className="status__email">Receipt to {order.email}</p>
              </>
            )}
          </>
        )}

        <Link className="btn btn--solid btn--block" to="/">BACK TO THE SHOP</Link>
      </motion.main>
    </div>
  );
}
