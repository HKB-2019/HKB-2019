import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { startCheckout, checkDiscount, checkGiftCard } from '../lib/api.js';
import { useSectionLink } from '../lib/useSectionLink.js';
import { asset } from '../lib/media.js';
import { track, visitId } from '../lib/analytics.js';
import { zoneFor, naira, isEmail, isPhone } from '../lib/delivery.js';
import { countriesAbroad } from '../data/countries.js';
import { Close, Heart, ArrowShort } from './Icons.jsx';
import StateMark from './StateMark.jsx';
import doodleOk from '../assets/states/doodle-ok.webp';
import { SizeButtons } from './DropGrid.jsx';
import { useFocusTrap } from '../lib/useFocusTrap.js';
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
function ShopButton() {
  const { closeOverlay } = useShop();
  const { home } = useHome();
  const goTo = useSectionLink();
  return (
    <button className="btn btn--ghost" onClick={() => { closeOverlay(); goTo('#drop'); }}>{home.heroButton}</button>
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
  if (cart.length === 0) {
    return (
      <div className="empty">
        <p>YOUR BAG IS EMPTY</p>
        <ShopButton />
      </div>
    );
  }
  return (
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
                      onClick={() => changeQty(item.key, -1)}>−</button>
              <span aria-live="polite">{item.qty}</span>
              <button aria-label={`Increase quantity of ${item.name}`}
                      onClick={() => changeQty(item.key, 1)}>+</button>
            </div>
          </div>
          <button className="line-item__remove"
                  onClick={() => removeItem(item.key)}>REMOVE</button>
        </motion.article>
      ))}
    </AnimatePresence>
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

function Field({ label, id, error, ok, hint, children }) {
  return (
    <label className="field field--tight" htmlFor={id}>
      <span>{label}{hint && <em className="field__hint"> · {hint}</em>}</span>
      {children}
      {error && <small className="field__error" id={`${id}-error`}>{error}</small>}
      {!error && ok && <small className="field__ok">{ok}</small>}
    </label>
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
        <span><strong>{applied.code}</strong> · {applied.label}</span>
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
  const { cart, cartSubtotal, delivery, setDelivery, site, toast, discountCode, closeOverlay } = useShop();
  const [applied, setApplied] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);
  // The email is checked when they leave the box, then again as they type:
  // a mistake is pointed out late, a fix is welcomed at once.
  const [emailSeen, setEmailSeen] = useState(false);
  const form = useRef(null);

  const zones = site?.delivery ?? [];
  const abroadOpen = zones.some(z => z.zone === 'international');
  const d = delivery;
  const inNigeria = d.address.country === 'Nigeria';

  const zone = zoneFor(d.address);
  const open = zones.find(z => z.zone === zone);
  // No fee in the total until there is somewhere to deliver to (a state, in Nigeria).
  const fee = open && (!inNigeria || d.address.state) ? open.feeKobo : null;
  const discountKobo = applied?.discountKobo ?? 0;
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
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onPay = async (ev) => {
    ev.preventDefault();
    if (!cart.length) return;
    if (!validate()) { shakeInvalid(form.current); return; }
    if (!open) { setServerError('Sorry — we don’t deliver there yet.'); return; }

    setBusy(true); setServerError(null);
    try {
      const { authorizationUrl, reference } = await startCheckout(d, cart, applied ? discountCode : undefined, visitId(), gift?.code);
      track('checkout', { valueKobo: total });
      // Leaving for the payment page: the bag closes behind us, so coming
      // back (the preview's payment page is in the same page) finds the shop.
      closeOverlay();
      // Paid in full by a gift card: nothing for Paystack, straight to the order.
      if (!authorizationUrl) { navigate(`/order?reference=${encodeURIComponent(reference)}`); return; }
      window.location.href = authorizationUrl;   // hand off to Paystack
    } catch (err) {
      setBusy(false);
      setServerError(err.message);
      toast({ tone: 'bad', title: 'Payment couldn’t start', body: 'Please check your connection and try again.' });
    }
  };

  const err = (k) => errors[k] ? { 'aria-invalid': true, 'aria-describedby': `d-${k}-error`, className: 'is-error' } : {};

  return (
    <form className="delivery" onSubmit={onPay} noValidate ref={form}>
      <button type="button" className="delivery__back" onClick={onBack}>← BACK TO BAG</button>

      <Field label="EMAIL FOR RECEIPT" id="d-email" error={errors.email}
             ok={emailSeen && isEmail(d.email) ? 'Looks good!' : null}>
        <input id="d-email" type="email" autoComplete="email" inputMode="email"
               value={d.email} onChange={set('email')}
               onBlur={() => {
                 if (!d.email.trim()) return;
                 setEmailSeen(true);
                 if (!isEmail(d.email)) setErrors(x => ({ ...x, email: 'Please enter a valid email address.' }));
               }}
               {...err('email')}
               className={errors.email ? 'is-error' : emailSeen && isEmail(d.email) ? 'is-valid' : undefined} />
      </Field>
      <Field label="FULL NAME" id="d-name" error={errors.name}>
        <input id="d-name" autoComplete="name" value={d.name} onChange={set('name')} {...err('name')} />
      </Field>
      <Field label="PHONE" id="d-phone" error={errors.phone} hint="for the rider">
        <input id="d-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567"
               value={d.phone} onChange={set('phone')} {...err('phone')} />
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
                  value={d.address.state} onChange={setAddr('state')} {...err('state')}>
            <option value="">Choose…</option>
            {(site?.states ?? []).map(s => <option key={s} value={s}>{s === 'FCT' ? 'FCT (Abuja)' : s}</option>)}
          </select>
        ) : (
          <input id="d-state" autoComplete="address-level1"
                 value={d.address.state} onChange={setAddr('state')} {...err('state')} />
        )}
      </Field>
      <Field label="CITY OR AREA" id="d-city" error={errors.city}>
        <input id="d-city" autoComplete="address-level2" placeholder={inNigeria ? 'e.g. Lekki' : ''}
               value={d.address.city} onChange={setAddr('city')} {...err('city')} />
      </Field>
      <Field label="STREET ADDRESS" id="d-line1" error={errors.line1}>
        <input id="d-line1" autoComplete="address-line1"
               value={d.address.line1} onChange={setAddr('line1')} {...err('line1')} />
      </Field>
      <Field label="FLAT, LANDMARK" id="d-line2" hint="optional">
        <input id="d-line2" autoComplete="address-line2"
               value={d.address.line2} onChange={setAddr('line2')} />
      </Field>
      {!inNigeria && (
        <Field label="POSTCODE / ZIP" id="d-postcode" error={errors.postcode} hint="if you have one">
          <input id="d-postcode" autoComplete="postal-code" maxLength={12} autoCapitalize="characters"
                 value={d.address.postcode ?? ''} onChange={setAddr('postcode')} {...err('postcode')} />
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
            ? (open ? (fee === 0 ? 'FREE' : naira(fee)) : 'NOT AVAILABLE')
            : '—'}</span>
        </div>
        {giftKobo > 0 && (
          <div className="drawer__row drawer__row--discount"><span>GIFT CARD</span><span>−{naira(giftKobo)}</span></div>
        )}
        <div className="drawer__row drawer__row--total"><span>{giftKobo > 0 ? 'TO PAY' : 'TOTAL'}</span><span>{naira(due)}</span></div>
      </div>

      <button type="submit" className="btn btn--solid btn--block" disabled={busy || !cart.length}>
        {busy ? (due === 0 ? 'PLACING YOUR ORDER…' : 'TAKING YOU TO PAYSTACK…') : due === 0 && giftKobo > 0 ? 'PLACE ORDER' : `PAY ${naira(due)}`}
      </button>
      <p className="drawer__note drawer__note--center">Secure payment by Paystack. We never see your card.</p>

      <p className={`form-msg${serverError ? ' is-show is-error' : ''}`} role="status" aria-live="polite">
        {serverError ?? ''}
      </p>
    </form>
  );
}

function CartDrawer() {
  const { cart, cartQty, cartSubtotal, format, site, catalogueStatus } = useShop();
  const [step, setStep] = useState('bag');

  // Delivery prices are the owner's to set; until they are, nothing can be sold.
  const checkoutOpen = (site?.delivery ?? []).length > 0;

  if (step === 'delivery' && cart.length) {
    return (
      <Drawer label="Delivery" title="DELIVERY">
        <DeliveryForm onBack={() => setStep('bag')} />
      </Drawer>
    );
  }

  return (
    <Drawer
      label="Your bag" title="YOUR BAG" count={cartQty}
      foot={<>
        <div className="drawer__row"><span>SUBTOTAL</span><span>{format(cartSubtotal)}</span></div>
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
        <div className="empty">
          <p>NOTHING SAVED YET</p>
          <ShopButton />
        </div>
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
function AddedModal({ name, what, img }) {
  const { openOverlay, closeOverlay } = useShop();
  return (
    <Modal labelledBy="addedTitle" className="modal__panel--state modal__panel--ok">
      <div className="state-panel">
        <StateMark tone="ok" size="lg" />
        <h2 className="state-panel__title" id="addedTitle">Added to your bag</h2>
        <div className="state-panel__piece">
          {img && <img src={img} alt="" />}
          <p><span>{name}</span><span>{what}</span></p>
        </div>
        <button type="button" className="btn btn--contrast btn--block" onClick={() => openOverlay('cart')}>
          VIEW BAG <ArrowShort className="btn__arrow" />
        </button>
        <button type="button" className="state-panel__link" onClick={closeOverlay}>Continue shopping</button>
      </div>
      <img className="state-panel__doodle" src={doodleOk} alt="" aria-hidden="true" />
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
                 className={error ? 'is-error' : ''}
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
          {overlay === 'saved' && <SavedDrawer />}
          {overlay === 'track' && <TrackOrderModal />}
          {overlay === 'film'  && <FilmModal />}
          {overlay === 'welcome' && <WelcomeModal />}
          {info                && <InfoModal title={info} />}
          {overlay.added       && <AddedModal {...overlay.added} />}
          {overlay.zoom        && <ZoomViewer {...overlay.zoom} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
