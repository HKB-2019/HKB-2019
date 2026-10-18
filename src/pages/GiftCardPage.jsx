import { useEffect, useState } from 'react';
import { Link, useHref, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { buyGiftCard, getGiftCard, openGiftCard } from '../lib/api.js';
import { naira, isEmail } from '../lib/delivery.js';
import Card, { DesignSwatches, designOf, longDate } from '../components/GiftCard.jsx';
import TopUp from '../components/GiftTopUp.jsx';
import Wordmark from '../components/Wordmark.jsx';

/* /gift-card — buy a MASQ. gift card, and (with ?reference=, where Paystack
 * sends the buyer back) see it once paid: its code, to copy or send. With
 * ?topup, add money to a card someone already has, found by its code.
 *
 * The card is shown like an artefact in the gallery: on a dark stage (dark in
 * both themes, like the hero), with a label under it (src/components/GiftCard.jsx).
 * The buyer chooses its colour; the person given it opens the same card from
 * the link the buyer sends (/gift/:code, src/pages/GiftCardOpen.jsx). The rules live on the
 * server (server/lib/giftcards.js): ₦10,000, ₦25,000, ₦50,000, ₦100,000 or
 * any whole amount from ₦5,000 to ₦500,000; twelve months; pieces and delivery. */

const PRESETS = [10_000, 25_000, 50_000, 100_000];
const MIN = 5_000, MAX = 500_000;

/** Buy a card | Top up a card. */
function Modes({ topup }) {
  return (
    <nav className="gift__modes" aria-label="Gift cards">
      <Link className="gift__mode" to="/gift-card" aria-current={topup ? undefined : 'page'}>Buy a card</Link>
      <Link className="gift__mode" to="/gift-card?topup" aria-current={topup ? 'page' : undefined}>Top up a card</Link>
    </nav>
  );
}

/** Top up a card someone already has: find it by its code, then add money. */
function TopUpFind() {
  const [code, setCode] = useState('');
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const find = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null); setCard(null);
    try {
      const c = await openGiftCard(code);
      if (c.state === 'expired') setError('This card has run out, so money cannot be added to it.');
      else if (c.state === 'cancelled') setError('This card has been cancelled, so money cannot be added to it.');
      else setCard(c);
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <div className="gift">
      <div className="gift-stage">
        <Card amountKobo={card?.amountKobo ?? null} to={card?.recipientName} code={card?.code} design={card?.design}
              until={card ? longDate(card.expiresAt) : undefined}
              lines={card ? ['MASQ. gift card', `${naira(card.balanceKobo)} on it now`, `Use by ${longDate(card.expiresAt)} · pieces and delivery`]
                           : ['MASQ. gift card', 'Your card shows here', 'Type its code to find it']} />
      </div>
      <div className="gift__form">
        <Modes topup />
        <p className="eyebrow">Gift card</p>
        <h1 className="gift__title">Top up a card</h1>
        <p className="gift__intro">
          Add money to a MASQ. gift card you have, or one you gave. Type its code: it is on the back of the
          card, and in the message it came with.
        </p>
        <form className="gift__find" onSubmit={find} noValidate>
          <label className="field field--tight" htmlFor="t-code">
            <span>CARD CODE</span>
            <input id="t-code" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="MASQ-XXXX-XXXX"
                   value={code} onChange={(e) => { setCode(e.target.value); setError(null); }}
                   aria-invalid={error ? true : undefined} aria-describedby={error ? 't-code-error' : undefined} />
          </label>
          <button type="submit" className="btn btn--ghost" disabled={busy || !code.trim()}>{busy ? 'FINDING…' : 'FIND CARD'}</button>
        </form>
        {error && <small className="field__error" id="t-code-error" role="alert">{error}</small>}
        {card && (
          <>
            <p className="gift__found">
              <strong>{card.code}</strong> · {naira(card.balanceKobo)} on it · use by {longDate(card.expiresAt)}
            </p>
            <TopUp key={card.code} code={card.code} balanceKobo={card.balanceKobo} startOpen />
          </>
        )}
      </div>
    </div>
  );
}

function Buy() {
  const [choice, setChoice] = useState(25_000);       // a preset, or 'other'
  const [other, setOther] = useState('');
  const [form, setForm] = useState({ email: '', recipientName: '', recipientEmail: '', message: '' });
  const [design, setDesign] = useState('violet');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);

  const otherNaira = Number(other.replace(/[,\s₦]/g, ''));
  const amount = choice === 'other' ? (Number.isInteger(otherNaira) && otherNaira >= MIN && otherNaira <= MAX ? otherNaira : null) : choice;
  const set = (k) => (e) => { setForm(f => ({ ...f, [k]: e.target.value })); setErrors(x => ({ ...x, [k]: null })); setServerError(null); };
  const pick = (v) => { setChoice(v); setErrors(x => ({ ...x, amount: null })); };

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
        recipientEmail: form.recipientEmail.trim() || undefined, message: form.message.trim(), design
      });
      window.location.href = authorizationUrl;    // to Paystack
    } catch (e2) { setServerError(e2.message); setBusy(false); }
  };
  const fieldErr = (k) => errors[k] ? { 'aria-invalid': true, 'aria-describedby': `g-${k}-error` } : {};

  return (
    <div className="gift">
      <div className="gift-stage">
        <Card amountKobo={amount ? amount * 100 : null} to={form.recipientName.trim()} design={design} />
      </div>
      <form className="gift__form" onSubmit={pay} noValidate>
        <Modes />
        <p className="eyebrow">Gift card</p>
        <h1 className="gift__title">Give MASQ.</h1>
        <p className="gift__intro">A card for any piece in the shop, and its delivery. Spend it in one order or over several, within twelve months.</p>

        <fieldset className="gift__group">
          <legend className="gift__label">Amount</legend>
          <div className="gift__tiles" role="radiogroup" aria-label="Amount">
            {PRESETS.map(n => (
              <label key={n} className={`gift__tile${choice === n ? ' is-on' : ''}`}>
                <input type="radio" name="amount" checked={choice === n} onChange={() => pick(n)} />
                {naira(n * 100)}
              </label>
            ))}
            <label className={`gift__tile gift__tile--other${choice === 'other' ? ' is-on' : ''}`}>
              <input type="radio" name="amount" checked={choice === 'other'} onChange={() => pick('other')} />
              Other amount
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

        <fieldset className="gift__group">
          <legend className="gift__label">Colour<span className="gift__chosen"> · {designOf(design).name}</span></legend>
          <DesignSwatches value={design} onChange={setDesign} />
        </fieldset>

        <fieldset className="gift__group">
          <legend className="gift__label">Who it is for</legend>
          <label className="field field--tight" htmlFor="g-name">
            <span>THEIR NAME<em className="field__hint"> · optional, shown on the card</em></span>
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
        </fieldset>

        <fieldset className="gift__group">
          <legend className="gift__label">From you</legend>
          <label className="field field--tight" htmlFor="g-email">
            <span>YOUR EMAIL<em className="field__hint"> · for the receipt</em></span>
            <input id="g-email" type="email" autoComplete="email" inputMode="email" value={form.email} onChange={set('email')} {...fieldErr('email')} />
            {errors.email && <small className="field__error" id="g-email-error">{errors.email}</small>}
          </label>
        </fieldset>

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
  const [copied, setCopied] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const openHref = useHref(card?.code ? `/gift/${card.code}` : '/gift-card');

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

  // Paid: the card turns over to show its code, once, a moment after the page settles.
  const active = card?.status === 'active';
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setRevealed(true), 450);
    return () => clearTimeout(t);
  }, [active]);

  const copy = (what, value) => async () => {
    try { await navigator.clipboard.writeText(value); setCopied(what); setTimeout(() => setCopied(null), 1800); }
    catch { setCopied(null); }
  };

  if (error) {
    return (
      <div className="gift gift--note">
        <p className="eyebrow">Gift card</p>
        <h1 className="gift__title">We could not find that gift card</h1>
        <p className="gift__intro">Check the link in your receipt.</p>
      </div>
    );
  }
  if (!card) return <div className="gift gift--note"><div className="status__wait" aria-hidden="true" /></div>;

  if (!active) {
    const unpaid = card.status === 'abandoned' || card.payment === 'not_completed';
    return (
      <div className="gift gift--note">
        <p className="eyebrow">Gift card</p>
        <h1 className="gift__title">{unpaid ? 'Payment not completed' : 'Confirming your payment'}</h1>
        <p className="gift__intro">{unpaid
          ? 'Nothing was taken. You can try again whenever you like.'
          : 'This usually takes a few seconds. The code appears here as soon as the payment is confirmed.'}</p>
        {!unpaid && <div className="status__wait" aria-hidden="true" />}
        {unpaid && <Link className="btn btn--ghost btn--block" to="/gift-card">TRY AGAIN</Link>}
      </div>
    );
  }

  // The link opens the card as they will see it; the code is in the message too.
  const link = new URL(openHref, window.location.href).toString();
  const text = `A MASQ. gift card for you${card.recipientName ? `, ${card.recipientName}` : ''}: ${naira(card.amountKobo)}.`
    + (card.message ? `\n\n${card.message}` : '')
    + `\n\nOpen it: ${link}\nCode ${card.code}, to use at checkout by ${longDate(card.expiresAt)}.`;

  return (
    <div className="gift">
      <div className="gift-stage">
        <Card amountKobo={card.amountKobo} to={card.recipientName} code={card.code} until={longDate(card.expiresAt)} design={card.design} revealed={revealed} />
      </div>
      <div className="gift__form">
        <p className="eyebrow">Gift card</p>
        <h1 className="gift__title">Your gift card is ready</h1>
        <p className="gift__intro">
          Send it to {card.recipientName || 'the person it is for'}: the link opens this card, in this colour,
          with your message. They type the code at checkout under “Have a gift card?”. Anyone with the
          code or the link can spend it, so send it only to them.
        </p>
        <p className="gift__codeline">
          <span className="gift__label">Code</span>
          <span className="gift__code" id="gift-code">{card.code}</span>
        </p>
        {card.message && <blockquote className="gift__message">{card.message}</blockquote>}
        <div className="gift__actions">
          <a className="btn btn--solid" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">SEND ON WHATSAPP</a>
          <button type="button" className="btn btn--ghost" onClick={copy('link', link)}>{copied === 'link' ? 'LINK COPIED' : 'COPY LINK'}</button>
          <button type="button" className="btn btn--ghost" onClick={copy('code', card.code)}>{copied === 'code' ? 'COPIED' : 'COPY CODE'}</button>
        </div>
        <Link className="gift__back" to="/">Back to the shop</Link>
      </div>
    </div>
  );
}

export default function GiftCardPage() {
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';
  return (
    <div className="status gift-page">
      <header className="status__bar">
        <Link to="/" className="logo"><Wordmark /></Link>
      </header>
      <motion.main className="gift-page__main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        {reference ? <Bought reference={reference} /> : params.has('topup') ? <TopUpFind /> : <Buy />}
      </motion.main>
    </div>
  );
}
