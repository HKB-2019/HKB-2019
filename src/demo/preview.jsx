import { useState } from 'react';
import { Route, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { finishPayment, previewOrder, resetPreview } from './api.js';
import { useShop } from '../store/ShopContext.jsx';
import { forgetWelcome, markWelcome } from '../lib/welcome.js';

const naira = (kobo) => '₦' + (kobo / 100).toLocaleString('en-NG');

/* Stands in for Paystack's payment page. On the live shop the customer is
   sent to Paystack here, and nothing is confirmed until Paystack says so. */
function PretendPayment() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const reference = params.get('reference') ?? '';
  const order = previewOrder(reference);
  const total = order ? order.items.reduce((n, i) => n + i.unitPriceKobo * i.qty, 0) + order.shippingKobo : 0;

  const done = (paid) => {
    finishPayment(reference, paid);
    navigate(`/order?reference=${encodeURIComponent(reference)}`);
  };

  return (
    <div className="status">
      <main className="status__panel">
        <p className="eyebrow">Payment page — preview</p>
        <h1 className="status__title">{order ? `Pay ${naira(total)}` : 'No such order'}</h1>
        <p className="status__note">
          On the live shop this is Paystack’s own page, where the customer pays by card, bank transfer or USSD.
          Here nothing is charged: choose what happens.
        </p>
        {order && (
          <>
            <button className="btn btn--solid btn--block" onClick={() => done(true)}>PAY (PRETEND)</button>
            <button className="btn btn--ghost btn--block" style={{ marginTop: 10 }} onClick={() => done(false)}>CANCEL PAYMENT</button>
          </>
        )}
      </main>
    </div>
  );
}

export const previewRoutes = [<Route key="pay" path="/pay" element={<PretendPayment />} />];

export function PreviewBanner() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const inAdmin = pathname.startsWith('/admin');

  // The welcome pop-up shows once per tab; this brings it back at once.
  const { openOverlay } = useShop();
  const showWelcome = () => {
    forgetWelcome();
    if (pathname !== '/') navigate('/');
    openOverlay('welcome');
    markWelcome('shown');
  };

  const reset = () => {
    resetPreview();
    window.location.reload();
  };

  return (
    <aside className="preview-bar" aria-label="About this preview">
      <span className="preview-bar__tag">PREVIEW</span>
      <span className="preview-bar__text">Sample data in your browser. Nothing is charged or sent.</span>
      <span className="preview-bar__actions">
        <button onClick={() => navigate(inAdmin ? '/' : '/admin')}>{inAdmin ? 'OPEN THE SHOP' : 'OPEN THE ADMIN'}</button>
        {!inAdmin && <button onClick={showWelcome}>SEE THE POP-UP</button>}
        {confirm
          ? <><button onClick={reset}>YES, START AGAIN</button><button onClick={() => setConfirm(false)}>KEEP</button></>
          : <button onClick={() => setConfirm(true)}>START AGAIN</button>}
      </span>
    </aside>
  );
}
