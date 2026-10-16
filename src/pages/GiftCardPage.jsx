import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { buyGiftCard, getGiftCard } from '../lib/api.js';
import { naira, isEmail } from '../lib/delivery.js';

/* /gift-card — buy a MASQ. gift card, and (with ?reference=, where Paystack
 * sends the buyer back) see it once paid: its code, to copy or send.
 * The rules live on the server (server/lib/giftcards.js): ₦10,000, ₦25,000,
 * ₦50,000, ₦100,000 or any whole amount from ₦5,000 to ₦500,000; twelve
 * months; pieces and delivery. */

const PRESETS = [10_000, 25_000, 50_000, 100_000];
const MIN = 5_000, MAX = 500_000;
const longDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The card itself, as the person receiving it would picture it. */
function Card({ amountKobo, to, code, until }) {
  return (
    <div className="giftcard" aria-hidden={!code}>
      <div className="giftcard__top">
        <span className="giftcard__logo">MASQ<span>.</span></span>
        <span className="giftcard__kind">GIFT CARD</span>
      </div>
      <p className="giftcard__amount">{amountKobo ? naira(amountKobo) : '₦—'}</p>
      <div className="giftcard__foot">
        <span>{to ? `For ${to}` : 'For someone'}</span>
        {code ? <span className="giftcard__code">{code}</span> : <span>Lasts 12 months</span>}
      </div>
      {until && <span className="giftcard__until">Use by {until}</span>}
    </div>
  );
}

function Buy() {
  const [choice, setChoice] = useState(25_000);       // a preset, or 'other'
  const [other, setOther] = useState('');
  const [form, setForm] = useState({ email: '', recipientName: '', recipientEmail: '', message: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);

  const otherNaira = Number(other.replace(/[,\s₦]/g, ''));
  const amount = choice === 'other' ? (Number.isInteger(otherNaira) && otherNaira >= MIN && otherNaira <= MAX ? otherNaira : null) : choice;
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: null })); setServerError(null); };

  const pay = async (e) => {
    e.preventDefault();
    const err = {};
    if (!amount) err.amount = `Choose an amount from ${naira(MIN * 100)} to ${naira(MAX * 100)}, in whole naira.`;
    if (!isEmail(form.email)) err.email = 'Enter your email, for the receipt.';
    if (form.recipientEmail.trim() && !isEmail(form.recipientEmail)) err.recipientEmail = 'That is not an email address.';
    setErrors(err);
    if (Object.keys(err).length) return;
    setBusy(true);
    try {
      const { authorizationUrl } = await buyGiftCard({
        amountKobo: amount * 100, email: form.email.trim(), recipientName: form.recipientName.trim(),
        recipientEmail: form.recipientEmail.trim() || undefined, message: form.message.trim()
      });
      window.location.href = authorizationUrl;    // to Paystack
    } catch (e2) { setServerError(e2.message); setBusy(false); }
  };
  const fieldErr = (k) => errors[k] ? { 'aria-invalid': true, 'aria-describedby': `g-${k}-error` } : {};

  return (
    <div className="gift">
      <div className="gift__show">
        <Card amountKobo={amount ? amount * 100 : null} to={form.recipientName.trim()} />
      </div>
      <form className="gift__form" onSubmit={pay} noValidate>
        <p className="eyebrow">Gift card</p>
        <h1 className="status__title">Give MASQ.</h1>
        <p className="status__note">A card for any piece in the shop, and its delivery. Spend it in one order or over several, within twelve months.</p>

        <fieldset className="gift__amounts">
          <legend className="gift__label">Amount</legend>
          <div className="gift__chips">
            {PRESETS.map(n => (
              <label key={n} className={`gift__chip${choice === n ? ' is-on' : ''}`}>
                <input type="radio" name="amount" checked={choice === n} onChange={() => { setChoice(n); setErrors(x => ({ ...x, amount: null })); }} />
                {naira(n * 100)}
              </label>
            ))}
            <label className={`gift__chip${choice === 'other' ? ' is-on' : ''}`}>
              <input type="radio" name="amount" checked={choice === 'other'} onChange={() => setChoice('other')} />
              Other
            </label>
          </div>
          {choice === 'other' && (
            <label className="field field--tight gift__other" htmlFor="g-other">
              <span>AMOUNT IN NAIRA<em className="field__hint"> · {naira(MIN * 100)} to {naira(MAX * 100)}</em></span>
              <input id="g-other" inputMode="numeric" placeholder="e.g. 40000" value={other} autoFocus
                     onChange={(e) => { setOther(e.target.value); setErrors(x => ({ ...x, amount: null })); }} {...fieldErr('amount')} />
            </label>
          )}
          {errors.amount && <small className="field__error" id="g-amount-error">{errors.amount}</small>}
        </fieldset>

        <label className="field field--tight" htmlFor="g-email">
          <span>YOUR EMAIL<em className="field__hint"> · for the receipt</em></span>
          <input id="g-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} {...fieldErr('email')} />
          {errors.email && <small className="field__error" id="g-email-error">{errors.email}</small>}
        </label>
        <label className="field field--tight" htmlFor="g-name">
          <span>WHO IT IS FOR<em className="field__hint"> · optional</em></span>
          <input id="g-name" maxLength={60} value={form.recipientName} onChange={set('recipientName')} />
        </label>
        <label className="field field--tight" htmlFor="g-their-email">
          <span>THEIR EMAIL<em className="field__hint"> · optional</em></span>
          <input id="g-their-email" type="email" inputMode="email" value={form.recipientEmail} onChange={set('recipientEmail')} {...fieldErr('recipientEmail')} />
          {errors.recipientEmail && <small className="field__error" id="g-recipientEmail-error">{errors.recipientEmail}</small>}
        </label>
        <label className="field field--tight" htmlFor="g-message">
          <span>A MESSAGE<em className="field__hint"> · optional</em></span>
          <textarea id="g-message" rows={3} maxLength={300} value={form.message} onChange={set('message')} />
        </label>

        <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
          {busy ? 'TAKING YOU TO PAYSTACK…' : amount ? `PAY ${naira(amount * 100)}` : 'PAY'}
        </button>
        <p className="drawer__note drawer__note--center">Secure payment by Paystack. The code shows here as soon as it is paid.</p>
        <p className={`form-msg${serverError ? ' is-show is-error' : ''}`} role="status" aria-live="polite">{serverError ?? ''}</p>
      </form>
    </div>
  );
}

function Bought({ reference }) {
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true, tries = 0;
    const check = async () => {
      try {
        const data = await getGiftCard(reference);
        if (!live) return;
        setCard(data);
        if (data.status === 'pending' && data.payment !== 'not_completed' && ++tries < 10) setTimeout(check, 3000);
      } catch (err) { if (live) setError(err.message); }
    };
    check();
    return () => { live = false; };
  }, [reference]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(card.code); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
  };

  if (error) {
    return (
      <div className="gift gift--one">
        <p className="eyebrow">Gift card</p>
        <h1 className="status__title">We could not find that gift card</h1>
        <p className="status__note">Check the link in your receipt.</p>
      </div>
    );
  }
  if (!card) return <div className="gift gift--one"><div className="status__wait" aria-hidden="true" /></div>;

  if (card.status !== 'active') {
    const unpaid = card.status === 'abandoned' || card.payment === 'not_completed';
    return (
      <div className="gift gift--one">
        <p className="eyebrow">Gift card</p>
        <h1 className="status__title">{unpaid ? 'Payment not completed' : 'Confirming your payment'}</h1>
        <p className="status__note">{unpaid
          ? 'Nothing was taken. You can try again whenever you like.'
          : 'This usually takes a few seconds. The code appears here as soon as the payment is confirmed.'}</p>
        {!unpaid && <div className="status__wait" aria-hidden="true" />}
        {unpaid && <Link className="btn btn--ghost btn--block" to="/gift-card">TRY AGAIN</Link>}
      </div>
    );
  }

  const text = `A MASQ. gift card for you${card.recipientName ? `, ${card.recipientName}` : ''}: ${naira(card.amountKobo)}. `
    + `Code ${card.code}, to use at checkout by ${longDate(card.expiresAt)}.`
    + (card.message ? `\n\n${card.message}` : '');

  return (
    <div className="gift">
      <div className="gift__show">
        <Card amountKobo={card.amountKobo} to={card.recipientName} code={card.code} until={longDate(card.expiresAt)} />
      </div>
      <div className="gift__form">
        <p className="eyebrow">Gift card</p>
        <h1 className="status__title">Your gift card is ready</h1>
        <p className="status__note">
          Send the code to {card.recipientName || 'the person it is for'}. They type it at checkout under
          “Have a gift card?”. Anyone with the code can spend it, so send it only to them.
        </p>
        <p className="gift__codeline">
          <span className="gift__label">Code</span>
          <span className="gift__code" id="gift-code">{card.code}</span>
        </p>
        {card.message && <blockquote className="gift__message">{card.message}</blockquote>}
        <div className="gift__actions">
          <button type="button" className="btn btn--solid" onClick={copy}>{copied ? 'COPIED' : 'COPY CODE'}</button>
          <a className="btn btn--ghost" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">SEND ON WHATSAPP</a>
        </div>
        <p className="status__email">{naira(card.amountKobo)} · use by {longDate(card.expiresAt)} · pieces and delivery</p>
      </div>
    </div>
  );
}

export default function GiftCardPage() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';
  return (
    <div className="status">
      <header className="status__bar">
        <Link to="/" className="logo">MASQ<span>.</span></Link>
      </header>
      <motion.main className="status__panel gift-page" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
        {reference ? <Bought reference={reference} /> : <Buy />}
      </motion.main>
    </div>
  );
}
