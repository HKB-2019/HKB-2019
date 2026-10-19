import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CURRENCIES, currencies } from '../data/currencies.js';
import { readStore, writeStore } from '../lib/storage.js';
import { getProducts, getSite } from '../lib/api.js';
import { HOME_DEFAULT } from '../data/home.js';
import { track } from '../lib/analytics.js';
import { holdSmoothScroll } from '../lib/smoothScroll.js';
import { hasColours, sizesFor, photoFor, optionLabel } from '../lib/colours.js';

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

  /* A toast is { title, body?, img?, tone? }: tone 'ok' (it worked), 'bad'
   * (it did not) or none (news). A plain string is a title. Each stays for
   * its own time, longer for a problem, and can be closed sooner (Toasts.jsx
   * keeps the clock, and holds it while the pointer rests on one). */
  const toast = useCallback((message, tone) => {
    const t = typeof message === 'string' ? { title: message, tone } : message;
    const id = ++toastId.current;
    setToasts(list => [...list.slice(-2), { id, ms: t.tone === 'bad' ? 6000 : 4200, ...t }]);
  }, []);
  const dismissToast = useCallback((id) => setToasts(list => list.filter(x => x.id !== id)), []);

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
    } catch {
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
    notes.slice(0, 3).forEach(n => toast({ title: 'Your bag has been updated', body: n }));
  }, [status, products, cart, format, toast]);

  const productById = useCallback((id) => products.find(p => p.id === id), [products]);

  /* --------------------------------------------------------------- bag */

  /* Returns what went in, or nothing if it could not. `quiet` leaves the
   * saying-so to the caller (the product page shows its own panel). */
  const addToCart = useCallback((product, size, colour = '', { quiet = false } = {}) => {
    const p = products.find(x => x.id === product.id) ?? product;
    if (hasColours(p) && !colour) { toast({ tone: 'bad', title: 'Choose a colour first' }); return; }
    const what = optionLabel(colour, size);
    const max = maxFor(p, size, colour);
    if (max === 0) { toast({ tone: 'bad', title: 'Sold out', body: `${p.name} (${what}) has sold out.`, img: photoFor(p, colour).img }); return; }

    const key = `${p.id}|${colour}|${size}`;
    const existing = cart.find(i => i.key === key);
    if (existing && existing.qty >= max) {
      toast(max < MAX_PER_LINE
        ? { tone: 'bad', title: `Only ${max} left in ${what}`, body: 'They are all in your bag already.' }
        : { tone: 'bad', title: `Up to ${MAX_PER_LINE} per order` });
      return;
    }
    const { img } = photoFor(p, colour);
    setCart(items => existing
      ? items.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i)
      : [...items, { key, id: p.id, name: p.name, price: p.price, img, colour, size, qty: 1 }]);
    if (!quiet) toast({ tone: 'ok', title: 'Added to bag', body: `${p.name} · ${what}`, img });
    track('add_to_cart', { productId: p.id, size, valueKobo: p.priceKobo });
    return { name: p.name, what, img };
  }, [products, cart, toast]);

  const changeQty = useCallback((key, delta) => {
    const line = cart.find(i => i.key === key);
    if (!line) return;
    if (delta > 0) {
      const max = maxFor(products.find(p => p.id === line.id), line.size, line.colour ?? '');
      if (line.qty + delta > max) {
        toast({ tone: 'bad', title: max === 0 ? 'Sold out' : max < MAX_PER_LINE ? `Only ${max} left` : `Up to ${MAX_PER_LINE} per order` });
        return;
      }
    }
    setCart(items => items
      .map(i => i.key === key ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0));
  }, [cart, products, toast]);

  const removeItem = useCallback((key) => {
    setCart(items => items.filter(i => i.key !== key));
    toast('Removed from your bag');
  }, [toast]);

  const toggleWish = useCallback((id) => {
    const on = wishlist.includes(id);
    setWishlist(list => on ? list.filter(w => w !== id) : [...list, id]);
    toast(on ? 'Removed from saved' : { tone: 'ok', title: 'Saved to your list' });
  }, [wishlist, toast]);

  /* Emptied once an order is confirmed paid — the bag has become an order,
     and leaving it in localStorage invites a second, accidental purchase. */
  const clearCart = useCallback(() => setCart([]), []);

  const cartQty      = useMemo(() => cart.reduce((n, i) => n + i.qty, 0), [cart]);
  const cartSubtotal = useMemo(() => cart.reduce((n, i) => n + i.price * i.qty, 0), [cart]);

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
    products, site, catalogueStatus: status, loadCatalogue, productById,
    cart, cartQty, cartSubtotal, addToCart, changeQty, removeItem, clearCart, maxFor,
    delivery, setDelivery, discountCode, setDiscountCode,
    wishlist, toggleWish,
    currency, setCurrency, format,
    overlay, openOverlay, closeOverlay,
    toasts, toast, dismissToast
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
