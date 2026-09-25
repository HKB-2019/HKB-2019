import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Reveal from './Reveal.jsx';
import { useShop } from '../store/ShopContext.jsx';
import { subscribe } from '../lib/api.js';

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v).trim());

export default function Newsletter() {
  const { toast } = useShop();
  const [email, setEmail]   = useState('');
  const [msg, setMsg]       = useState(null);   // { text, error }
  const [busy, setBusy]     = useState(false);

  /* This used to show "You're in" and throw the address away. Now it is
   * stored, and the owner sees the list in the admin. */
  const onSubmit = async (e) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setMsg({ text: 'PLEASE ENTER A VALID EMAIL ADDRESS', error: true });
      return;
    }
    setBusy(true);
    try {
      await subscribe(email.trim());
      setEmail('');
      setMsg({ text: 'YOU’RE IN. WATCH YOUR INBOX FOR DROP 02.', error: false });
      toast('WELCOME TO THE WORLD OF MASQ.', 'violet');
    } catch (err) {
      setMsg({ text: err.message.toUpperCase(), error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="newsletter">
      <Reveal className="newsletter__inner">
        <p className="eyebrow">The List</p>
        <h2 className="newsletter__title">Enter the world of MASQ.</h2>
        <p className="newsletter__note">
          First access to every drop, and the story behind each mask. Nothing else.
        </p>

        <form className="newsletter__form" onSubmit={onSubmit} noValidate>
          <label className="sr-only" htmlFor="email">Email address</label>
          <input
            type="email" id="email" name="email"
            className={msg?.error ? 'is-error' : ''}
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
      </Reveal>
    </section>
  );
}
