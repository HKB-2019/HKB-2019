import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CURRENCIES } from '../data/catalogue.js';
import { readStore, writeStore } from '../lib/storage.js';

/* One place for everything the shop needs to remember: the bag, the saved
 * list, the chosen currency, which overlay is open and any toasts in flight.
 *
 * The bag still lives in localStorage. That is fine for a browsing session but
 * it is NOT where a real order lives — when the back end lands, this is the
 * module that starts talking to it, and the components above it should not
 * need to change. */

const ShopContext = createContext(null);

export function useShop() {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error('useShop must be used inside <ShopProvider>');
  return ctx;
}

export function ShopProvider({ children }) {
  const [cart, setCart]         = useState(() => readStore('masq:cart', []));
  const [wishlist, setWishlist] = useState(() => readStore('masq:wishlist', []));
  const [currency, setCurrency] = useState(() => readStore('masq:currency', 'NGN'));
  const [overlay, setOverlay]   = useState(null);   // 'cart' | 'account' | 'film' | {info:'FAQ'}
  const [toasts, setToasts]     = useState([]);
  const toastId = useRef(0);

  useEffect(() => writeStore('masq:cart', cart), [cart]);
  useEffect(() => writeStore('masq:wishlist', wishlist), [wishlist]);
  useEffect(() => writeStore('masq:currency', currency), [currency]);

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

  /* --------------------------------------------------------------- bag */

  const addToCart = useCallback((product, size) => {
    const key = `${product.id}|${size}`;
    setCart(items => {
      const found = items.find(i => i.key === key);
      if (found) return items.map(i => i.key === key ? { ...i, qty: i.qty + 1 } : i);
      return [...items, {
        key, id: product.id, name: product.name,
        price: product.price, img: product.img, size, qty: 1
      }];
    });
    toast(`${product.name} ADDED TO BAG`, 'violet');
  }, [toast]);

  const changeQty = useCallback((key, delta) => {
    setCart(items => items
      .map(i => i.key === key ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0));
  }, []);

  const removeItem = useCallback((key) => {
    setCart(items => items.filter(i => i.key !== key));
    toast('REMOVED FROM BAG');
  }, [toast]);

  const toggleWish = useCallback((id) => {
    setWishlist(list => {
      const on = list.includes(id);
      toast(on ? 'REMOVED FROM SAVED' : 'SAVED TO YOUR LIST');
      return on ? list.filter(w => w !== id) : [...list, id];
    });
  }, [toast]);

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
    cart, cartQty, cartSubtotal, addToCart, changeQty, removeItem,
    wishlist, toggleWish,
    currency, setCurrency, format,
    overlay, openOverlay, closeOverlay,
    toasts, toast
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
