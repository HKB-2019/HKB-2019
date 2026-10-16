import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { openGiftCard } from '../lib/api.js';
import { naira } from '../lib/delivery.js';
import Card, { longDate } from '../components/GiftCard.jsx';

/* /gift/:code — the card as the person given it sees it, from the link the
 * buyer sends: the same colour, their name and the message on it, then the
 * card turns over to show the code, with what is left and how to spend it.
 * The code is the key, as it is at checkout (POST /api/gift-cards/open). */

const ENDED = {
  spent: ['This card has been spent', 'Everything on it has been used. We hope you love what you chose.'],
  expired: ['This card has run out', 'Gift cards last twelve months, and this one has passed its date.'],
  cancelled: ['This card no longer works', 'If you think this is a mistake, reply to the message it came with.']
};

function Opened({ code }) {
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    openGiftCard(code).then(c => { if (live) setCard(c); }).catch(err => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [code]);

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
            <Link className="btn btn--ghost btn--block" to="/">TO THE SHOP</Link>
          </>
        ) : (
          <>
            <h1 className="gift__title">{card.recipientName ? `For you, ${card.recipientName}` : 'A gift for you'}</h1>
            <p className="gift__intro">
              Someone has given you {naira(card.amountKobo)} to spend at MASQ., on any piece and its delivery.
            </p>
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
          </>
        )}
      </div>
    </div>
  );
}

export default function GiftCardOpen() {
  const { code = '' } = useParams();
  return (
    <div className="status gift-page">
      <header className="status__bar">
        <Link to="/" className="logo">MASQ<span>.</span></Link>
      </header>
      <motion.main className="gift-page__main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <Opened code={code} />
      </motion.main>
    </div>
  );
}
