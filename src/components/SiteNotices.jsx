import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import StateMark from './StateMark.jsx';
import StateArt from './StateArt.jsx';
import Wordmark from './Wordmark.jsx';
import { Close } from './Icons.jsx';
import { JoinForm } from './Newsletter.jsx';
import Dialog from './Dialog.jsx';
import { SOCIAL } from './Footer.jsx';
import { readStore, writeStore } from '../lib/storage.js';
import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';

/* The owner's banners across the top of the shop (Settings), stacked:
 *
 *   announcement   news (blue), an offer (green) or a warning (amber), with an
 *                  optional button: to a page, or "Learn more" in a panel.
 *                  Closed, it stays closed until the owner changes its words.
 *   maintenance    planned (amber, the date, or a countdown inside the last
 *                  day) or going on with the shop still open. Closed, it
 *                  stays closed for this visit; a new plan shows again.
 *   owner's note   while the shop is closed to customers; not closable.
 *
 * The header and the page move down to make room (--announce-h). */

const TONES = { info: 'info', ok: 'ok', warn: 'warn' };
const keyOf = (a) => `${a.tone}|${a.title}|${a.text}|${a.button}|${a.link}`;

const Megaphone = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M3 10v4a1 1 0 0 0 1 1h2l1.2 4.2a1 1 0 0 0 1 .8H10a1 1 0 0 0 1-1.2L10 15l8 4V5l-8 4H4a1 1 0 0 0-1 1zm17 0a2 2 0 0 1 0 4z" /></svg>
);
const Spanner = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a4 4 0 0 0-5.2 5.2l-5.6 5.6a1.5 1.5 0 0 0 2.1 2.1l5.6-5.6a4 4 0 0 0 5.2-5.2l-2.4 2.4-2-.5-.5-2z" />
  </svg>
);
const Cog = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
  </svg>
);

const session = {
  get: (k) => { try { return sessionStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* this visit only */ } }
};

function Bar({ tone, icon, title, text, onClose, live, children }) {
  return (
    <motion.div className={`announce announce--${tone}`} role={live ? 'status' : 'region'} aria-label={live ? undefined : title}
                layout initial={{ y: -16, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: UI_OUT, ease: EASE_OUT } }}
                transition={{ duration: 0.4, ease: EASE_OUT }}>
      <div className="announce__inner">
        {icon ? <span className={`announce__icon announce__icon--${tone}`}>{icon}</span> : <StateMark tone={tone} delay={0.25} />}
        <p className="announce__text"><strong>{title}</strong>{text && <span> {text}</span>}</p>
        {children}
        {onClose && (
          <button type="button" className="announce__close" aria-label={`Close: ${title}`} onClick={onClose}><Close /></button>
        )}
      </div>
    </motion.div>
  );
}

/* HH MM SS to a moment, ticking; calls `onEnd` when it gets there. */
function Countdown({ to, onEnd }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(0, Date.parse(to) - now);
  useEffect(() => { if (left === 0) onEnd?.(); }, [left === 0]);   // eslint-disable-line react-hooks/exhaustive-deps
  const parts = [[Math.floor(left / 3600_000), 'Hours'], [Math.floor(left / 60_000) % 60, 'Minutes'], [Math.floor(left / 1000) % 60, 'Seconds']];
  return (
    <span className="announce__count" role="timer" aria-label={`${parts[0][0]} hours ${parts[1][0]} minutes`}>
      {parts.map(([n, label]) => (
        <span key={label}><b>{String(n).padStart(2, '0')}</b><small>{label}</small></span>
      ))}
    </span>
  );
}

const lagos = (iso, opts) => new Date(iso).toLocaleString('en-GB', { timeZone: 'Africa/Lagos', ...opts });

export function SiteBar() {
  const { site, loadCatalogue } = useShop();
  const navigate = useNavigate();
  const a = site?.announcement;
  const m = site?.maintenance;
  const notice = site?.maintenanceNotice;
  const soon = site?.maintenanceSoon;
  const [closed, setClosed] = useState(() => readStore('masq:announce-closed', ''));
  const [hidden, setHidden] = useState(() => session.get('masq:maint-closed') ?? '');
  const [more, setMore] = useState(false);
  const ref = useRef(null);

  // Room for the bars, kept up to date as they come, go and wrap.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--announce-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.setProperty('--announce-h', '0px'); };
  }, []);

  const showA = a && TONES[a.tone] && closed !== keyOf(a);
  const soonKey = soon ? `soon|${soon.startsAt}` : '';
  const noticeKey = notice ? `now|${notice.message}` : '';
  const hide = (k) => { session.set('masq:maint-closed', k); setHidden(k); };
  const within = soon && Date.parse(soon.startsAt) - Date.now() < 24 * 3600_000;
  const go = (link) => (link.startsWith('/') ? navigate(link) : window.open(link, '_blank', 'noopener'));

  return (
    <div className="site-bars" ref={ref}>
      <AnimatePresence initial={false}>
        {m?.ownerView && (
          <Bar key="owner" tone="warn" live title="Maintenance mode is on."
               text="Customers see “We’ll be back soon”. You see the shop because you’re signed in to the admin." />
        )}
        {showA && (
          <Bar key={keyOf(a)} tone={a.tone} icon={a.tone === 'ok' ? <Megaphone /> : null} title={a.title} text={a.text}
               onClose={() => { writeStore('masq:announce-closed', keyOf(a)); setClosed(keyOf(a)); }}>
            {a.button && (
              <button type="button" className={`announce__cta${a.tone === 'ok' ? ' announce__cta--solid' : ''}`}
                      onClick={() => (a.link ? go(a.link) : setMore(true))}>{a.button}</button>
            )}
          </Bar>
        )}
        {notice && hidden !== noticeKey && (
          <Bar key={noticeKey} tone="warn" icon={<Cog />} title="We’re currently performing maintenance."
               text={notice.message || 'Some features may be unavailable. We’ll be back to normal shortly.'}
               onClose={() => hide(noticeKey)} />
        )}
        {soon && hidden !== soonKey && (
          <Bar key={soonKey} tone="warn" icon={<Spanner />}
               title={within ? 'Scheduled maintenance starts in' : 'Scheduled maintenance'}
               text={within ? 'Some features may be unavailable during this time.'
                 : `Our site will be undergoing maintenance on ${lagos(soon.startsAt, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} from ${lagos(soon.startsAt, { hour: '2-digit', minute: '2-digit' })} – ${lagos(soon.endsAt, { hour: '2-digit', minute: '2-digit' })} WAT.`}
               onClose={() => hide(soonKey)}>
            {within && <Countdown to={soon.startsAt} onEnd={loadCatalogue} />}
          </Bar>
        )}
      </AnimatePresence>
      {a?.details && (
        <Dialog open={more} tone="info" labelledBy="announceMore" onClose={() => setMore(false)}>
          <StateMark tone="info" size="lg" />
          <h2 className="state-panel__title" id="announceMore">{a.title}</h2>
          <p className="state-panel__note state-panel__note--pre">{a.details}</p>
          <button type="button" className="btn btn--contrast btn--block" onClick={() => setMore(false)}>GOT IT</button>
        </Dialog>
      )}
    </div>
  );
}

/* --------------------------------------------------------- maintenance */

const downtime = (min) => !min ? null
  : min < 60 ? `about ${min} minute${min === 1 ? '' : 's'}`
  : min < 60 * 24 ? `about ${Math.round(min / 60)} hour${Math.round(min / 60) === 1 ? '' : 's'}`
  : `about ${Math.round(min / 1440)} day${Math.round(min / 1440) === 1 ? '' : 's'}`;

/* The spanner, drawing itself in, then a slow turn now and then: work going on. */
function ToolsMark() {
  const calm = useReducedMotion();
  const draw = (d) => calm ? {} : { initial: { pathLength: 0, opacity: 0 }, animate: { pathLength: 1, opacity: 1 }, transition: { duration: 0.6, delay: d, ease: EASE_OUT } };
  return (
    <span className="state-mark state-mark--lg state-mark--wait tools-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <motion.circle cx="12" cy="12" r="10.6" strokeWidth="1.1" transform="rotate(-90 12 12)" {...draw(0)} />
        <motion.g style={{ originX: '50%', originY: '50%' }}
                  animate={calm ? undefined : { rotate: [0, 0, -18, 0] }}
                  transition={{ duration: 3.2, times: [0, 0.7, 0.85, 1], repeat: Infinity, ease: 'easeInOut', delay: 1 }}>
          <motion.path strokeWidth="1.5" d="M14.7 7.6a3 3 0 0 0-3.9 3.9l-3.6 3.6a1.1 1.1 0 0 0 1.6 1.6l3.6-3.6a3 3 0 0 0 3.9-3.9l-1.8 1.8-1.4-.3-.3-1.4z" {...draw(0.35)} />
        </motion.g>
      </svg>
    </span>
  );
}

export function Maintenance({ message, minutes }) {
  const { site } = useShop();
  const social = SOCIAL.filter(([key]) => site?.social?.[key]);
  const [joined, setJoined] = useState(false);
  useEffect(() => {
    const was = document.title;
    document.title = 'We’ll be back soon — MASQ.';
    return () => { document.title = was; };
  }, []);
  return (
    <div className="status maintenance">
      <header className="status__bar"><Link to="/" className="logo"><Wordmark /></Link></header>
      <motion.main className="status__panel status__panel--wait" id="main" tabIndex={-1}
                   initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                   transition={{ duration: 0.45, ease: EASE_OUT }}>
        <StateArt tone="wait" />
        <div className="status__inner">
          <div className="status__head">
            <ToolsMark />
            <h1 className="status__title">We’ll be back soon</h1>
            <p className="status__note">{message || 'We’re making some improvements to the shop. Thank you for your patience.'}</p>
          </div>
          {downtime(minutes) && (
            <p className="maintenance__eta"><span className="pill">Estimated downtime</span> {downtime(minutes)}</p>
          )}
          <div className="maintenance__join">
            <p className="maintenance__lead">{joined ? 'You’re on the list.' : 'Join the list to hear about the next drop.'}</p>
            {!joined && <JoinForm id="maintenance-email" onJoined={() => setJoined(true)} />}
          </div>
          {social.length > 0 && (
            <div className="footer__social maintenance__social">
              {social.map(([key, label, Icon]) => (
                <a key={key} href={site.social[key]} target="_blank" rel="noopener noreferrer" aria-label={`MASQ. on ${label}`}><Icon /></a>
              ))}
            </div>
          )}
        </div>
      </motion.main>
    </div>
  );
}
