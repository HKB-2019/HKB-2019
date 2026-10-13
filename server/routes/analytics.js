import { Router } from 'express';
import { query } from '../db.js';
import { readSession, requireAdmin, COOKIE } from '../lib/auth.js';
import { report, RANGES } from '../lib/report.js';
import { rateLimit } from '../lib/limits.js';
import { visitorId, isBot, parseAgent, deviceFor, countryFor, channelFor, tidy } from '../lib/analytics.js';

export const analyticsRouter = Router();

/* What the shop's pages report, and nothing else. */
export const EVENTS = new Set([
  'pageview', 'leave',                                   // a page seen; time spent on it
  'view_item', 'add_to_cart', 'begin_checkout', 'checkout',   // the shopping steps
  'subscribe', 'restock_request', 'discount_applied', 'film_play', 'size_guide'   // goals
]);

/* Generous for a person, tight for a script: a busy visit is a few dozen. */
export const eventLimit = rateLimit({ windowMs: 10 * 60_000, max: 600, message: 'Too many.' });

const text = (v, max, re) => {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
  return t && (!re || re.test(t)) ? t : null;
};
const int = (v, max) => (Number.isInteger(v) && v >= 0 && v <= max ? v : null);

const readCookie = (req, name) => {
  const m = (req.headers.cookie ?? '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
};

/**
 * POST /api/e — one thing that happened on a page.
 *
 * Always answers 204 with no body, accepted or not: a page has nothing to do
 * with the answer, and a refusal should not tell a script what to change.
 */
analyticsRouter.post('/e', eventLimit, async (req, res) => {
  try { await record(req); }
  catch (err) { console.error('[analytics] could not record an event:', err.message); }
  res.status(204).end();
});

async function record(req) {
  const b = req.body ?? {};
  const ua = String(req.get('user-agent') ?? '').slice(0, 400);
  if (isBot(ua)) return;
  // The owner looking at their own shop is not a visitor.
  if (readSession(readCookie(req, COOKIE))) return;

  const name = EVENTS.has(b.n) ? b.n : null;
  const session = text(b.s, 32, /^[a-f0-9]{16,32}$/);
  const path = text(b.p, 200, /^\/[^\s]*$/);
  if (!name || !session || !path || path.startsWith('/admin')) return;

  const row = {
    name, session, path,
    visitor: await visitorId(req.ip ?? '', ua),
    product_id: text(b.pid, 60, /^[a-z0-9-]+$/),
    size: text(b.sz, 12),
    value_kobo: int(b.v, 1_000_000_000),
    engaged_ms: name === 'leave' ? int(b.ms, 30 * 60_000) : null
  };

  if (name === 'pageview') {
    const { os, browser } = parseAgent(ua);
    const referrer = text(b.r, 100, /^[a-z0-9.-]+$/i)?.toLowerCase() ?? null;
    const utm = { source: text(b.us, 60), medium: text(b.um, 60), campaign: text(b.uc, 80) };
    Object.assign(row, {
      referrer, os, browser,
      utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign,
      channel: channelFor({ referrer, utmSource: utm.source, utmMedium: utm.medium, browser }),
      device: deviceFor(int(b.w, 10_000), ua),
      country: countryFor(b.tz),
      returning_visitor: b.ret === true
    });
  }

  const cols = Object.keys(row);
  await query(
    `INSERT INTO events (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
    cols.map(c => row[c] ?? null));
  await tidy();
}

/* GET /api/admin/analytics?range=today|7d|30d|90d|12m — the VISITORS tab. */
analyticsRouter.get('/admin/analytics', requireAdmin, async (req, res) => {
  const range = RANGES.includes(req.query.range) ? req.query.range : '30d';
  res.set('Cache-Control', 'no-store');
  res.json(await report(range));
});
