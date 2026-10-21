import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { useSectionLink } from '../lib/useSectionLink.js';
import { Instagram, TikTok, XIcon, Speaker } from './Icons.jsx';
import Lines from './Lines.jsx';
import Wordmark from './Wordmark.jsx';
import { JoinForm } from './Newsletter.jsx';
import { soundOn, setSoundOn, onSoundChange, tick } from '../lib/sound.js';

/* The footer, in groups a shopper scans for: the shop itself, help with an
 * order, and the small print. Pages open in a panel; shop links go to their
 * part of the home page from wherever the shopper is. */

export const SOCIAL = [
  ['instagram', 'Instagram', Instagram],
  ['tiktok', 'TikTok', TikTok],
  ['x', 'X', XIcon]
];

/** Sounds on or off: the shop plays a soft tick or chime for good news; a
 *  shopper who would rather not hear them turns them off here, for good. */
function SoundSwitch() {
  const [on, setOn] = useState(soundOn);
  useEffect(() => onSoundChange(setOn), []);
  const flip = () => { setSoundOn(!on); if (!on) tick(); };   // turned on: a tick to show it
  return (
    <button type="button" className="footer__sound" aria-pressed={on} onClick={flip}>
      <Speaker on={on} /> Sounds {on ? 'on' : 'off'}
    </button>
  );
}

/* `join`: false on pages with a sign-up of their own (the Journal), so the
 * form is not there twice. */
export default function Footer({ join = true }) {
  const { openOverlay, site, toast } = useShop();
  const { home } = useHome();
  const goTo = useSectionLink();
  // Only links the owner has set in the admin. An icon that goes nowhere is
  // worse than no icon.
  const social = SOCIAL.filter(([key]) => site?.social?.[key]);

  const section = (hash, label) => (
    <li><a href={hash.startsWith('/') ? hash : `/${hash}`} onClick={(e) => { e.preventDefault(); goTo(hash); }}>{label}</a></li>
  );
  const page = (key, label) => (
    <li><button type="button" onClick={() => openOverlay({ info: key })}>{label}</button></li>
  );
  const panel = (which, label) => (
    <li><button type="button" onClick={() => openOverlay(which)}>{label}</button></li>
  );

  return (
    <footer className="footer">
      <div className="footer__inner">
        <div className="footer__brand">
          <a href="/#top" className="footer__logo" onClick={(e) => { e.preventDefault(); goTo('#top'); }}><Wordmark /></a>
          <p className="footer__tagline"><Lines text={home.heroSub} /></p>
          {/* The mailing list on every page, with the owner's email checks:
              "Looks good!" or "Please enter a valid email address." */}
          {join && <div className="footer__join">
            <h2 className="footer__head" id="footer-join">Join the list</h2>
            <p className="footer__join-note">New drops and restocks, before anyone else.</p>
            <JoinForm id="footer-email"
                      onJoined={() => toast({ tone: 'ok', title: 'You’re on the list', body: 'Welcome to the world of MASQ.' })} />
          </div>}
          {social.length > 0 && (
            <div className="footer__social">
              {social.map(([key, label, Icon]) => (
                <a key={key} href={site.social[key]} target="_blank" rel="noopener noreferrer"
                   aria-label={`MASQ. on ${label}`}><Icon /></a>
              ))}
            </div>
          )}
        </div>

        <nav className="footer__cols" aria-label="Footer">
          <div className="footer__col">
            <h2 className="footer__head">Shop</h2>
            <ul>
              {section('/shop', 'All products')}
              {section('/collections', 'Collections')}
              {section('/about', 'About MASQ.')}
              {panel('saved', 'Saved pieces')}
              <li><Link to="/gift-card">Gift cards</Link></li>
              <li><Link to="/gift-card?topup">Top up a gift card</Link></li>
            </ul>
          </div>
          <div className="footer__col">
            <h2 className="footer__head">Help</h2>
            <ul>
              {page('SIZE_GUIDE', 'Size guide')}
              {page('SHIPPING', 'Delivery')}
              {page('RETURNS', 'Returns')}
              {page('FAQ', 'FAQ')}
              {panel('track', 'Track an order')}
              {page('CONTACT', 'Contact')}
            </ul>
          </div>
          <div className="footer__col">
            <h2 className="footer__head">The small print</h2>
            <ul>
              {page('TERMS', 'Terms of sale')}
              {page('PRIVACY', 'Privacy')}
            </ul>
          </div>
        </nav>
      </div>

      <div className="footer__base">
        <p>© {new Date().getFullYear()} MASQ. All rights reserved.</p>
        <p><span>Prices in naira</span> · <span>Payments secured by Paystack</span></p>
        <SoundSwitch />
      </div>
    </footer>
  );
}
