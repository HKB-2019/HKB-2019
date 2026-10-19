import { useState } from 'react';
import { topUpGiftCard } from '../lib/api.js';
import { naira, isEmail } from '../lib/delivery.js';
import { useEmailCheck, EMAIL_OK, EMAIL_BAD } from '../lib/useEmailCheck.js';
import FieldNote from './FieldNote.jsx';

/* Adding money to a gift card that works (a top-up): on the card's own page
 * (/gift/:code) and under "Top up a card" on /gift-card. Paid on Paystack as
 * its own payment, which sends the payer back to the card's page; the money is
 * added once Paystack confirms it (server/lib/giftcards.js). */

const TOPUP_PRESETS = [5_000, 10_000, 25_000, 50_000];
const MIN = 5_000, MAX = 500_000;

/** Add money: an amount and an email for the receipt, then Paystack. Closed,
 *  it is a button that opens it. */
export default function TopUp({ code, balanceKobo, startOpen = false }) {
  const [open, setOpen] = useState(startOpen);
  const [choice, setChoice] = useState(10_000);
  const [other, setOther] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const otherNaira = Number(other.replace(/[,\s₦]/g, ''));
  const amount = choice === 'other' ? (Number.isInteger(otherNaira) && otherNaira >= MIN && otherNaira <= MAX ? otherNaira : null) : choice;
  const room = MAX * 100 - balanceKobo;
  const check = useEmailCheck(email);

  const pay = async (e) => {
    e.preventDefault();
    if (!amount) return setError(`Choose an amount from ${naira(MIN * 100)} to ${naira(MAX * 100)}, in whole naira.`);
    if (amount * 100 > room) return setError(`A card holds up to ${naira(MAX * 100)}. You can add up to ${naira(Math.floor(room / 100_00) * 100_00)} to this one.`);
    if (!isEmail(email)) return setError(email.trim() ? EMAIL_BAD : 'Enter your email, for the receipt.');
    setBusy(true); setError(null);
    try {
      const { authorizationUrl } = await topUpGiftCard({ code, amountKobo: amount * 100, email: email.trim() });
      window.location.href = authorizationUrl;    // to Paystack
    } catch (err) { setError(err.message); setBusy(false); }
  };

  if (!open) {
    return <button type="button" className="btn btn--ghost btn--block gift__topup-open" onClick={() => setOpen(true)}>ADD MONEY TO THIS CARD</button>;
  }
  return (
    <form className={`gift__topup${startOpen ? ' gift__topup--first' : ''}`} onSubmit={pay} noValidate>
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
                 onChange={(e) => { setEmail(e.target.value); setError(null); }} {...check.input} />
          <FieldNote error={check.state === 'bad' ? EMAIL_BAD : null} ok={check.state === 'ok' ? EMAIL_OK : null} reserve />
        </label>
      </fieldset>
      <button type="submit" className="btn btn--solid btn--block" disabled={busy}>
        {busy && <span className="spinner" aria-hidden="true" />}
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
