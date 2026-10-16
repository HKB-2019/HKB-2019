import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion';
import { buyGiftCard, getGiftCard } from '../lib/api.js';
import { naira, isEmail } from '../lib/delivery.js';
import maskUrl from '../assets/giftcard/mask.webp';
import wordmarkUrl from '../assets/giftcard/wordmark.webp';
import symbolsUrl from '../assets/giftcard/symbols.webp';
import { EASE_OUT, EASE_SLOW } from '../lib/motion.js';

/* /gift-card — buy a MASQ. gift card, and (with ?reference=, where Paystack
 * sends the buyer back) see it once paid: its code, to copy or send.
 *
 * The card is shown like an artefact in the gallery: on a dark stage (dark in
 * both themes, like the hero), with a label under it. It is the one place the
 * logo's full colours appear (src/assets/giftcard, cut from the logo). The rules live on the
 * server (server/lib/giftcards.js): ₦10,000, ₦25,000, ₦50,000, ₦100,000 or
 * any whole amount from ₦5,000 to ₦500,000; twelve months; pieces and delivery. */

const PRESETS = [10_000, 25_000, 50_000, 100_000];
const MIN = 5_000, MAX = 500_000;
const longDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** The card, built from the logo's own artwork. The front carries the mask, the
 * amount and the name; the back the code. It turns over by a click, and once by
 * itself when `revealed` turns true (the code has arrived). */
function Card({ amountKobo, to, code, until, revealed = false }) {
  const calm = useReducedMotion();
  const [back, setBack] = useState(revealed);
  useEffect(() => { if (revealed) setBack(true); }, [revealed]);
  // A slight tilt towards the pointer, on a computer: the card as an object.
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const sx = useSpring(rx, { stiffness: 140, damping: 18 }), sy = useSpring(ry, { stiffness: 140, damping: 18 });
  const rotateX = useTransform(sx, v => `${v}deg`), rotateY = useTransform(sy, v => `${v}deg`);
  const tilt = (e) => {
    if (calm || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    ry.set(((e.clientX - r.left) / r.width - 0.5) * 8);
    rx.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
  };
  const rest = () => { rx.set(0); ry.set(0); };
  const turn = () => setBack(b => !b);

  return (
    <div className="giftcard-wrap">
      <motion.div className="giftcard-tilt" style={{ rotateX, rotateY }} onPointerMove={tilt} onPointerLeave={rest} onClick={turn}>
        <motion.div
          className="giftcard-flip"
          initial={false}
          animate={{ rotateY: back ? 180 : 0 }}
          transition={calm ? { duration: 0 } : { duration: 1.1, ease: EASE_SLOW }}
        >
          <div className="giftcard giftcard--front" aria-hidden={back}>
            <img className="giftcard__wordmark" src={wordmarkUrl} alt="MASQ." />
            <span className="giftcard__kind">Gift card</span>
            <img className="giftcard__mask" src={maskUrl} alt="" />
            <div className="giftcard__amount" aria-live="polite">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={amountKobo ?? 'none'}
                  initial={calm ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={calm ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: EASE_OUT }}
                >{amountKobo ? naira(amountKobo) : '₦—'}</motion.span>
              </AnimatePresence>
            </div>
            <span className="giftcard__for">{to ? `For ${to}` : 'For someone'}</span>
          </div>
          <div className="giftcard giftcard--back" aria-hidden={!back}>
            <img className="giftcard__symbols" src={symbolsUrl} alt="" />
            <p className="giftcard__motto">We wear identity.<br />Unapologetically yours.</p>
            <span className={code ? 'giftcard__code' : 'giftcard__code giftcard__code--blank'}>{code ?? 'MASQ-••••-••••'}</span>
            <span className="giftcard__small">{until ? `Use by ${until}` : 'Twelve months'} · pieces and delivery</span>
          </div>
        </motion.div>
      </motion.div>
      <div className="giftcard__label">
        <span>MASQ. gift card</span>
        <span className="giftcard__label-line">{amountKobo ? naira(amountKobo) : 'Choose an amount'}{to ? ` · for ${to}` : ''}</span>
        <span>{until ? `Use by ${until}` : 'Lasts twelve months'} · pieces and delivery</span>
        <button type="button" className="giftcard__turn" onClick={turn}>{back ? 'See the front' : 'Turn it over'}</button>
      </div>
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
        recipientEmail: form.recipientEmail.trim() || undefined, message: form.message.trim()
      });
      window.location.href = authorizationUrl;    // to Paystack
    } catch (e2) { setServerError(e2.message); setBusy(false); }
  };
  const fieldErr = (k) => errors[k] ? { 'aria-invalid': true, 'aria-describedby': `g-${k}-error` } : {};

  return (
    <div className="gift">
      <div className="gift-stage">
        <Card amountKobo={amount ? amount * 100 : null} to={form.recipientName.trim()} />
      </div>
      <form className="gift__form" onSubmit={pay} noValidate>
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
  const [copied, setCopied] = useState(false);
  const [revealed, setRevealed] = useState(false);

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

  const copy = async () => {
    try { await navigator.clipboard.writeText(card.code); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setCopied(false); }
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

  const text = `A MASQ. gift card for you${card.recipientName ? `, ${card.recipientName}` : ''}: ${naira(card.amountKobo)}. `
    + `Code ${card.code}, to use at checkout by ${longDate(card.expiresAt)}.`
    + (card.message ? `\n\n${card.message}` : '');

  return (
    <div className="gift">
      <div className="gift-stage">
        <Card amountKobo={card.amountKobo} to={card.recipientName} code={card.code} until={longDate(card.expiresAt)} revealed={revealed} />
      </div>
      <div className="gift__form">
        <p className="eyebrow">Gift card</p>
        <h1 className="gift__title">Your gift card is ready</h1>
        <p className="gift__intro">
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
        <Link to="/" className="logo">MASQ<span>.</span></Link>
      </header>
      <motion.main className="gift-page__main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        {reference ? <Bought reference={reference} /> : <Buy />}
      </motion.main>
    </div>
  );
}
