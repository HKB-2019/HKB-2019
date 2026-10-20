import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import StateMark from './StateMark.jsx';
import StateArt from './StateArt.jsx';
import Wordmark from './Wordmark.jsx';
import { Close } from './Icons.jsx';
import { JoinForm } from './Newsletter.jsx';
import { SOCIAL } from './Footer.jsx';
import { readStore, writeStore } from '../lib/storage.js';
import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';

/* The owner's banners across the top of the shop, set in Settings: news
 * (blue), good news (green) or a warning (amber). A closed one stays closed
 * until the owner changes what it says. The header and the page move down
 * to make room (--announce-h), and back up when it goes. */

const TONES = { info: 'info', ok: 'ok', warn: 'warn' };
const keyOf = (a) => `${a.tone}|${a.title}|${a.text}`;

function Bar({ tone, title, text, onClose, live }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = () => document.documentElement.style.setProperty('--announce-h', `${el.offsetHeight}px`);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.setProperty('--announce-h', '0px'); };
  }, []);
  return (
    <motion.div ref={ref} className={`announce announce--${tone}`} role={live ? 'status' : 'region'} aria-label={live ? undefined : 'Announcement'}
                initial={{ y: '-100%' }} animate={{ y: 0 }} exit={{ y: '-100%', transition: { duration: UI_OUT, ease: EASE_OUT } }}
                transition={{ duration: 0.4, ease: EASE_OUT }}>
      <div className="announce__inner">
        <StateMark tone={tone} delay={0.25} />
        <p className="announce__text"><strong>{title}</strong>{text && <span> {text}</span>}</p>
        {onClose && (
          <button type="button" className="announce__close" aria-label="Close announcement" onClick={onClose}><Close /></button>
        )}
      </div>
    </motion.div>
  );
}

export function SiteBar() {
  const { site } = useShop();
  const a = site?.announcement;
  const m = site?.maintenance;
  const [closed, setClosed] = useState(() => readStore('masq:announce-closed', ''));
  const showA = a && TONES[a.tone] && closed !== keyOf(a);
  // The owner, signed in, sees the shop while it is closed: said so here.
  const owner = m?.ownerView;
  return (
    <AnimatePresence onExitComplete={() => document.documentElement.style.setProperty('--announce-h', '0px')}>
      {owner ? (
        <Bar key="owner" tone="warn" live title="Maintenance mode is on."
             text="Customers see “We’ll be back soon”. You see the shop because you’re signed in to the admin." />
      ) : showA ? (
        <Bar key={keyOf(a)} tone={a.tone} title={a.title} text={a.text}
             onClose={() => { writeStore('masq:announce-closed', keyOf(a)); setClosed(keyOf(a)); }} />
      ) : null}
    </AnimatePresence>
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
