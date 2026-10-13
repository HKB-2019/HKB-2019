/* The preview's stand-in for the shop's server.
 *
 * The preview build swaps this file in for src/lib/api.js, so every screen is
 * the real one, talking to a small store kept in the visitor's own browser
 * instead of a database. It follows the server's rules where a visitor would
 * notice (prices from the catalogue, stock held at checkout, a product needs
 * a photo before it goes on sale) and nothing is ever charged. */

import { CATALOGUE } from '../data/catalogue.js';
import { HOME_DEFAULT, NAV } from '../data/home.js';
import { PAGES, PAGES_DEFAULT } from '../data/pages.js';

const KEY = 'masq:preview-store';
const ZONES = ['lagos', 'abuja', 'nigeria', 'international'];
const ZONE_LABELS = { lagos: 'Lagos', abuja: 'Abuja (FCT)', nigeria: 'Rest of Nigeria', international: 'Outside Nigeria' };
const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara'
];

/* ------------------------------------------------------------- sample */

const ago = (hours) => new Date(Date.now() - hours * 3_600_000).toISOString();

function sampleStore() {
  let variantId = 0;
  const products = CATALOGUE.map((p, position) => ({
    id: p.id, name: p.name, priceKobo: p.naira * 100, img: p.img, uploaded: null,
    badge: p.badge ?? null, inDrop: !!p.drop, featured: !!p.featured, inEssentials: !!p.essential,
    hidden: false, position, description: '', details: '', extras: [],
    sizes: Object.entries(p.sizes).map(([size, stock]) => ({ variantId: ++variantId, size, stock }))
  }));
  const tee = products.find(p => p.id === 'tee');
  tee.description = 'Heavyweight cotton, cut a little boxy.\n\nThe face on the front is MASQ.’s first mark: a mask drawn from the shapes of the old carvings, in the colours of the city at night.';
  tee.details = 'Sample text — the owner writes this in the admin.\nWash cold, inside out.';

  const line = (id, size, qty) => {
    const p = products.find(x => x.id === id);
    return { name: p.name, size, qty, unitPriceKobo: p.priceKobo };
  };
  const addr = (line1, city, state) => ({ line1, line2: '', city, state, country: 'Nigeria' });
  const orders = [
    { reference: 'masq-3f9a1c0e7b2d4a6f8c1e5d20', email: 'ada@example.com', name: 'Ada Obi', phone: '+234 803 000 0001',
      address: addr('12 Admiralty Way', 'Lekki', 'Lagos'), zone: 'lagos', status: 'paid', fulfilledAt: null,
      items: [line('jacket', 'L', 1)], shippingKobo: 250000, createdAt: ago(2), paidAt: ago(2) },
    { reference: 'masq-8c2e4f6a0b1d3e5f7a9c0b12', email: 'chidi@example.com', name: 'Chidi Eze', phone: '+234 806 000 0002',
      address: addr('4 Aminu Kano Crescent', 'Wuse 2', 'FCT'), zone: 'abuja', status: 'paid', fulfilledAt: ago(20),
      items: [line('hoodie', 'M', 2)], shippingKobo: 350000, createdAt: ago(26), paidAt: ago(26) },
    { reference: 'masq-1b3d5f7a9c0e2f4a6b8d0c34', email: 'zainab@example.com', name: 'Zainab Bello', phone: '+234 809 000 0003',
      address: addr('7 Ahmadu Bello Way', 'Kaduna North', 'Kaduna'), zone: 'nigeria', status: 'pending', fulfilledAt: null,
      items: [line('cap', 'ONE SIZE', 1), line('tee', 'M', 1)], shippingKobo: 500000, createdAt: ago(0.2), paidAt: null },
    { reference: 'masq-6e8f0a2b4c6d8e0f1a3b5c56', email: 'tunde@example.com', name: 'Tunde Ade', phone: '+234 802 000 0004',
      address: addr('22 Bodija Road', 'Ibadan', 'Oyo'), zone: 'nigeria', status: 'abandoned', fulfilledAt: null,
      items: [line('tee', 'S', 2)], shippingKobo: 500000, createdAt: ago(30), paidAt: null }
  ];

  return {
    products, orders,
    subscribers: [
      { id: 2, email: 'nneka@example.com', joinedAt: ago(5) },
      { id: 1, email: 'femi@example.com', joinedAt: ago(50) }
    ],
    settings: {
      delivery: {
        lagos: { enabled: true, feeKobo: 250000 }, abuja: { enabled: true, feeKobo: 350000 },
        nigeria: { enabled: true, feeKobo: 500000 }, international: { enabled: false, feeKobo: null }
      },
      pages: { ...PAGES_DEFAULT },
      social: { instagram: '', tiktok: '', x: '' },
      film: { url: '', kind: null, youtubeId: null },
      home: structuredClone(HOME_DEFAULT)
    },
    homeImages: { hero: null, band: null, film: null },
    nextId: 100
  };
}

/* -------------------------------------------------------------- store */

let store = load();

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.products) return saved;
  } catch { /* fall through to the sample */ }
  return sampleStore();
}

function save() {
  // Photos are kept as data inside the store, so this can outgrow the
  // browser's allowance. Then the preview carries on in memory for this visit.
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* memory only */ }
}

export function resetPreview() {
  store = sampleStore();
  try { localStorage.removeItem(KEY); } catch { /* nothing kept */ }
  try { ['masq:cart', 'masq:wishlist', 'masq:currency'].forEach(k => localStorage.removeItem(k)); } catch { /* ok */ }
}

/** A short wait, so saving looks like saving rather than flicker. */
const settle = (value, ms = 220) => new Promise(r => setTimeout(() => r(structuredClone(value)), ms));
const fail = (message, status = 400) => new Promise((_, reject) =>
  setTimeout(() => reject(Object.assign(new Error(message), { status })), 180));

/* ----------------------------------------------------------- products */

const twin = (img) => img.replace(/\.(webp|jpe?g|png)$/i, '@2x.$1');

function photosOf(p) {
  const main = p.uploaded ?? (p.img ? { img: p.img, img2x: twin(p.img) } : null);
  return { main, all: [...(main ? [main] : []), ...p.extras] };
}

function shape(p, forAdmin) {
  const { main, all } = photosOf(p);
  const base = {
    id: p.id, name: p.name, description: p.description, details: p.details, photos: all,
    price: p.priceKobo / 100, priceKobo: p.priceKobo,
    img: main?.img ?? '', img2x: main?.img2x ?? '',
    badge: p.badge, inDrop: p.inDrop, featured: p.featured, inEssentials: p.inEssentials,
    soldOut: p.sizes.length === 0 || p.sizes.every(s => s.stock <= 0)
  };
  if (forAdmin) {
    return { ...base, hidden: p.hidden, hasUpload: !!p.uploaded, hasBuiltInPhoto: !!p.img,
             sizes: p.sizes.map(s => ({ ...s })) };
  }
  return { ...base, sizes: p.sizes.map(s => ({
    size: s.size, available: s.stock > 0, left: s.stock > 0 && s.stock < 10 ? s.stock : null })) };
}

const ordered = () => [...store.products].sort((a, b) => a.position - b.position);
const product = (id) => store.products.find(p => p.id === id);

export const getProducts = () => settle(ordered().filter(p => !p.hidden).map(p => shape(p, false)), 120);

export const getSite = () => settle({
  home: {
    ...store.settings.home,
    images: Object.fromEntries(Object.entries(store.homeImages).map(([k, v]) => [k, v ? { img: v.img, img2x: v.img2x } : null]))
  },
  pages: store.settings.pages,
  social: store.settings.social,
  film: store.settings.film.kind ? store.settings.film : null,
  delivery: openZones(),
  states: STATES
}, 120);

function openZones() {
  return ZONES.filter(z => store.settings.delivery[z].enabled)
    .map(z => ({ zone: z, label: ZONE_LABELS[z], feeKobo: store.settings.delivery[z].feeKobo }));
}

/* ----------------------------------------------------------- checkout */

function zoneFor({ country, state }) {
  if (!/^(nigeria|ng)$/i.test(String(country).trim())) return 'international';
  if (/^lagos$/i.test(state)) return 'lagos';
  if (/^(fct|abuja)/i.test(state)) return 'abuja';
  return 'nigeria';
}

const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');

export async function startCheckout({ email, name, phone, address }, items) {
  const zone = openZones().find(z => z.zone === zoneFor(address));
  if (!zone) return fail('Sorry — we don’t deliver there yet.');
  const lines = [];
  for (const i of items) {
    const p = product(i.id);
    const v = p && !p.hidden && p.sizes.find(s => s.size === i.size);
    if (!v) return fail('Something in your bag is no longer available.', 404);
    if (v.stock < i.qty) return fail(v.stock ? `${p.name} (${i.size}) — only ${v.stock} left.` : `${p.name} (${i.size}) has sold out.`, 409);
    lines.push([v, { name: p.name, size: i.size, qty: i.qty, unitPriceKobo: p.priceKobo }]);
  }
  lines.forEach(([v, l]) => { v.stock -= l.qty; });       // held while paying, as the real shop does
  const reference = 'masq-' + hex(24);
  store.orders.unshift({
    reference, email: email.trim().toLowerCase(), name, phone, address, zone: zone.zone, status: 'pending',
    fulfilledAt: null, items: lines.map(([, l]) => l), shippingKobo: zone.feeKobo, createdAt: new Date().toISOString(), paidAt: null
  });
  save();
  return settle({ reference, authorizationUrl: `#/pay?reference=${reference}` }, 500);
}

/** The pretend payment page's two buttons. */
export function finishPayment(reference, paid) {
  const o = store.orders.find(x => x.reference === reference);
  if (!o || o.status !== 'pending') return;
  if (paid) { o.status = 'paid'; o.paidAt = new Date().toISOString(); }
  else {
    o.status = 'abandoned';
    for (const l of o.items) {
      const v = store.products.find(p => p.name === l.name)?.sizes.find(s => s.size === l.size);
      if (v) v.stock += l.qty;
    }
  }
  save();
}

export function previewOrder(reference) {
  const o = store.orders.find(x => x.reference === reference);
  return o ? structuredClone(o) : null;
}

const mask = (email) => email.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');
const subtotal = (o) => o.items.reduce((n, i) => n + i.unitPriceKobo * i.qty, 0);

export function getOrder(reference) {
  const o = store.orders.find(x => x.reference === reference);
  if (!o) return fail('Order not found.', 404);
  return settle({
    reference: o.reference, status: o.status, email: mask(o.email),
    subtotalKobo: subtotal(o), shippingKobo: o.shippingKobo, totalKobo: subtotal(o) + o.shippingKobo,
    deliveryTo: `${o.address.city}, ${o.address.state}`, payment: null, currency: 'NGN',
    paidAt: o.paidAt, createdAt: o.createdAt, items: o.items
  });
}

export function subscribe(email) {
  const e = email.trim().toLowerCase();
  if (!store.subscribers.some(s => s.email === e)) {
    store.subscribers.unshift({ id: store.nextId++, email: e, joinedAt: new Date().toISOString() });
    save();
  }
  return settle({ ok: true });
}

/* ------------------------------------------------------------- admin */

let signedIn = true;      // the preview opens signed in; any password works after SIGN OUT

export const adminStatus = () => settle({ configured: true });
export const adminMe = () => (signedIn ? settle({ signedIn: true }) : fail('Sign in first.', 401));
export const adminLogin = () => { signedIn = true; return settle({ ok: true }); };
export const adminLogout = () => { signedIn = false; return settle({ ok: true }); };
export const adminSetup = () => { signedIn = true; return settle({ ok: true }); };

export function adminOrders(status) {
  return settle(store.orders.filter(o => !status || o.status === status).map((o, i) => ({
    id: store.orders.length - i, reference: o.reference, email: o.email, name: o.name, phone: o.phone,
    address: o.address, zone: o.zone, status: o.status, subtotalKobo: subtotal(o), shippingKobo: o.shippingKobo,
    totalKobo: subtotal(o) + o.shippingKobo, currency: 'NGN', paidAt: o.paidAt, fulfilledAt: o.fulfilledAt,
    createdAt: o.createdAt, items: o.items
  })));
}

export function adminSummary() {
  const paid = store.orders.filter(o => o.status === 'paid');
  return settle({
    paidOrders: paid.length,
    revenueKobo: paid.reduce((n, o) => n + subtotal(o) + o.shippingKobo, 0),
    awaitingFulfilment: paid.filter(o => !o.fulfilledAt).length,
    pendingPayment: store.orders.filter(o => o.status === 'pending').length,
    refundDue: 0,
    lowStock: ordered().filter(p => !p.hidden).flatMap(p => p.sizes.filter(s => s.stock <= 3)
      .map(s => ({ name: p.name, size: s.size, stock: s.stock }))).sort((a, b) => a.stock - b.stock),
    checkoutOpen: openZones().length > 0,
    subscribers: store.subscribers.length
  });
}

export function adminFulfil(reference) {
  const o = store.orders.find(x => x.reference === reference);
  if (!o || o.status !== 'paid') return fail('Only a paid order can be marked sent.', 409);
  o.fulfilledAt = new Date().toISOString();
  save();
  return settle({ ok: true });
}

export const adminStock = () => settle(ordered().flatMap(p => p.sizes.map(s => ({
  variantId: s.variantId, productId: p.id, name: p.name, size: s.size, stock: s.stock, priceKobo: p.priceKobo }))));

export function adminSetStock(variantId, stock) {
  const v = store.products.flatMap(p => p.sizes).find(s => s.variantId === variantId);
  if (!v) return fail('Variant not found.', 404);
  v.stock = stock;
  save();
  return settle({ ok: true, variantId, stock });
}

/* --------------------------------------------------- admin: products */

const adminList = () => ordered().map(p => shape(p, true));
const current = (id) => shape(product(id), true);

export const adminProducts = () => settle(adminList());

function cleanName(v) {
  const name = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (name.length < 2) throw new Error('Give the product a name.');
  if (name.length > 60) throw new Error('Keep the name under 60 characters.');
  return name;
}
function cleanPrice(v) {
  if (!Number.isInteger(v)) throw new Error('The price must be a whole number of naira.');
  if (v < 100) throw new Error('The price must be at least ₦100.');
  if (v > 1_000_000) throw new Error('The price must be ₦1,000,000 or less.');
  return v * 100;
}
const tidy = (t) => String(t ?? '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

/** Runs a change and answers like the server: the new state, or its reason for refusing. */
function attempt(fn, ms) {
  try { const out = fn(); save(); return settle(out, ms); }
  catch (err) { return fail(err.message, 409); }
}

export const adminCreateProduct = (b) => attempt(() => {
  const name = cleanName(b.name);
  const priceKobo = cleanPrice(b.priceNaira);
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'product';
  let id = base, n = 1;
  while (product(id)) id = `${base}-${++n}`;
  const sizes = (b.sizes?.length ? b.sizes : ['ONE SIZE']).map(s => String(s).trim().toUpperCase());
  store.products.push({
    id, name, priceKobo, img: '', uploaded: null, badge: null, inDrop: true, featured: true, inEssentials: false,
    hidden: true, position: store.products.length, description: '', details: '', extras: [],
    sizes: sizes.map(size => ({ variantId: store.nextId++, size, stock: 0 }))
  });
  return current(id);
});

export const adminUpdateProduct = (id, b) => attempt(() => {
  const p = product(id);
  if ('hidden' in b && b.hidden === false) {
    if (!p.img && !p.uploaded) throw new Error('Add a photo before putting this on sale.');
    if (!p.sizes.length) throw new Error('Add at least one size before putting this on sale.');
  }
  if ('name' in b) p.name = cleanName(b.name);
  if ('priceNaira' in b) p.priceKobo = cleanPrice(b.priceNaira);
  if ('badge' in b) p.badge = String(b.badge ?? '').trim().toUpperCase().slice(0, 16) || null;
  for (const k of ['inDrop', 'featured', 'inEssentials', 'hidden']) if (k in b) p[k] = b[k];
  if ('description' in b) p.description = tidy(b.description).slice(0, 2000);
  if ('details' in b) p.details = tidy(b.details).slice(0, 1000);
  return current(id);
});

export const adminMoveProduct = (id, direction) => attempt(() => {
  const list = ordered();
  const i = list.findIndex(p => p.id === id);
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j >= 0 && j < list.length) [list[i], list[j]] = [list[j], list[i]];
  list.forEach((p, n) => { p.position = n; });
  return adminList();
});

export const adminAddSize = (id, size) => attempt(() => {
  const p = product(id);
  const s = String(size).trim().toUpperCase();
  if (p.sizes.some(x => x.size === s)) throw new Error(`${s} is already a size of this product.`);
  p.sizes.push({ variantId: store.nextId++, size: s, stock: 0 });
  return current(id);
});

export const adminRemoveSize = (id, variantId) => attempt(() => {
  const p = product(id);
  const v = p.sizes.find(s => s.variantId === variantId);
  if (v.stock > 0) throw new Error(`Set the ${v.size} count to 0 first.`);
  if (p.sizes.length <= 1 && !p.hidden) throw new Error('A product on sale needs at least one size. Take it off sale first.');
  p.sizes = p.sizes.filter(s => s !== v);
  return current(id);
});

export const adminUploadPhoto = (id, image, image2x) =>
  attempt(() => { product(id).uploaded = { img: image, img2x: image2x }; return current(id); }, 600);

export const adminRemovePhoto = (id) => attempt(() => {
  const p = product(id);
  if (!p.img && !p.hidden) throw new Error('This product has no other photo. Upload a new one instead, or take it off sale first.');
  p.uploaded = null;
  return current(id);
});

export const adminAddGalleryPhoto = (id, image, image2x) => attempt(() => {
  const p = product(id);
  if (p.extras.length >= 6) throw new Error('A product can have 6 extra photos. Remove one first.');
  p.extras.push({ id: store.nextId++, img: image, img2x: image2x });
  return current(id);
}, 600);

export const adminRemoveGalleryPhoto = (id, photoId) =>
  attempt(() => { const p = product(id); p.extras = p.extras.filter(x => x.id !== photoId); return current(id); });

/* -------------------------------------------------- admin: home page */

export const adminUploadHomeImage = (slot, image, image2x) =>
  attempt(() => { store.homeImages[slot] = { img: image, img2x: image2x }; return { ok: true }; }, 600);
export const adminRemoveHomeImage = (slot) =>
  attempt(() => { store.homeImages[slot] = null; return { ok: true }; });

/* --------------------------------------------- admin: settings, list */

export const adminSettings = () => settle(store.settings);

export const adminSaveSetting = (key, value) => attempt(() => {
  let clean = value;
  if (key === 'delivery') {
    for (const z of ZONES) {
      const v = value[z];
      if (v.enabled && !(Number.isInteger(v.feeKobo) && v.feeKobo >= 0 && v.feeKobo <= 10_000_000)) {
        throw new Error(`${ZONE_LABELS[z]}: set a delivery fee between ₦0 and ₦100,000.`);
      }
    }
  } else if (key === 'pages') {
    clean = Object.fromEntries(PAGES.map(k => [k, tidy(value[k] ?? PAGES_DEFAULT[k])]));
    const empty = PAGES.find(k => !clean[k]);
    if (empty) throw new Error(`${empty}: write something, or the page will be empty.`);
  } else if (key === 'social') {
    for (const [k, v] of Object.entries(value)) {
      if (v && !/^https:\/\//.test(v)) throw new Error(`${k}: use a link that starts with https://`);
    }
  } else if (key === 'film') {
    const url = String(value.url ?? '').trim();
    const yt = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
    if (url && !yt && !/^https:\/\/.+\.mp4$/i.test(url)) throw new Error('Film: use a YouTube link, or a link that ends in .mp4');
    clean = { url, kind: !url ? null : yt ? 'youtube' : 'mp4', youtubeId: yt?.[1] ?? null };
  } else if (key === 'home') {
    clean = structuredClone(value);
    for (const k of Object.keys(HOME_DEFAULT)) {
      if (k === 'nav') continue;
      clean[k] = tidy(value[k]);
      if (!clean[k]) throw new Error(`${k}: write something, or it will be blank on the page.`);
    }
    for (const n of NAV) {
      clean.nav[n].label = String(value.nav[n].label).replace(/\s+/g, ' ').trim().toUpperCase();
      if (!clean.nav[n].label) throw new Error(`Menu: ${n}: write something, or it will be blank on the page.`);
    }
  }
  store.settings[key] = clean;
  return clean;
});

export const adminSubscribers = () => settle(store.subscribers);
export const adminRemoveSubscriber = (id) =>
  attempt(() => { store.subscribers = store.subscribers.filter(s => s.id !== id); return { ok: true }; });

/** Downloads cannot leave a preview page, so this says so instead. */
export const adminDownload = () => fail('Downloads are switched off in this preview. On the live shop this saves a spreadsheet.');
