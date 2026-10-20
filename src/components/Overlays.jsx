import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { startCheckout, checkDiscount, checkGiftCard } from '../lib/api.js';
import { useSectionLink } from '../lib/useSectionLink.js';
import { asset } from '../lib/media.js';
import { track, visitId } from '../lib/analytics.js';
import { zoneFor, naira, isEmail, isPhone, looksNigerian } from '../lib/delivery.js';
import Amount from './Amount.jsx';
import { countriesAbroad } from '../data/countries.js';
import { Close, Heart, ArrowShort, BagIcon, Check } from './Icons.jsx';
import StateMark from './StateMark.jsx';
import StateArt from './StateArt.jsx';
import Dialog, { PieceCard } from './Dialog.jsx';
import { TrashMark } from './StateMark.jsx';
import { SizeButtons } from './DropGrid.jsx';
import { useFocusTrap } from '../lib/useFocusTrap.js';
import { glideTo } from '../lib/smoothScroll.js';
import { shake, shakeInvalid } from '../lib/feel.js';
import ZoomViewer from './ZoomViewer.jsx';
import { FROM_SHOP } from '../lib/pageMorph.js';
import { JoinForm } from './Newsletter.jsx';
import Lines from './Lines.jsx';

import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';

/* ------------------------------------------------------------ drawer shell */

function Drawer({ label, title, count, children, foot }) {
  const { closeOverlay } = useShop();
  const ref = useFocusTrap(true);
  return (
    <motion.div
      ref={ref}
      className="drawer" data-lenis-prevent
      role="dialog" aria-modal="true" aria-label={label}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 34, mass: 0.9 }}
    >
      <div className="drawer__head">
        <h2 className="drawer__title">{title} {count !== undefined && <span>({count})</span>}</h2>
        <button className="close-btn" data-close aria-label={`Close ${label.toLowerCase()}`} onClick={closeOverlay}>
          <Close />
        </button>
      </div>
      <div className="drawer__body">{children}</div>
      {foot && <div className="drawer__foot">{foot}</div>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ the bag */

/** The empty-state button: back to the drop grid, from whichever page. */
function ShopButton({ label }) {
  const { closeOverlay } = useShop();
  const { home } = useHome();
  const goTo = useSectionLink();
  return (
    <button className="btn btn--contrast" onClick={() => { closeOverlay(); goTo('#drop'); }}>
      {label ?? home.heroButton} <ArrowShort className="btn__arrow" />
    </button>
  );
}

/* The owner's empty states: an outline icon that settles in, a title, a line
 * and the way back to the pieces. */
function EmptyState({ icon, title, text, button }) {
  return (
    <motion.div className="empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: UI_IN, ease: EASE_OUT }}>
      <motion.span className="empty__icon" aria-hidden="true"
                   initial={{ scale: 0.7, rotate: -8, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }}
                   transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT }}>{icon}</motion.span>
      <h3 className="empty__title">{title}</h3>
      <p className="empty__text">{text}</p>
      <ShopButton label={button} />
    </motion.div>
  );
}

/** A product's name in a drawer, opening its page. */
function NameLink({ id, name, colour }) {
  const { closeOverlay } = useShop();
  const to = `/product/${id}${colour ? `?colour=${encodeURIComponent(colour)}` : ''}`;
  return <Link to={to} state={FROM_SHOP} onClick={closeOverlay}>{name}</Link>;
}

function BagLines() {
  const { cart, changeQty, removeItem, format } = useShop();
  // "Remove this item?" — the owner's dialog, over the bag, which stays open.
  const [ask, setAsk] = useState(null);
  const lastAsk = useRef(null);
  if (ask) lastAsk.current = ask;
  const shown = ask ?? lastAsk.current;
  const confirmRemove = shown && (
    <Dialog open={Boolean(ask)} tone="bad" labelledBy="removeTitle" onClose={() => setAsk(null)}>
      <TrashMark />
      <h2 className="state-panel__title" id="removeTitle">Remove this item?</h2>
      <p className="state-panel__note">Are you sure you want to remove {shown.name} from your bag?</p>
      <PieceCard img={shown.img} name={shown.name}
                 meta={<>{shown.colour ? <>Colour: {shown.colour}<span aria-hidden="true"> · </span></> : null}Size: {shown.size}</>}
                 price={format(shown.price * shown.qty)} aside={shown.qty > 1 ? `Qty: ${shown.qty}` : null} />
      <button type="button" className="btn btn--danger btn--block" onClick={() => { removeItem(shown.key); setAsk(null); }}>REMOVE ITEM</button>
      <button type="button" className="state-panel__cancel" onClick={() => setAsk(null)}>Cancel</button>
    </Dialog>
  );
  if (cart.length === 0) {
    return (
      <>
        <EmptyState icon={<BagIcon />} title="Your bag is waiting for something special"
                    text="Looks like you haven’t added anything yet." button="START SHOPPING" />
        {confirmRemove}
      </>
    );
  }
  return (
    <>
    <AnimatePresence initial={false} mode="popLayout">
      {cart.map(item => (
        <motion.article
          key={item.key}
          layout
          className="line-item"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: 40, transition: { duration: UI_OUT, ease: EASE_OUT } }}
          transition={{ duration: UI_IN, ease: EASE_OUT }}
        >
          <img className="line-item__img" src={item.img} alt={item.name} />
          <div>
            <h3 className="line-item__name"><NameLink id={item.id} name={item.name} colour={item.colour} /></h3>
            <p className="line-item__variant">{item.colour ? `${item.colour.toUpperCase()} · ` : ''}SIZE {item.size}</p>
            <p className="line-item__price">{format(item.price * item.qty)}</p>
            <div className="qty">
              <button aria-label={`Decrease quantity of ${item.name}`}
                      onClick={() => (item.qty === 1 ? setAsk(item) : changeQty(item.key, -1))}>−</button>
              <span aria-live="polite">{item.qty}</span>
              <button aria-label={`Increase quantity of ${item.name}`}
                      onClick={() => changeQty(item.key, 1)}>+</button>
            </div>
          </div>
          <button className="line-item__remove"
                  onClick={() => setAsk(item)}>REMOVE</button>
        </motion.article>
      ))}
    </AnimatePresence>
    {confirmRemove}
    </>
  );
}

/** Shown whenever prices are in a currency other than the one Paystack charges. */
function CurrencyNote({ itemsNaira }) {
  const { currency } = useShop();
  if (currency === 'NGN') return null;
  return (
    <p className="drawer__note drawer__note--fx">
      Prices in {currency} are a guide. You pay in naira: {naira(itemsNaira * 100)} for these
      pieces, plus delivery.
    </p>
  );
}

function Field({ label, id, error, ok, warn, reserve = false, hint, children }) {
  return (
    <label className="field field--tight" htmlFor={id}>
      <span>{label}{hint && <em className="field__hint"> · {hint}</em>}</span>
      {children}
      {error && <small className="field__error" id={`${id}-error`}>{error}</small>}
      {!error && warn && <small className="field__warn" id={`${id}-warn`}>{warn}</small>}
      {!error && !warn && ok && <small className="field__ok">{ok}</small>}
      {!error && !warn && !ok && reserve && <small className="field__note-room" aria-hidden="true" />}
    </label>
  );
}

/* What is wrong with the delivery details, field by field (none: all right). */
function problemsWith(d, inNigeria) {
  const e = {};
  if (!isEmail(d.email)) e.email = d.email.trim() ? 'Please enter a valid email address.' : 'Enter the email for your receipt.';
  if (d.name.trim().length < 2) e.name = 'Enter your full name.';
  if (!isPhone(d.phone)) e.phone = 'Enter a phone number the rider can call.';
  if (!inNigeria && d.address.country.trim().length < 2) e.country = 'Choose your country.';
  if (!d.address.state.trim()) e.state = inNigeria ? 'Choose your state.' : 'Enter your state or region.';
  if (d.address.city.trim().length < 2) e.city = 'Enter your city or area.';
  if (d.address.line1.trim().length < 3) e.line1 = 'Enter your street address.';
  const pc = (d.address.postcode ?? '').trim();
  if (!inNigeria && pc && !/^[A-Za-z0-9][A-Za-z0-9 -]{1,11}$/.test(pc)) e.postcode = 'Letters, numbers, spaces and dashes only.';
  return e;
}

/* Bag → Delivery → Payment → Done: where checkout has got to. The line fills
 * to the step, the dot there breathes. Payment happens on Paystack's page and
 * Done on the order page, so the bag only ever shows the first two. */
const CHECKOUT_STEPS = ['Bag', 'Delivery', 'Payment', 'Done'];
export function CheckoutSteps({ at }) {
  return (
    <ol className="steps steps--checkout" aria-label="Checkout steps">
      <span className="steps__track" aria-hidden="true">
        <span className="steps__fill" style={{ transform: `scaleX(${at / (CHECKOUT_STEPS.length - 1)})` }} />
      </span>
      {CHECKOUT_STEPS.map((label, i) => {
        const state = i < at ? 'done' : i === at ? 'now' : 'next';
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

/* While the payment is being set up: the server checks every price and size,
 * holds the pieces, and opens a payment with Paystack, in one go. The first
 * two tick when its answer comes back; the last turns until the page goes. */
function Processing({ stage, giftOnly }) {
  const steps = ['Checking prices and stock', 'Holding your pieces', giftOnly ? 'Placing your order' : 'Opening Paystack’s secure page'];
  return (
    <motion.div className="processing" role="status" aria-live="polite"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: UI_OUT } }}
                transition={{ duration: UI_IN, ease: EASE_OUT }}>
      <motion.div className="processing__card" initial={{ y: 12, scale: 0.97 }} animate={{ y: 0, scale: 1 }}
                  transition={{ duration: 0.4, ease: EASE_OUT }}>
        <span className="processing__ring" aria-hidden="true"><span /></span>
        <h3 className="processing__title">{giftOnly ? 'Placing your order' : 'Processing payment'}</h3>
        <p className="processing__note">Please don’t close this window.</p>
        <ol className="processing__steps">
          {steps.map((label, i) => {
            const done = stage === 'opening' ? i < 2 : false;
            const now = stage === 'opening' ? i === 2 : i < 2;
            return (
              <li key={label} className={done ? 'is-done' : now ? 'is-now' : ''}>
                <span className="processing__dot" aria-hidden="true">
                  {done ? <StateMark tone="ok" delay={i * 0.12} /> : <span className="spinner" />}
                </span>
                {label}
              </li>
            );
          })}
        </ol>
        <p className="processing__lock"><LockIcon /> Secure payment by Paystack</p>
      </motion.div>
    </motion.div>
  );
}

const LockIcon = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <rect x="3" y="7" width="10" height="7" rx="1.6" /><path d="M5.5 7V5.2a2.5 2.5 0 0 1 5 0V7" />
  </svg>
);

/* "₦X away from free delivery", and the bar filling towards it, when the
 * owner offers free delivery over an amount. */
function FreeDeliveryBar({ itemsKobo }) {
  const { site } = useShop();
  const over = site?.freeDelivery?.overKobo;
  if (!over) return null;
  const left = over - itemsKobo;
  const reach = Math.min(1, Math.max(0, itemsKobo / over));
  return (
    <div className={`free-bar${left <= 0 ? ' is-done' : ''}`}>
      <p className="free-bar__text">
        {left <= 0
          ? <><StateMark tone="ok" /> <span><strong>Free delivery unlocked.</strong> Your order ships free.</span></>
          : <span>You’re <strong>{naira(left)}</strong> away from free delivery.</span>}
      </p>
      <span className="free-bar__track" aria-hidden="true">
        <motion.span className="free-bar__fill" initial={false} animate={{ scaleX: reach }}
                     transition={{ duration: 0.6, ease: EASE_OUT }} />
      </span>
    </div>
  );
}

/**
 * Step two of the bag: who it is for and where it is going. The fee shown
 * here is worked out from the same rules the server uses — but the server
 * decides the real one, and never reads this page's answer.
 */
/**
 * "Have a code?" in the bag. The server says what a code takes off — the bag
 * only shows it — and checks again at checkout, holding a use then.
 */
function DiscountBox({ applied, onApplied }) {
  const { cart, discountCode, setDiscountCode } = useShop();
  const [open, setOpen] = useState(Boolean(discountCode));
  const [typed, setTyped] = useState(discountCode);
  const [state, setState] = useState(null);     // null | 'checking' | error message
  const box = useRef(null);

  // The bag changed (or the drawer reopened): ask again what the code is worth.
  const lines = cart.map(i => `${i.id}|${i.colour ?? ''}|${i.size}|${i.qty}`).join(',');
  useEffect(() => {
    if (!discountCode) { onApplied(null); return; }
    let live = true;
    checkDiscount(discountCode, cart)
      .then(r => { if (live) { onApplied(r); setState(null); } })
      .catch(e => { if (live) { onApplied(null); setState(e.message); } });
    return () => { live = false; };
  }, [discountCode, lines]);   // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async () => {
    const code = typed.trim();
    if (!code) return;
    setState('checking');
    try {
      const r = await checkDiscount(code, cart);
      setDiscountCode(r.code); onApplied(r); setState(null);
      track('discount_applied');
    } catch (e) { setState(e.message); shake(box.current?.querySelector('input')); }
  };

  if (applied) {
    return (
      <div className="discount discount--on">
        <StateMark tone="ok" />
        <span><strong>{applied.code}</strong> applied · {applied.label}</span>
        <button type="button" className="discount__remove"
                onClick={() => { setDiscountCode(''); setTyped(''); onApplied(null); setState(null); }}>REMOVE</button>
      </div>
    );
  }
  if (!open) {
    return <button type="button" className="discount__open" onClick={() => setOpen(true)}>HAVE A CODE?</button>;
  }
  return (
    <div className="discount">
      <label className="sr-only" htmlFor="d-code">Discount code</label>
      <div className="discount__row" ref={box}>
        <input id="d-code" autoComplete="off" autoCapitalize="characters" spellCheck="false" placeholder="DISCOUNT CODE"
               value={typed} maxLength={24}
               onChange={(e) => { setTyped(e.target.value); if (state && state !== 'checking') setState(null); }}
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
               aria-invalid={Boolean(state && state !== 'checking')}
               aria-describedby={state && state !== 'checking' ? 'd-code-error' : undefined} />
        <button type="button" className="btn btn--ghost" onClick={apply} disabled={state === 'checking' || !typed.trim()}>
          {state === 'checking' ? '…' : 'APPLY'}
        </button>
      </div>
      {state && state !== 'checking' && <p className="field__error" id="d-code-error" role="alert">{state}</p>}
    </div>
  );
}

/**
 * "HAVE A GIFT CARD?" — the card's balance, shown before paying. Nothing is
 * held here: checkout checks the card again and takes what it pays then.
 */
function GiftCardBox({ gift, onGift, usingKobo }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [state, setState] = useState(null);     // null | 'checking' | error message
  const box = useRef(null);

  const apply = async () => {
    if (!typed.trim()) return;
    setState('checking');
    try { onGift(await checkGiftCard(typed)); setState(null); }
    catch (e) { setState(e.message); shake(box.current?.querySelector('input')); }
  };

  if (gift) {
    const left = gift.balanceKobo - usingKobo;
    return (
      <div className="discount discount--on">
        <StateMark tone="ok" />
        <span><strong>{gift.code}</strong> · {left > 0 ? `${naira(left)} left on it after this` : `pays ${naira(usingKobo)}`}</span>
        <button type="button" className="discount__remove" onClick={() => { onGift(null); setTyped(''); }}>REMOVE</button>
      </div>
    );
  }
  if (!open) return <button type="button" className="discount__open" onClick={() => setOpen(true)}>HAVE A GIFT CARD?</button>;
  return (
    <div className="discount">
      <label className="sr-only" htmlFor="d-gift">Gift card code</label>
      <div className="discount__row" ref={box}>
        <input id="d-gift" autoComplete="off" autoCapitalize="characters" spellCheck="false" placeholder="MASQ-XXXX-XXXX"
               value={typed} maxLength={20}
               onChange={(e) => { setTyped(e.target.value); if (state && state !== 'checking') setState(null); }}
               onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); apply(); } }}
               aria-invalid={Boolean(state && state !== 'checking')}
               aria-describedby={state && state !== 'checking' ? 'd-gift-error' : undefined} />
        <button type="button" className="btn btn--ghost" onClick={apply} disabled={state === 'checking' || !typed.trim()}>
          {state === 'checking' ? '…' : 'APPLY'}
        </button>
      </div>
      {state && state !== 'checking' && <p className="field__error" id="d-gift-error" role="alert">{state}</p>}
    </div>
  );
}

function DeliveryForm({ onBack }) {
  const { cart, cartSubtotal, delivery, setDelivery, site, discountCode, closeOverlay } = useShop();
  const [applied, setApplied] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);   // false | 'checking' | 'opening'
  const [serverError, setServerError] = useState(null);
  // Each box is checked when they leave it, then again as they type: a
  // mistake is pointed out late, a fix is welcomed at once.
  const [seen, setSeen] = useState({});
  const form = useRef(null);

  const zones = site?.delivery ?? [];
  const abroadOpen = zones.some(z => z.zone === 'international');
  const d = delivery;
  const inNigeria = d.address.country === 'Nigeria';

  const zone = zoneFor(d.address);
  const open = zones.find(z => z.zone === zone);
  const discountKobo = applied?.discountKobo ?? 0;
  // Free over the owner's amount, after any discount, as the server decides.
  const freeOver = site?.freeDelivery?.overKobo;
  const free = Boolean(freeOver) && cartSubtotal * 100 - discountKobo >= freeOver;
  // No fee in the total until there is somewhere to deliver to (a state, in Nigeria).
  const fee = open && (!inNigeria || d.address.state) ? (free ? 0 : open.feeKobo) : null;
  const total = cartSubtotal * 100 - discountKobo + (fee ?? 0);
  // A gift card pays after any discount, delivery included; Paystack takes the rest.
  const [gift, setGift] = useState(null);
  const giftKobo = gift ? Math.min(gift.balanceKobo, total) : 0;
  const due = total - giftKobo;
  const navigate = useNavigate();

  const set = (key) => (e) => {
    setDelivery(v => ({ ...v, [key]: e.target.value }));
    setErrors(x => ({ ...x, [key]: null })); setServerError(null);
  };
  const setAddr = (key) => (e) => {
    const value = e.target.value;
    setDelivery(v => ({ ...v, address: { ...v.address, [key]: value } }));
    setErrors(x => ({ ...x, [key]: null })); setServerError(null);
  };
  // Delivery abroad switched off (or not yet loaded as on): the address is in Nigeria.
  useEffect(() => {
    if (site && !abroadOpen && !inNigeria) setCountry('Nigeria');
  }, [site, abroadOpen, inNigeria]);   // eslint-disable-line react-hooks/exhaustive-deps

  const setCountry = (country) => {
    // Nigeria's states are a list, other countries' are typed: switching
    // between the two starts the state again.
    setDelivery(v => ({ ...v, address: { ...v.address, country,
      state: (country === 'Nigeria') === (v.address.country === 'Nigeria') ? v.address.state : '' } }));
    setErrors({}); setServerError(null);
  };

  const validate = () => {
    const e = problemsWith(d, inNigeria);
    setErrors(e);
    setSeen(Object.fromEntries(['email', 'name', 'phone', 'country', 'state', 'city', 'line1', 'postcode'].map(k => [k, true])));
    return Object.keys(e).length === 0;
  };

  // Leaving a box: a mistake is said now. An empty box is let be (they may
  // only be passing through), and so is leaving it for a button, which
  // would otherwise jump from under the finger as the line appears.
  const leave = (key) => (e) => {
    if (e.relatedTarget?.closest?.('button')) return;
    const value = key in d.address ? d.address[key] : d[key];
    if (!String(value ?? '').trim()) return;
    setSeen(x => ({ ...x, [key]: true }));
    const problem = problemsWith(d, inNigeria)[key];
    if (problem) setErrors(x => ({ ...x, [key]: problem }));
  };
  const problems = problemsWith(d, inNigeria);
  const good = (key) => seen[key] && !errors[key] && !problems[key];
  const phoneWarn = good('phone') && inNigeria && !looksNigerian(d.phone)
    ? 'This doesn’t look like a Nigerian number. Check it, so the rider can reach you.' : null;

  const onPay = async (ev) => {
    ev.preventDefault();
    if (!cart.length) return;
    if (!validate()) { shakeInvalid(form.current); return; }
    if (!open) { setServerError('Sorry — we don’t deliver there yet.'); return; }

    setBusy('checking'); setServerError(null);
    try {
      const { authorizationUrl, reference } = await startCheckout(d, cart, applied ? discountCode : undefined, visitId(), gift?.code);
      track('checkout', { valueKobo: total });
      setBusy('opening');
      // A moment for the ticks to land before the page changes.
      await new Promise(r => setTimeout(r, 450));
      // Paid in full by a gift card: nothing for Paystack, straight to the order.
      if (!authorizationUrl) { closeOverlay(); navigate(`/order?reference=${encodeURIComponent(reference)}`); return; }
      if (authorizationUrl.startsWith('#')) closeOverlay();   // the preview's pretend payment page, in this page
      // Coming back with the browser's Back finds the shop, not this screen.
      else window.addEventListener('pageshow', (e) => { if (e.persisted) closeOverlay(); }, { once: true });
      window.location.href = authorizationUrl;   // hand off to Paystack
    } catch (err) {
      setBusy(false);
      // Said once, under the button they pressed (not again in a message card).
      setServerError(err.message || 'Payment couldn’t start. Please check your connection and try again.');
    }
  };

  const err = (k) => errors[k] ? { 'aria-invalid': true, 'aria-describedby': `d-${k}-error`, className: 'is-error' }
    : good(k) ? { className: 'is-valid' } : {};

  return (
    <form className="delivery" onSubmit={onPay} noValidate ref={form}>
      <button type="button" className="delivery__back" onClick={onBack}>← BACK TO BAG</button>

      <Field label="EMAIL FOR RECEIPT" id="d-email" error={errors.email}
             ok={good('email') ? 'Looks good!' : null} reserve>
        <input id="d-email" type="email" autoComplete="email" inputMode="email"
               value={d.email} onChange={set('email')} onBlur={leave('email')} {...err('email')} />
      </Field>
      <Field label="FULL NAME" id="d-name" error={errors.name}>
        <input id="d-name" autoComplete="name" value={d.name} onChange={set('name')} onBlur={leave('name')} {...err('name')} />
      </Field>
      <Field label="PHONE" id="d-phone" error={errors.phone} warn={phoneWarn} hint="for the rider">
        <input id="d-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567"
               value={d.phone} onChange={set('phone')} onBlur={leave('phone')} {...err('phone')}
               {...(phoneWarn ? { className: 'is-warn', 'aria-describedby': 'd-phone-warn' } : {})} />
      </Field>

      {/* Only when the owner delivers abroad (Settings → Outside Nigeria):
          Nigeria first, every other country below it. Otherwise there is no
          choice to make, and the address is in Nigeria. */}
      {abroadOpen && (
        <Field label="COUNTRY" id="d-country" error={errors.country}>
          <select id="d-country" autoComplete="country-name"
                  value={d.address.country} onChange={(e) => setCountry(e.target.value)} {...err('country')}>
            <option value="Nigeria">Nigeria</option>
            {!inNigeria && !d.address.country && <option value="">Choose…</option>}
            <optgroup label="Outside Nigeria">
              {countriesAbroad().map(c => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          </select>
        </Field>
      )}

      <Field label={inNigeria ? 'STATE' : 'STATE OR REGION'} id="d-state" error={errors.state}>
        {inNigeria ? (
          <select id="d-state" autoComplete="address-level1"
                  value={d.address.state} onChange={setAddr('state')} onBlur={leave('state')} {...err('state')}>
            <option value="">Choose…</option>
            {(site?.states ?? []).map(s => <option key={s} value={s}>{s === 'FCT' ? 'FCT (Abuja)' : s}</option>)}
          </select>
        ) : (
          <input id="d-state" autoComplete="address-level1"
                 value={d.address.state} onChange={setAddr('state')} onBlur={leave('state')} {...err('state')} />
        )}
      </Field>
      <AnimatePresence initial={false}>
        {!open && site && (d.address.state || !inNigeria) && (inNigeria || d.address.country) && (
          <motion.div className="delivery__nope" role="alert" key="nope"
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: UI_IN, ease: EASE_OUT }}>
            <div className="delivery__nope-in">
              <StateMark tone="bad" />
              <p><strong>We don’t deliver to {inNigeria ? d.address.state : d.address.country} yet.</strong>
                <span>Choose another address, or check back soon.</span></p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Field label="CITY OR AREA" id="d-city" error={errors.city}>
        <input id="d-city" autoComplete="address-level2" placeholder={inNigeria ? 'e.g. Lekki' : ''}
               value={d.address.city} onChange={setAddr('city')} onBlur={leave('city')} {...err('city')} />
      </Field>
      <Field label="STREET ADDRESS" id="d-line1" error={errors.line1}>
        <input id="d-line1" autoComplete="address-line1"
               value={d.address.line1} onChange={setAddr('line1')} onBlur={leave('line1')} {...err('line1')} />
      </Field>
      <Field label="FLAT, LANDMARK" id="d-line2" hint="optional">
        <input id="d-line2" autoComplete="address-line2"
               value={d.address.line2} onChange={setAddr('line2')} />
      </Field>
      {!inNigeria && (
        <Field label="POSTCODE / ZIP" id="d-postcode" error={errors.postcode} hint="if you have one">
          <input id="d-postcode" autoComplete="postal-code" maxLength={12} autoCapitalize="characters"
                 value={d.address.postcode ?? ''} onChange={setAddr('postcode')} onBlur={leave('postcode')} {...err('postcode')} />
        </Field>
      )}
      {/* Never ticked for them: news is only sent to people who asked. */}
      <label className="delivery__optin">
        <input type="checkbox" checked={Boolean(d.newsletter)}
               onChange={(e) => setDelivery(v => ({ ...v, newsletter: e.target.checked }))} />
        <span>Email me about new drops and restocks. Leave any time.</span>
      </label>

      <div className="delivery__sum">
        <DiscountBox applied={applied} onApplied={setApplied} />
        <GiftCardBox gift={gift} onGift={setGift} usingKobo={giftKobo} />
        <div className="drawer__row"><span>ITEMS</span><span>{naira(cartSubtotal * 100)}</span></div>
        {discountKobo > 0 && (
          <div className="drawer__row drawer__row--discount"><span>DISCOUNT</span><span>−{naira(discountKobo)}</span></div>
        )}
        <div className="drawer__row">
          <span>DELIVERY</span>
          <span>{d.address.state || !inNigeria
            ? (open ? (fee === 0 ? <span className="drawer__free">FREE</span> : naira(fee)) : 'NOT AVAILABLE')
            : '—'}</span>
        </div>
        {giftKobo > 0 && (
          <div className="drawer__row drawer__row--discount"><span>GIFT CARD</span><span>−{naira(giftKobo)}</span></div>
        )}
        <div className="drawer__row drawer__row--total"><span>{giftKobo > 0 ? 'TO PAY' : 'TOTAL'}</span><Amount value={due} format={naira} /></div>
      </div>

      <button type="submit" className="btn btn--solid btn--block" disabled={busy || !cart.length}>
        {busy && <span className="spinner" aria-hidden="true" />}
        {busy ? (due === 0 ? 'PLACING YOUR ORDER…' : 'TAKING YOU TO PAYSTACK…') : due === 0 && giftKobo > 0 ? 'PLACE ORDER' : `PAY ${naira(due)}`}
      </button>
      <p className="drawer__note drawer__note--center">Secure payment by Paystack. We never see your card.</p>

      <p className={`form-msg${serverError ? ' is-show is-error' : ''}`} role="status" aria-live="polite">
        {serverError ?? ''}
      </p>
      <AnimatePresence>{busy && <Processing stage={busy} giftOnly={due === 0} />}</AnimatePresence>
    </form>
  );
}

function CartDrawer({ start = 'bag' }) {
  const { cart, cartQty, cartSubtotal, format, site, catalogueStatus } = useShop();
  const [step, setStep] = useState(start);

  // Delivery prices are the owner's to set; until they are, nothing can be sold.
  const checkoutOpen = (site?.delivery ?? []).length > 0;

  if (step === 'delivery' && cart.length) {
    return (
      <Drawer label="Delivery" title="DELIVERY">
        <CheckoutSteps at={1} />
        <DeliveryForm onBack={() => setStep('bag')} />
      </Drawer>
    );
  }

  return (
    <Drawer
      label="Your bag" title="YOUR BAG" count={cartQty}
      foot={<>
        <FreeDeliveryBar itemsKobo={Math.round(cartSubtotal * 100)} />
        <div className="drawer__row"><span>SUBTOTAL</span><Amount value={cartSubtotal} format={format} /></div>
        <CurrencyNote itemsNaira={cartSubtotal} />
        <p className="drawer__note">
          {checkoutOpen || catalogueStatus !== 'ready'
            ? 'Delivery is added at the next step, before you pay.'
            : 'Checkout opens soon — you can keep your bag until then.'}
        </p>
        <button className="btn btn--solid btn--block"
                disabled={!cart.length || !checkoutOpen}
                onClick={() => { setStep('delivery'); track('begin_checkout', { valueKobo: Math.round(cartSubtotal * 100) }); }}>
          CHECKOUT
        </button>
      </>}
    >
      {cart.length > 0 && <CheckoutSteps at={0} />}
      <BagLines />
    </Drawer>
  );
}

/* -------------------------------------------------------------- saved list */

function SavedDrawer() {
  const { wishlist, toggleWish, productById, format, catalogueStatus } = useShop();
  // Only pieces still on sale; anything since taken off quietly drops out.
  const items = wishlist.map(productById).filter(Boolean);

  return (
    <Drawer label="Saved" title="SAVED" count={items.length}>
      {catalogueStatus === 'ready' && items.length === 0 ? (
        <EmptyState icon={<Heart />} title="Nothing saved yet"
                    text="Tap the heart on any piece to keep it here for later." button="EXPLORE THE DROP" />
      ) : items.map(p => (
        <article className="line-item saved-item" key={p.id}>
          {p.img ? <img className="line-item__img" src={p.img} alt={p.name} /> : <span className="line-item__img" />}
          <div>
            <h3 className="line-item__name"><NameLink id={p.id} name={p.name} /></h3>
            <p className="line-item__price">{p.soldOut ? 'SOLD OUT' : format(p.price)}</p>
            {!p.soldOut && (
              <div className={`saved-item__sizes card__sizes${p.colours?.length ? ' card__sizes--colours' : ''}`} role="group" aria-label={`Add ${p.name} in a size`}>
                <SizeButtons product={p} />
              </div>
            )}
          </div>
          <button className="line-item__remove" aria-label={`Remove ${p.name} from saved`}
                  onClick={() => toggleWish(p.id)}><Heart /></button>
        </article>
      ))}
    </Drawer>
  );
}

/* --------------------------------------------------------------- modal shell */

function Modal({ label, labelledBy, wide, className = '', closeOutside = true, children }) {
  const { closeOverlay } = useShop();
  const ref = useFocusTrap(true);
  return (
    // The dark space around the panel belongs to the dialog, so a tap there
    // closes it — the same as the scrim it sits over. Not for a panel that
    // arrives unasked (the welcome pop-up): a tap meant for the page would
    // close it before it was seen, so only its own buttons and Escape do.
    <div className="modal" role="dialog" aria-modal="true" data-lenis-prevent
         aria-label={label} aria-labelledby={labelledBy}
         onClick={(e) => { if (closeOutside && e.target === e.currentTarget) closeOverlay(); }}>
      <motion.div
        ref={ref}
        className={`modal__panel ${className || (wide ? 'modal__panel--film' : 'modal__panel--sm')}`}
        initial={{ opacity: 0, y: 14, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: UI_OUT, ease: EASE_OUT } }}
        transition={{ duration: UI_IN, ease: EASE_OUT }}
      >
        <button className="close-btn modal__close" data-close aria-label={closeOutside ? 'Close' : 'Close, no thanks'} onClick={closeOverlay}>
          <Close />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------ added to bag */

/* The owner's success panel: a piece has gone in the bag from its own page.
 * The way on is the bag; carrying on shopping is the quiet second choice. */
function AddedModal({ name, what, img, colour, size, price, qty }) {
  const { openOverlay, closeOverlay } = useShop();
  return (
    <Modal labelledBy="addedTitle" className="modal__panel--state modal__panel--ok">
      <StateArt tone="ok" />
      <div className="state-panel">
        <StateMark tone="ok" size="lg" burst />
        <h2 className="state-panel__title" id="addedTitle">Added to your bag</h2>
        <p className="state-panel__note">{name} is in your bag.</p>
        <div className="state-card state-card--piece">
          {img && <img src={img} alt="" />}
          <div className="state-card__piece">
            <p className="state-card__name">{name}</p>
            <p className="state-card__meta">{colour ? <>Colour: {colour}<span aria-hidden="true"> · </span></> : null}Size: {size ?? what}</p>
            <p className="state-card__price">{price}{qty > 1 && <span> · {qty} in your bag</span>}</p>
          </div>
        </div>
        <button type="button" className="btn btn--contrast btn--block" onClick={() => openOverlay('cart')}>
          VIEW BAG <ArrowShort className="btn__arrow" />
        </button>
        <button type="button" className="btn btn--ghost btn--block state-panel__second" onClick={closeOverlay}>CONTINUE SHOPPING</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ out of stock */

/* The owner's "Out of stock" panel, when a sold-out piece is tapped: the
 * piece itself, a way to hear when it is back (the product page's own form,
 * opened and waiting), and a way to the others. */
function SoldOutModal({ id, name, img, price, colour, size, everySize }) {
  const { closeOverlay } = useShop();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const goTo = useSectionLink();
  const page = `/product/${id}`;
  const notify = () => {
    closeOverlay();
    navigate(`${page}${colour ? `?colour=${encodeURIComponent(colour)}` : ''}`, { state: { ...FROM_SHOP, notify: true, size } });
  };
  const similar = () => {
    closeOverlay();
    // On its own page the others are just below; elsewhere, the drop.
    const more = pathname === page && document.getElementById('moreLike');
    if (more) glideTo(more, -120); else goTo('#drop');
  };
  return (
    <Modal labelledBy="soldOutTitle" className="modal__panel--state modal__panel--bad">
      <StateArt tone="bad" />
      <div className="state-panel">
        <StateMark tone="bad" size="lg" />
        <h2 className="state-panel__title" id="soldOutTitle">Out of stock</h2>
        <p className="state-panel__note">
          {everySize ? 'This piece has sold out for now.' : 'This piece is no longer available in the selected size.'}
        </p>
        <PieceCard img={img} name={name} price={price}
                   meta={colour || size ? <>{colour ? <>Colour: {colour}</> : null}{colour && size ? <span aria-hidden="true"> · </span> : null}{size ? <>Size: {size}</> : null}</> : null}
                   aside={<span className="pill pill--bad">Sold out</span>} />
        <button type="button" className="btn btn--danger btn--block" onClick={notify}>NOTIFY ME WHEN AVAILABLE</button>
        <button type="button" className="btn btn--ghost btn--block state-panel__second" onClick={similar}>VIEW SIMILAR ITEMS</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ track an order */

/* Replaces a sign-in form that did nothing: it told people "Welcome back"
 * and "Account created" while discarding what they typed. Until real
 * accounts exist, the honest thing to offer is the one thing we can do. */
/* ----------------------------------------------------------- welcome */

/**
 * The mailing list, offered once to a first-time visitor on the home page
 * (opened by src/pages/Storefront.jsx). The words are the owner's, from
 * Home page → Words in the admin.
 */
function WelcomeModal() {
  const { closeOverlay } = useShop();
  const { home, images } = useHome();
  const [joined, setJoined] = useState(false);
  const photo = images.hero?.img ?? asset('assets/img/hero-design.webp');

  return (
    <Modal labelledBy="welcomeTitle" className="modal__panel--welcome" closeOutside={false}>
      <div className="welcome">
        <div className="welcome__photo" aria-hidden="true"><img src={photo} alt="" /></div>
        <div className="welcome__body">
          <p className="eyebrow">The List</p>
          <h2 className="welcome__title" id="welcomeTitle">{home.welcomeTitle}</h2>
          <p className="welcome__note"><Lines text={home.welcomeNote} /></p>
          <JoinForm id="welcome-email" onJoined={() => setJoined(true)} />
          <button type="button" className={joined ? 'btn btn--ghost welcome__done' : 'welcome__skip'} onClick={closeOverlay}>
            {joined ? 'CONTINUE TO THE SHOP' : 'NO THANKS'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function TrackOrderModal() {
  const { closeOverlay } = useShop();
  const navigate = useNavigate();
  const [ref, setRef] = useState('');
  const [error, setError] = useState(null);

  const onSubmit = (e) => {
    e.preventDefault();
    const reference = ref.trim();
    if (!/^[A-Za-z0-9._=-]{6,64}$/.test(reference)) {
      setError('That does not look like an order reference.');
      return;
    }
    closeOverlay();
    navigate(`/order?reference=${encodeURIComponent(reference)}`);
  };

  return (
    <Modal labelledBy="trackTitle">
      <h2 className="modal__title" id="trackTitle">TRACK AN ORDER</h2>
      <p className="modal__text modal__text--sm">
        Your order reference starts with <strong>masq-</strong>. It is in the receipt Paystack
        emailed you, and on the page you saw after paying.
      </p>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field" htmlFor="track-ref">
          <span>ORDER REFERENCE</span>
          <input id="track-ref" autoComplete="off" spellCheck="false" placeholder="masq-…"
                 className={error ? 'is-error' : ''} aria-invalid={error ? true : undefined}
                 value={ref} onChange={(e) => { setRef(e.target.value); setError(null); }} />
        </label>
        <button type="submit" className="btn btn--solid btn--block">SEE MY ORDER</button>
        <p className={`form-msg${error ? ' is-show is-error' : ''}`} role="status" aria-live="polite">
          {error ?? ''}
        </p>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- film modal */

/* The old player ticked a clock over a still image and played nothing. Now
 * it plays the film the owner links in the admin, or says plainly that it is
 * coming. The YouTube id reaching this page has already been reduced to its
 * 11 safe characters by the server. */
/* The brand film made in code (video/, rendered with Remotion), played when
 * the owner has not set a film of their own in the admin. */
const BRAND_FILM = 'assets/video/brand-film.mp4';

function FilmModal() {
  const { site } = useShop();
  const film = site?.film ?? { kind: 'mp4', url: asset(BRAND_FILM) };
  useEffect(() => { track('film_play'); }, []);

  return (
    <Modal label="MASQ. film" wide>
      <div className="film-frame">
        {film.kind === 'youtube' ? (
          <div className="film-frame__video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${film.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
              title="Urban Rituals — the film"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="film-frame__video">
            <video src={film.url} controls autoPlay playsInline />
          </div>
        )}
        <div className="film-frame__body">
          <p className="eyebrow">URBAN RITUALS — THE FILM</p>
          <p className="film-frame__title">A study of mask, movement and memory.</p>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- info modal */

const PAGE_TITLES = { FAQ: 'FAQ', SHIPPING: 'Delivery', RETURNS: 'Returns', CONTACT: 'Contact', PRIVACY: 'Privacy', SIZE_GUIDE: 'Size guide', TERMS: 'Terms of sale' };

function InfoModal({ title }) {
  const { site } = useShop();
  const text = site?.pages?.[title];
  useEffect(() => { if (title === 'SIZE_GUIDE') track('size_guide'); }, [title]);
  return (
    <Modal labelledBy="infoTitle">
      <h2 className="modal__title" id="infoTitle">{(PAGE_TITLES[title] ?? title).toUpperCase()}</h2>
      {/* Plain text from the admin, shown as text: line breaks kept, never HTML. */}
      <p className="modal__text modal__text--pre">{text ?? 'Loading…'}</p>
    </Modal>
  );
}

/* -------------------------------------------------------------------- root */

export default function Overlays() {
  const { overlay, closeOverlay } = useShop();
  const info = overlay && typeof overlay === 'object' ? overlay.info : null;

  return (
    <AnimatePresence>
      {overlay && (
        <motion.div key="overlay-root">
          <motion.div
            className="scrim"
            onClick={overlay === 'welcome' ? undefined : closeOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: UI_OUT } }}
            transition={{ duration: UI_IN, ease: EASE_OUT }}
          />
          {overlay === 'cart'  && <CartDrawer />}
          {overlay === 'checkout' && <CartDrawer start="delivery" />}
          {overlay === 'saved' && <SavedDrawer />}
          {overlay === 'track' && <TrackOrderModal />}
          {overlay === 'film'  && <FilmModal />}
          {overlay === 'welcome' && <WelcomeModal />}
          {info                && <InfoModal title={info} />}
          {overlay.added       && <AddedModal {...overlay.added} />}
          {overlay.soldOut     && <SoldOutModal {...overlay.soldOut} />}
          {overlay.zoom        && <ZoomViewer {...overlay.zoom} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
