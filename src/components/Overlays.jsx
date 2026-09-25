import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import { startCheckout } from '../lib/api.js';
import { scrollToId } from '../lib/scroll.js';
import { zoneFor, naira, isEmail, isPhone } from '../lib/delivery.js';
import { Close, Heart } from './Icons.jsx';
import { SizeButtons } from './DropGrid.jsx';

const ease = [0.33, 0.02, 0.18, 1];

/* Keeps Tab inside an open overlay and hands focus back to whatever opened it. */
function useFocusTrap(active) {
  const ref = useRef(null);
  const lastFocused = useRef(null);

  useEffect(() => {
    if (!active) return;
    lastFocused.current = document.activeElement;
    const root = ref.current;
    const first = root?.querySelector('input, select, button:not([data-close])') || root?.querySelector('[data-close]');
    first?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, iframe, video, [tabindex]:not([tabindex="-1"])'
      )).filter(el => el.offsetParent !== null);
      if (!items.length) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) { e.preventDefault(); tail.focus(); }
      else if (!e.shiftKey && document.activeElement === tail) { e.preventDefault(); head.focus(); }
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      lastFocused.current?.focus?.({ preventScroll: true });
    };
  }, [active]);

  return ref;
}

/* ------------------------------------------------------------ drawer shell */

function Drawer({ label, title, count, children, foot }) {
  const { closeOverlay } = useShop();
  const ref = useFocusTrap(true);
  return (
    <motion.aside
      ref={ref}
      className="drawer"
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
    </motion.aside>
  );
}

/* ------------------------------------------------------------------ the bag */

function BagLines() {
  const { cart, changeQty, removeItem, format, closeOverlay } = useShop();
  if (cart.length === 0) {
    return (
      <div className="empty">
        <p>YOUR BAG IS EMPTY</p>
        <button className="btn btn--ghost"
                onClick={() => { closeOverlay(); scrollToId('#drop'); }}>SHOP DROP 01</button>
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
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.32, ease }}
        >
          <img className="line-item__img" src={item.img} alt={item.name} />
          <div>
            <h3 className="line-item__name">{item.name}</h3>
            <p className="line-item__variant">SIZE {item.size}</p>
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

function Field({ label, id, error, hint, children }) {
  return (
    <label className="field field--tight" htmlFor={id}>
      <span>{label}{hint && <em className="field__hint"> · {hint}</em>}</span>
      {children}
      {error && <small className="field__error" id={`${id}-error`}>{error}</small>}
    </label>
  );
}

/**
 * Step two of the bag: who it is for and where it is going. The fee shown
 * here is worked out from the same rules the server uses — but the server
 * decides the real one, and never reads this page's answer.
 */
function DeliveryForm({ onBack }) {
  const { cart, cartSubtotal, delivery, setDelivery, site, toast } = useShop();
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState(null);

  const zones = site?.delivery ?? [];
  const abroadOpen = zones.some(z => z.zone === 'international');
  const d = delivery;
  const inNigeria = d.address.country === 'Nigeria';

  const zone = zoneFor(d.address);
  const open = zones.find(z => z.zone === zone);
  const fee = open ? open.feeKobo : null;
  const total = cartSubtotal * 100 + (fee ?? 0);

  const set = (key) => (e) => {
    setDelivery(v => ({ ...v, [key]: e.target.value }));
    setErrors(x => ({ ...x, [key]: null })); setServerError(null);
  };
  const setAddr = (key) => (e) => {
    const value = e.target.value;
    setDelivery(v => ({ ...v, address: { ...v.address, [key]: value } }));
    setErrors(x => ({ ...x, [key]: null })); setServerError(null);
  };
  const setAbroad = (abroad) => {
    setDelivery(v => ({ ...v, address: { ...v.address, country: abroad ? '' : 'Nigeria', state: '' } }));
    setErrors({}); setServerError(null);
  };

  const validate = () => {
    const e = {};
    if (!isEmail(d.email)) e.email = 'Enter the email for your receipt.';
    if (d.name.trim().length < 2) e.name = 'Enter your full name.';
    if (!isPhone(d.phone)) e.phone = 'Enter a phone number the rider can call.';
    if (!inNigeria && d.address.country.trim().length < 2) e.country = 'Enter your country.';
    if (!d.address.state.trim()) e.state = inNigeria ? 'Choose your state.' : 'Enter your state or region.';
    if (d.address.city.trim().length < 2) e.city = 'Enter your city or area.';
    if (d.address.line1.trim().length < 3) e.line1 = 'Enter your street address.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onPay = async (ev) => {
    ev.preventDefault();
    if (!cart.length) return;
    if (!validate()) return;
    if (!open) { setServerError('Sorry — we don’t deliver there yet.'); return; }

    setBusy(true); setServerError(null);
    try {
      const { authorizationUrl } = await startCheckout(d, cart);
      window.location.href = authorizationUrl;   // hand off to Paystack
    } catch (err) {
      setBusy(false);
      setServerError(err.message);
      toast('CHECKOUT COULD NOT START');
    }
  };

  const err = (k) => errors[k] ? { 'aria-invalid': true, 'aria-describedby': `d-${k}-error`, className: 'is-error' } : {};

  return (
    <form className="delivery" onSubmit={onPay} noValidate>
      <button type="button" className="delivery__back" onClick={onBack}>← BACK TO BAG</button>

      <Field label="EMAIL FOR RECEIPT" id="d-email" error={errors.email}>
        <input id="d-email" type="email" autoComplete="email" inputMode="email"
               value={d.email} onChange={set('email')} {...err('email')} />
      </Field>
      <Field label="FULL NAME" id="d-name" error={errors.name}>
        <input id="d-name" autoComplete="name" value={d.name} onChange={set('name')} {...err('name')} />
      </Field>
      <Field label="PHONE" id="d-phone" error={errors.phone} hint="for the rider">
        <input id="d-phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="0803 123 4567"
               value={d.phone} onChange={set('phone')} {...err('phone')} />
      </Field>

      {abroadOpen && (
        <div className="delivery__where" role="radiogroup" aria-label="Delivering to">
          <button type="button" role="radio" aria-checked={inNigeria}
                  className={inNigeria ? 'is-on' : ''} onClick={() => setAbroad(false)}>NIGERIA</button>
          <button type="button" role="radio" aria-checked={!inNigeria}
                  className={!inNigeria ? 'is-on' : ''} onClick={() => setAbroad(true)}>OUTSIDE NIGERIA</button>
        </div>
      )}

      {!inNigeria && (
        <Field label="COUNTRY" id="d-country" error={errors.country}>
          <input id="d-country" autoComplete="country-name"
                 value={d.address.country} onChange={setAddr('country')} {...err('country')} />
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

      <div className="delivery__sum">
        <div className="drawer__row"><span>ITEMS</span><span>{naira(cartSubtotal * 100)}</span></div>
        <div className="drawer__row">
          <span>DELIVERY</span>
          <span>{d.address.state || !inNigeria
            ? (open ? (fee === 0 ? 'FREE' : naira(fee)) : 'NOT AVAILABLE')
            : '—'}</span>
        </div>
        <div className="drawer__row drawer__row--total"><span>TOTAL</span><span>{naira(total)}</span></div>
      </div>

      <button type="submit" className="btn btn--solid btn--block" disabled={busy || !cart.length}>
        {busy ? 'TAKING YOU TO PAYSTACK…' : `PAY ${naira(total)}`}
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
                onClick={() => setStep('delivery')}>
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
  const { wishlist, toggleWish, productById, format, closeOverlay, catalogueStatus } = useShop();
  // Only pieces still on sale; anything since taken off quietly drops out.
  const items = wishlist.map(productById).filter(Boolean);

  return (
    <Drawer label="Saved" title="SAVED" count={items.length}>
      {catalogueStatus === 'ready' && items.length === 0 ? (
        <div className="empty">
          <p>NOTHING SAVED YET</p>
          <button className="btn btn--ghost"
                  onClick={() => { closeOverlay(); scrollToId('#drop'); }}>SHOP DROP 01</button>
        </div>
      ) : items.map(p => (
        <article className="line-item saved-item" key={p.id}>
          {p.img ? <img className="line-item__img" src={p.img} alt={p.name} /> : <span className="line-item__img" />}
          <div>
            <h3 className="line-item__name">{p.name}</h3>
            <p className="line-item__price">{p.soldOut ? 'SOLD OUT' : format(p.price)}</p>
            {!p.soldOut && (
              <div className="saved-item__sizes card__sizes" role="group" aria-label={`Add ${p.name} in a size`}>
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

function Modal({ label, labelledBy, wide, children }) {
  const { closeOverlay } = useShop();
  const ref = useFocusTrap(true);
  return (
    <div className="modal" role="dialog" aria-modal="true"
         aria-label={label} aria-labelledby={labelledBy}>
      <motion.div
        ref={ref}
        className={`modal__panel ${wide ? 'modal__panel--film' : 'modal__panel--sm'}`}
        initial={{ opacity: 0, y: 20, scale: 0.984 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.988 }}
        transition={{ duration: 0.42, ease }}
      >
        <button className="close-btn modal__close" data-close aria-label="Close" onClick={closeOverlay}>
          <Close />
        </button>
        {children}
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------ track an order */

/* Replaces a sign-in form that did nothing: it told people "Welcome back"
 * and "Account created" while discarding what they typed. Until real
 * accounts exist, the honest thing to offer is the one thing we can do. */
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
function FilmModal() {
  const { site } = useShop();
  const film = site?.film;

  return (
    <Modal label="MASQ. film" wide>
      <div className="film-frame">
        {film?.kind === 'youtube' ? (
          <div className="film-frame__video">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${film.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
              title="Urban Rituals — the film"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : film?.kind === 'mp4' ? (
          <div className="film-frame__video">
            <video src={film.url} controls autoPlay playsInline />
          </div>
        ) : (
          <img src="assets/img/film-still.webp" alt="" aria-hidden="true" />
        )}
        <div className="film-frame__body">
          <p className="eyebrow">URBAN RITUALS — THE FILM</p>
          <p className="film-frame__title">
            {film ? 'A study of mask, movement and memory.' : 'The film is coming soon.'}
          </p>
          {!film && (
            <p className="modal__text modal__text--sm">Join the list at the foot of the page to see it first.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- info modal */

const PAGE_TITLES = { FAQ: 'FAQ', SHIPPING: 'Shipping', RETURNS: 'Returns', CONTACT: 'Contact', PRIVACY: 'Privacy' };

function InfoModal({ title }) {
  const { site } = useShop();
  const text = site?.pages?.[title];
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
            onClick={closeOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease }}
          />
          {overlay === 'cart'  && <CartDrawer />}
          {overlay === 'saved' && <SavedDrawer />}
          {overlay === 'track' && <TrackOrderModal />}
          {overlay === 'film'  && <FilmModal />}
          {info                && <InfoModal title={info} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
