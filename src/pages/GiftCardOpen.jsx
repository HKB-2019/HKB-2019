import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { openGiftCard, topUpGiftCard, getTopup } from '../lib/api.js';
import { naira, isEmail } from '../lib/delivery.js';
import Card, { longDate } from '../components/GiftCard.jsx';

/* /gift/:code — the card as the person given it sees it, from the link the
 * buyer sends: the same colour, their name and the message on it, then the
 * card turns over to show the code, with what is left and how to spend it.
 * The code is the key, as it is at checkout (POST /api/gift-cards/open).
 * Money can be added here too (a top-up): paid on Paystack, which sends the
 * payer back here with ?reference=gtop-…, and added once Paystack confirms. */

const TOPUP_PRESETS = [5_000, 10_000, 25_000, 50_000];
const MIN = 5_000, MAX = 500_000;

/** Add money: an amount and an email for the receipt, then Paystack. */
function TopUp({ code, balanceKobo }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState(10_000);
  const [other, setOther] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const otherNaira = Number(other.replace(/[,\s₦]/g, ''));
  const amount = choice === 'other' ? (Number.isInteger(otherNaira) && otherNaira >= MIN && otherNaira <= MAX ? otherNaira : null) : choice;
  const room = MAX * 100 - balanceKobo;

  const pay = async (e) => {
    e.preventDefault();
    if (!amount) return setError(`Choose an amount from ${naira(MIN * 100)} to ${naira(MAX * 100)}, in whole naira.`);
    if (amount * 100 > room) return setError(`A card holds up to ${naira(MAX * 100)}. You can add up to ${naira(Math.floor(room / 100_00) * 100_00)} to this one.`);
    if (!isEmail(email)) return setError('Enter your email, for the receipt.');
    setBusy(true); setError(null);
    try {
      const { authorizationUrl } = await topUpGiftCard({ code, amountKobo: amount * 100, email: email.trim() });
      window.location.href = authorizationUrl;    // to Paystack
    } catch (err) { setError(err.message); setBusy(false); }
  };

  if (!open) {
    return <button type="button" className="gift__topup-open" onClick={() => setOpen(true)}>Add money to this card</button>;
  }
  return (
    <form className="gift__topup" onSubmit={pay} noValidate>
      <fieldset className="gift__group">
        <legend className="gift__label">Add money</legend>
        <div className="gift__tiles" role="radiogroup" aria-label="Amount to add">
          {TOPUP_PRESETS.map(n => (
            <label key={n} className={`gift__tile${choice === n ? ' is-on' : ''}`}>
              <input type="radio" name="topup" checked={choice === n} onChange={() => { setChoice(n); setError(null); }} />
              {naira(n * 100)}
            </label>
          ))}
          <label className={`gift__tile gift__tile--other${choice === 'other' ? ' is-on' : ''}`}>
            <input type="radio" name="topup" checked={choice === 'other'} onChange={() => { setChoice('other'); setError(null); }} />
            Other amount
          </label>
        </div>
        {choice === 'other' && (
          <label className="field field--tight gift__other" htmlFor="t-other">
            <span>AMOUNT IN NAIRA<em className="field__hint"> · {naira(MIN * 100)} or more</em></span>
            <input id="t-other" inputMode="numeric" placeholder="e.g. 15000" value={other} autoFocus
                   onChange={(e) => { setOther(e.target.value); setError(null); }} />
          </label>
        )}
        <label className="field field--tight" htmlFor="t-email">
          <span>YOUR EMAIL<em className="field__hint"> · for the receipt</em></span>
          <input id="t-email" type="email" autoComplete="email" inputMode="email" value={email}
                 onChange={(e) => { setEmail(e.target.value); setError(null); }} />
        </label>
      </fieldset>
      <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
        {busy ? 'TAKING YOU TO PAYSTACK…' : amount ? `ADD ${naira(amount * 100)}` : 'ADD MONEY'}
      </button>
      <p className="drawer__note drawer__note--center">
        Paid by card, bank transfer or USSD on Paystack. It is on the card as soon as it is paid,
        and the card then lasts twelve months from today.
      </p>
      <p className={`form-msg${error ? ' is-show is-error' : ''}`} role="status" aria-live="polite">{error ?? ''}</p>
    </form>
  );
}

/** Back from Paystack after adding money: is it on the card yet? */
function useTopup(reference, onPaid) {
  const [topup, setTopup] = useState(null);
  useEffect(() => {
    if (!reference) return;
    let live = true, tries = 0;
    const check = async () => {
      try {
        const t = await getTopup(reference);
        if (!live) return;
        setTopup(t);
        if (t.status === 'paid') onPaid();
        else if (t.status === 'pending' && t.payment !== 'not_completed' && ++tries < 10) setTimeout(check, 3000);
      } catch { /* the card itself still shows */ }
    };
    check();
    return () => { live = false; };
  }, [reference]);   // eslint-disable-line react-hooks/exhaustive-deps
  return topup;
}

function TopupNote({ topup }) {
  if (!topup) return null;
  const [cls, text] = topup.status === 'paid'
    ? ['is-good', `${naira(topup.amountKobo)} added. ${naira(topup.balanceKobo)} on the card now, to use by ${longDate(topup.expiresAt)}.`]
    : topup.status === 'refund_due'
      ? ['is-bad', 'Your payment arrived after this card was cancelled. We will refund it.']
      : topup.status === 'abandoned' || topup.payment === 'not_completed'
        ? ['is-bad', `Adding ${naira(topup.amountKobo)} was not completed. Nothing was taken.`]
        : ['', `Confirming your payment of ${naira(topup.amountKobo)}…`];
  return <p className={`gift__topup-note ${cls}`} role="status">{text}</p>;
}

const ENDED = {
  spent: ['This card has been spent', 'Everything on it has been used. We hope you love what you chose.'],
  expired: ['This card has run out', 'Gift cards last twelve months, and this one has passed its date.'],
  cancelled: ['This card no longer works', 'If you think this is a mistake, reply to the message it came with.']
};

function Opened({ code, topupReference }) {
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const [loads, setLoads] = useState(0);
  useEffect(() => {
    let live = true;
    openGiftCard(code).then(c => { if (live) setCard(c); }).catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [code, loads]);
  const topup = useTopup(topupReference, () => setLoads(n => n + 1));

  // The gift first: their name on the front; then it turns over to show the code.
  const active = card?.state === 'active';
  useEffect(() => {
    if (!active) return;
    const t = setTimeout(() => setRevealed(true), 1600);
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
        <p className="gift__intro">{error}</p>
        <Link className="btn btn--ghost btn--block" to="/">TO THE SHOP</Link>
      </div>
    );
  }
  if (!card) return <div className="gift gift--note"><div className="status__wait" aria-hidden="true" /></div>;

  const until = longDate(card.expiresAt);
  const ended = ENDED[card.state];
  return (
    <div className="gift">
      <div className={`gift-stage${ended ? ' is-ended' : ''}`}>
        <Card amountKobo={card.amountKobo} to={card.recipientName} code={card.code} until={until}
              design={card.design} revealed={revealed}
              lines={['MASQ. gift card', `${naira(card.balanceKobo)} left on it`, `Use by ${until} · pieces and delivery`]} />
      </div>
      <div className="gift__form">
        <p className="eyebrow">Gift card</p>
        {ended ? (
          <>
            <h1 className="gift__title">{ended[0]}</h1>
            <p className="gift__intro">{ended[1]}</p>
            <TopupNote topup={topup} />
            <Link className="btn btn--ghost btn--block" to="/">TO THE SHOP</Link>
            {card.state === 'spent' && <TopUp code={card.code} balanceKobo={card.balanceKobo} />}
          </>
        ) : (
          <>
            <h1 className="gift__title">{card.recipientName ? `For you, ${card.recipientName}` : 'A gift for you'}</h1>
            <p className="gift__intro">
              Someone has given you {naira(card.amountKobo)} to spend at MASQ., on any piece and its delivery.
            </p>
            <TopupNote topup={topup} />
            {card.message && <blockquote className="gift__message">{card.message}</blockquote>}
            <p className="gift__codeline">
              <span className="gift__label">Your code</span>
              <span className="gift__code" id="gift-code">{card.code}</span>
              <span className="gift__left">{naira(card.balanceKobo)} left · use by {until}</span>
            </p>
            <div className="gift__actions">
              <Link className="btn btn--solid" to="/">SHOP NOW</Link>
              <button type="button" className="btn btn--ghost" onClick={copy}>{copied ? 'COPIED' : 'COPY CODE'}</button>
            </div>
            <p className="gift__how">
              Add what you love to your bag. At checkout, choose “Have a gift card?” and type the code.
              Spend it all at once or over several orders.
            </p>
            <TopUp code={card.code} balanceKobo={card.balanceKobo} />
          </>
        )}
      </div>
    </div>
  );
}

export default function GiftCardOpen() {
  const { code = '' } = useParams();
  const [params] = useSearchParams();
  const reference = params.get('reference') || params.get('trxref') || '';
  return (
    <div className="status gift-page">
      <header className="status__bar">
        <Link to="/" className="logo">MASQ<span>.</span></Link>
      </header>
      <motion.main className="gift-page__main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <Opened code={code} topupReference={/^gtop-/.test(reference) ? reference : ''} />
      </motion.main>
    </div>
  );
}
