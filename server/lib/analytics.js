import { createHash, randomBytes } from 'node:crypto';
import { one, query } from '../db.js';
import { ZONE_COUNTRY } from './timezones.js';

/* Counting visits without following anyone.
 *
 *   - No cookies. A visit is a random id the browser keeps for that tab
 *     (sessionStorage), gone when the tab closes or after 30 idle minutes.
 *   - A visitor is a scrambled code made from their internet address and
 *     browser with a secret that is replaced every day and then forgotten.
 *     Today's visitor cannot be matched to yesterday's — not even by us —
 *     and the address itself is never stored.
 *   - Detail is kept for 90 days; after that only daily totals remain.
 *
 * This is the approach Plausible and Fathom use. It counts a person on two
 * devices, or on two days, twice; that is the price of not tracking them. */

const KEEP_DAYS = 90;
const LAGOS_MS = 60 * 60_000;            // WAT is UTC+1 all year

/** "2026-10-13" for the Lagos day containing `t`. */
export const lagosDay = (t = Date.now()) => new Date(new Date(t).getTime() + LAGOS_MS).toISOString().slice(0, 10);

/* ----------------------------------------------------------- visitor id */

let salt = null;   // { day, value }

async function dailySalt() {
  const day = lagosDay();
  if (salt?.day === day) return salt.value;
  const row = await one("SELECT value FROM settings WHERE key = 'analytics_salt'");
  let stored = null;
  try { stored = JSON.parse(row?.value ?? 'null'); } catch { /* make a new one */ }
  if (stored?.day === day && typeof stored.value === 'string') {
    salt = stored;
    return salt.value;
  }
  // A new day: a new secret, and yesterday's is overwritten for good.
  salt = { day, value: randomBytes(32).toString('hex') };
  await query(`
    INSERT INTO settings (key, value, updated_at) VALUES ('analytics_salt', $1, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `, [JSON.stringify(salt)]);
  return salt.value;
}

export async function visitorId(ip, userAgent) {
  const s = await dailySalt();
  return createHash('sha256').update(`${s}|${ip}|${userAgent}`).digest('hex').slice(0, 20);
}

/* ------------------------------------------------------------ the device */

const BOT = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|preview|facebookexternalhit|whatsapp\/|curl|wget|python|node-fetch|axios|go-http|java\/|httpclient|monitor|uptime/i;
export const isBot = (ua) => !ua || BOT.test(ua);

export function parseAgent(ua = '') {
  const os =
    /iPhone|iPad|iPod/.test(ua) ? 'iOS' :
    /Android/.test(ua) ? 'Android' :
    /Windows/.test(ua) ? 'Windows' :
    /CrOS/.test(ua) ? 'ChromeOS' :
    /Mac OS X|Macintosh/.test(ua) ? 'macOS' :
    /Linux/.test(ua) ? 'Linux' : 'Other';
  // In-app browsers first: a link tapped inside Instagram opens in Instagram.
  const browser =
    /Instagram/.test(ua) ? 'Instagram app' :
    /FBAN|FBAV|FB_IAB/.test(ua) ? 'Facebook app' :
    /BytedanceWebview|musical_ly|TikTok/i.test(ua) ? 'TikTok app' :
    /Snapchat/.test(ua) ? 'Snapchat app' :
    /Opera Mini|OPiOS/.test(ua) ? 'Opera Mini' :
    /OPR\/|Opera/.test(ua) ? 'Opera' :
    /SamsungBrowser/.test(ua) ? 'Samsung Internet' :
    /Edg\//.test(ua) ? 'Edge' :
    /CriOS|Chrome\//.test(ua) ? 'Chrome' :
    /FxiOS|Firefox\//.test(ua) ? 'Firefox' :
    /Safari\//.test(ua) ? 'Safari' : 'Other';
  return { os, browser };
}

/** Phone, tablet or computer, from the screen width the page reported. */
export function deviceFor(width, ua = '') {
  if (/iPad|Tablet/.test(ua)) return 'Tablet';
  if (!Number.isInteger(width) || width <= 0) return /Mobi|Android|iPhone/.test(ua) ? 'Phone' : 'Computer';
  return width < 768 ? 'Phone' : width < 1100 ? 'Tablet' : 'Computer';
}

export const countryFor = (tz) => (typeof tz === 'string' && ZONE_COUNTRY[tz]) || null;

/* ------------------------------------------------------------ the source */

/**
 * Where a visit came from, in the owner's words. A tagged link (utm_source)
 * wins over the referring site, which wins over the in-app browser it opened
 * in. WhatsApp sends no referrer, so untagged WhatsApp links count as Direct
 * — the admin's link builder exists to fix exactly that.
 */
export function channelFor({ referrer, utmSource, utmMedium, browser }) {
  const source = String(utmSource || '').toLowerCase();
  const medium = String(utmMedium || '').toLowerCase();
  const host = String(referrer || '').toLowerCase();
  const said = source || host || (browser?.endsWith(' app') ? browser.toLowerCase() : '');

  if (/^(email|e-mail|newsletter)$/.test(medium) || /mail/.test(source)) return 'Email';
  const rules = [
    [/instagram|^ig$/, 'Instagram'],
    [/whatsapp|wa\.me|^wa$/, 'WhatsApp'],
    [/tiktok|bytedance|musical_ly/, 'TikTok'],
    [/facebook|^fb$|^fb\.|\.fb\.|fb\.me|fban/, 'Facebook'],
    [/twitter|^t\.co$|^x\.com$|^x$/, 'X'],
    [/snapchat/, 'Snapchat'],
    [/youtube|youtu\.be/, 'YouTube'],
    [/google/, 'Google'],
    [/bing|duckduckgo|yahoo|yandex|ecosia|baidu|brave/, 'Other search']
  ];
  for (const [re, name] of rules) if (re.test(said)) return name;
  if (source) return 'Other';
  if (host) return 'Other websites';
  return 'Direct';
}

/* ---------------------------------------------------------- housekeeping */

let lastTidy = 0;

/**
 * Turn finished days into daily totals, then drop detail older than 90 days.
 * Runs at most once an hour, from whichever request comes first.
 */
export async function tidy({ force = false } = {}) {
  if (!force && Date.now() - lastTidy < 60 * 60_000) return;
  lastTidy = Date.now();
  // Only days not yet totalled: from the Lagos midnight after the last one.
  const last = await one('SELECT MAX(day)::text AS day FROM analytics_daily');
  const from = last?.day
    ? new Date(new Date(`${last.day}T00:00:00+01:00`).getTime() + 86_400_000).toISOString()
    : '-infinity';
  await query(`
    INSERT INTO analytics_daily (day, visitors, visits, pageviews, bounces, engaged_ms)
    SELECT d.day, d.visitors, d.visits, d.pageviews, d.bounces, d.engaged_ms
      FROM (
        SELECT (s.start + interval '1 hour')::date AS day,
               COUNT(DISTINCT s.visitor) AS visitors,
               COUNT(*) AS visits,
               SUM(s.pages) AS pageviews,
               COUNT(*) FILTER (WHERE s.bounce) AS bounces,
               SUM(s.engaged) AS engaged_ms
          FROM (${SESSIONS_SQL}) s
         GROUP BY 1
      ) d
     WHERE d.day < (now() + interval '1 hour')::date
    ON CONFLICT (day) DO NOTHING
  `, [from, new Date().toISOString()]);
  await query(`DELETE FROM events WHERE at < now() - make_interval(days => $1)`, [KEEP_DAYS]);
}

/**
 * One row per visit in [$1, $2): when it started, who (today's code), how
 * many pages, time spent, and whether it bounced — one page, under ten
 * seconds, and nothing done.
 */
export const SESSIONS_SQL = `
  SELECT session,
         MIN(visitor) AS visitor,
         MIN(at) AS start,
         COUNT(*) FILTER (WHERE name = 'pageview') AS pages,
         COALESCE(SUM(engaged_ms), 0)::bigint AS engaged,
         (COUNT(*) FILTER (WHERE name = 'pageview') <= 1
           AND COALESCE(SUM(engaged_ms), 0) < 10000
           AND COUNT(*) FILTER (WHERE name NOT IN ('pageview', 'leave')) = 0) AS bounce
    FROM events
   WHERE at >= $1 AND at < $2
   GROUP BY session
  HAVING COUNT(*) FILTER (WHERE name = 'pageview') > 0
`;

/** Where the visit that placed an order came from, to keep on the order. */
export async function attribution(session) {
  if (typeof session !== 'string' || !/^[a-f0-9]{16,32}$/.test(session)) return null;
  const row = await one(`
    SELECT channel, utm_campaign FROM events
     WHERE session = $1 AND name = 'pageview' ORDER BY at LIMIT 1
  `, [session]);
  return { session, channel: row?.channel ?? null, campaign: row?.utm_campaign ?? null };
}
