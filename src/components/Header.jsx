import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { useSectionLink } from '../lib/useSectionLink.js';
import { NAV, NAV_TARGETS } from '../data/home.js';
import { CURRENCIES } from '../data/currencies.js';
import { jumpToTop } from '../lib/smoothScroll.js';
import { ChevronDown, AccountIcon, BagIcon, Heart, Sun, Moon } from './Icons.jsx';
import { useTheme } from '../lib/theme.js';
import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';
import Wordmark from './Wordmark.jsx';
import SwapIcon from './SwapIcon.jsx';

export default function Header() {
  const { theme, toggle } = useTheme();
  const { cartQty, currency, setCurrency, openOverlay, wishlist } = useShop();
  const { home, ready } = useHome();
  const { pathname } = useLocation();
  const goTo = useSectionLink();
  // The menu as the owner named it in the admin; hidden items left out.
  const LINKS = ready
    ? NAV.filter(k => home.nav[k]?.show !== false).map(k => ({ href: NAV_TARGETS[k], label: home.nav[k].label }))
    : [];
  const [stuck, setStuck]       = useState(false);
  const [active, setActive]     = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [curOpen, setCurOpen]   = useState(false);
  const curRef = useRef(null);

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.pageYOffset > 24);
      let current = '';
      for (const href of Object.values(NAV_TARGETS)) {
        const el = document.querySelector(href);
        if (el && el.getBoundingClientRect().top <= 140 && el.getBoundingClientRect().bottom > 140) current = href;
      }
      setActive(current);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname]);

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
    goTo(href);
    setMenuOpen(false);
  };

  return (
    // At the top of the home page the menu sits over the dark photo, so it
    // keeps the dark look there in either theme.
    <header className={`header${stuck ? ' is-stuck' : ''}${pathname === '/' && !stuck ? ' header--over-dark' : ''}`}>
      <div className="header__inner">
        <button
          className="burger"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(o => !o)}
        >
          <span /><span />
        </button>

        {pathname === '/'
          ? <a href="#top" className="logo" onClick={(e) => go(e, '#top')}><Wordmark /></a>
          : <Link to="/" className="logo" onClick={jumpToTop}><Wordmark alt="MASQ. home" /></Link>}

        <nav className="nav" aria-label="Primary">
          {LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={'/' + href}
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

          {/* Light or dark. On a phone it is in the menu: the bar is full. */}
          <button className="icon-btn theme-btn" onClick={toggle}
                  aria-label={theme === 'light' ? 'Switch to the dark theme' : 'Switch to the light theme'}>
            <SwapIcon swap={theme}>{theme === 'light' ? <Moon /> : <Sun />}</SwapIcon>
          </button>

          <button className="icon-btn saved-btn" aria-label={`Saved pieces (${wishlist.length})`} aria-haspopup="dialog"
                  onClick={() => openOverlay('saved')}>
            <Heart />
            {wishlist.length > 0 && <span className="saved-count" aria-hidden="true">{wishlist.length}</span>}
          </button>

          <button className="icon-btn" aria-label="Track an order" aria-haspopup="dialog"
                  onClick={() => openOverlay('track')}>
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
            // Revealed downwards by a clip, not grown: animating height
            // re-lays out the menu on every frame.
            initial={{ clipPath: 'inset(0 0 100% 0)', opacity: 0 }}
            animate={{ clipPath: 'inset(0 0 0% 0)', opacity: 1 }}
            exit={{ clipPath: 'inset(0 0 100% 0)', opacity: 0, transition: { duration: UI_OUT, ease: EASE_OUT } }}
            transition={{ duration: UI_IN, ease: EASE_OUT }}
          >
            {LINKS.map(({ href, label }) => (
              <a key={href} href={'/' + href} onClick={(e) => go(e, href)}>{label}</a>
            ))}
            <button type="button" className="mobile-nav__theme" onClick={toggle}>
              <SwapIcon swap={theme}>{theme === 'light' ? <Moon /> : <Sun />}</SwapIcon>
              {theme === 'light' ? 'Dark theme' : 'Light theme'}
            </button>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
