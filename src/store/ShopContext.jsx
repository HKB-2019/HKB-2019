import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CURRENCIES, currencies } from '../data/currencies.js';
import { readStore, writeStore } from '../lib/storage.js';
import { getProducts, getSite } from '../lib/api.js';
import { HOME_DEFAULT } from '../data/home.js';
import { track } from '../lib/analytics.js';
import { holdSmoothScroll } from '../lib/smoothScroll.js';
import { hasColours, sizesFor, photoFor, optionLabel } from '../lib/colours.js';
import { tick } from '../lib/sound.js';

/* One place for everything the shop needs to remember: the catalogue and site
 * settings from the server, the bag, the saved list, the chosen currency,
 * which overlay is open and any toasts in flight.
 *
 * The catalogue is the server's. The bag lives in localStorage between
 * visits, so it can hold yesterday's prices and pieces that have since sold
 * out — it is checked against the catalogue every time that loads. */

const MAX_PER_LINE = 10;     // the server refuses more than this per line

const ShopContext = createContext(null);

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>');
  return ctx;
}

/**
 * The home page's words and photos, as the owner set them in the admin.
 * `ready` stays false until they have arrived, so the design's own words do
 * not flash up first and then change. If the server cannot be reached, the
 * design's words are used.
 */
export function useHome() {
  const { site, catalogueStatus } = useShop();
  return {
    home: site?.home ?? HOME_DEFAULT,
    images: site?.home?.images ?? {},
    ready: Boolean(site) || catalogueStatus === 'error'
  };
}

/** How many of one colour and size may go in the bag: the per-line cap, or fewer if stock is low. */
function maxFor(product, size, colour = '') {
  // A piece sold in colours is bought in one of them; without colours, in none.
  if (!product || hasColours(product) !== Boolean(colour)) return 0;
  const s = sizesFor(product, colour).find(x => x.size === size);
  if (!s || !s.available) return 0;
  return Math.min(MAX_PER_LINE, s.left ?? MAX_PER_LINE);
}

export function ShopProvider({ children }) {
  const [cart, setCart]         = useState(() => readStore('masq:cart', []));
  const [wishlist, setWishlist] = useState(() => readStore('masq:wishlist', []));
  const [currency, setCurrency] = useState(() => readStore('masq:currency', 'NGN'));
  const [overlay, setOverlay]   = useState(null);   // 'cart' | 'saved' | 'track' | 'film' | {info:'FAQ'}
  const [toasts, setToasts]     = useState([]);
  const toastId = useRef(0);

  const [products, setProducts] = useState([]);
  const [site, setSite]         = useState(null);
  const [status, setStatus]     = useState('idle');   // idle | loading | ready | error
  const [catalogueError, setCatalogueError] = useState(null);   // what went wrong, for View details

  // Kept while the bag is open and closed, so a customer who steps back to
  // change their bag does not have to type their address again. Memory only:
  // an address has no business sitting in localStorage on a shared phone.
  const [delivery, setDelivery] = useState({
    email: '', name: '', phone: '',
    address: { line1: '', line2: '', city: '', state: '', postcode: '', country: 'Nigeria' }
  });

  // A discount code typed in the bag: kept for this visit only, and checked
  // with the server again whenever the bag changes.
  const [discountCode, setDiscountCode] = useState('');

  useEffect(() => writeStore('masq:cart', cart), [cart]);
  useEffect(() => writeStore('masq:wishlist', wishlist), [wishlist]);
  useEffect(() => writeStore('masq:currency', CURRENCIES[currency] ? currency : 'NGN'), [currency]);

  /* ------------------------------------------------------------- money */

  // The owner's rates once the site settings arrive; the starting ones before.
  const rates = site?.rates;
  const format = useCallback((naira) => {
    const table = currencies(rates);
    const c = table[currency] || table.NGN;
    return c.symbol + (naira * c.rate).toLocaleString('en-US', {
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals
    });
  }, [currency, rates]);

  /* ------------------------------------------------------------ toasts */

  /* A toast is { title, body?, img?, tone?, action?, ms?, key? }. tone: 'ok'
   * (it worked), 'bad' (it did not), 'warn' (worth a look), 'info' (news), or
   * none. action: { label, onClick }, a button on the card (Undo, View bag).
   * ms: how long it stays, longer for a problem; null keeps it until it is
   * dismissed. key: a new one with the same key replaces the old. A plain
   * string is a title. At most three at once.
   *   undo   { onUndo, done }: Undo with its seconds counting down in a ring
   *          (10 seconds); undone, a second card says so (`done`).
   *   once   a name: shown once a visit, never again until the next (tips,
   *          news that is not urgent).
   *   sign   'promo' (a drop, an offer) or 'tip' (a hint): the mark's sign.
   *   busy   a turning ring in place of the mark (Retrying…). */
  const toast = useCallback((message, tone) => {
    const t = typeof message === 'string' ? { title: message, tone } : { ...message };
    if (t.once) {
      try {
        if (sessionStorage.getItem(`masq:once:${t.once}`)) return;
        sessionStorage.setItem(`masq:once:${t.once}`, '1');
      } catch { /* private window: shown, not remembered */ }
    }
    if (t.undo) {
      const { onUndo, done } = t.undo;
      t.undo = { onUndo: () => { onUndo(); toast({ key: t.key, tone: 'ok', title: done ?? 'Restored.' }); } };
    }
    const id = ++toastId.current;
    const ms = t.ms === null ? null : t.ms ?? (t.undo ? 10000 : t.tone === 'bad' ? 6000 : t.action ? 6000 : 4500);
    setToasts(list => [...list.filter(x => !t.key || x.key !== t.key).slice(-2), { ...t, id, ms }]);
    if (t.tone === 'ok' && !t.busy) tick();
  }, []);

  /* Something that did not go, with Retry: "Retrying…" while it runs, then
   * done, or "Still having trouble" after two misses, and after three a way
   * to contact us instead of trying again (no hammering the server).
   *   { key, title, body?, run, done: { title, body? } } */
  const failed = useCallback(({ key, title, body, run, done }) => {
    const miss = (n, err) => toast({
      key, tone: 'bad', ms: null,
      title: n >= 2 ? 'Still having trouble.' : title,
      body: n >= 2 ? 'Please try again or contact us.' : (body ?? err?.message),
      action: n < 3 ? { label: 'Retry', onClick: () => attempt(n) } : { label: 'Contact us', onClick: () => setOverlay({ info: 'CONTACT' }) }
    });
    const attempt = async (n) => {
      toast({ key, busy: true, tone: 'info', title: 'Retrying…', body: 'Please wait while we try again.', ms: null });
      try { await run(); toast({ key, tone: 'ok', title: done?.title ?? 'Done.', body: done?.body }); }
      catch (err) { miss(n + 1, err); }
    };
    miss(0);
  }, [toast]);
  const dismissToast = useCallback((id) => setToasts(list => list.filter(x => x.id !== id)), []);

  /* Offline: said once, and kept until the connection is back. */
  useEffect(() => {
    const off = () => toast({ key: 'net', tone: 'bad', title: 'You’re offline', body: 'Please check your internet connection and try again.', ms: null });
    const on = () => toast({ key: 'net', tone: 'ok', title: 'Back online', body: 'You’re connected again.' });
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    return () => { window.removeEventListener('offline', off); window.removeEventListener('online', on); };
  }, [toast]);

  /* --------------------------------------------------------- catalogue */

  // Loaded on every page visit, so an admin change shows at once. Once there
  // is a catalogue, a refresh happens quietly behind it rather than blanking
  // the page back to placeholders.
  const loadCatalogue = useCallback(async () => {
    setStatus(s => (s === 'ready' ? s : 'loading'));
    try {
      const [p, s] = await Promise.all([getProducts(), getSite()]);
      setProducts(p);
      setSite(s);
      setStatus('ready');
      setCatalogueError(null);
    } catch (err) {
      setCatalogueError(err);
      setStatus(s => (s === 'ready' ? s : 'error'));
    }
  }, []);

  /* Check the bag against the catalogue whenever it loads. Anything gone is
   * removed, anything repriced takes the new price, and a quantity above what
   * is left comes down — each said out loud, once, so the customer is never
   * surprised at the payment page. */
  const lastChecked = useRef(null);
  useEffect(() => {
    if (status !== 'ready' || lastChecked.current === products) return;
    lastChecked.current = products;

    const notes = [];
    let changed = false;
    const next = [];
    for (const line of cart) {
      const p = products.find(x => x.id === line.id);
      const colour = line.colour ?? '';
      const what = optionLabel(colour, line.size);
      const max = maxFor(p, line.size, colour);
      if (!p || max === 0) {
        notes.push(p && hasColours(p) && !colour
          ? `${line.name} now comes in colours: choose yours again.`
          : `${line.name} (${what}) is no longer available, so it has been taken out.`);
        changed = true;
        continue;
      }
      const qty = Math.min(line.qty, max);
      if (qty !== line.qty) notes.push(`Only ${max} ${p.name} (${what}) left.`);
      if (p.price !== line.price) notes.push(`${p.name} is now ${format(p.price)}.`);
      const { img } = photoFor(p, colour);
      const updated = { ...line, name: p.name, price: p.price, img, qty };
      if (qty !== line.qty || p.price !== line.price || p.name !== line.name || img !== line.img) changed = true;
      next.push(updated);
    }
    if (changed) setCart(next);
    notes.slice(0, 3).forEach(n => toast({ tone: 'warn', title: 'Your bag has been updated', body: n }));
  }, [status, products, cart, format, toast]);

  const productById = useCallback((id) => products.find(p => p.id === id), [products]);

  /* --------------------------------------------------------------- bag */

  /* The owner's "Out of stock" panel, in place of a passing message: the
   * piece, and the two ways on (be told when it is back, see others). */
  const showSoldOut = useCallback((product, colour = '', size = '') => {
    const p = products.find(x => x.id === product.id) ?? product;
    setOverlay({ soldOut: {
      id: p.id, name: p.name, img: photoFor(p, colour).img ?? p.img, price: format(p.price),
      colour, size, everySize: Boolean(p.soldOut) || !size
    } });
  }, [products, format]);

  /* Returns what went in, or nothing if it could not. `quiet` leaves the
   * saying-so to the caller (the product page shows its own panel). */
  const addToCart = useCallback((product, size, colour = '', { quiet = false, qty = 1 } = {}) => {
    const p = products.find(x => x.id === product.id) ?? product;
    if (hasColours(p) && !colour) { toast({ tone: 'warn', title: 'Choose a colour first' }); return; }
    const what = optionLabel(colour, size);
    const max = maxFor(p, size, colour);
    if (max === 0) { showSoldOut(p, colour, size); return; }

    const key = `${p.id}|${colour}|${size}`;
    const existing = cart.find(i => i.key === key);
    if (existing && existing.qty >= max) {
      toast(max < MAX_PER_LINE
        ? { tone: 'warn', title: `Only ${max} left in ${what}`, body: 'They are all in your bag already.' }
        : { tone: 'warn', title: `Up to ${MAX_PER_LINE} per order` });
      return;
    }
    const { img } = photoFor(p, colour);
    // Several at once (the product page's quantity), up to what may be had.
    const add = Math.max(1, Math.min(qty, max - (existing?.qty ?? 0)));
    if (add < qty) toast({ tone: 'warn', title: max < MAX_PER_LINE ? `Only ${max} left in ${what}` : `Up to ${MAX_PER_LINE} per order`, body: `${add} added to your bag.` });
    setCart(items => existing
      ? items.map(i => i.key === key ? { ...i, qty: i.qty + add } : i)
      : [...items, { key, id: p.id, name: p.name, price: p.price, img, colour, size, qty: add }]);
    if (!quiet) toast({ tone: 'ok', title: 'Added to bag', body: `${p.name} · ${what}`, img, action: { label: 'View bag', onClick: () => setOverlay('cart') } });
    track('add_to_cart', { productId: p.id, size, valueKobo: p.priceKobo });
    return { name: p.name, what, img, colour, size, price: format(p.price), qty: (existing?.qty ?? 0) + add };
  }, [products, cart, toast, format, showSoldOut]);

  const changeQty = useCallback((key, delta) => {
    const line = cart.find(i => i.key === key);
    if (!line) return;
    if (delta > 0) {
      const max = maxFor(products.find(p => p.id === line.id), line.size, line.colour ?? '');
      if (line.qty + delta > max) {
        toast(max === 0 ? { tone: 'bad', title: 'Sold out' } : { tone: 'warn', title: max < MAX_PER_LINE ? `Only ${max} left` : `Up to ${MAX_PER_LINE} per order` });
        return;
      }
    }
    setCart(items => items
      .map(i => i.key === key ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0));
    // One card for a run of taps, updated in place rather than stacked.
    if (line.qty + delta > 0) {
      toast({ key: 'qty', tone: 'ok', title: 'Quantity updated', body: `${line.name} · ${line.qty + delta} in your bag`, img: line.img, ms: 2600 });
    }
  }, [cart, products, toast]);

  /* Taken out (after the bag's "Remove this item?"), with Undo on the
   * message to put it back where it was. */
  const removeItem = useCallback((key) => {
    const at = cart.findIndex(i => i.key === key);
    if (at < 0) return;
    const line = cart[at];
    setCart(items => items.filter(i => i.key !== key));
    toast({
      key: `bag-${key}`, tone: 'ok', title: `“${line.name}” removed from your bag.`, body: optionLabel(line.colour ?? '', line.size), img: line.img,
      undo: { done: 'Item restored to your bag.', onUndo: () => setCart(items => items.some(i => i.key === key) ? items
        : [...items.slice(0, at), line, ...items.slice(at)]) }
    });
  }, [cart, toast]);

  const toggleWish = useCallback((id) => {
    const on = wishlist.includes(id);
    setWishlist(list => on ? list.filter(w => w !== id) : [...list, id]);
    const p = products.find(x => x.id === id);
    toast(on
      ? { key: `saved-${id}`, title: 'Removed from saved', body: p?.name, img: p?.img,
          undo: { done: 'Saved again.', onUndo: () => setWishlist(list => list.includes(id) ? list : [...list, id]) } }
      : { tone: 'ok', title: 'Saved to your list', body: p?.name, img: p?.img,
          action: { label: 'View saved', onClick: () => setOverlay('saved') } });
  }, [wishlist, products, toast]);

  /* Emptied once an order is confirmed paid — the bag has become an order,
     and leaving it in localStorage invites a second, accidental purchase. */
  const clearCart = useCallback(() => setCart([]), []);

  const cartQty      = useMemo(() => cart.reduce((n, i) => n + i.qty, 0), [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((n, i) => n + i.price * i.qty, 0), [cart]);

  /* Free delivery reached: said once, as the bag crosses the owner's amount
   * (not on arriving with a bag already over it). */
  const freeOver = site?.freeDelivery?.overKobo ?? null;
  const wasOver = useRef(null);
  useEffect(() => {
    const over = freeOver !== null && cartSubtotal * 100 >= freeOver;
    if (wasOver.current === false && over) {
      toast({ key: 'free', tone: 'ok', title: 'Free delivery unlocked', body: 'Your order now ships free.' });
    }
    wasOver.current = freeOver === null ? null : over;
  }, [cartSubtotal, freeOver, toast]);

  /* ---------------------------------------------------------- overlays */

  const openOverlay  = useCallback((which) => setOverlay(which), []);
  const closeOverlay = useCallback(() => setOverlay(null), []);

  // Lock the page behind an open overlay so the background cannot scroll.
  useEffect(() => {
    document.body.classList.toggle('is-locked', overlay !== null);
    holdSmoothScroll(overlay !== null);
    return () => { document.body.classList.remove('is-locked'); holdSmoothScroll(false); };
  }, [overlay]);

  useEffect(() => {
    if (!overlay) return;
    const onKey = (e) => { if (e.key === 'Escape') closeOverlay(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [overlay, closeOverlay]);

  const value = {
    products, site, catalogueStatus: status, catalogueError, loadCatalogue, productById,
    cart, cartQty, cartSubtotal, addToCart, showSoldOut, changeQty, removeItem, clearCart, maxFor,
    delivery, setDelivery, discountCode, setDiscountCode,
    wishlist, toggleWish,
    currency, setCurrency, format,
    overlay, openOverlay, closeOverlay,
    toasts, toast, dismissToast, failed
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
