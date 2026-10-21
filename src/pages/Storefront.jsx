import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigationType, useSearchParams } from 'react-router-dom';
import ShopLayout from '../components/ShopLayout.jsx';
import Hero from '../components/Hero.jsx';
import CraftBand from '../components/CraftBand.jsx';
import DropGrid from '../components/DropGrid.jsx';
import Manifesto from '../components/Manifesto.jsx';
import FilmStrip from '../components/FilmStrip.jsx';
import Essentials from '../components/Essentials.jsx';
import Newsletter from '../components/Newsletter.jsx';
import Perks from '../components/Perks.jsx';
import DropCountdown from '../components/DropCountdown.jsx';
import { useShop, useHome } from '../store/ShopContext.jsx';
import { scrollToId } from '../lib/scroll.js';
import { jumpTo } from '../lib/smoothScroll.js';
import { welcomeSeen, markWelcome } from '../lib/welcome.js';

// Someone who closed the welcome pop-up is asked again after this long; someone who joined, never.
const ASK_AGAIN_MS = 30 * 24 * 3_600_000;

export default function Storefront() {
  const { openOverlay, overlay, catalogueStatus } = useShop();
  const { home, ready } = useHome();
  const { hash, key } = useLocation();
  const how = useNavigationType();

  // Leaving for a piece's page: note where they were, against this visit to
  // the page (each entry in the browser's history has its own key). Taken as
  // the page is removed, before the product page moves to its top.
  useLayoutEffect(() => () => {
    try {
      sessionStorage.setItem(`masq:spot:${key}`, JSON.stringify({
        y: window.scrollY,
        all: Boolean(document.querySelector('#drop .link-arrow[aria-expanded="true"]'))
      }));
    } catch { /* private window: back lands at the top, as before */ }
  }, [key]);

  // Coming back (BACK on a piece's page, or the browser's back): the same
  // spot, with VIEW ALL still open if it was — once the sections below the
  // hero are their full height.
  const [spot] = useState(() => {
    if (how !== 'POP') return null;
    try { return JSON.parse(sessionStorage.getItem(`masq:spot:${key}`)); } catch { return null; }
  });
  const returned = useRef(false);
  useEffect(() => {
    if (!spot || returned.current || !ready || catalogueStatus !== 'ready') return;
    returned.current = true;
    if (spot.all) window.dispatchEvent(new CustomEvent('masq:expand-drop'));
    requestAnimationFrame(() => requestAnimationFrame(() => jumpTo(spot.y)));
  }, [spot, ready, catalogueStatus]);

  // The welcome pop-up: the mailing list, offered to a first-time visitor a
  // few seconds after they land (the owner sets how many, or switches it off,
  // in the admin). Never over another panel, and never twice: it is noted as
  // shown the moment it opens.
  const welcome = home.welcome;
  useEffect(() => {
    if (!ready || !welcome?.show || overlay) return;
    const seen = welcomeSeen();
    if (seen && (seen.state === 'joined' || Date.now() - seen.at < ASK_AGAIN_MS)) return;
    const timer = setTimeout(() => {
      markWelcome('shown');
      openOverlay('welcome');
    }, welcome.delay * 1000);
    return () => clearTimeout(timer);
  }, [ready, welcome?.show, welcome?.delay, overlay, openOverlay]);

  // The big photos drift as the page scrolls (src/lib/drift.js), fetched
  // once the page is showing, and not at all on a device set to reduce motion.
  useEffect(() => {
    if (!ready || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let stop, gone = false;
    import('../lib/drift.js')
      .then(m => { if (!gone) stop = m.startDrift(document.getElementById('main')); })
      .catch(() => {});
    return () => { gone = true; stop?.(); };
  }, [ready]);

  // "Back to your bag" from an unfinished payment lands with the bag open.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    // A link from an email to one of the shop's pages ("/?page=contact").
    const page = String(params.get('page') ?? '').toUpperCase().replace(/-/g, '_');
    if (['FAQ', 'SHIPPING', 'RETURNS', 'CONTACT', 'PRIVACY', 'SIZE_GUIDE', 'TERMS'].includes(page)) {
      openOverlay({ info: page });
      params.delete('page');
      setParams(params, { replace: true });
      return;
    }
    const bag = params.get('bag');
    if (bag !== 'open' && bag !== 'checkout') return;
    // "Use a different payment method": straight to the delivery step.
    openOverlay(bag === 'checkout' ? 'checkout' : 'cart');
    params.delete('bag');
    setParams(params, { replace: true });
  }, [params, setParams, openOverlay]);

  // Arriving from a product page's menu ("/#drop"): wait until the products
  // are in, so the sections are their full height, then go to the one asked for.
  const landed = useRef(null);
  useEffect(() => {
    if (!hash || spot || catalogueStatus === 'loading' || catalogueStatus === 'idle' || landed.current === hash) return;
    landed.current = hash;
    requestAnimationFrame(() => scrollToId(hash));
  }, [hash, spot, catalogueStatus]);

  return (
    <ShopLayout>
      <span id="top" />
      <Hero />
      <CraftBand />
      <DropCountdown />
      <DropGrid />
      <Manifesto />
      <FilmStrip />
      <Essentials />
      <Perks />
      <Newsletter />
    </ShopLayout>
  );
}
