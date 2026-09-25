import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CURRENCIES } from '../data/currencies.js';
import { readStore, writeStore } from '../lib/storage.js';
import { getProducts, getSite } from '../lib/api.js';

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

/** How many of one size may go in the bag: the per-line cap, or fewer if stock is low. */
function maxFor(product, size) {
  const s = product?.sizes.find(x => x.size === size);
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
    address: { line1: '', line2: '', city: '', state: '', country: 'Nigeria' }
  });

  useEffect(() => writeStore('masq:cart', cart), [cart]);
  useEffect(() => writeStore('masq:wishlist', wishlist), [wishlist]);
  useEffect(() => writeStore('masq:currency', CURRENCIES[currency] ? currency : 'NGN'), [currency]);

  /* ------------------------------------------------------------- money */

  const format = useCallback((naira) => {
    const c = CURRENCIES[currency] || CURRENCIES.NGN;
    return c.symbol + (naira * c.rate).toLocaleString('en-US', {
      minimumFractionDigits: c.decimals,
      maximumFractionDigits: c.decimals
    });
  }, [currency]);

  /* ------------------------------------------------------------ toasts */

  const toast = useCallback((message, variant) => {
    const id = ++toastId.current;
    setToasts(t => [...t, { id, message, variant }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);

  /* --------------------------------------------------------- catalogue */

  const loadCatalogue = useCallback(async () => {
    setStatus('loading');
    try {
      const [p, s] = await Promise.all([getProducts(), getSite()]);
      setProducts(p);
      setSite(s);
      setStatus('ready');
    } catch {
      setStatus('error');
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
      const max = maxFor(p, line.size);
      if (!p || max === 0) {
        notes.push(`${line.name} (${line.size}) is no longer available — removed from your bag`);
        changed = true;
        continue;
      }
      const qty = Math.min(line.qty, max);
      if (qty !== line.qty) notes.push(`Only ${max} ${p.name} (${line.size}) left — your bag has been updated`);
      if (p.price !== line.price) notes.push(`${p.name} is now ${format(p.price)}`);
      const updated = { ...line, name: p.name, price: p.price, img: p.img, qty };
      if (qty !== line.qty || p.price !== line.price || p.name !== line.name || p.img !== line.img) changed = true;
      next.push(updated);
    }
    if (changed) setCart(next);
    notes.slice(0, 3).forEach(n => toast(n.toUpperCase()));
  }, [status, products, cart, format, toast]);

  const productById = useCallback((id) => products.find(p => p.id === id), [products]);

  /* --------------------------------------------------------------- bag */

  const addToCart = useCallback((product, size) => {
    const p = products.find(x => x.id === product.id) ?? product;
    const max = maxFor(p, size);
    if (max === 0) { toast(`${p.name} (${size}) HAS SOLD OUT`); return; }

    const key = `${p.id}|${size}`;
    const existing = cart.find(i => i.key === key);
    if (existing && existing.qty >= max) {
      toast(max < MAX_PER_LINE ? `ONLY ${max} LEFT IN ${size}` : `UP TO ${MAX_PER_LINE} PER ORDER`);
      return;
    }
    setCart(items => existing
      ? items.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i)
      : [...items, { key, id: p.id, name: p.name, price: p.price, img: p.img, size, qty: 1 }]);
    toast(`${p.name} ADDED TO BAG`, 'violet');
  }, [products, cart, toast]);

  const changeQty = useCallback((key, delta) => {
    const line = cart.find(i => i.key === key);
    if (!line) return;
    if (delta > 0) {
      const max = maxFor(products.find(p => p.id === line.id), line.size);
      if (line.qty + delta > max) {
        toast(max === 0 ? 'SOLD OUT' : max < MAX_PER_LINE ? `ONLY ${max} LEFT` : `UP TO ${MAX_PER_LINE} PER ORDER`);
        return;
      }
    }
    setCart(items => items
      .map(i => i.key === key ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0));
  }, [cart, products, toast]);

  const removeItem = useCallback((key) => {
    setCart(items => items.filter(i => i.key !== key));
    toast('REMOVED FROM BAG');
  }, [toast]);

  const toggleWish = useCallback((id) => {
    const on = wishlist.includes(id);
    setWishlist(list => on ? list.filter(w => w !== id) : [...list, id]);
    toast(on ? 'REMOVED FROM SAVED' : 'SAVED TO YOUR LIST');
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
    return () => document.body.classList.remove('is-locked');
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
    delivery, setDelivery,
    wishlist, toggleWish,
    currency, setCurrency, format,
    overlay, openOverlay, closeOverlay,
    toasts, toast
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
