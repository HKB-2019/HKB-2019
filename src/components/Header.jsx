import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { useSectionLink } from '../lib/useSectionLink.js';
import { NAV, NAV_TARGETS } from '../data/home.js';
import { CURRENCIES } from '../data/currencies.js';
import { jumpToTop } from '../lib/smoothScroll.js';
import { ChevronDown, AccountIcon, BagIcon, Heart, Sun, Moon, SearchIcon, Truck } from './Icons.jsx';
import { useTheme } from '../lib/theme.js';
import { EASE_OUT, UI_IN, UI_OUT } from '../lib/motion.js';
import Wordmark from './Wordmark.jsx';
import SwapIcon from './SwapIcon.jsx';
import { useAccount, initialsOf } from '../store/AccountContext.jsx';
import { ShopMenu, CollectionsMenu, MobileShopLinks } from './MegaMenu.jsx';

// The menu items that open a wide menu under them (MegaMenu.jsx).
const MEGA = { shop: ShopMenu, collections: CollectionsMenu };

export default function Header() {
  const { theme, toggle } = useTheme();
  const { cartQty, currency, setCurrency, openOverlay, wishlist } = useShop();
  const { account, status: accountStatus } = useAccount();
  const accountsOn = accountStatus === 'in' || accountStatus === 'out';
  const { home, ready } = useHome();
  const { pathname } = useLocation();
  const goTo = useSectionLink();
  // The menu as the owner named it in the admin; hidden items left out.
  const LINKS = ready
    ? NAV.filter(k => home.nav[k]?.show !== false).map(k => ({ key: k, href: NAV_TARGETS[k], label: home.nav[k].label }))
    : [];
  const [stuck, setStuck]       = useState(false);
  const [active, setActive]     = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [curOpen, setCurOpen]   = useState(false);
  const curRef = useRef(null);
  // The wide menu open under SHOP or COLLECTIONS, and which one is open on a phone.
  const [mega, setMega] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(null);
  const megaTimer = useRef(null);
  const megaRef = useRef(null);
  const openSoon = (key) => { clearTimeout(megaTimer.current); megaTimer.current = setTimeout(() => setMega(key), mega ? 0 : 90); };
  const closeSoon = () => { clearTimeout(megaTimer.current); megaTimer.current = setTimeout(() => setMega(null), 180); };
  const closeMega = () => { clearTimeout(megaTimer.current); setMega(null); };
  useEffect(() => { closeMega(); setMobileOpen(null); }, [pathname]);
  useEffect(() => () => clearTimeout(megaTimer.current), []);
  useEffect(() => {
    if (!mega) return;
    const onKey = (e) => { if (e.key === 'Escape') { closeMega(); megaRef.current?.querySelector(`[data-mega="${mega}"]`)?.focus(); } };
    const onDown = (e) => { if (!megaRef.current?.contains(e.target)) closeMega(); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [mega]);
  const hoverable = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches;
  const Mega = mega ? MEGA[mega] : null;

  useEffect(() => {
    const onScroll = () => {
      setStuck(window.pageYOffset > 24);
      let current = '';
      for (const href of Object.values(NAV_TARGETS)) {
        if (!href.startsWith('#')) continue;
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
    // At the top of the home page and the Journal's pages the menu sits over
    // a dark photo, so it keeps the dark look there in either theme.
    <header ref={megaRef}
            className={`header${stuck ? ' is-stuck' : ''}${mega ? ' has-mega' : ''}${(pathname === '/' || pathname.startsWith('/journal') || pathname === '/about' || pathname.startsWith('/shop') || pathname.startsWith('/collections')) && !stuck && !mega ? ' header--over-dark' : ''}`}
            onMouseLeave={hoverable ? closeSoon : undefined}>
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
          {LINKS.map(({ key, href, label }) => {
            const here = active === href || (href.startsWith('/') && pathname.startsWith(href));
            const link = (
              <a
                key={href}
                href={href.startsWith('/') ? href : '/' + href}
                className={`nav__link${here || mega === key ? ' is-active' : ''}`}
                aria-current={href.startsWith('/') && pathname === href ? 'page' : undefined}
                onClick={(e) => { closeMega(); go(e, href); }}
              >{label}</a>
            );
            if (!MEGA[key]) return link;
            // The name opens its page; the arrow beside it (or pointing at it)
            // opens the wide menu.
            return (
              <span key={href} className="nav__item" onMouseEnter={hoverable ? () => openSoon(key) : undefined}>
                {link}
                <button type="button" className={`nav__more${mega === key ? ' is-open' : ''}`} data-mega={key}
                        aria-expanded={mega === key} aria-controls="mega" aria-label={`More in ${label}`}
                        onClick={() => (mega === key ? closeMega() : setMega(key))}>
                  <ChevronDown />
                </button>
              </span>
            );
          })}
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

          <button className="icon-btn search-btn" aria-label="Search the shop" aria-haspopup="dialog"
                  onClick={() => openOverlay('search')}>
            <SearchIcon />
          </button>

          <button className="icon-btn saved-btn" aria-label={`Saved pieces (${wishlist.length})`} aria-haspopup="dialog"
                  onClick={() => openOverlay('saved')}>
            <Heart />
            {wishlist.length > 0 && <span className="saved-count" aria-hidden="true">{wishlist.length}</span>}
          </button>

          {/* With accounts: the customer's own pages (or sign in). Without: track an order. */}
          {accountsOn ? (
            <Link to="/account" className={`icon-btn account-btn${account ? ' is-in' : ''}`}
                  aria-label={account ? `Your account (${account.name})` : 'Sign in'}>
              {account ? <span className="account-btn__initials" aria-hidden="true">{initialsOf(account.name, account.email)}</span> : <AccountIcon />}
            </Link>
          ) : (
            <button className="icon-btn track-btn" aria-label="Track an order" aria-haspopup="dialog"
                    onClick={() => openOverlay('track')}>
              <Truck />
            </button>
          )}

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

      <AnimatePresence>
        {Mega && (
          <motion.div id="mega" className="mega" key="mega"
                      onMouseEnter={hoverable ? () => clearTimeout(megaTimer.current) : undefined}
                      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6, transition: { duration: UI_OUT, ease: EASE_OUT } }}
                      transition={{ duration: UI_IN, ease: EASE_OUT }}>
            <div className="mega__panel">
              <Mega onGo={closeMega} pathname={pathname} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
            {LINKS.map(({ key, href, label }) => (MEGA[key] ? (
              <div key={href} className={`mobile-nav__group${mobileOpen === key ? ' is-open' : ''}`}>
                <div className="mobile-nav__row">
                  <a href={href} onClick={(e) => go(e, href)}>{label}</a>
                  <button type="button" aria-expanded={mobileOpen === key} aria-label={`More in ${label}`}
                          onClick={() => setMobileOpen(o => (o === key ? null : key))}><ChevronDown /></button>
                </div>
                {mobileOpen === key && <MobileShopLinks which={key} onGo={() => setMenuOpen(false)} />}
              </div>
            ) : (
              <a key={href} href={href.startsWith('/') ? href : '/' + href} onClick={(e) => go(e, href)}>{label}</a>
            )))}
            {/* On a small phone the bar has no room for it: here instead. */}
            {accountsOn && (
              <Link to="/account" className="mobile-nav__theme mobile-nav__account" onClick={() => setMenuOpen(false)}>
                <AccountIcon /> {account ? 'Your account' : 'Sign in'}
              </Link>
            )}
            <button type="button" className={`mobile-nav__theme${accountsOn ? '' : ' mobile-nav__track'}`} onClick={() => { setMenuOpen(false); openOverlay('track'); }}>
              <Truck /> Track an order
            </button>
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
