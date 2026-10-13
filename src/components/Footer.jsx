import { useShop, useHome } from '../store/ShopContext.jsx';
import { useSectionLink } from '../lib/useSectionLink.js';
import { Instagram, TikTok, XIcon } from './Icons.jsx';
import Lines from './Lines.jsx';

/* The footer, in groups a shopper scans for: the shop itself, help with an
 * order, and the small print. Pages open in a panel; shop links go to their
 * part of the home page from wherever the shopper is. */

const SOCIAL = [
  ['instagram', 'Instagram', Instagram],
  ['tiktok', 'TikTok', TikTok],
  ['x', 'X', XIcon]
];

export default function Footer() {
  const { openOverlay, site } = useShop();
  const { home } = useHome();
  const goTo = useSectionLink();
  // Only links the owner has set in the admin. An icon that goes nowhere is
  // worse than no icon.
  const social = SOCIAL.filter(([key]) => site?.social?.[key]);

  const section = (hash, label) => (
    <li><a href={`/${hash}`} onClick={(e) => { e.preventDefault(); goTo(hash); }}>{label}</a></li>
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
          <a href="/#top" className="footer__logo" onClick={(e) => { e.preventDefault(); goTo('#top'); }}>MASQ<span>.</span></a>
          <p className="footer__tagline"><Lines text={home.heroSub} /></p>
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
              {section('#drop', 'The drop')}
              {section('#essentials', 'The Essentials')}
              {section('#craft', 'About MASQ.')}
              {panel('saved', 'Saved pieces')}
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
      </div>
    </footer>
  );
}
