import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import { INFO_COPY } from '../data/catalogue.js';
import { scrollToId } from '../lib/scroll.js';
import { Close, Play, Pause } from './Icons.jsx';

const ease  = [0.33, 0.02, 0.18, 1];
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

/* Keeps Tab inside an open overlay and hands focus back to whatever opened it. */
function useFocusTrap(active) {
  const ref = useRef(null);
  const lastFocused = useRef(null);

  useEffect(() => {
    if (!active) return;
    lastFocused.current = document.activeElement;
    const root = ref.current;
    const first = root?.querySelector('input, button:not([data-close])') || root?.querySelector('[data-close]');
    first?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key !== 'Tab' || !root) return;
      const items = Array.from(root.querySelectorAll(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

/* ------------------------------------------------------------- cart drawer */

function CartDrawer() {
  const { cart, cartQty, cartSubtotal, changeQty, removeItem, format, closeOverlay, toast } = useShop();
  const ref = useFocusTrap(true);
  const [busy, setBusy] = useState(false);

  const onCheckout = () => {
    if (!cart.length) { toast('YOUR BAG IS EMPTY'); return; }
    setBusy(true);
    // TODO: hand off to the payment provider once the back end exists
    setTimeout(() => {
      setBusy(false);
      closeOverlay();
      toast('CHECKOUT IS A DEMO — NOTHING WAS CHARGED', 'violet');
    }, 1100);
  };

  return (
    <motion.aside
      ref={ref}
      className="drawer"
      role="dialog" aria-modal="true" aria-label="Your bag"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 260, damping: 34, mass: 0.9 }}
    >
      <div className="drawer__head">
        <h2 className="drawer__title">YOUR BAG <span>({cartQty})</span></h2>
        <button className="close-btn" data-close aria-label="Close bag" onClick={closeOverlay}>
          <Close />
        </button>
      </div>

      <div className="drawer__body">
        {cart.length === 0 ? (
          <div className="empty">
            <p>YOUR BAG IS EMPTY</p>
            <button className="btn btn--ghost"
                    onClick={() => { closeOverlay(); scrollToId('#drop'); }}>SHOP DROP 01</button>
          </div>
        ) : (
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
                    <span>{item.qty}</span>
                    <button aria-label={`Increase quantity of ${item.name}`}
                            onClick={() => changeQty(item.key, 1)}>+</button>
                  </div>
                </div>
                <button className="line-item__remove"
                        onClick={() => removeItem(item.key)}>REMOVE</button>
              </motion.article>
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="drawer__foot">
        <div className="drawer__row"><span>SUBTOTAL</span><span>{format(cartSubtotal)}</span></div>
        <p className="drawer__note">Shipping and duties calculated at checkout.</p>
        <button className="btn btn--solid btn--block" disabled={busy} onClick={onCheckout}>
          {busy ? 'PROCESSING…' : 'CHECKOUT'}
        </button>
      </div>
    </motion.aside>
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

/* ------------------------------------------------------------ account modal */

function AccountModal() {
  const { closeOverlay } = useShop();
  const [mode, setMode] = useState('signin');
  const [msg, setMsg]   = useState(null);
  const [fields, setFields] = useState({ email: '', password: '' });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!isEmail(fields.email)) {
      setMsg({ text: 'ENTER A VALID EMAIL ADDRESS', error: true, field: 'email' });
      return;
    }
    if (fields.password.length < 8) {
      setMsg({ text: 'PASSWORD MUST BE AT LEAST 8 CHARACTERS', error: true, field: 'password' });
      return;
    }
    // TODO: real authentication once the back end exists
    setMsg({
      text: mode === 'signin' ? 'WELCOME BACK TO MASQ.' : 'ACCOUNT CREATED — CHECK YOUR INBOX',
      error: false
    });
    setTimeout(closeOverlay, 1200);
  };

  return (
    <Modal label="Account">
      <div className="tabs" role="tablist">
        {[['signin', 'SIGN IN'], ['register', 'CREATE ACCOUNT']].map(([key, label]) => (
          <button key={key} role="tab"
                  className={`tab${mode === key ? ' is-active' : ''}`}
                  aria-selected={mode === key}
                  onClick={() => { setMode(key); setMsg(null); }}>{label}</button>
        ))}
      </div>

      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <label className="field">
          <span>EMAIL</span>
          <input type="email" name="email" placeholder="you@example.com" required autoComplete="email"
                 className={msg?.field === 'email' ? 'is-error' : ''}
                 value={fields.email}
                 onChange={(e) => setFields(f => ({ ...f, email: e.target.value }))} />
        </label>
        <label className="field">
          <span>PASSWORD</span>
          <input type="password" name="password" placeholder="••••••••" required minLength={8}
                 autoComplete="current-password"
                 className={msg?.field === 'password' ? 'is-error' : ''}
                 value={fields.password}
                 onChange={(e) => setFields(f => ({ ...f, password: e.target.value }))} />
        </label>
        <button type="submit" className="btn btn--solid btn--block">
          {mode === 'signin' ? 'SIGN IN' : 'CREATE ACCOUNT'}
        </button>
        <p className={`form-msg${msg ? ' is-show' : ''}${msg?.error ? ' is-error' : ''}`}
           role="status" aria-live="polite">{msg?.text ?? ''}</p>
      </form>
    </Modal>
  );
}

/* --------------------------------------------------------------- film modal */

const DURATION = 180;
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function FilmModal() {
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setElapsed(e => {
        if (e + 1 >= DURATION) { setPlaying(false); return DURATION; }
        return e + 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [playing]);

  return (
    <Modal label="MASQ. film" wide>
      <div className="film-frame">
        <img src="/assets/img/film-still.webp" alt="" aria-hidden="true" />
        <div className="film-frame__body">
          <p className="eyebrow">URBAN RITUALS — THE FILM</p>
          <p className="film-frame__title">A 3-minute study of mask, movement and memory.</p>
          <div className="player">
            <button className="player__btn"
                    aria-label={playing ? 'Pause' : 'Play'}
                    onClick={() => setPlaying(p => !p)}>
              {playing ? <Pause /> : <Play />}
            </button>
            <div className="player__bar">
              <motion.span className="player__fill"
                           animate={{ width: `${(elapsed / DURATION) * 100}%` }}
                           transition={{ duration: 0.25, ease: 'linear' }} />
            </div>
            <span className="player__time">{fmtTime(elapsed)} / {fmtTime(DURATION)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- info modal */

function InfoModal({ title }) {
  return (
    <Modal labelledBy="infoTitle">
      <h2 className="modal__title" id="infoTitle">{title}</h2>
      <p className="modal__text">{INFO_COPY[title] ?? ''}</p>
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
          {overlay === 'cart'    && <CartDrawer />}
          {overlay === 'account' && <AccountModal />}
          {overlay === 'film'    && <FilmModal />}
          {info                  && <InfoModal title={info} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
