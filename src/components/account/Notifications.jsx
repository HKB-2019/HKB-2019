import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { accountNotifications, accountSetNotifications, accountRemoveStockAlert } from '../../lib/api.js';
import { useShop } from '../../store/ShopContext.jsx';
import { ErrorBanner, Loader, detailsOf } from '../Notices.jsx';
import { Close } from '../Icons.jsx';
import { AccountFrame } from './AccountArea.jsx';
import { EASE_OUT } from '../../lib/motion.js';

/* What the account hears about, and nothing it doesn't: the mailing list,
 * an email when it is signed in somewhere new, and the "tell me when it's
 * back" requests made with its email. Emails about security (codes, reset
 * links, a changed email) always go: they are how the account stays theirs. */

const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** An on/off switch: the whole row is the control. */
function Switch({ id, title, text, on, busy, onChange }) {
  return (
    <div className="pref">
      <span className="pref__text"><strong id={`${id}-t`}>{title}</strong><em id={`${id}-d`}>{text}</em></span>
      <button type="button" role="switch" aria-checked={on} aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}
              className={`switch${on ? ' is-on' : ''}`} disabled={busy} onClick={() => onChange(!on)}>
        <span className="switch__knob" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Notifications() {
  const { toast, failed } = useShop();
  const [n, setN] = useState(null);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [busy, setBusy] = useState(null);

  const load = async () => {
    setRetrying(true);
    try { setN(await accountNotifications()); setError(null); } catch (err) { setError(err); }
    setRetrying(false);
  };
  useEffect(() => { load(); }, []);

  // Switched at once on screen; put back if the server says no.
  const flip = async (key, value, said) => {
    const was = n;
    setN(x => ({ ...x, [key]: value })); setBusy(key);
    try { setN(await accountSetNotifications({ [key]: value })); toast({ key: 'prefs', tone: 'ok', title: said }); }
    catch (err) {
      setN(was);
      failed({ key: 'prefs', title: 'We couldn’t save that.', body: err.message, done: { title: said },
        run: async () => { setN(await accountSetNotifications({ [key]: value })); } });
    }
    setBusy(null);
  };
  const drop = async (id) => {
    setBusy(id);
    try { setN(await accountRemoveStockAlert(id)); toast({ key: 'prefs', title: 'Request removed' }); }
    catch (err) { toast({ key: 'prefs', tone: 'bad', title: 'That didn’t work.', body: err.message }); }
    setBusy(null);
  };

  let body;
  if (error && !n) {
    body = <ErrorBanner layout="panel" picture={error.status === 0 ? 'offline' : 'list'} title="We couldn’t load your settings."
                        text="Please try again." onRetry={load} retrying={retrying} retryLabel="Retry" details={detailsOf(error)} />;
  } else if (!n) {
    body = <Loader title="Loading your settings…" />;
  } else {
    body = (
      <>
        <h2 className="acct__sub">Email</h2>
        <div className="prefs">
          <Switch id="pref-news" title="New drops and news" text="Hear first when a drop lands or a piece comes back. Leave any time."
                  on={n.newsletter} busy={busy === 'newsletter'}
                  onChange={(v) => flip('newsletter', v, v ? 'You’re on the list' : 'You’ve left the list')} />
          <Switch id="pref-signin" title="Sign-in alerts" text="An email when your account is signed in on a browser we haven’t seen before."
                  on={n.signInAlerts} busy={busy === 'signInAlerts'}
                  onChange={(v) => flip('signInAlerts', v, v ? 'Sign-in alerts on' : 'Sign-in alerts off')} />
          <div className="pref pref--fixed">
            <span className="pref__text"><strong>Security emails</strong>
              <em>Codes, password reset links and a changed email always reach you. They keep your account yours.</em></span>
            <span className="pill pill--ok">Always on</span>
          </div>
        </div>

        <h2 className="acct__sub">Back-in-stock requests</h2>
        {n.stockAlerts.length ? (
          <ul className="alerts-list">
            <AnimatePresence initial={false}>
              {n.stockAlerts.map(a => (
                <motion.li key={a.id} layout="position" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
                  <span>
                    {a.productId ? <Link to={`/product/${a.productId}`}><strong>{a.name}</strong></Link> : <strong>{a.name}</strong>}
                    <em>{[a.colour, a.size].filter(Boolean).join(' · ')} · asked {day(a.createdAt)}</em>
                  </span>
                  <button type="button" className="alerts-list__x" aria-label={`Stop waiting for ${a.name}, ${a.size}`}
                          disabled={busy === a.id} onClick={() => drop(a.id)}><Close /></button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="acct__quiet">None yet. On a sold-out size, tap <strong>Tell me when it’s back</strong> and it will show here.</p>
        )}
      </>
    );
  }
  return <AccountFrame title="Notifications" note="Choose what we email you about.">{body}</AccountFrame>;
}
