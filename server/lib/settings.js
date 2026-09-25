import { one, query } from '../db.js';

/* Everything the owner can change about the shop that is not a product:
 * delivery fees, the footer pages, social links and the film link.
 *
 * Each setting has a validator. Nothing reaches the database, and so nothing
 * reaches a customer's screen, without passing through one — these values are
 * shown on the public site, so a link has to be a real https link and a page
 * has to be plain text. */

const MAX_FEE_KOBO = 100_000_00;          // ₦100,000 — a guard, not a policy
const MAX_PAGE_CHARS = 4000;

/* ------------------------------------------------------------ delivery */

/** The zones a delivery address can fall into, in the order they are shown. */
export const ZONES = ['lagos', 'abuja', 'nigeria', 'international'];

export const ZONE_LABELS = {
  lagos: 'Lagos',
  abuja: 'Abuja (FCT)',
  nigeria: 'Rest of Nigeria',
  international: 'Outside Nigeria'
};

/* Every zone starts switched off, with no fee. Delivery prices are the owner's
 * decision, and a default of ₦0 would quietly give delivery away — so checkout
 * stays closed until at least one zone has been set. */
const DELIVERY_DEFAULT = Object.fromEntries(ZONES.map(z => [z, { enabled: false, feeKobo: null }]));

function validDelivery(value) {
  if (!value || typeof value !== 'object') throw bad('Delivery settings are missing.');
  const out = {};
  for (const zone of ZONES) {
    const z = value[zone] ?? {};
    const enabled = z.enabled === true;
    const fee = z.feeKobo;
    if (enabled) {
      if (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE_KOBO) {
        throw bad(`${ZONE_LABELS[zone]}: set a delivery fee between ₦0 and ₦100,000.`);
      }
    } else if (fee !== null && fee !== undefined && (!Number.isInteger(fee) || fee < 0 || fee > MAX_FEE_KOBO)) {
      throw bad(`${ZONE_LABELS[zone]}: that fee is not a whole number of naira.`);
    }
    out[zone] = { enabled, feeKobo: Number.isInteger(fee) ? fee : null };
  }
  return out;
}

/* ---------------------------------------------------------- page copy */

export const PAGES = ['FAQ', 'SHIPPING', 'RETURNS', 'CONTACT', 'PRIVACY'];

/* The first four are the copy from the original design. CONTACT holds
 * placeholder details and must be replaced before launch. PRIVACY describes
 * what this code actually collects and why — it is a factual starting point
 * for the owner to review, not legal advice. */
const PAGES_DEFAULT = {
  FAQ:      'Sizing, care and drop mechanics. Pieces run true to size; every MASQ. artifact ships with an authenticity card bearing its own mask number.',
  SHIPPING: 'Lagos & Abuja: 1–3 working days. Rest of Nigeria: 3–5 working days. The delivery fee for your address is shown before you pay.',
  RETURNS:  'Unworn pieces may be returned within 14 days of delivery with tags and authenticity card intact. Limited jacket releases are final sale.',
  CONTACT:  'studio@masq.ng · +234 000 0000 · The Studio, 14 Ikoyi Crescent, Lagos. Monday to Friday, 10:00 – 18:00 WAT.',
  PRIVACY:
    'When you order, we collect your name, email, phone number and delivery address, and use them only to deliver your order and contact you about it.\n\n' +
    'Payments are handled by Paystack. We never see or store your card details.\n\n' +
    'If you join the list, we keep your email address to tell you about new drops. We do not sell or share your details.\n\n' +
    'To see or delete what we hold about you, contact us using the details on the Contact page.'
};

function validPages(value) {
  if (!value || typeof value !== 'object') throw bad('Page text is missing.');
  const out = {};
  for (const page of PAGES) {
    const text = value[page];
    if (typeof text !== 'string') throw bad(`${page}: text is missing.`);
    // Plain text only. It is rendered as text, never as HTML, but control
    // characters have no business in it either.
    const clean = text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
    if (!clean) throw bad(`${page}: write something, or the page will be empty.`);
    if (clean.length > MAX_PAGE_CHARS) throw bad(`${page}: keep it under ${MAX_PAGE_CHARS} characters.`);
    out[page] = clean;
  }
  return out;
}

/* -------------------------------------------------------------- links */

export const SOCIAL = ['instagram', 'tiktok', 'x'];
const SOCIAL_DEFAULT = { instagram: '', tiktok: '', x: '' };

/** An https link or nothing. Rules out javascript:, data: and friends. */
function httpsUrl(raw, label) {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  let url;
  try { url = new URL(v); } catch { throw bad(`${label}: that is not a web address.`); }
  if (url.protocol !== 'https:') throw bad(`${label}: use a link that starts with https://`);
  if (v.length > 300) throw bad(`${label}: that link is too long.`);
  return url.toString();
}

function validSocial(value) {
  if (!value || typeof value !== 'object') throw bad('Social links are missing.');
  return {
    instagram: httpsUrl(value.instagram, 'Instagram'),
    tiktok:    httpsUrl(value.tiktok, 'TikTok'),
    x:         httpsUrl(value.x, 'X')
  };
}

/**
 * The film: a YouTube link or a direct .mp4 link. Stored as what the page
 * needs to play it — a YouTube id is reduced to its 11 safe characters, so
 * nothing the owner types is ever placed into an embed address as-is.
 */
export function parseFilm(raw) {
  const v = String(raw ?? '').trim();
  if (!v) return { url: '', kind: null, youtubeId: null };
  const url = new URL(httpsUrl(v, 'Film'));
  const host = url.hostname.replace(/^www\.|^m\./, '');

  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    id = url.searchParams.get('v')
      ?? url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1]
      ?? null;
  }
  if (id !== null) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw bad('Film: that YouTube link has no video in it.');
    return { url: url.toString(), kind: 'youtube', youtubeId: id };
  }
  if (/\.mp4$/i.test(url.pathname)) return { url: url.toString(), kind: 'mp4', youtubeId: null };
  throw bad('Film: use a YouTube link, or a link that ends in .mp4');
}

function validFilm(value) {
  return parseFilm(value?.url);
}

/* -------------------------------------------------------------- store */

const SPEC = {
  delivery: { fallback: DELIVERY_DEFAULT, validate: validDelivery },
  pages:    { fallback: PAGES_DEFAULT,    validate: validPages },
  social:   { fallback: SOCIAL_DEFAULT,   validate: validSocial },
  film:     { fallback: { url: '', kind: null, youtubeId: null }, validate: validFilm }
};

export const SETTING_KEYS = Object.keys(SPEC);

function bad(message) {
  return Object.assign(new Error(message), { status: 400 });
}

/** A setting, or its default. A stored value that no longer validates falls back too. */
export async function getSetting(key) {
  const spec = SPEC[key];
  if (!spec) throw new Error(`unknown setting ${key}`);
  const row = await one('SELECT value FROM settings WHERE key = $1', [key]);
  if (!row) return structuredClone(spec.fallback);
  try { return spec.validate(JSON.parse(row.value)); }
  catch { return structuredClone(spec.fallback); }
}

export async function getSettings(keys = SETTING_KEYS) {
  const out = {};
  for (const k of keys) out[k] = await getSetting(k);
  return out;
}

/** Validate, then store. Throws a 400-shaped error naming what is wrong. */
export async function setSetting(key, value) {
  const spec = SPEC[key];
  if (!spec) throw bad(`There is no setting called ${key}.`);
  const clean = spec.validate(value);
  await query(`
    INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `, [key, JSON.stringify(clean)]);
  return clean;
}

/* ----------------------------------------------------------- delivery */

/** The zones open for delivery, with their fees. Empty means checkout is closed. */
export async function openZones() {
  const d = await getSetting('delivery');
  return ZONES.filter(z => d[z].enabled).map(z => ({ zone: z, label: ZONE_LABELS[z], feeKobo: d[z].feeKobo }));
}

/**
 * Which zone an address is in. Decided here, from the address, never taken
 * from the browser — a customer in Kano cannot pick the Lagos fee.
 */
export function zoneFor({ country, state }) {
  const c = String(country ?? '').trim().toLowerCase();
  if (c !== 'nigeria' && c !== 'ng') return 'international';
  const s = String(state ?? '').trim().toLowerCase().replace(/\s+state$/, '');
  if (s === 'lagos') return 'lagos';
  if (['abuja', 'fct', 'federal capital territory', 'abuja (fct)', 'fct abuja'].includes(s)) return 'abuja';
  return 'nigeria';
}

/** The 36 states and the FCT, for the checkout form and its validation. */
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba',
  'Yobe', 'Zamfara'
];
