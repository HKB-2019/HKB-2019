import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from './Reveal.jsx';
import { useShop, useHome } from '../store/ShopContext.jsx';
import Lines from './Lines.jsx';
import { subscribe } from '../lib/api.js';
import { track } from '../lib/analytics.js';
import { markWelcome } from '../lib/welcome.js';
import { shake } from '../lib/feel.js';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

/**
 * The email box and JOIN button: on the page's mailing-list section, and in
 * the welcome pop-up. `id` must be unique on the page.
 */
export function JoinForm({ id, onJoined }) {
  const [email, setEmail]   = useState('');
  const [msg, setMsg]       = useState(null);   // { text, error } or { text, ok } (the address looks right)
  const [busy, setBusy]     = useState(false);
  const box = useRef(null);

  /* This used to show "You're in" and throw the address away. Now it is
   * stored, and the owner sees the list in the admin. */
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setMsg({ text: 'Please enter a valid email address.', error: true });
      shake(box.current?.form);
      return;
    }
    setBusy(true);
    try {
      await subscribe(email.trim());
      track('subscribe');
      markWelcome('joined');   // someone on the list is never offered it again
      setEmail('');
      setMsg({ text: 'You’re in. Watch your inbox for Drop 02.', ok: true, joined: true });
      onJoined?.();
    } catch (err) {
      setMsg({ text: err.message, error: true });
      shake(box.current?.form);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form className="newsletter__form" onSubmit={onSubmit} noValidate>
        <label className="sr-only" htmlFor={id}>Email address</label>
        <input
          type="email" id={id} name="email" ref={box}
          className={msg?.error ? 'is-error' : msg?.ok ? 'is-valid' : ''} aria-invalid={msg?.error || undefined}
          placeholder="Your email address" autoComplete="email" required
          value={email}
          onChange={(e) => {
            const v = e.target.value;
            setEmail(v);
            // Once checked, a fix is welcomed at once; a new slip waits for them to leave the box.
            if (msg?.error || (msg?.ok && !msg.joined)) setMsg(isEmail(v) ? { text: 'Looks good!', ok: true } : null);
          }}
          onBlur={() => {
            if (!email.trim() || busy) return;
            setMsg(isEmail(email) ? { text: 'Looks good!', ok: true } : { text: 'Please enter a valid email address.', error: true });
          }}
        />
        <button type="submit" className="btn btn--solid btn--join" disabled={busy}>
          {busy && <span className="spinner" aria-hidden="true" />}{busy ? 'JOINING…' : 'JOIN'}
        </button>
      </form>

      <div className="form-msg-wrap" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {msg && (
            <motion.p
              key={msg.text}
              className={`form-msg is-show${msg.error ? ' is-error' : msg.ok ? ' is-ok' : ''}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3 }}
            >{msg.text}</motion.p>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}

export default function Newsletter() {
  const { toast } = useShop();
  const { home } = useHome();

  return (
    <section className="newsletter">
      <Reveal className="newsletter__inner">
        <p className="eyebrow">The List</p>
        <h2 className="newsletter__title">{home.newsletterTitle}</h2>
        <p className="newsletter__note"><Lines text={home.newsletterNote} /></p>
        <JoinForm id="email" onJoined={() => toast({ tone: 'ok', title: 'You’re on the list', body: 'Welcome to the world of MASQ.' })} />
      </Reveal>
    </section>
  );
}
