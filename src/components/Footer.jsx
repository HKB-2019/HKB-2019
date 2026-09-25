import { useShop } from '../store/ShopContext.jsx';
import { scrollToId } from '../lib/scroll.js';
import { Instagram, TikTok, XIcon } from './Icons.jsx';

const INFO_LINKS = ['FAQ', 'SHIPPING', 'RETURNS', 'CONTACT', 'PRIVACY'];

const SOCIAL = [
  ['instagram', 'Instagram', Instagram],
  ['tiktok', 'TikTok', TikTok],
  ['x', 'X', XIcon]
];

export default function Footer() {
  const { openOverlay, site } = useShop();
  // Only links the owner has set in the admin. An icon that goes nowhere is
  // worse than no icon.
  const social = SOCIAL.filter(([key]) => site?.social?.[key]);

  return (
    <footer className="footer">
      <div className="footer__inner">
        <nav className="footer__links" aria-label="Footer">
          <a href="#craft" onClick={(e) => { e.preventDefault(); scrollToId('#craft'); }}>ABOUT</a>
          {INFO_LINKS.map(title => (
            <button key={title} type="button" className="footer__link"
                    onClick={() => openOverlay({ info: title })}>{title}</button>
          ))}
        </nav>

        <div className="footer__social">
          {social.map(([key, label, Icon]) => (
            <a key={key} href={site.social[key]} target="_blank" rel="noopener noreferrer"
               aria-label={`MASQ. on ${label}`}><Icon /></a>
          ))}
        </div>

        <p className="footer__copy">© {new Date().getFullYear()} MASQ. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  );
}
