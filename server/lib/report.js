import { one, query } from '../db.js';
import { SESSIONS_SQL, tidy, lagosDay } from './analytics.js';

/* Everything the VISITORS tab shows, for one date range.
 *
 * Visits come from the events table (90 days of detail); money comes from
 * orders, which are kept for good. Weeks, days and hours are Lagos time. */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const LAGOS = HOUR;                       // UTC+1, no clock changes

export const RANGES = ['today', '7d', '30d', '90d', '12m'];

/** Lagos midnight at the start of the day containing `t`, as a UTC instant. */
const midnight = (t) => new Date(`${lagosDay(t)}T00:00:00+01:00`).getTime();

/** The range, the one before it for comparison, and how to bucket the chart. */
export function rangeWindow(range, now = Date.now()) {
  if (range === 'today') {
    const from = midnight(now);
    return { from, to: now, prevFrom: from - DAY, prevTo: now - DAY, bucket: 'hour' };
  }
  if (range === '12m') {
    const d = new Date(now + LAGOS);
    const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1) - LAGOS;
    const prevFirst = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 23, 1) - LAGOS;
    return { from: first, to: now, prevFrom: prevFirst, prevTo: first, bucket: 'month' };
  }
  const days = { '7d': 7, '30d': 30, '90d': 90 }[range];
  const from = midnight(now) - (days - 1) * DAY;
  return { from, to: now, prevFrom: from - days * DAY, prevTo: from, bucket: 'day' };
}

/** The chart's buckets, as Lagos-labelled start instants. */
function buckets(w) {
  const out = [];
  if (w.bucket === 'hour') for (let t = w.from; t < w.from + DAY; t += HOUR) out.push(t);
  else if (w.bucket === 'day') for (let t = w.from; t <= w.to; t += DAY) out.push(t);
  else {
    const d = new Date(w.from + LAGOS);
    for (let i = 0; i < 12; i++) out.push(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1) - LAGOS);
  }
  return out;
}

function bucketOf(t, w, starts) {
  const ms = new Date(t).getTime();
  let i = starts.length - 1;
  while (i > 0 && starts[i] > ms) i--;
  return i;
}

const iso = (t) => new Date(t).toISOString();

/** A page's address as the owner would say it. */
function pageLabel(path, names) {
  if (path === '/') return 'Home';
  if (path === '/order') return 'Order page';
  const m = path.match(/^\/product\/([a-z0-9-]+)/);
  if (m) return names.get(m[1]) ?? `Product: ${m[1]}`;
  return path;
}
const ratio = (a, b) => (b ? a / b : 0);
const PAID_TOTAL = 'subtotal_kobo - discount_kobo + shipping_kobo';

/** Count rows by a key, largest first: [{ key, visits }]. */
function countBy(rows, key, { limit = 10, label = (k) => k } = {}) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key] ?? null;
    if (k === null || k === '') continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, n]) => ({ key: label(k), visits: n }));
}

/** Top-line numbers for a span, from detail where it exists, from daily totals before that. */
async function topLine(from, to) {
  const s = await one(`
    SELECT COUNT(*) AS visits, COUNT(DISTINCT visitor) AS visitors,
           COALESCE(SUM(pages), 0)::bigint AS pageviews, COUNT(*) FILTER (WHERE bounce) AS bounces,
           COALESCE(SUM(engaged), 0)::bigint AS engaged,
           MIN(start) AS first
      FROM (${SESSIONS_SQL}) s
  `, [iso(from), iso(to)]);
  // Days whose detail has gone: their daily totals.
  const old = await one(`
    SELECT COALESCE(SUM(visitors), 0)::bigint AS visitors, COALESCE(SUM(visits), 0)::bigint AS visits,
           COALESCE(SUM(pageviews), 0)::bigint AS pageviews, COALESCE(SUM(bounces), 0)::bigint AS bounces,
           COALESCE(SUM(engaged_ms), 0)::bigint AS engaged
      FROM analytics_daily
     WHERE day >= $1::date AND day < $2::date
       AND day < COALESCE((SELECT (MIN(at) + interval '1 hour')::date FROM events), '9999-12-31'::date)
  `, [lagosDay(from), lagosDay(to + 1)]);
  const orders = await one(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(${PAID_TOTAL}), 0)::bigint AS revenue
      FROM orders WHERE status = 'paid' AND paid_at >= $1 AND paid_at < $2
  `, [iso(from), iso(to)]);
  const visits = s.visits + old.visits;
  const visitors = s.visitors + old.visitors;
  return {
    visitors, visits,
    pageviews: s.pageviews + old.pageviews,
    bounceRate: ratio(s.bounces + old.bounces, visits),
    avgVisitMs: Math.round(ratio(s.engaged + old.engaged, visits)),
    pagesPerVisit: ratio(s.pageviews + old.pageviews, visits),
    orders: orders.orders,
    revenueKobo: orders.revenue,
    conversionRate: ratio(orders.orders, visits),
    revenuePerVisitorKobo: Math.round(ratio(orders.revenue, visitors)),
    averageOrderKobo: Math.round(ratio(orders.revenue, orders.orders))
  };
}

export async function report(range) {
  await tidy();
  const w = rangeWindow(range);
  // Breakdowns need the detail, which reaches back 90 days at most.
  const detailFrom = Math.max(w.from, midnight(Date.now()) - 89 * DAY);
  const span = [iso(detailFrom), iso(w.to)];

  /* ---- one row per visit, with where it came from and how far it got */
  const sessions = await query(`
    WITH s AS (${SESSIONS_SQL}),
    f AS (
      SELECT DISTINCT ON (session) session, path AS entry, channel, referrer, utm_source, utm_campaign,
             device, os, browser, country, returning_visitor
        FROM events WHERE name = 'pageview' AND at >= $1 AND at < $2
       ORDER BY session, at
    ),
    l AS (
      SELECT DISTINCT ON (session) session, path AS exit
        FROM events WHERE name = 'pageview' AND at >= $1 AND at < $2
       ORDER BY session, at DESC
    ),
    st AS (
      SELECT session, MAX(CASE name WHEN 'view_item' THEN 1 WHEN 'add_to_cart' THEN 2
                                    WHEN 'begin_checkout' THEN 3 WHEN 'checkout' THEN 4 ELSE 0 END) AS step
        FROM events WHERE at >= $1 AND at < $2 GROUP BY session
    )
    SELECT s.session, s.visitor, s.start, s.pages, s.engaged, s.bounce,
           f.entry, f.channel, f.referrer, f.utm_source, f.utm_campaign, f.device, f.os, f.browser,
           f.country, f.returning_visitor, l.exit, COALESCE(st.step, 0) AS step,
           EXISTS (SELECT 1 FROM orders o WHERE o.session_id = s.session AND o.status = 'paid') AS paid
      FROM s JOIN f USING (session) LEFT JOIN l USING (session) LEFT JOIN st USING (session)
  `, span);

  /* ---- the chart: visitors and visits per hour, day or month */
  const starts = buckets(w);
  const series = starts.map(t => ({ start: iso(t), visitors: new Set(), visits: 0, pageviews: 0, orders: 0, revenueKobo: 0 }));
  for (const s of sessions) {
    const b = series[bucketOf(s.start, w, starts)];
    if (!b) continue;
    b.visitors.add(s.visitor); b.visits += 1; b.pageviews += s.pages;
  }
  if (w.bucket === 'month') {
    // Older months come from the daily totals.
    const days = await query(`
      SELECT day::text AS day, visitors, visits, pageviews FROM analytics_daily
       WHERE day >= $1::date AND day < $2::date
    `, [lagosDay(w.from), lagosDay(detailFrom)]);
    for (const d of days) {
      const b = series[bucketOf(new Date(`${d.day}T12:00:00+01:00`), w, starts)];
      // Each day's visitors were already counted once per day; add them as numbers.
      b.extraVisitors = (b.extraVisitors ?? 0) + d.visitors;
      b.visits += d.visits; b.pageviews += d.pageviews;
    }
  }
  const paidOrders = await query(`
    SELECT paid_at, ${PAID_TOTAL} AS total, channel, campaign, address->>'state' AS state,
           address->>'country' AS country
      FROM orders WHERE status = 'paid' AND paid_at >= $1 AND paid_at < $2
  `, [iso(w.from), iso(w.to)]);
  for (const o of paidOrders) {
    const b = series[bucketOf(o.paid_at, w, starts)];
    if (b) { b.orders += 1; b.revenueKobo += o.total; }
  }
  const previousStarts = starts.map(t => t - (w.from - w.prevFrom));
  const prevSeries = previousStarts.map(() => ({ visitors: new Set(), visits: 0 }));
  if (w.bucket !== 'month') {
    const prevSessions = await query(`SELECT visitor, start FROM (${SESSIONS_SQL}) s`, [iso(w.prevFrom), iso(w.prevTo)]);
    for (const s of prevSessions) {
      const b = prevSeries[bucketOf(s.start, w, previousStarts)];
      if (b) { b.visitors.add(s.visitor); b.visits += 1; }
    }
  }

  /* ---- the funnel: how far each visit got. A step counts every visit
     that reached it or anything after it, so a quick add from the grid
     (which skips the product page) still counts as having seen a piece. */
  const reached = (k) => sessions.filter(s => (s.paid ? 5 : s.step) >= k).length;
  const funnel = [
    { step: 'Visited', visits: sessions.length },
    { step: 'Viewed a piece', visits: reached(1) },
    { step: 'Added to bag', visits: reached(2) },
    { step: 'Started checkout', visits: reached(3) },
    { step: 'Went to payment', visits: reached(4) },
    { step: 'Paid', visits: reached(5) }
  ];

  /* ---- sources, with the sales each brought */
  const channelSales = new Map();
  for (const o of paidOrders) {
    const k = o.channel ?? 'Not known';
    const c = channelSales.get(k) ?? { orders: 0, revenueKobo: 0 };
    c.orders += 1; c.revenueKobo += o.total; channelSales.set(k, c);
  }
  const channelVisits = countBy(sessions, 'channel', { limit: 50 });
  const channels = [...new Set([...channelVisits.map(c => c.key), ...channelSales.keys()])].map(k => {
    const visits = channelVisits.find(c => c.key === k)?.visits ?? 0;
    const sales = channelSales.get(k) ?? { orders: 0, revenueKobo: 0 };
    return { channel: k, visits, ...sales, conversionRate: ratio(sales.orders, visits) };
  }).sort((a, b) => b.visits - a.visits || b.revenueKobo - a.revenueKobo);

  const campaignSales = new Map();
  for (const o of paidOrders) if (o.campaign) {
    const c = campaignSales.get(o.campaign) ?? { orders: 0, revenueKobo: 0 };
    c.orders += 1; c.revenueKobo += o.total; campaignSales.set(o.campaign, c);
  }
  const campaigns = [...new Set([...countBy(sessions, 'utm_campaign', { limit: 50 }).map(c => c.key), ...campaignSales.keys()])]
    .map(k => ({ campaign: k, visits: sessions.filter(s => s.utm_campaign === k).length, ...(campaignSales.get(k) ?? { orders: 0, revenueKobo: 0 }) }))
    .sort((a, b) => b.visits - a.visits).slice(0, 15);

  /* ---- pages and pieces */
  const pages = await query(`
    SELECT path, COUNT(*) AS views, COUNT(DISTINCT session) AS visits
      FROM events WHERE name = 'pageview' AND at >= $1 AND at < $2
     GROUP BY path ORDER BY views DESC LIMIT 12
  `, span);
  const productEvents = await query(`
    SELECT product_id, name, COUNT(*) AS n, COUNT(DISTINCT session) AS visits
      FROM events WHERE name IN ('view_item', 'add_to_cart') AND product_id IS NOT NULL AND at >= $1 AND at < $2
     GROUP BY product_id, name
  `, span);
  const sold = await query(`
    SELECT i.product_id, SUM(i.qty)::bigint AS qty, SUM(i.qty * i.unit_price_kobo)::bigint AS revenue
      FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status = 'paid' AND o.paid_at >= $1 AND o.paid_at < $2
     GROUP BY i.product_id
  `, [iso(w.from), iso(w.to)]);
  const names = new Map((await query('SELECT id, name FROM products')).map(p => [p.id, p.name]));
  const productIds = new Set([...productEvents.map(e => e.product_id), ...sold.map(s => s.product_id)]);
  const products = [...productIds].map(id => {
    const views = productEvents.find(e => e.product_id === id && e.name === 'view_item');
    const adds = productEvents.find(e => e.product_id === id && e.name === 'add_to_cart');
    const s = sold.find(x => x.product_id === id);
    return {
      productId: id, name: names.get(id) ?? id,
      views: views?.n ?? 0, adds: adds?.n ?? 0,
      addRate: ratio(adds?.visits ?? 0, views?.visits ?? 0),
      sold: s?.qty ?? 0, revenueKobo: s?.revenue ?? 0
    };
  }).sort((a, b) => b.views - a.views || b.sold - a.sold).slice(0, 15);

  const sizes = await query(`
    SELECT size, COUNT(*) AS adds FROM events
     WHERE name = 'add_to_cart' AND size IS NOT NULL AND at >= $1 AND at < $2
     GROUP BY size ORDER BY adds DESC LIMIT 10
  `, span);

  const goals = await query(`
    SELECT name, COUNT(*) AS n, COUNT(DISTINCT session) AS visits FROM events
     WHERE name IN ('subscribe', 'restock_request', 'discount_applied', 'film_play', 'size_guide')
       AND at >= $1 AND at < $2
     GROUP BY name
  `, span);

  /* ---- where buyers are: Nigerian states from delivery addresses */
  const states = new Map();
  const abroad = new Map();
  for (const o of paidOrders) {
    if (!o.country || o.country === 'Nigeria') {
      const k = o.state ?? 'Not known';
      const v = states.get(k) ?? { orders: 0, revenueKobo: 0 };
      v.orders += 1; v.revenueKobo += o.total; states.set(k, v);
    } else {
      const v = abroad.get(o.country) ?? { orders: 0, revenueKobo: 0 };
      v.orders += 1; v.revenueKobo += o.total; abroad.set(o.country, v);
    }
  }

  /* ---- when: visits and orders by weekday and hour, Lagos time */
  const grid = () => Array.from({ length: 7 }, () => Array(24).fill(0));
  const when = { visits: grid(), orders: grid() };
  const place = (t, g) => {
    const d = new Date(new Date(t).getTime() + LAGOS);
    g[(d.getUTCDay() + 6) % 7][d.getUTCHours()] += 1;   // Monday first
  };
  for (const s of sessions) place(s.start, when.visits);
  for (const o of paidOrders) place(o.paid_at, when.orders);

  /* ---- checkouts that did not finish, and customers who came back */
  const unfinished = await one(`
    SELECT COUNT(*) FILTER (WHERE status IN ('abandoned', 'failed')) AS count,
           COALESCE(SUM(${PAID_TOTAL}) FILTER (WHERE status IN ('abandoned', 'failed')), 0)::bigint AS value,
           COUNT(*) FILTER (WHERE status = 'pending') AS pending
      FROM orders WHERE created_at >= $1 AND created_at < $2
  `, [iso(w.from), iso(w.to)]);
  const repeat = await one(`
    SELECT COUNT(*) AS buyers, COUNT(*) FILTER (WHERE n > 1) AS repeat
      FROM (SELECT email, COUNT(*) AS n FROM orders WHERE status = 'paid' GROUP BY email) c
  `);

  /* ---- right now */
  const live = await query(`
    SELECT DISTINCT ON (session) session, path FROM events
     WHERE at > now() - interval '5 minutes' ORDER BY session, at DESC
  `);

  const [current, previous] = await Promise.all([topLine(w.from, w.to), topLine(w.prevFrom, w.prevTo)]);

  return {
    range, from: iso(w.from), to: iso(w.to), bucket: w.bucket,
    detailFrom: iso(detailFrom),
    totals: {
      ...current,
      returningRate: ratio(sessions.filter(s => s.returning_visitor).length, sessions.length)
    },
    previous,
    series: series.map((b, i) => ({
      start: b.start,
      visitors: b.visitors.size + (b.extraVisitors ?? 0),
      visits: b.visits, pageviews: b.pageviews, orders: b.orders, revenueKobo: b.revenueKobo,
      previousVisitors: w.bucket === 'month' ? null : prevSeries[i].visitors.size
    })),
    funnel,
    channels,
    campaigns,
    referrers: countBy(sessions, 'referrer', { limit: 10 }),
    pages: pages.map(p => ({ path: p.path, label: pageLabel(p.path, names), views: p.views, visits: p.visits })),
    entryPages: countBy(sessions, 'entry').map(e => ({ ...e, label: pageLabel(e.key, names) })),
    exitPages: countBy(sessions, 'exit').map(e => ({ ...e, label: pageLabel(e.key, names) })),
    products,
    sizes: sizes.map(s => ({ size: s.size, adds: s.adds })),
    devices: countBy(sessions, 'device'),
    os: countBy(sessions, 'os'),
    browsers: countBy(sessions, 'browser'),
    countries: countBy(sessions, 'country', { limit: 250 }),
    states: [...states.entries()].map(([state, v]) => ({ state, ...v })).sort((a, b) => b.revenueKobo - a.revenueKobo),
    abroad: [...abroad.entries()].map(([country, v]) => ({ country, ...v })).sort((a, b) => b.revenueKobo - a.revenueKobo),
    when,
    goals: Object.fromEntries(goals.map(g => [g.name, { count: g.n, visits: g.visits }])),
    unfinished: { count: unfinished.count, valueKobo: unfinished.value, pending: unfinished.pending },
    repeatCustomers: { buyers: repeat.buyers, repeat: repeat.repeat, rate: ratio(repeat.repeat, repeat.buyers) },
    live: { visitors: live.length, pages: countBy(live, 'path', { limit: 5 }) }
  };
}
