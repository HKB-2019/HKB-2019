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
import { GUIDE_CURRENCIES, DEFAULT_RATES } from '../data/currencies.js';
import { sampleReport } from './sampleAnalytics.js';

const KEY = 'masq:preview-store-5';   // a new number whenever the sample's shape changes
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
  let colourId = 0;
  // `sizes` is one row per colour and size, as on the server: colour '' for a
  // piece without colours.
  const products = CATALOGUE.map((p, position) => ({
    id: p.id, name: p.name, priceKobo: p.naira * 100, img: p.img, uploaded: null,
    badge: p.badge ?? null, inDrop: !!p.drop, featured: !!p.featured, inEssentials: !!p.essential,
    hidden: false, position, description: '', details: '', extras: [], availableAt: null,
    colours: (p.colours ?? []).map(c => ({ id: ++colourId, name: c.name, hex: c.hex, img: c.img ?? '', photo: null })),
    sizes: (p.colours ?? [{ name: '', sizes: p.sizes }]).flatMap(c =>
      Object.entries(c.sizes).map(([size, stock]) => ({ variantId: ++variantId, colour: c.name, size, stock })))
  }));
  // The hoodie waits for a drop, so the home page shows its countdown.
  products.find(p => p.id === 'hoodie').availableAt = new Date(Date.now() + 3 * 86_400_000 + 5 * 3_600_000).toISOString();
  const tee = products.find(p => p.id === 'tee');
  tee.description = 'Heavyweight cotton, cut a little boxy.\n\nThe face on the front is MASQ.’s first mark: a mask drawn from the shapes of the old carvings, in the colours of the city at night.';
  tee.details = 'Sample text — the owner writes this in the admin.\nWash cold, inside out.';

  const line = (id, size, qty, colour = '') => {
    const p = products.find(x => x.id === id);
    return { name: p.name, colour, size, qty, unitPriceKobo: p.priceKobo };
  };
  const addr = (line1, city, state) => ({ line1, line2: '', city, state, country: 'Nigeria' });
  const orders = [
    { reference: 'masq-3f9a1c0e7b2d4a6f8c1e5d20', email: 'ada@example.com', name: 'Ada Obi', phone: '+234 803 000 0001',
      address: addr('12 Admiralty Way', 'Lekki', 'Lagos'), zone: 'lagos', status: 'paid', fulfilledAt: null,
      items: [line('jacket', 'L', 1)], shippingKobo: 250000, createdAt: ago(2), paidAt: ago(2),
      discountCode: 'LAUNCH10', discountKobo: 980000 },
    { reference: 'masq-8c2e4f6a0b1d3e5f7a9c0b12', email: 'chidi@example.com', name: 'Chidi Eze', phone: '+234 806 000 0002',
      address: addr('4 Aminu Kano Crescent', 'Wuse 2', 'FCT'), zone: 'abuja', status: 'paid', fulfilledAt: ago(20),
      courier: 'GIG Logistics', tracking: 'GIG-48213',
      items: [line('hoodie', 'M', 2, 'Black')], shippingKobo: 350000, createdAt: ago(200), paidAt: ago(200) },
    { reference: 'masq-1b3d5f7a9c0e2f4a6b8d0c34', email: 'zainab@example.com', name: 'Zainab Bello', phone: '+234 809 000 0003',
      address: addr('7 Ahmadu Bello Way', 'Kaduna North', 'Kaduna'), zone: 'nigeria', status: 'pending', fulfilledAt: null,
      items: [line('cap', 'ONE SIZE', 1), line('tee', 'M', 1, 'White')], shippingKobo: 500000, createdAt: ago(0.2), paidAt: null },
    { reference: 'masq-6e8f0a2b4c6d8e0f1a3b5c56', email: 'tunde@example.com', name: 'Tunde Ade', phone: '+234 802 000 0004',
      address: addr('22 Bodija Road', 'Ibadan', 'Oyo'), zone: 'nigeria', status: 'abandoned', fulfilledAt: null,
      items: [line('tee', 'S', 2, 'Indigo')], shippingKobo: 500000, createdAt: ago(30), paidAt: null }
  ];

  return {
    products, orders,
    codes: [
      { code: 'LAUNCH10', kind: 'percent', amount: 10, minSpendKobo: 0, maxUses: 50, uses: 1, endsAt: null, active: true },
      { code: 'VIP5K', kind: 'fixed', amount: 500000, minSpendKobo: 4000000, maxUses: null, uses: 0, endsAt: null, active: true }
    ],
    alerts: [{ id: 1, productId: 'phone', colour: '', size: 'ONE SIZE', email: 'kemi@example.com', askedAt: ago(9) }],
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
      home: structuredClone(HOME_DEFAULT),
      rates: { ...DEFAULT_RATES }
    },
    homeImages: { hero: null, band: null, film: null },
    giftCards: sampleGifts(),
    giftSamples: true,
    customers: {
      'chidi@example.com': { tags: ['VIP'], notes: 'Bought two hoodies for his brother. Asks about the next drop.', createdAt: ago(190) }
    },
    nextId: 100
  };
}

/* -------------------------------------------------------------- store */

let store = load();

/* Cards bought in the shop, for the admin to show: one untouched, one part spent. */
function sampleGifts() {
  const until = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
  return [
    { id: 1, code: 'MASQ-7K3P-Q9XD', amountKobo: 2500000, balanceKobo: 2500000, status: 'active', reference: 'gift-' + '7'.repeat(24),
      buyerEmail: 'tolu@example.com', recipientName: 'Kemi', recipientEmail: null, message: 'Happy birthday. Wear it well.',
      note: null, design: 'violet', activatedAt: ago(48), expiresAt: until(364), uses: [] },
    { id: 9001, code: 'MASQ-4HNW-T8RE', amountKobo: 5000000, balanceKobo: 1350000, status: 'active', reference: 'gift-' + '4'.repeat(24),
      buyerEmail: 'ada@example.com', recipientName: 'Bisi', recipientEmail: 'bisi@example.com', message: 'For the new job.',
      note: null, design: 'teal', activatedAt: ago(24 * 20), expiresAt: until(345),
      uses: [{ orderReference: 'MASQ-1042', amountKobo: -3650000, kind: 'spend', at: ago(24 * 6) }] }
  ];
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved?.products) {
      // A preview begun before these samples were added gets them now.
      if (!saved.giftSamples) {
        const have = saved.giftCards ?? [];
        saved.giftCards = [...have, ...sampleGifts().filter(s => !have.some(g => g.code === s.code || g.id === s.id))];
        saved.giftSamples = true;
      }
      return saved;
    }
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

/** Each size once, in the order first added, whatever the colour. */
const sizeNames = (p) => [...new Set(p.sizes.map(s => s.size))];
function shopSizes(p, rows) {
  return sizeNames(p).map(size => {
    const stock = rows.filter(r => r.size === size).reduce((n, r) => n + Math.max(0, r.stock), 0);
    return { size, available: stock > 0, left: stock > 0 && stock < 10 ? stock : null };
  });
}
const colourPhoto = (c) => (c.photo ? { img: c.photo.img, img2x: c.photo.img2x }
  : c.img ? { img: c.img, img2x: twin(c.img) } : { img: null, img2x: null });

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
             availableAt: waiting(p) ? p.availableAt : null,
             colours: p.colours.map(c => ({ id: c.id, name: c.name, hex: c.hex, ...colourPhoto(c), hasPhoto: !!c.photo })),
             sizes: p.sizes.map(s => ({ ...s, colour: s.colour || null })) };
  }
  const colours = p.colours.map(c => {
    const own = shopSizes(p, p.sizes.filter(s => s.colour === c.name));
    return { name: c.name, hex: c.hex, ...colourPhoto(c), soldOut: own.every(s => !s.available), sizes: own };
  });
  return { ...base, colours, sizes: shopSizes(p, p.sizes) };
}

/** The stock row for a colour and size of an on-sale piece, or nothing. */
const variantOf = (p, colour, size) => p && onSale(p) && p.sizes.find(s => s.colour === (colour ?? '') && s.size === size);
const optionText = (colour, size) => (colour ? `${colour}, ${size}` : size);

const ordered = () => [...store.products].sort((a, b) => a.position - b.position);
const waiting = (p) => p.availableAt && new Date(p.availableAt) > new Date();
const onSale = (p) => !p.hidden && !waiting(p);
const product = (id) => store.products.find(p => p.id === id);

export const getProducts = () => settle(ordered().filter(onSale).map(p => shape(p, false)), 120);

/* A preview saved before a newer setting existed (the welcome pop-up, say)
 * gets that setting's default, as the server does. */
const withHomeDefaults = (home) => ({ ...structuredClone(HOME_DEFAULT), ...home });

export const getSite = () => settle({
  home: {
    ...withHomeDefaults(store.settings.home),
    images: Object.fromEntries(Object.entries(store.homeImages).map(([k, v]) => [k, v ? { img: v.img, img2x: v.img2x } : null]))
  },
  pages: store.settings.pages,
  social: store.settings.social,
  film: store.settings.film.kind ? store.settings.film : null,
  delivery: openZones(),
  states: STATES,
  rates: store.settings.rates,
  nextDrop: (() => {
    const next = store.products.filter(p => !p.hidden && waiting(p)).map(p => p.availableAt).sort()[0];
    return next ? { at: next, pieces: store.products.filter(p => !p.hidden && p.availableAt === next).length } : null;
  })()
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

/* ---------------------------------------------------------- discounts */

const nairaText = (kobo) => `₦${(kobo / 100).toLocaleString('en-NG')}`;
const codeLabel = (c) => (c.kind === 'percent' ? `${c.amount}% off` : `${nairaText(c.amount)} off`);

/** The same rules as server/lib/discounts.js. Throws the reason a customer reads. */
function priceCode(raw, subtotalKobo) {
  const code = String(raw ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new Error('That code is not valid.');
  const c = store.codes.find(x => x.code === code);
  if (!c || !c.active) throw new Error(`${code} is not a code we recognise.`);
  if (c.endsAt && new Date(c.endsAt) <= new Date()) throw new Error(`${code} has ended.`);
  if (subtotalKobo < c.minSpendKobo) throw new Error(`${code} is for orders of ${nairaText(c.minSpendKobo)} or more, before delivery.`);
  if (c.maxUses !== null && c.uses >= c.maxUses) throw new Error(`${code} has been used up.`);
  const raw2 = c.kind === 'percent' ? Math.floor((subtotalKobo * c.amount) / 100 / 100) * 100 : c.amount;
  const discountKobo = Math.max(0, Math.min(raw2, subtotalKobo - 10000));
  if (!discountKobo) throw new Error(`${code} does not take anything off this bag.`);
  return { c, result: { code, discountKobo, label: codeLabel(c) } };
}

const bagSubtotal = (items) => items.reduce((n, i) => {
  const p = product(i.id);
  return n + (p && onSale(p) ? p.priceKobo * i.qty : 0);
}, 0);

export function checkDiscount(code, items) {
  try { return settle(priceCode(code, bagSubtotal(items)).result); }
  catch (err) { return fail(err.message); }
}

export function askForRestock(productId, size, email, colour = '') {
  const p = product(productId);
  const v = variantOf(p, colour, size);
  if (!v) return fail('That piece is not available.', 404);
  if (v.stock > 0) return fail(`${optionText(colour, size)} is in stock — you can buy it now.`, 409);
  const e = email.trim().toLowerCase();
  if (!store.alerts.some(a => a.productId === productId && (a.colour ?? '') === colour && a.size === size && a.email === e)) {
    store.alerts.push({ id: store.nextId++, productId, colour, size, email: e, askedAt: new Date().toISOString() });
    save();
  }
  return settle({ ok: true });
}

export async function startCheckout({ email, name, phone, address, newsletter }, items, discountCode, _session, giftCode) {
  const zone = openZones().find(z => z.zone === zoneFor(address));
  if (!zone) return fail('Sorry — we don’t deliver there yet.');
  // As the server: a postcode only abroad, tidied; none kept for Nigeria.
  const { postcode: rawPostcode = '', ...rest } = address;
  const postcode = address.country === 'Nigeria' ? '' : String(rawPostcode).replace(/\s+/g, ' ').trim().toUpperCase();
  if (postcode && !/^[A-Z0-9][A-Z0-9 -]{1,11}$/.test(postcode)) return fail('Please check the postcode: letters, numbers, spaces and dashes only.');
  address = { ...rest, ...(postcode ? { postcode } : {}) };
  let discount = null;
  if (discountCode) {
    try { discount = priceCode(discountCode, bagSubtotal(items)); } catch (err) { return fail(err.message); }
  }
  const lines = [];
  for (const i of items) {
    const p = product(i.id);
    const colour = i.colour ?? '';
    if (p?.colours.length && !colour) return fail(`Please choose a colour of ${p.name}.`);
    const v = variantOf(p, colour, i.size);
    if (!v) return fail('Something in your bag is no longer available.', 404);
    const what = `${p.name} (${optionText(colour, i.size)})`;
    if (v.stock < i.qty) return fail(v.stock ? `${what} — only ${v.stock} left.` : `${what} has sold out.`, 409);
    lines.push([v, { name: p.name, colour, size: i.size, qty: i.qty, unitPriceKobo: p.priceKobo }]);
  }
  let card = null;
  if (giftCode) {
    try { card = usableGift(giftCode); } catch (err) { return fail(err.message); }
  }
  lines.forEach(([v, l]) => { v.stock -= l.qty; });       // held while paying, as the real shop does
  if (discount) discount.c.uses += 1;
  const reference = 'masq-' + hex(24);
  const itemsKobo = lines.reduce((n, [, l]) => n + l.unitPriceKobo * l.qty, 0);
  const totalKobo = itemsKobo - (discount?.result.discountKobo ?? 0) + zone.feeKobo;
  const giftKobo = card ? Math.min(card.balanceKobo, totalKobo) : 0;
  const paidInFull = giftKobo > 0 && giftKobo === totalKobo;
  if (card) { card.balanceKobo -= giftKobo; card.uses.push({ orderReference: reference, amountKobo: -giftKobo, kind: 'spend', at: new Date().toISOString() }); }
  store.orders.unshift({
    reference, email: email.trim().toLowerCase(), name, phone, address, zone: zone.zone, status: paidInFull ? 'paid' : 'pending',
    fulfilledAt: null, items: lines.map(([, l]) => l), shippingKobo: zone.feeKobo, createdAt: new Date().toISOString(),
    paidAt: paidInFull ? new Date().toISOString() : null,
    discountCode: discount?.result.code ?? null, discountKobo: discount?.result.discountKobo ?? 0,
    giftCode: card?.code ?? null, giftKobo
  });
  const e = email.trim().toLowerCase();
  if (newsletter && !store.subscribers.some(s => s.email === e)) store.subscribers.unshift({ id: Date.now(), email: e, joinedAt: new Date().toISOString() });
  save();
  if (paidInFull) return settle({ reference, authorizationUrl: null, paid: true }, 500);
  return settle({ reference, authorizationUrl: `#/pay?reference=${reference}` }, 500);
}

/** The pretend payment page's two buttons. */
export function finishPayment(reference, paid) {
  const t = topups().find(x => x.reference === reference);
  if (t) {
    if (t.status !== 'pending') return;
    const g = gifts().find(x => x.id === t.cardId);
    if (paid && g?.status === 'active') {
      g.balanceKobo += t.amountKobo;
      g.expiresAt = new Date(Math.max(new Date(g.expiresAt).getTime(), Date.now() + 365 * 86_400_000)).toISOString();
      g.uses.push({ orderReference: null, amountKobo: t.amountKobo, kind: 'topup', at: new Date().toISOString() });
      t.status = 'paid';
    } else t.status = paid ? 'refund_due' : 'abandoned';
    save();
    return;
  }
  const g = gifts().find(x => x.reference === reference);
  if (g) {
    if (g.status !== 'pending') return;
    if (paid) Object.assign(g, { status: 'active', balanceKobo: g.amountKobo, activatedAt: new Date().toISOString(),
                                 expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString() });
    else g.status = 'abandoned';
    save();
    return;
  }
  const o = store.orders.find(x => x.reference === reference);
  if (!o || o.status !== 'pending') return;
  if (paid) { o.status = 'paid'; o.paidAt = new Date().toISOString(); }
  else {
    o.status = 'abandoned';
    for (const l of o.items) {
      const v = store.products.find(p => p.name === l.name)?.sizes.find(s => s.colour === (l.colour ?? '') && s.size === l.size);
      if (v) v.stock += l.qty;
    }
    const c = store.codes.find(x => x.code === o.discountCode);
    if (c) c.uses = Math.max(0, c.uses - 1);
    returnGift(o);
  }
  save();
}

/** What the pretend payment page asks for, and where it sends the payer back
 *  to: an order's remainder, a gift card, or money added to one. */
export function previewDue(reference) {
  const t = topups().find(x => x.reference === reference);
  if (t) return { kobo: t.amountKobo, back: `/gift/${gifts().find(x => x.id === t.cardId)?.code}` };
  const g = gifts().find(x => x.reference === reference);
  if (g) return { kobo: g.amountKobo, back: '/gift-card' };
  const o = store.orders.find(x => x.reference === reference);
  return o ? { kobo: totalOf(o) - (o.giftKobo ?? 0), back: '/order' } : null;
}

const mask = (email) => email.replace(/^(.)[^@]*(@.*)$/, '$1•••$2');
const subtotal = (o) => o.items.reduce((n, i) => n + i.unitPriceKobo * i.qty, 0);
const totalOf = (o) => subtotal(o) - (o.discountKobo ?? 0) + o.shippingKobo;

export function getOrder(reference) {
  const o = store.orders.find(x => x.reference === reference);
  if (!o) return fail('Order not found.', 404);
  return settle({
    reference: o.reference, status: o.status, email: mask(o.email),
    subtotalKobo: subtotal(o), shippingKobo: o.shippingKobo, totalKobo: totalOf(o),
    discountCode: o.discountCode ?? null, discountKobo: o.discountKobo ?? 0,
    giftKobo: o.giftKobo ?? 0, paidByCardKobo: totalOf(o) - (o.giftKobo ?? 0),
    deliveryTo: `${o.address.city}, ${o.address.state}`, payment: null, currency: 'NGN',
    sentAt: o.status === 'paid' ? o.fulfilledAt : null,
    courier: o.status === 'paid' && o.fulfilledAt ? o.courier ?? null : null,
    tracking: o.status === 'paid' && o.fulfilledAt ? o.tracking ?? null : null,
    refundedAt: o.refundedAt ?? null,
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
    totalKobo: totalOf(o), discountCode: o.discountCode ?? null, discountKobo: o.discountKobo ?? 0, giftKobo: o.giftKobo ?? 0,
    courier: o.courier ?? null, tracking: o.tracking ?? null, refundedAt: o.refundedAt ?? null,
    currency: 'NGN', paidAt: o.paidAt, fulfilledAt: o.fulfilledAt,
    createdAt: o.createdAt, items: o.items
  })));
}

export function adminSummary() {
  const paid = store.orders.filter(o => o.status === 'paid');
  return settle({
    paidOrders: paid.length,
    revenueKobo: paid.reduce((n, o) => n + totalOf(o), 0),
    awaitingFulfilment: paid.filter(o => !o.fulfilledAt).length,
    pendingPayment: store.orders.filter(o => o.status === 'pending').length,
    refundDue: 0,
    lowStock: ordered().filter(p => !p.hidden).flatMap(p => p.sizes.filter(s => s.stock <= 3)
      .map(s => ({ name: p.name, colour: s.colour || null, size: s.size, stock: s.stock }))).sort((a, b) => a.stock - b.stock),
    checkoutOpen: openZones().length > 0,
    subscribers: store.subscribers.length,
    alertsReady: store.alerts.filter(a => {
      const p = product(a.productId);
      return p && onSale(p) && (p.sizes.find(s => s.colour === (a.colour ?? '') && s.size === a.size)?.stock ?? 0) > 0;
    }).length
  });
}

export function adminFulfil(reference, { courier = '', tracking = '' } = {}) {
  const o = store.orders.find(x => x.reference === reference);
  if (!o || o.status !== 'paid') return fail('Only a paid order can be marked sent.', 409);
  const clean = (v, max) => String(v).replace(/\s+/g, ' ').trim().slice(0, max) || null;
  o.fulfilledAt ??= new Date().toISOString();
  o.courier = clean(courier, 40);
  o.tracking = clean(tracking, 60);
  save();
  return settle({ ok: true });
}

export function adminRefunded(reference, restock) {
  const o = store.orders.find(x => x.reference === reference);
  if (!o || !['paid', 'refund_due'].includes(o.status)) return fail('Only a paid order can be refunded.', 409);
  if (restock && o.status === 'paid') {
    for (const l of o.items) {
      const v = store.products.find(p => p.name === l.name)?.sizes.find(s => s.colour === (l.colour ?? '') && s.size === l.size);
      if (v) v.stock += l.qty;
    }
  }
  returnGift(o);
  o.status = 'refunded';
  o.refundedAt = new Date().toISOString();
  save();
  return settle({ ok: true, giftReturnedKobo: o.giftKobo ?? 0 });
}

/* Stock as the server reports it (server/routes/admin.js): what is left to
 * sell, plus pieces sold but not sent and pieces being paid for, which are
 * still on the shelf. */
const LOW_STOCK = 3;
function committed(p, s) {
  let toSend = 0, held = 0;
  for (const o of store.orders) for (const i of o.items) {
    if (i.name !== p.name || (i.colour ?? '') !== s.colour || i.size !== s.size) continue;
    if (o.status === 'paid' && !o.fulfilledAt) toSend += i.qty;
    if (o.status === 'pending') held += i.qty;
  }
  return { toSend, held };
}
const stockRows = () => ordered().flatMap(p => p.sizes.map(s => {
  const { toSend, held } = committed(p, s);
  return {
    variantId: s.variantId, productId: p.id, name: p.name, colour: s.colour || null, size: s.size,
    stock: s.stock, toSend, held, shelf: s.stock + toSend + held, priceKobo: p.priceKobo, offSale: p.hidden,
    state: s.stock === 0 ? 'out' : s.stock <= LOW_STOCK ? 'low' : 'ok'
  };
}));
const findLine = (variantId) => {
  for (const p of store.products) for (const s of p.sizes) if (s.variantId === variantId) return { p, s };
  return null;
};
const logStock = (p, s, before, after, shelf, kind = shelf === null ? 'set' : 'count', note = '') => {
  store.stockLog = store.stockLog ?? [];
  store.stockLog.unshift({ id: Date.now() + Math.random(), name: p.name, colour: s.colour || null, size: s.size,
    before, after, shelf, kind, note: note || null, at: new Date().toISOString() });
  store.stockLog.length = Math.min(store.stockLog.length, 100);
};

export const adminStock = () => settle(stockRows());

export function adminSetStock(variantId, stock) {
  const found = findLine(variantId);
  if (!found) return fail('Variant not found.', 404);
  if (found.s.stock !== stock) logStock(found.p, found.s, found.s.stock, stock, null);
  found.s.stock = stock;
  save();
  return settle({ ok: true, variantId, stock });
}

export function adminSaveStockCounts(counts) {
  const lines = counts.map(c => ({ ...findLine(c.variantId), shelf: c.shelf }));
  if (lines.some(l => !l.s)) return fail('One of those lines no longer exists. Reload the page.', 404);
  const short = lines.map(({ p, s, shelf }) => {
    const { toSend, held } = committed(p, s);
    const spoken = toSend + held;
    return shelf < spoken ? `${p.name}, ${s.colour ? `${s.colour}, ` : ''}${s.size}: you counted ${shelf}, but ${spoken} ${spoken === 1 ? 'is' : 'are'} sold or being paid for and not yet sent` : null;
  }).filter(Boolean);
  if (short.length) return fail(`Nothing was saved. ${short.join('; ')}. Count again, or mark those orders sent first.`, 409);
  let changed = 0;
  for (const { p, s, shelf } of lines) {
    const { toSend, held } = committed(p, s);
    const after = shelf - toSend - held;
    if (after !== s.stock) { logStock(p, s, s.stock, after, shelf); s.stock = after; changed++; }
  }
  save();
  return settle({ changed, stock: stockRows() });
}

export function adminReceiveStock(lines, note = '') {
  const clean = String(note ?? '').replace(/\s+/g, ' ').trim();
  if (!lines?.length) return fail('Type how many arrived on at least one line.');
  if (clean.length > 120) return fail('Keep the note under 120 characters.');
  const found = lines.map(l => ({ ...findLine(l.variantId), qty: l.qty }));
  if (found.some(f => !f.s)) return fail('One of those lines no longer exists. Reload the page.', 404);
  if (found.some(f => !Number.isInteger(f.qty) || f.qty < 1)) return fail('How many arrived must be a whole number, 1 or more.');
  for (const { p, s, qty } of found) {
    logStock(p, s, s.stock, s.stock + qty, null, 'delivery', clean);
    s.stock += qty;
  }
  save();
  return settle({ received: found.reduce((n, f) => n + f.qty, 0), lines: found.length, stock: stockRows() });
}

export const adminStockHistory = () => settle(store.stockLog ?? []);

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
  const colours = (b.colours ?? []).map(c => ({ id: store.nextId++, name: titleCase(c.name), hex: cleanHex(c.hex), photo: null }));
  store.products.push({
    id, name, priceKobo, img: '', uploaded: null, badge: null, inDrop: true, featured: true, inEssentials: false,
    hidden: true, position: store.products.length, description: '', details: '', extras: [], colours,
    sizes: (colours.length ? colours.map(c => c.name) : ['']).flatMap(colour =>
      sizes.map(size => ({ variantId: store.nextId++, colour, size, stock: 0 })))
  });
  return current(id);
});

/* "Write it for me": the preview cannot call Claude, so it stands in with a
 * draft put together from the notes, marked as a sample for the admin to say so. */
export const adminWriterStatus = () => settle({ ready: true });
export const adminDraftDescription = (id, notes) => {
  const p = product(id);
  const said = String(notes ?? '').trim();
  if (said.length < 3) return fail('Write a few words about the piece first.');
  const phrases = said.split(/[\n,;.]+/).map(s => s.trim()).filter(Boolean);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const name = p.name.charAt(0) + p.name.slice(1).toLowerCase();
  return settle({
    sample: true,
    description: `${name}, made as a modern artefact to be worn every day. ${phrases.slice(0, 3).map(cap).join('. ')}.`,
    details: phrases.slice(0, 4).map(cap).join('\n')
  }, 1600);
};

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
  if ('availableAt' in b) p.availableAt = b.availableAt || null;
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

const colourNames = (p) => (p.colours.length ? p.colours.map(c => c.name) : ['']);

export const adminAddSize = (id, size) => attempt(() => {
  const p = product(id);
  const s = String(size).trim().toUpperCase();
  if (p.sizes.some(x => x.size === s)) throw new Error(`${s} is already a size of this product.`);
  for (const colour of colourNames(p)) p.sizes.push({ variantId: store.nextId++, colour, size: s, stock: 0 });
  return current(id);
});

export const adminRemoveSize = (id, variantId) => attempt(() => {
  const p = product(id);
  const v = p.sizes.find(s => s.variantId === variantId);
  const rows = p.sizes.filter(s => s.size === v.size);
  const counted = rows.find(r => r.stock > 0);
  if (counted) throw new Error(`Set the ${counted.colour ? `${counted.colour} ` : ''}${v.size} count to 0 first.`);
  if (sizeNames(p).length <= 1 && !p.hidden) throw new Error('A product on sale needs at least one size. Take it off sale first.');
  p.sizes = p.sizes.filter(s => s.size !== v.size);
  return current(id);
});

/* colours, as on the server (server/routes/admin-products.js) */
const titleCase = (v) => String(v ?? '').replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|[\s-])\p{L}/gu, m => m.toUpperCase());
const cleanHex = (v) => {
  const h = String(v ?? '').trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(h)) throw new Error('Pick the colour of its swatch.');
  return h;
};
const colourOf = (p, colourId) => {
  const c = p.colours.find(x => x.id === Number(colourId));
  if (!c) throw new Error('That colour does not exist.');
  return c;
};

export const adminAddColour = (id, name, hex) => attempt(() => {
  const p = product(id);
  const n = titleCase(name);
  if (!n || n.length > 24) throw new Error('Name the colour, in under 24 characters.');
  const h = cleanHex(hex);
  if (p.colours.some(c => c.name === n)) throw new Error(`${n} is already a colour of this product.`);
  if (p.colours.length >= 12) throw new Error('A product can have 12 colours.');
  if (!p.colours.length) {
    p.sizes.forEach(s => { s.colour = n; });
    store.alerts.forEach(a => { if (a.productId === id && !a.colour) a.colour = n; });
  } else {
    for (const size of sizeNames(p)) p.sizes.push({ variantId: store.nextId++, colour: n, size, stock: 0 });
  }
  p.colours.push({ id: store.nextId++, name: n, hex: h, photo: null });
  return current(id);
});

export const adminUpdateColour = (id, colourId, change) => attempt(() => {
  const p = product(id);
  const c = colourOf(p, colourId);
  if ('hex' in change) c.hex = cleanHex(change.hex);
  if ('name' in change) {
    const n = titleCase(change.name);
    if (!n || n.length > 24) throw new Error('Name the colour, in under 24 characters.');
    if (n !== c.name && p.colours.some(x => x.name === n)) throw new Error(`${n} is already a colour of this product.`);
    p.sizes.forEach(s => { if (s.colour === c.name) s.colour = n; });
    store.alerts.forEach(a => { if (a.productId === id && a.colour === c.name) a.colour = n; });
    c.name = n;
  }
  return current(id);
});

export const adminRemoveColour = (id, colourId) => attempt(() => {
  const p = product(id);
  const c = colourOf(p, colourId);
  if (p.colours.length > 1) {
    const counted = p.sizes.find(s => s.colour === c.name && s.stock > 0);
    if (counted) throw new Error(`Set the ${c.name} counts to 0 first (${counted.size} has ${counted.stock}).`);
    p.sizes = p.sizes.filter(s => s.colour !== c.name);
    store.alerts = store.alerts.filter(a => !(a.productId === id && a.colour === c.name));
  } else {
    p.sizes.forEach(s => { s.colour = ''; });
    store.alerts.forEach(a => { if (a.productId === id) a.colour = ''; });
  }
  p.colours = p.colours.filter(x => x !== c);
  return current(id);
});

export const adminUploadColourPhoto = (id, colourId, image, image2x) =>
  attempt(() => { colourOf(product(id), colourId).photo = { img: image, img2x: image2x }; return current(id); }, 600);

export const adminRemoveColourPhoto = (id, colourId) =>
  attempt(() => { colourOf(product(id), colourId).photo = null; return current(id); });

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

export const adminSettings = () => settle({ ...store.settings, home: withHomeDefaults(store.settings.home) });

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
  } else if (key === 'rates') {
    for (const c of GUIDE_CURRENCIES) {
      if (!Number.isInteger(value[c]) || value[c] < 1 || value[c] > 100_000) throw new Error(`${c}: type how many naira make one ${c}, as a whole number.`);
    }
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

/* ------------------------------------------- admin: sales and waiting */

const WEEK = 7 * 86_400_000;
function mondayLagos(t) {
  const local = new Date(new Date(t).getTime() + 3_600_000);
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - ((local.getUTCDay() + 6) % 7));
  return local.getTime() - 3_600_000;
}

export function adminSales() {
  const paid = store.orders.filter(o => o.status === 'paid');
  const from = mondayLagos(Date.now()) - 11 * WEEK;
  const weeks = Array.from({ length: 12 }, (_, i) => ({ start: new Date(from + i * WEEK).toISOString(), revenueKobo: 0, orders: 0 }));
  for (const o of paid) {
    const w = weeks[Math.round((mondayLagos(o.paidAt) - from) / WEEK)];
    if (w) { w.revenueKobo += totalOf(o); w.orders += 1; }
  }
  const tally = (key) => {
    const m = new Map();
    for (const o of paid) for (const i of o.items) {
      const k = key(i); const t = m.get(k) ?? { qty: 0, revenueKobo: 0 };
      t.qty += i.qty; t.revenueKobo += i.qty * i.unitPriceKobo; m.set(k, t);
    }
    return [...m.entries()].sort((a, b) => b[1].qty - a[1].qty);
  };
  const revenue = paid.reduce((n, o) => n + totalOf(o), 0);
  const codes = new Map();
  for (const o of paid) if (o.discountCode) {
    const c = codes.get(o.discountCode) ?? { code: o.discountCode, orders: 0, discountKobo: 0 };
    c.orders += 1; c.discountKobo += o.discountKobo; codes.set(o.discountCode, c);
  }
  return settle({
    weeks,
    totals: { orders: paid.length, revenueKobo: revenue, discountKobo: paid.reduce((n, o) => n + (o.discountKobo ?? 0), 0),
              averageKobo: paid.length ? Math.round(revenue / paid.length) : 0 },
    pieces: tally(i => i.name).slice(0, 8).map(([name, t]) => ({ productId: name, name, ...t })),
    sizes: tally(i => i.size).slice(0, 8).map(([size, t]) => ({ size, qty: t.qty })),
    colours: tally(i => (i.colour ? `${i.name}|${i.colour}` : '')).filter(([k]) => k).slice(0, 8)
      .map(([k, t]) => ({ name: k.split('|')[0], colour: k.split('|')[1], qty: t.qty })),
    codes: [...codes.values()]
  });
}

const shapeCode = (c) => ({
  ...c, label: codeLabel(c),
  ended: Boolean(c.endsAt && new Date(c.endsAt) <= new Date()),
  usedUp: c.maxUses !== null && c.uses >= c.maxUses
});

export const adminDiscounts = () => settle(store.codes.map(shapeCode));

export const adminCreateDiscount = (b) => attempt(() => {
  const code = String(b.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new Error('That code is not valid.');
  if (store.codes.some(c => c.code === code)) throw new Error(`${code} already exists.`);
  if (b.kind === 'percent' && !(Number.isInteger(b.amount) && b.amount >= 1 && b.amount <= 90)) throw new Error('Per cent off must be a whole number from 1 to 90.');
  if (b.kind === 'fixed' && !(Number.isInteger(b.amount) && b.amount >= 100)) throw new Error('Naira off must be a whole number of naira, ₦100 or more.');
  const c = { code, kind: b.kind, amount: b.kind === 'fixed' ? b.amount * 100 : b.amount,
              minSpendKobo: (b.minSpendNaira || 0) * 100, maxUses: b.maxUses ?? null, uses: 0,
              endsAt: b.endsAt ?? null, active: true };
  store.codes.unshift(c);
  return shapeCode(c);
});

export const adminUpdateDiscount = (code, change) => attempt(() => {
  const c = store.codes.find(x => x.code === code);
  Object.assign(c, change);
  return shapeCode(c);
});

export const adminDeleteDiscount = (code) =>
  attempt(() => { store.codes = store.codes.filter(c => c.code !== code); return { ok: true }; });

export function adminStockAlerts() {
  const groups = [];
  for (const p of ordered()) for (const s of p.sizes) {
    const people = store.alerts.filter(a => a.productId === p.id && (a.colour ?? '') === s.colour && a.size === s.size)
      .map(a => ({ id: a.id, email: a.email, askedAt: a.askedAt }));
    if (people.length) groups.push({ productId: p.id, name: p.name, colour: s.colour || null, size: s.size, stock: s.stock, people });
  }
  return settle(groups);
}

export const adminClearAlerts = (productId, size, colour = '') => attempt(() => {
  const before = store.alerts.length;
  store.alerts = store.alerts.filter(a => !(a.productId === productId && (a.colour ?? '') === (colour ?? '') && a.size === size));
  return { ok: true, cleared: before - store.alerts.length };
});

export const adminRemoveAlert = (id) =>
  attempt(() => { store.alerts = store.alerts.filter(a => a.id !== id); return { ok: true }; });

/* ---------------------------------------------------------- customers */

/* As server/routes/admin-customers.js: one record per email, joined up from
 * orders, the mailing list and restock requests, plus the owner's tags and
 * notes (kept here under store.customers). */

const notesOf = () => (store.customers ??= {});

function people() {
  const emails = new Set([
    ...store.orders.map(o => o.email.toLowerCase()),
    ...store.subscribers.map(s => s.email.toLowerCase()),
    ...store.alerts.map(a => a.email.toLowerCase()),
    ...Object.entries(notesOf()).filter(([, c]) => c.notes || c.tags.length).map(([e]) => e)
  ]);
  const list = [...emails].filter(e => !e.endsWith('@removed.invalid')).map(personOf);
  const latest = (p) => p.lastOrderAt ?? p.firstSeenAt ?? '';
  return list.sort((a, b) => latest(b).localeCompare(latest(a)) || a.email.localeCompare(b.email));
}

function personOf(email) {
  const mine = store.orders.filter(o => o.email.toLowerCase() === email);
  const paid = mine.filter(o => o.status === 'paid');
  const named = [...mine].filter(o => o.name).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const sub = store.subscribers.find(s => s.email.toLowerCase() === email);
  const alerts = store.alerts.filter(a => a.email.toLowerCase() === email);
  const c = notesOf()[email];
  const dates = (xs) => xs.filter(Boolean).sort();
  return {
    email, name: named?.name ?? null, phone: named?.phone ?? null,
    city: named?.address?.city ?? null, state: named?.address?.state ?? null, country: named?.address?.country ?? null,
    orders: paid.length, spentKobo: paid.reduce((n, o) => n + totalOf(o), 0),
    unfinished: mine.filter(o => ['pending', 'abandoned', 'failed'].includes(o.status)).length,
    firstOrderAt: dates(paid.map(o => o.createdAt))[0] ?? null,
    lastOrderAt: dates(paid.map(o => o.createdAt)).at(-1) ?? null,
    subscribed: Boolean(sub), subscribedAt: sub?.joinedAt ?? null,
    waiting: alerts.length, tags: c?.tags ?? [], notes: c?.notes ?? '',
    firstSeenAt: dates([...mine.map(o => o.createdAt), sub?.joinedAt, ...alerts.map(a => a.askedAt), c?.createdAt])[0] ?? null,
    kind: paid.length ? 'buyer' : 'prospect',
    address: named?.address ?? null
  };
}

const known = (email) => people().find(p => p.email === String(email).trim().toLowerCase());

export const adminCustomers = () => settle(people().map(({ address, ...p }) => p));

export function adminCustomer(email) {
  const p = known(email);
  if (!p) return fail('No one with that email.', 404);
  const orderList = store.orders.filter(o => o.email.toLowerCase() === p.email)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(o => ({ reference: o.reference, status: o.status, placedAt: o.createdAt, sentAt: o.fulfilledAt ?? null,
                 totalKobo: totalOf(o), items: o.items.map(i => ({ name: i.name, colour: i.colour || null, size: i.size, qty: i.qty })) }));
  const waitingFor = store.alerts.filter(a => a.email.toLowerCase() === p.email)
    .map(a => ({ name: product(a.productId)?.name ?? 'A piece no longer listed', colour: a.colour || null, size: a.size, askedAt: a.askedAt }));
  return settle({ ...p, orderList, waitingFor });
}

export const adminUpdateCustomer = (email, change) => attempt(() => {
  const p = known(email);
  if (!p) throw new Error('No one with that email.');
  const c = notesOf()[p.email] ??= { tags: [], notes: '', createdAt: new Date().toISOString() };
  if ('tags' in change) {
    const tags = [...new Set(change.tags.map(t => String(t ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
    if (tags.length > 10) throw new Error('Up to 10 tags.');
    if (tags.some(t => t.length > 24)) throw new Error('Keep each tag under 24 characters.');
    c.tags = tags;
  }
  if ('notes' in change) {
    const notes = String(change.notes).replace(/\r\n?/g, '\n').trim();
    if (notes.length > 2000) throw new Error('Keep notes under 2,000 characters.');
    c.notes = notes;
  }
  const { address, ...out } = personOf(p.email);
  return out;
});

export const adminForgetCustomer = (email) => attempt(() => {
  const p = known(email);
  if (!p) throw new Error('No one with that email.');
  const mine = store.orders.filter(o => o.email.toLowerCase() === p.email);
  if (mine.some(o => o.status === 'pending' || (o.status === 'paid' && !o.fulfilledAt))) {
    throw new Error('This person has an order still being paid for or waiting to be sent. Send it (or refund it) first.');
  }
  mine.forEach(o => Object.assign(o, { email: `removed-${store.nextId++}@removed.invalid`, name: null, phone: null, address: null }));
  store.subscribers = store.subscribers.filter(s => s.email.toLowerCase() !== p.email);
  store.alerts = store.alerts.filter(a => a.email.toLowerCase() !== p.email);
  delete notesOf()[p.email];
  return { ok: true, ordersKeptWithoutName: mine.length };
});

/* ---------------------------------------------------------- gift cards */

/* As server/lib/giftcards.js: bought with a payment of its own (the pretend
 * payment page here), live for twelve months, spent at checkout after any
 * discount, delivery included; given back if that order is not paid. */

const gifts = () => (store.giftCards ??= []);
const topups = () => (store.giftTopups ??= []);
const GIFT_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const giftCode = () => `MASQ-${[0, 0, 0, 0].map(() => GIFT_CHARS[Math.floor(Math.random() * GIFT_CHARS.length)]).join('')}-${[0, 0, 0, 0].map(() => GIFT_CHARS[Math.floor(Math.random() * GIFT_CHARS.length)]).join('')}`;
const cleanGift = (v) => {
  const raw = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('MASQ') ? raw.slice(4) : raw;
  return /^[A-Z0-9]{8}$/.test(body) ? `MASQ-${body.slice(0, 4)}-${body.slice(4)}` : null;
};

function usableGift(raw) {
  const code = cleanGift(raw);
  if (!code) throw new Error('That is not a gift card code. It looks like MASQ-XXXX-XXXX.');
  const g = gifts().find(x => x.code === code);
  if (!g || g.status === 'pending' || g.status === 'abandoned') throw new Error(`${code} is not a gift card we recognise.`);
  if (g.status === 'cancelled') throw new Error(`${code} has been cancelled.`);
  if (new Date(g.expiresAt) <= new Date()) throw new Error(`${code} has run out.`);
  if (g.balanceKobo <= 0) throw new Error(`${code} has been spent.`);
  return g;
}

function returnGift(o) {
  if (!o.giftCode || !o.giftKobo) return;
  const g = gifts().find(x => x.code === o.giftCode);
  if (!g) return;
  g.balanceKobo += o.giftKobo;
  g.uses.push({ orderReference: o.reference, amountKobo: o.giftKobo, kind: 'return', at: new Date().toISOString() });
}

const GIFT_DESIGNS = ['violet', 'night', 'teal', 'clay', 'rose'];
const giftDesign = (v) => GIFT_DESIGNS.includes(v) ? v : 'violet';

export function buyGiftCard({ amountKobo, email, recipientName, recipientEmail, message, design }) {
  if (!Number.isInteger(amountKobo) || amountKobo % 100 || amountKobo < 500000 || amountKobo > 50000000) {
    return fail('Choose an amount from ₦5,000 to ₦500,000, in whole naira.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? '').trim())) return fail('Please enter your email, for the receipt.');
  const reference = 'gift-' + hex(24);
  gifts().unshift({
    id: store.nextId++, code: giftCode(), amountKobo, balanceKobo: 0, status: 'pending', reference,
    buyerEmail: email.trim().toLowerCase(), recipientName: (recipientName ?? '').trim() || null,
    recipientEmail: recipientEmail || null, message: (message ?? '').trim() || null, note: null,
    design: giftDesign(design), activatedAt: null, expiresAt: null, uses: []
  });
  save();
  return settle({ reference, authorizationUrl: `#/pay?reference=${reference}`, amountKobo }, 500);
}

export function getGiftCard(reference) {
  const g = gifts().find(x => x.reference === reference);
  if (!g) return fail('Gift card not found.', 404);
  const live = g.status === 'active';
  return settle({
    reference, status: g.status, amountKobo: g.amountKobo, balanceKobo: live ? g.balanceKobo : null,
    code: live ? g.code : null, expiresAt: live ? g.expiresAt : null,
    recipientName: g.recipientName, message: g.message, design: giftDesign(g.design), payment: null
  });
}

/** As POST /api/gift-cards/topups: add money to a card that works. */
export function topUpGiftCard({ code: raw, amountKobo, email }) {
  const code = cleanGift(raw);
  const g = code && gifts().find(x => x.code === code && (x.status === 'active' || x.status === 'cancelled'));
  if (!g) return fail('We could not find a gift card with that code.', 404);
  if (g.status === 'cancelled') return fail('This card has been cancelled, so money cannot be added to it.');
  if (new Date(g.expiresAt) <= new Date()) return fail('This card has run out, so money cannot be added to it.');
  if (!Number.isInteger(amountKobo) || amountKobo % 100 || amountKobo < 500000 || amountKobo > 50000000) {
    return fail('Choose an amount from ₦5,000 to ₦500,000, in whole naira.');
  }
  if (g.balanceKobo + amountKobo > 50000000) return fail('A card holds up to ₦500,000.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email ?? '').trim())) return fail('Please enter your email, for the receipt.');
  const reference = 'gtop-' + hex(24);
  topups().push({ id: store.nextId++, cardId: g.id, amountKobo, reference, email: email.trim().toLowerCase(), status: 'pending' });
  save();
  return settle({ reference, authorizationUrl: `#/pay?reference=${reference}`, amountKobo }, 500);
}

/** As GET /api/gift-cards/topups/:reference. */
export function getTopup(reference) {
  const t = topups().find(x => x.reference === reference);
  if (!t) return fail('Top-up not found.', 404);
  const g = gifts().find(x => x.id === t.cardId);
  const paid = t.status === 'paid';
  return settle({ reference, status: t.status, amountKobo: t.amountKobo, code: g?.code,
    balanceKobo: paid ? g.balanceKobo : null, expiresAt: paid ? g.expiresAt : null, payment: null });
}

/** As POST /api/gift-cards/open: the card as the person given it sees it. */
export function openGiftCard(raw) {
  const code = cleanGift(raw);
  const g = code && gifts().find(x => x.code === code && (x.status === 'active' || x.status === 'cancelled'));
  if (!g) return fail('We could not find a gift card with that code. Check it against the message you were sent.', 404);
  return settle({
    code: g.code, state: giftState(g), amountKobo: g.amountKobo, balanceKobo: g.balanceKobo, expiresAt: g.expiresAt,
    recipientName: g.recipientName, message: g.message, design: giftDesign(g.design)
  });
}

export function checkGiftCard(code) {
  try { const g = usableGift(code); return settle({ code: g.code, balanceKobo: g.balanceKobo, expiresAt: g.expiresAt }); }
  catch (err) { return fail(err.message); }
}

const giftState = (g) => g.status === 'cancelled' ? 'cancelled'
  : new Date(g.expiresAt) <= new Date() ? 'expired' : g.balanceKobo === 0 ? 'spent' : 'active';
const shapeGift = (g) => ({
  id: g.id, code: g.code, amountKobo: g.amountKobo, balanceKobo: g.balanceKobo, state: giftState(g),
  madeBy: g.reference ? 'customer' : 'shop', buyerEmail: g.buyerEmail, recipientName: g.recipientName,
  recipientEmail: g.recipientEmail, message: g.message, design: giftDesign(g.design), note: g.note, activatedAt: g.activatedAt,
  expiresAt: g.expiresAt, uses: g.uses,
  topupsToRefund: topups().filter(t => t.cardId === g.id && t.status === 'refund_due').map(t => ({ reference: t.reference, amountKobo: t.amountKobo, email: t.email, at: null }))
});

export function adminGiftCards() {
  const cards = gifts().filter(g => g.status === 'active' || g.status === 'cancelled').map(shapeGift);
  const live = cards.filter(c => c.state === 'active');
  const sold = cards.filter(c => c.madeBy === 'customer');
  return settle({ cards, totals: {
    soldCount: sold.length, soldKobo: sold.reduce((n, c) => n + c.amountKobo, 0) + topups().filter(t => t.status === 'paid').reduce((n, t) => n + t.amountKobo, 0),
    outstandingKobo: live.reduce((n, c) => n + c.balanceKobo, 0), liveCount: live.length
  } });
}

export const adminMakeGiftCard = ({ amountKobo, recipientName, note, design }) => attempt(() => {
  if (!Number.isInteger(amountKobo) || amountKobo % 100 || amountKobo < 50000 || amountKobo > 50000000) {
    throw new Error('Choose an amount from ₦500 to ₦500,000, in whole naira.');
  }
  const g = {
    id: store.nextId++, code: giftCode(), amountKobo, balanceKobo: amountKobo, status: 'active', reference: null,
    buyerEmail: null, recipientName: (recipientName ?? '').trim() || null, recipientEmail: null, message: null,
    note: (note ?? '').trim() || null, design: giftDesign(design), activatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(), uses: []
  };
  gifts().unshift(g);
  return shapeGift(g);
});

export const adminCancelGiftCard = (id) => attempt(() => {
  const g = gifts().find(x => x.id === id && x.status === 'active');
  if (!g) throw new Error('No working gift card with that number.');
  g.status = 'cancelled';
  return shapeGift(g);
});

/** Downloads cannot leave a preview page, so this says so instead. */
export const adminDownload = () => fail('Downloads are switched off in this preview. On the live shop this saves a spreadsheet.');

/* ------------------------------------------------------------- visits */

/** The preview counts nothing: its VISITORS tab shows made-up sample figures. */
export function sendEvent() {}

export const adminAnalytics = (range) => settle(sampleReport(range), 300);
