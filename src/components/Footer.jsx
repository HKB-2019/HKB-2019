import { useShop } from '../store/ShopContext.jsx';
import { scrollToId } from '../lib/scroll.js';
import { Instagram, TikTok, XIcon } from './Icons.jsx';

const INFO_LINKS = ['FAQ', 'SHIPPING', 'RETURNS', 'CONTACT'];

export default function Footer() {
  const { openOverlay } = useShop();
  return (
    <footer className="footer">
      <div className="footer__inner">
        <nav className="footer__links" aria-label="Footer">
          <a href="#craft" onClick={(e) => { e.preventDefault(); scrollToId('#craft'); }}>ABOUT</a>
          {INFO_LINKS.map(title => (
            <a key={title} href="#"
               onClick={(e) => { e.preventDefault(); openOverlay({ info: title }); }}>{title}</a>
          ))}
        </nav>

        <div className="footer__social">
          <a href="#" aria-label="MASQ. on Instagram"><Instagram /></a>
          <a href="#" aria-label="MASQ. on TikTok"><TikTok /></a>
          <a href="#" aria-label="MASQ. on X"><XIcon /></a>
        </div>

        <p className="footer__copy">© 2024 MASQ. ALL RIGHTS RESERVED.</p>
      </div>
    </footer>
  );
}
