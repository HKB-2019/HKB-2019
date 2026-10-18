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
  const [msg, setMsg]       = useState(null);   // { text, error }
  const [busy, setBusy]     = useState(false);
  const box = useRef(null);

  /* This used to show "You're in" and throw the address away. Now it is
   * stored, and the owner sees the list in the admin. */
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setMsg({ text: 'PLEASE ENTER A VALID EMAIL ADDRESS', error: true });
      shake(box.current?.form);
      return;
    }
    setBusy(true);
    try {
      await subscribe(email.trim());
      track('subscribe');
      markWelcome('joined');   // someone on the list is never offered it again
      setEmail('');
      setMsg({ text: 'YOU’RE IN. WATCH YOUR INBOX FOR DROP 02.', error: false });
      onJoined?.();
    } catch (err) {
      setMsg({ text: err.message.toUpperCase(), error: true });
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
          className={msg?.error ? 'is-error' : ''} aria-invalid={msg?.error || undefined}
          placeholder="Your email address" autoComplete="email" required
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (msg?.error) setMsg(null); }}
        />
        <button type="submit" className="btn btn--solid btn--join" disabled={busy}>
          {busy ? 'JOINING…' : 'JOIN'}
        </button>
      </form>

      <div className="form-msg-wrap" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {msg && (
            <motion.p
              key={msg.text}
              className={`form-msg is-show${msg.error ? ' is-error' : ''}`}
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
        <JoinForm id="email" onJoined={() => toast('WELCOME TO THE WORLD OF MASQ.', 'violet')} />
      </Reveal>
    </section>
  );
}
