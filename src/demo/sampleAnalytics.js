/* Made-up visitor figures for the preview's VISITORS tab, in the same shape
 * the real server sends (server/lib/report.js). Fixed by a seed, so the
 * preview shows the same picture every time. Nothing here is real. */

const DAY = 86_400_000;

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const weighted = (r, pairs) => {
  let x = r() * pairs.reduce((n, p) => n + p[1], 0);
  for (const [v, w] of pairs) if ((x -= w) <= 0) return v;
  return pairs[0][0];
};

const CHANNELS = [['Instagram', 40], ['WhatsApp', 18], ['Direct', 20], ['TikTok', 9], ['Google', 7], ['X', 3], ['Other websites', 3]];
const COUNTRIES = [['NG', 85], ['GB', 6], ['US', 4], ['GH', 2], ['CA', 1], ['ZA', 1], ['AE', 1]];
const STATES = [['Lagos', 50], ['FCT', 18], ['Rivers', 9], ['Oyo', 5], ['Enugu', 4], ['Kano', 3], ['Delta', 3], ['Edo', 3], ['Ogun', 3], ['Kaduna', 2]];
const PIECES = [['tee', 'THE FACE TEE', 2800000], ['cap', 'THE MARK CAP', 1400000], ['backpack', 'THE CARRIER BACKPACK', 6500000],
                ['scarf', 'THE PATTERN SCARF', 1800000], ['jacket', 'THE SYMBOL JACKET', 9800000], ['wallet', 'THE ARTIFACT WALLET', 2200000]];
const HOURS = [1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 5, 6, 7, 7, 6, 6, 6, 7, 9, 11, 12, 10, 6, 3];

export function sampleReport(range) {
  const r = rng(42);
  const now = Date.now();
  const days = { today: 1, '7d': 7, '30d': 30, '90d': 90, '12m': 365 }[range];
  const bucket = range === 'today' ? 'hour' : range === '12m' ? 'month' : 'day';
  const n = range === 'today' ? 24 : range === '12m' ? 12 : days;
  const start = now - (days - 1) * DAY;

  const daily = (i) => Math.round(45 + i * 0.9 + 20 * r());
  const series = Array.from({ length: n }, (_, i) => {
    const visits = bucket === 'hour' ? Math.round(HOURS[i] * (3 + r() * 2) * (i <= new Date().getUTCHours() + 1 ? 1 : 0))
      : bucket === 'month' ? Math.round(daily(i * 3) * 30 * (0.4 + i * 0.06)) : daily(i);
    const orders = Math.round(visits * (0.06 + r() * 0.03));
    return {
      start: new Date(bucket === 'hour' ? now - (23 - i) * 3_600_000 : bucket === 'month' ? now - (11 - i) * 30 * DAY : start + i * DAY).toISOString(),
      visitors: Math.round(visits * 0.97), visits, pageviews: Math.round(visits * 2.3),
      orders, revenueKobo: orders * 4_800_000,
      previousVisitors: bucket === 'month' ? null : Math.round(visits * (0.7 + r() * 0.2))
    };
  });

  const visits = series.reduce((s, b) => s + b.visits, 0);
  const visitors = series.reduce((s, b) => s + b.visitors, 0);
  const orders = series.reduce((s, b) => s + b.orders, 0);
  const revenue = series.reduce((s, b) => s + b.revenueKobo, 0);
  const share = (pairs) => pairs.map(([k, w]) => [k, Math.round((visits * w) / pairs.reduce((a, p) => a + p[1], 0))]);

  const channels = share(CHANNELS).map(([channel, v]) => {
    const o = Math.round(v * (0.05 + r() * 0.05));
    return { channel, visits: v, orders: o, revenueKobo: o * 4_800_000, conversionRate: v ? o / v : 0 };
  });
  const funnel = [1, 0.59, 0.27, 0.15, 0.105, orders / visits].map((f, i) => ({
    step: ['Visited', 'Viewed a piece', 'Added to bag', 'Started checkout', 'Went to payment', 'Paid'][i],
    visits: Math.round(visits * f)
  }));
  const grid = (scale) => Array.from({ length: 7 }, (_, d) => HOURS.map(h => Math.round(h * scale * (0.6 + r() * 0.8) * (d >= 4 ? 1.2 : 1))));
  const stateRows = share(STATES).map(([state, v]) => {
    const o = Math.max(1, Math.round((orders * v) / visits));
    return { state, orders: o, revenueKobo: o * 4_800_000 };
  });

  const previous = {
    visitors: Math.round(visitors * 0.82), visits: Math.round(visits * 0.82), pageviews: Math.round(visits * 2.1),
    bounceRate: 0.43, avgVisitMs: 41_000, pagesPerVisit: 2.1, orders: Math.round(orders * 0.75),
    revenueKobo: Math.round(revenue * 0.74), conversionRate: (orders * 0.75) / (visits * 0.82),
    revenuePerVisitorKobo: Math.round((revenue * 0.74) / (visitors * 0.82)), averageOrderKobo: 4_700_000
  };

  return {
    range, bucket, from: new Date(start).toISOString(), to: new Date(now).toISOString(),
    detailFrom: new Date(Math.max(start, now - 89 * DAY)).toISOString(),
    totals: {
      visitors, visits, pageviews: Math.round(visits * 2.3), bounceRate: 0.4, avgVisitMs: 46_000, pagesPerVisit: 2.3,
      orders, revenueKobo: revenue, conversionRate: orders / visits, revenuePerVisitorKobo: Math.round(revenue / visitors),
      averageOrderKobo: Math.round(revenue / Math.max(orders, 1)), returningRate: 0.3
    },
    previous,
    series,
    funnel,
    channels,
    campaigns: [
      { campaign: 'drop01', visits: Math.round(visits * 0.21), orders: Math.round(orders * 0.22), revenueKobo: Math.round(revenue * 0.23) },
      { campaign: 'broadcast-oct', visits: Math.round(visits * 0.1), orders: Math.round(orders * 0.08), revenueKobo: Math.round(revenue * 0.07) }
    ],
    referrers: [{ key: 'bellanaija.com', visits: Math.round(visits * 0.02) }, { key: 'pulse.ng', visits: Math.round(visits * 0.01) }],
    pages: [{ path: '/', label: 'Home', views: visits, visits }, ...PIECES.map(([id, name], i) => ({
      path: `/product/${id}`, label: name, views: Math.round(visits * (0.11 - i * 0.008)), visits: Math.round(visits * (0.1 - i * 0.008))
    }))],
    entryPages: [{ key: '/', label: 'Home', visits: Math.round(visits * 0.8) }, { key: '/product/tee', label: 'THE FACE TEE', visits: Math.round(visits * 0.12) }],
    exitPages: [{ key: '/', label: 'Home', visits: Math.round(visits * 0.5) }, { key: '/product/jacket', label: 'THE SYMBOL JACKET', visits: Math.round(visits * 0.14) }],
    products: PIECES.map(([id, name, price], i) => {
      const views = Math.round(visits * (0.11 - i * 0.008));
      const adds = Math.round(views * (0.48 - i * 0.02));
      const sold = Math.round(adds * 0.3);
      return { productId: id, name, views, adds, addRate: views ? adds / views : 0, sold, revenueKobo: sold * price };
    }),
    sizes: [{ size: 'ONE SIZE', adds: Math.round(visits * 0.12) }, { size: 'M', adds: Math.round(visits * 0.06) },
            { size: 'L', adds: Math.round(visits * 0.05) }, { size: 'XL', adds: Math.round(visits * 0.02) }, { size: 'S', adds: Math.round(visits * 0.015) }],
    devices: share([['Phone', 79], ['Computer', 18], ['Tablet', 3]]).map(([key, v]) => ({ key, visits: v })),
    os: share([['Android', 47], ['iOS', 32], ['Windows', 11], ['macOS', 7]]).map(([key, v]) => ({ key, visits: v })),
    browsers: share([['Instagram app', 36], ['Chrome', 33], ['Safari', 15], ['TikTok app', 8], ['Opera Mini', 4], ['Samsung Internet', 4]]).map(([key, v]) => ({ key, visits: v })),
    countries: share(COUNTRIES).map(([key, v]) => ({ key, visits: v })),
    states: stateRows,
    abroad: [{ country: 'United Kingdom', orders: 3, revenueKobo: 14_400_000 }],
    when: { visits: grid(Math.max(1, visits / 2400)), orders: grid(Math.max(0.08, orders / 2400)) },
    goals: {
      subscribe: { count: Math.round(visits * 0.01) }, restock_request: { count: Math.round(visits * 0.004) },
      discount_applied: { count: Math.round(visits * 0.006) }, size_guide: { count: Math.round(visits * 0.016) },
      film_play: { count: Math.round(visits * 0.003) }
    },
    unfinished: { count: Math.round(orders * 0.36), valueKobo: Math.round(orders * 0.36) * 4_800_000, pending: 1 },
    repeatCustomers: { buyers: Math.round(orders * 0.8), repeat: Math.round(orders * 0.18), rate: 0.225 },
    live: { visitors: 3 + Math.floor(r() * 4), pages: [{ key: '/', visits: 2 }] }
  };
}
