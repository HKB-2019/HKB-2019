import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useShop } from '../store/ShopContext.jsx';
import { scrollToId } from '../lib/scroll.js';
import { CURRENCIES } from '../data/catalogue.js';
import { ChevronDown, AccountIcon, BagIcon } from './Icons.jsx';

const LINKS = [
  { href: '#drop',       label: 'SHOP' },
  { href: '#essentials', label: 'COLLECTIONS' },
  { href: '#craft',      label: 'ABOUT' },
  { href: '#film',       label: 'JOURNAL' }
];

export default function Header() {
  const { cartQty, currency, setCurrency, openOverlay } = useShop();
  const [stuck, setStuck]       = useState(false);
  const [active, setActive]     = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [curOpen, setCurOpen]   = useState(false);
  const curRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.pageYOffset > 24);
      let current = '';
      for (const { href } of LINKS) {
        const el = document.querySelector(href);
        if (el && el.getBoundingClientRect().top <= 140) current = href;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!curOpen) return;
    const onDown = (e) => { if (!curRef.current?.contains(e.target)) setCurOpen(false); };
    const onKey  = (e) => { if (e.key === 'Escape') setCurOpen(false); };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [curOpen]);

  const go = (e, href) => {
    e.preventDefault();
    scrollToId(href);
    setMenuOpen(false);
  };

  return (
    <header className={`header${stuck ? ' is-stuck' : ''}`}>
      <div className="header__inner">
        <button
          className="burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span />
        </button>

        <a href="#top" className="logo" onClick={(e) => go(e, '#top')}>MASQ<span>.</span></a>

        <nav className="nav" aria-label="Primary">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className={`nav__link${active === href ? ' is-active' : ''}`}
              onClick={(e) => go(e, href)}
            >{label}</a>
          ))}
        </nav>

        <div className="utils">
          <div className={`currency${curOpen ? ' is-open' : ''}`} ref={curRef}>
            <button
              className="currency__btn"
              aria-haspopup="listbox"
              aria-expanded={curOpen}
              onClick={() => setCurOpen(o => !o)}
            >
              <span>{currency}</span>
              <ChevronDown />
            </button>
            <ul className="currency__menu" role="listbox" aria-label="Select currency">
              {Object.entries(CURRENCIES).map(([code, { symbol }]) => (
                <li
                  key={code}
                  role="option"
                  tabIndex={-1}
                  aria-selected={code === currency}
                  onClick={() => { setCurrency(code); setCurOpen(false); }}
                >{code}&nbsp;&nbsp;{symbol}</li>
              ))}
            </ul>
          </div>

          <button className="icon-btn" aria-label="Account" aria-haspopup="dialog"
                  onClick={() => openOverlay('account')}>
            <AccountIcon />
          </button>

          <button className="icon-btn cart-btn" aria-label="Open bag" aria-haspopup="dialog"
                  onClick={() => openOverlay('cart')}>
            <BagIcon />
            {/* the count springs when it changes, so adding to the bag registers */}
            <motion.span
              className="cart-count"
              key={cartQty}
              initial={{ y: '-45%', scale: 1 }}
              animate={{ y: '-45%', scale: [1, 1.45, 1] }}
              transition={{ duration: 0.34, ease: [0.22, 0.61, 0.36, 1] }}
            >{cartQty}</motion.span>
          </button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {menuOpen && (
          <motion.nav
            className="mobile-nav is-open"
            aria-label="Mobile"
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.42, ease: [0.33, 0.02, 0.18, 1] }}
          >
            {LINKS.map(({ href, label }) => (
              <a key={href} href={href} onClick={(e) => go(e, href)}>{label}</a>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
