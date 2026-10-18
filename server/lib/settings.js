import { one, query } from '../db.js';
import { HOME_DEFAULT, NAV } from '../../src/data/home.js';
import { PAGES, PAGES_DEFAULT } from '../../src/data/pages.js';
import { GUIDE_CURRENCIES, DEFAULT_RATES } from '../../src/data/currencies.js';

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

export { PAGES };

function validPages(value) {
  if (!value || typeof value !== 'object') throw bad('Page text is missing.');
  const out = {};
  for (const page of PAGES) {
    // A page added after the owner last saved falls back to its default
    // rather than making the whole saved set invalid.
    const text = value[page] ?? PAGES_DEFAULT[page];
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

/* ---------------------------------------------------------- home page */

/* Every line of words on the home page, and the menu. The defaults
 * (src/data/home.js, shared with the shop) are the design's own words, so a
 * shop that never touches this looks exactly as built. Plain text; line
 * breaks are kept where a line can wrap in two. */

export { NAV };

/** [max length, may it span lines?] for each piece of text. */
export const HOME_FIELDS = {
  heroEyebrow: [40, false], heroSub: [120, true], heroText: [220, true], heroButton: [24, false],
  heroButton2: [24, false], heroImageAlt: [140, false], heroImageAlt2: [140, false],
  craftTitle: [60, false], craftText: [240, true], dropTitle: [60, false],
  manifestoLine1: [60, false], manifestoLine2: [60, false], manifestoTag: [80, false], manifestoMore: [24, false],
  filmWords: [80, true],
  perk1Title: [40, false], perk1Text: [80, false], perk2Title: [40, false], perk2Text: [80, false],
  perk3Title: [40, false], perk3Text: [80, false],
  essentialsTitle: [40, false], newsletterTitle: [60, false], newsletterNote: [200, true],
  countdownTitle: [40, false], welcomeTitle: [60, false], welcomeNote: [200, true]
};

/** Seconds the welcome pop-up waits after a visitor lands: from at once to a minute. */
export const WELCOME_DELAYS = [0, 2, 4, 8, 15, 30, 60];

export function cleanText(v, { label, max, multiline = true, allowEmpty = false }) {
  if (typeof v !== 'string') throw bad(`${label}: text is missing.`);
  let t = v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  t = multiline ? t.replace(/\n{3,}/g, '\n\n').trim() : t.replace(/\s+/g, ' ').trim();
  if (!t && !allowEmpty) throw bad(`${label}: write something, or it will be blank on the page.`);
  if (t.length > max) throw bad(`${label}: keep it under ${max} characters.`);
  return t;
}

function validHome(value) {
  if (!value || typeof value !== 'object') throw bad('Home page text is missing.');
  const out = {};
  for (const [key, [max, multiline]] of Object.entries(HOME_FIELDS)) {
    out[key] = cleanText(value[key] ?? HOME_DEFAULT[key], { label: key, max, multiline });
  }
  const w = value.welcome ?? HOME_DEFAULT.welcome;
  const delay = w.delay ?? HOME_DEFAULT.welcome.delay;
  if (!WELCOME_DELAYS.includes(delay)) throw bad(`Welcome pop-up: wait one of ${WELCOME_DELAYS.join(', ')} seconds.`);
  out.welcome = { show: w.show !== false, delay };
  out.nav = {};
  for (const item of NAV) {
    const n = value.nav?.[item] ?? HOME_DEFAULT.nav[item];
    out.nav[item] = {
      label: cleanText(n.label ?? '', { label: `Menu: ${item}`, max: 20, multiline: false }).toUpperCase(),
      show: n.show !== false
    };
  }
  return out;
}

/* ------------------------------------------------- top photo switching */

/* With a second photo at the top of the home page, the two fade into each
 * other every so many seconds; 0 keeps the first one only. */
export const HERO_SWITCH_SECONDS = [0, 5, 8, 12, 20];
const HERO_SWITCH_DEFAULT = { every: 8 };

function validHeroSwitch(value) {
  const every = value?.every;
  if (!HERO_SWITCH_SECONDS.includes(every)) {
    throw bad(`Top photos: switch every ${HERO_SWITCH_SECONDS.filter(Boolean).join(', ')} seconds, or not at all.`);
  }
  return { every };
}

/* ---------------------------------------------------------- price guide */

/* Naira for one dollar, pound and euro: only for showing prices as a guide.
 * Nobody is ever charged in these. */
function validRates(value) {
  if (!value || typeof value !== 'object') throw bad('Rates are missing.');
  const out = {};
  for (const c of GUIDE_CURRENCIES) {
    const v = value[c];
    if (!Number.isInteger(v) || v < 1 || v > 100_000) throw bad(`${c}: type how many naira make one ${c}, as a whole number.`);
    out[c] = v;
  }
  return out;
}

/* -------------------------------------------------------------- store */

const SPEC = {
  delivery: { fallback: DELIVERY_DEFAULT, validate: validDelivery },
  pages:    { fallback: PAGES_DEFAULT,    validate: validPages },
  social:   { fallback: SOCIAL_DEFAULT,   validate: validSocial },
  film:     { fallback: { url: '', kind: null, youtubeId: null }, validate: validFilm },
  home:     { fallback: HOME_DEFAULT,      validate: validHome },
  rates:    { fallback: DEFAULT_RATES,     validate: validRates },
  heroSwitch: { fallback: HERO_SWITCH_DEFAULT, validate: validHeroSwitch }
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

/* ------------------------------------------------- home page photos */

/* The wide photos on the home page (hero2 is the optional second photo at
 * the top, which takes turns with the first). Kept apart from the `home` text so
 * that they can only be set by uploading — a settings save cannot point them
 * at some other image, such as a product's, which replacing would delete. */

export const HOME_SLOTS = ['hero', 'hero2', 'band', 'countdown', 'film'];

export async function getHomeImages() {
  const row = await one("SELECT value FROM settings WHERE key = 'home_images'");
  let ids = {};
  try { ids = JSON.parse(row?.value ?? '{}'); } catch { /* fall back to none */ }
  // Only ids whose image still exists.
  const wanted = HOME_SLOTS.map(s => ids[s]).filter(Number.isInteger);
  const present = wanted.length
    ? new Set((await query('SELECT id FROM images WHERE id = ANY($1::int[])', [wanted])).map(r => r.id))
    : new Set();
  return Object.fromEntries(HOME_SLOTS.map(s => [s, present.has(ids[s]) ? ids[s] : null]));
}

export async function setHomeImage(tx, slot, imageId) {
  const row = await tx.one("SELECT value FROM settings WHERE key = 'home_images' FOR UPDATE");
  let ids = {};
  try { ids = JSON.parse(row?.value ?? '{}'); } catch { /* start again */ }
  const previous = Number.isInteger(ids[slot]) ? ids[slot] : null;
  ids[slot] = imageId;
  await tx.query(`
    INSERT INTO settings (key, value, updated_at) VALUES ('home_images', $1, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `, [JSON.stringify(ids)]);
  return previous;
}
