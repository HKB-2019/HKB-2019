/* Counting visits: what is accepted, what is left out, and what the
 * VISITORS tab is told.
 *
 *   node --test server/test/analytics.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, paystack, sign, WHO } from './helpers.js';

let shop, cookie, lib;
before(async () => {
  shop = await startShop();
  stubPaystack(shop.one);
  lib = await import('../lib/analytics.js');
});
after(async () => { await shop.close(); });
beforeEach(async () => {
  await shop.reset();
  paystack.verify = { status: 'success', amount: null };
  cookie = await shop.login();
});

const PHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

let n = 0;
const sid = () => (++n).toString(16).padStart(24, 'a');
const send = (body, { ua = ANDROID, cookie: c } = {}) =>
  shop.request('/api/e', { method: 'POST', json: body, headers: { 'user-agent': ua }, cookie: c });
const pageview = (s, path, extra = {}, opts) =>
  send({ n: 'pageview', s, p: path, w: 390, tz: 'Africa/Lagos', ...extra }, opts);
const count = async () => (await shop.one('SELECT COUNT(*) AS n FROM events')).n;
const stats = async (range = '7d') => (await shop.request(`/api/admin/analytics?range=${range}`, { cookie })).body;

/* ---- collecting --------------------------------------------------------- */

test('a page view is recorded with device, browser, country and source — and no address', async () => {
  const res = await pageview(sid(), '/product/tee', { r: 'l.instagram.com', ret: true }, { ua: PHONE });
  assert.equal(res.status, 204);
  const e = await shop.one('SELECT * FROM events');
  assert.equal(e.path, '/product/tee');
  assert.equal(e.device, 'Phone');
  assert.equal(e.os, 'iOS');
  assert.equal(e.browser, 'Instagram app');
  assert.equal(e.country, 'NG');
  assert.equal(e.channel, 'Instagram');
  assert.equal(e.returning_visitor, true);
  assert.match(e.visitor, /^[0-9a-f]{20}$/);
  const row = JSON.stringify(e);
  assert.ok(!row.includes('127.0.0.1'), 'the internet address is not stored');
});

test('bots, the signed-in owner, admin pages and nonsense are not counted', async () => {
  await pageview(sid(), '/', {}, { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
  await pageview(sid(), '/', {}, { ua: '' });
  await pageview(sid(), '/', {}, { cookie });                           // the owner
  await pageview(sid(), '/admin');
  await send({ n: 'pageview', s: 'not-hex', p: '/' });
  await send({ n: 'made_up', s: sid(), p: '/' });
  await send({ n: 'pageview', s: sid(), p: 'https://evil.example/' });
  const res = await send({ n: 'pageview', s: sid(), p: '/', r: '<script>' });
  assert.equal(res.status, 204, 'answers the same either way');
  assert.equal(await count(), 1, 'only the last one, with its bad referrer dropped');
  assert.equal((await shop.one('SELECT referrer FROM events')).referrer, null);
});

test('the visitor code is the same all day for one browser, different for another, and changes daily', async () => {
  const a1 = await lib.visitorId('1.2.3.4', ANDROID);
  const a2 = await lib.visitorId('1.2.3.4', ANDROID);
  const b = await lib.visitorId('1.2.3.4', DESKTOP);
  assert.equal(a1, a2);
  assert.notEqual(a1, b);
  await shop.query("UPDATE settings SET value = '{\"day\":\"2000-01-01\",\"value\":\"old\"}' WHERE key = 'analytics_salt'");
  // The cached secret is for today; a fresh process reading an old day makes a new one.
  const fresh = await import(`../lib/analytics.js?again=${Date.now()}`);
  assert.notEqual(await fresh.visitorId('1.2.3.4', ANDROID), a1, 'a new day, a new code');
});

test('sources are named the way the owner thinks of them', () => {
  const c = (o) => lib.channelFor(o);
  assert.equal(c({ utmSource: 'whatsapp' }), 'WhatsApp');
  assert.equal(c({ utmSource: 'ig', referrer: 'l.facebook.com' }), 'Instagram', 'a tagged link wins');
  assert.equal(c({ referrer: 't.co' }), 'X');
  assert.equal(c({ referrer: 'www.google.com.ng' }), 'Google');
  assert.equal(c({ referrer: 'lm.facebook.com' }), 'Facebook');
  assert.equal(c({ browser: 'TikTok app' }), 'TikTok', 'opened inside the TikTok app');
  assert.equal(c({ utmSource: 'drop02', utmMedium: 'email' }), 'Email');
  assert.equal(c({ referrer: 'bellanaija.com' }), 'Other websites');
  assert.equal(c({}), 'Direct');
  assert.equal(lib.countryFor('Europe/London'), 'GB');
  assert.equal(lib.countryFor('Asia/Calcutta'), 'IN', 'older names browsers still use');
  assert.equal(lib.countryFor('Mars/Olympus'), null);
});

test('sending is limited, so a script cannot fill the database', async () => {
  const s = sid();
  let last;
  for (let i = 0; i < 601; i++) last = await send({ n: 'leave', s, p: '/', ms: 1000 });
  assert.equal(last.status, 429);
});

/* ---- the report ----------------------------------------------------------- */

test('visits, bounces, time spent, the funnel and sales by source add up', async () => {
  // A: from Instagram, looks at the tee, adds it, pays.
  const a = sid();
  await pageview(a, '/', { r: 'l.instagram.com', uc: 'drop02', us: 'instagram' }, { ua: PHONE });
  await pageview(a, '/product/tee', {}, { ua: PHONE });
  await send({ n: 'view_item', s: a, p: '/product/tee', pid: 'tee', v: 2_800_000 }, { ua: PHONE });
  await send({ n: 'add_to_cart', s: a, p: '/product/tee', pid: 'tee', sz: 'M', v: 2_800_000 }, { ua: PHONE });
  await send({ n: 'begin_checkout', s: a, p: '/product/tee', v: 2_800_000 }, { ua: PHONE });
  await send({ n: 'leave', s: a, p: '/product/tee', ms: 90_000 }, { ua: PHONE });
  const order = await shop.checkout({ email: 'a@example.com', analyticsSession: a, items: [{ productId: 'tee', colour: 'Indigo', size: 'M', qty: 1 }] });
  assert.equal(order.status, 200, order.raw);
  await send({ n: 'checkout', s: a, p: '/product/tee', v: 3_050_000 }, { ua: PHONE });
  const raw = JSON.stringify({ event: 'charge.success', data: { id: 501, reference: order.body.reference } });
  await shop.request('/api/paystack/webhook', { method: 'POST', body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) } });
  await new Promise(r => setTimeout(r, 150));

  // B: typed the address on a computer, one page, left at once: a bounce.
  const b = sid();
  await pageview(b, '/', { w: 1440, tz: 'Europe/London' }, { ua: DESKTOP });

  // C: quick-added from the grid without opening the piece, then left.
  const c = sid();
  await pageview(c, '/', { us: 'whatsapp' });
  await send({ n: 'add_to_cart', s: c, p: '/', pid: 'cap', sz: 'ONE SIZE', v: 1_400_000 });
  await send({ n: 'subscribe', s: c, p: '/' });

  const r = await stats('7d');
  assert.equal(r.totals.visits, 3);
  assert.equal(r.totals.visitors, 3);
  assert.equal(r.totals.pageviews, 4);
  assert.equal(Math.round(r.totals.bounceRate * 100), 33, 'one of three');
  assert.equal(r.totals.orders, 1);
  assert.equal(r.totals.revenueKobo, 3_050_000);
  assert.equal(Math.round(r.totals.conversionRate * 100), 33);

  assert.deepEqual(r.funnel.map(f => f.visits), [3, 2, 2, 1, 1, 1],
    'the quick add counts as having seen a piece');

  const insta = r.channels.find(x => x.channel === 'Instagram');
  assert.deepEqual([insta.visits, insta.orders, insta.revenueKobo], [1, 1, 3_050_000]);
  assert.equal(r.channels.find(x => x.channel === 'WhatsApp').visits, 1);
  assert.equal(r.campaigns[0].campaign, 'drop02');
  assert.equal(r.campaigns[0].orders, 1);

  const tee = r.products.find(p => p.productId === 'tee');
  assert.deepEqual([tee.views, tee.adds, tee.sold], [1, 1, 1]);
  assert.equal(tee.name, 'THE FACE TEE');
  assert.deepEqual(r.devices.map(d => d.key).sort(), ['Computer', 'Phone']);
  assert.deepEqual(r.countries.map(x => x.key).sort(), ['GB', 'NG']);
  assert.equal(r.goals.subscribe.count, 1);
  assert.deepEqual(r.states, [{ state: 'Lagos', orders: 1, revenueKobo: 3_050_000 }]);
  assert.equal(r.when.visits.flat().reduce((x, y) => x + y, 0), 3);
  assert.equal(r.when.orders.flat().reduce((x, y) => x + y, 0), 1);
  assert.equal(r.live.visitors, 3, 'all three were here in the last five minutes');
  assert.equal(r.series.at(-1).visits, 3, 'today is the last day on the chart');
  assert.equal(r.series.length, 7);

  const o = await shop.one('SELECT channel, campaign, session_id FROM orders');
  assert.deepEqual(o, { channel: 'Instagram', campaign: 'drop02', session_id: a }, 'the order remembers where it came from');
});

test('every range answers, compares with the one before, and the owner alone can read it', async () => {
  await pageview(sid(), '/');
  for (const range of ['today', '7d', '30d', '90d', '12m']) {
    const r = await stats(range);
    assert.ok(r.totals, range);
    assert.ok(r.previous, range);
    assert.equal(r.series.length, { today: 24, '7d': 7, '30d': 30, '90d': 90, '12m': 12 }[range], range);
  }
  const outsider = await shop.request('/api/admin/analytics?range=7d');
  assert.equal(outsider.status, 401);
});

test('repeat customers and unfinished checkouts come from real orders', async () => {
  const buy = async (email, id) => {
    const o = await shop.checkout({ ...WHO, email, items: [{ productId: 'cap', colour: 'Black', size: 'ONE SIZE', qty: 1 }] });
    const raw = JSON.stringify({ event: 'charge.success', data: { id, reference: o.body.reference } });
    await shop.request('/api/paystack/webhook', { method: 'POST', body: raw,
      headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) } });
  };
  await buy('a@example.com', 601);
  await buy('a@example.com', 602);
  await buy('b@example.com', 603);
  const left = await shop.checkout({ ...WHO, email: 'c@example.com', items: [{ productId: 'cap', colour: 'Black', size: 'ONE SIZE', qty: 1 }] });
  await shop.query("UPDATE orders SET status = 'abandoned' WHERE reference = $1", [left.body.reference]);
  await new Promise(r => setTimeout(r, 150));

  const r = await stats('30d');
  assert.deepEqual([r.repeatCustomers.buyers, r.repeatCustomers.repeat], [2, 1]);
  assert.equal(r.unfinished.count, 1);
  assert.equal(r.unfinished.valueKobo, 1_400_000 + 250_000);
  assert.equal(r.channels.find(c => c.channel === 'Not known').orders, 3, 'orders from before counting began still show');
});

test('old detail becomes daily totals and is then deleted', async () => {
  const s = sid();
  await pageview(s, '/');
  await pageview(s, '/product/cap');
  await shop.query("UPDATE events SET at = now() - interval '100 days'");
  await lib.tidy({ force: true });
  assert.equal(await count(), 0, 'detail older than 90 days is gone');
  const day = await shop.one('SELECT visitors, visits, pageviews FROM analytics_daily');
  assert.deepEqual(day, { visitors: 1, visits: 1, pageviews: 2 }, 'but the day is still counted');
  const r = await stats('12m');
  assert.equal(r.totals.visits, 1, 'and the year view includes it');
});
