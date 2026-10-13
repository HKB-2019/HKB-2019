/* Discount codes, tracking numbers, refunds, back-in-stock requests, drop
 * times, the sales summary, the price-guide rates and the terms page.
 *
 *   node --test server/test/sales.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, paystack, sign } from './helpers.js';

let shop, cookie, releaseStock, reconcile;
before(async () => {
  shop = await startShop();
  stubPaystack(shop.one);
  ({ releaseStock, reconcile } = await import('../lib/orders.js'));
});
after(async () => { await shop.close(); });
beforeEach(async () => {
  await shop.reset();
  paystack.verify = { status: 'success', amount: null };
  cookie = await shop.login();
});

const api = (path, method = 'GET', json) => shop.request(`/api/admin${path}`, { method, cookie, json });
const item = (productId = 'tee', size = 'M', qty = 1) => ({ items: [{ productId, size, qty }] });
const orderRow = (reference) => shop.one('SELECT * FROM orders WHERE reference = $1', [reference]);
const usesOf = async (code) => (await shop.one('SELECT uses FROM discount_codes WHERE code = $1', [code])).uses;
const stockOf = async (productId, size) =>
  (await shop.one('SELECT stock FROM variants WHERE product_id = $1 AND size = $2', [productId, size])).stock;

const makeCode = (body) => api('/discounts', 'POST', { kind: 'percent', amount: 10, ...body });

let eventId = 1000;
async function pay(reference) {
  // Each payment is its own Paystack event; a repeated id is ignored as a retry.
  const raw = JSON.stringify({ event: 'charge.success', data: { id: ++eventId, reference } });
  await shop.request('/api/paystack/webhook', { method: 'POST', body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) } });
  await new Promise(r => setTimeout(r, 150));
}

/* ---- the door ------------------------------------------------------------- */

test('every new admin route refuses a caller who is not signed in', async () => {
  for (const [method, path] of [
    ['GET', '/api/admin/sales'], ['GET', '/api/admin/discounts'], ['POST', '/api/admin/discounts'],
    ['PATCH', '/api/admin/discounts/X'], ['DELETE', '/api/admin/discounts/X'],
    ['GET', '/api/admin/stock-alerts'], ['GET', '/api/admin/stock-alerts.csv'],
    ['POST', '/api/admin/stock-alerts/clear'], ['DELETE', '/api/admin/stock-alerts/1'],
    ['POST', '/api/admin/orders/x/refunded'], ['PUT', '/api/admin/settings/rates']
  ]) {
    const res = await shop.request(path, { method, json: method === 'GET' ? undefined : {} });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

/* ---- discount codes ------------------------------------------------------- */

test('a code is made in the admin, checked in the bag, and charged at checkout', async () => {
  const made = await makeCode({ code: ' launch10 ' });
  assert.equal(made.status, 201, made.raw);
  assert.equal(made.body.code, 'LAUNCH10');
  assert.equal(made.body.label, '10% off');

  const check = await shop.request('/api/discount', { method: 'POST', json: { code: 'launch10', ...item('tee', 'M', 2) } });
  assert.equal(check.status, 200, check.raw);
  assert.equal(check.body.discountKobo, 560_000, '10% of ₦56,000');

  const res = await shop.checkout({ email: 'a@example.com', discountCode: 'launch10', ...item('tee', 'M', 2) });
  assert.equal(res.status, 200, res.raw);
  assert.equal(res.body.discountKobo, 560_000);
  assert.equal(res.body.totalKobo, 5_600_000 - 560_000 + 250_000, 'items − discount + delivery');
  const init = paystack.calls.find(c => c.url.includes('/initialize'));
  assert.equal(init.body.amount, 5_290_000, 'Paystack is asked for the discounted total');
  assert.equal(await usesOf('LAUNCH10'), 1, 'one use held');

  await pay(res.body.reference);
  const o = await orderRow(res.body.reference);
  assert.equal(o.status, 'paid', 'the discounted amount is accepted as full payment');
  assert.equal(o.discount_code, 'LAUNCH10');

  const page = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(page.discountKobo, 560_000);
  assert.equal(page.totalKobo, 5_290_000);
});

test('a fixed-naira code, a minimum spend, and a code never takes the items below ₦100', async () => {
  await api('/discounts', 'POST', { code: 'FIVEK', kind: 'fixed', amount: 5000, minSpendNaira: 20000 });
  const small = await shop.request('/api/discount', { method: 'POST', json: { code: 'FIVEK', ...item('cap', 'ONE SIZE') } });
  assert.equal(small.status, 400);
  assert.match(small.body.error, /₦20,000 or more/);
  const ok = await shop.request('/api/discount', { method: 'POST', json: { code: 'FIVEK', ...item('tee', 'M') } });
  assert.equal(ok.body.discountKobo, 500_000);

  await api('/discounts', 'POST', { code: 'HUGE', kind: 'fixed', amount: 1_000_000 });
  const huge = await shop.request('/api/discount', { method: 'POST', json: { code: 'HUGE', ...item('cap', 'ONE SIZE') } });
  assert.equal(huge.body.discountKobo, 1_400_000 - 10_000, 'capped so the cap still costs ₦100');
});

test('a code that is unknown, off, ended or used up is refused, saying which', async () => {
  await makeCode({ code: 'OFFNOW' });
  await api('/discounts/OFFNOW', 'PATCH', { active: false });
  await makeCode({ code: 'OLD', endsAt: new Date(Date.now() + 60_000).toISOString() });
  await shop.query("UPDATE discount_codes SET ends_at = now() - interval '1 minute' WHERE code = 'OLD'");
  await makeCode({ code: 'ONCE', maxUses: 1 });

  for (const [code, message] of [['NOPE', /not a code we recognise/], ['OFFNOW', /not a code we recognise/],
                                  ['OLD', /has ended/], ['x!', /not valid/]]) {
    const res = await shop.checkout({ email: 'a@example.com', discountCode: code, ...item() });
    assert.equal(res.status, 400, code);
    assert.match(res.body.error, message);
  }
  assert.equal(await stockOf('tee', 'M'), 18, 'a refused code holds no stock');

  const first = await shop.checkout({ email: 'a@example.com', discountCode: 'ONCE', ...item() });
  assert.equal(first.status, 200);
  const second = await shop.checkout({ email: 'b@example.com', discountCode: 'ONCE', ...item() });
  assert.equal(second.status, 400);
  assert.match(second.body.error, /used up/);
});

test('a use comes back when the payment never does, and counts again if it turns up late', async () => {
  await makeCode({ code: 'ONCE', maxUses: 1 });
  const res = await shop.checkout({ email: 'a@example.com', discountCode: 'ONCE', ...item() });
  await releaseStock(res.body.reference, 'abandoned');
  assert.equal(await usesOf('ONCE'), 0, 'given back with the stock');

  paystack.verify = { status: 'success', amount: null };
  assert.equal(await reconcile(res.body.reference), 'paid', 'paid late, stock still there');
  assert.equal(await usesOf('ONCE'), 1, 'counted again');
});

test('the code list shows uses, and a code can be switched off, changed and deleted', async () => {
  await makeCode({ code: 'DROP2', maxUses: 50 });
  const dup = await makeCode({ code: 'drop2' });
  assert.equal(dup.status, 409);
  for (const [body, message] of [
    [{ code: 'P', amount: 10 }, /not valid/], [{ code: 'PCT', amount: 95 }, /1 to 90/],
    [{ code: 'FIXED', kind: 'fixed', amount: 50 }, /₦100/], [{ code: 'BAD', kind: 'free' }, /per cent off or naira off/]
  ]) {
    const r = await makeCode(body);
    assert.equal(r.status, 400, JSON.stringify(body));
    assert.match(r.body.error, message);
  }
  const list = (await api('/discounts')).body;
  assert.deepEqual(list.map(c => [c.code, c.uses, c.maxUses]), [['DROP2', 0, 50]]);
  const off = await api('/discounts/drop2', 'PATCH', { active: false, maxUses: 80 });
  assert.equal(off.body.active, false);
  assert.equal(off.body.maxUses, 80);
  assert.equal((await api('/discounts/DROP2', 'DELETE')).status, 200);
  assert.equal((await api('/discounts')).body.length, 0);
});

test('trying codes one after another is limited', async () => {
  let last;
  for (let i = 0; i < 31; i++) {
    last = await shop.request('/api/discount', { method: 'POST', json: { code: `GUESS${i}`, ...item() } });
  }
  assert.equal(last.status, 429);
});

/* ---- tracking and refunds ------------------------------------------------- */

test('a sent order shows its courier and tracking number to the customer', async () => {
  const res = await shop.checkout({ email: 'a@example.com', ...item() });
  await pay(res.body.reference);
  const sent = await api(`/orders/${res.body.reference}/fulfil`, 'POST', { courier: ' GIG Logistics ', tracking: 'GIG-123 456' });
  assert.equal(sent.status, 200, sent.raw);

  const page = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(page.courier, 'GIG Logistics');
  assert.equal(page.tracking, 'GIG-123 456');
  assert.ok(page.sentAt);

  const fixed = await api(`/orders/${res.body.reference}/fulfil`, 'POST', { courier: 'GIG Logistics', tracking: 'GIG-999' });
  assert.equal(fixed.body.alreadyFulfilled, true);
  assert.equal((await shop.request(`/api/orders/${res.body.reference}`)).body.tracking, 'GIG-999', 'a typo can be corrected');

  const long = await api(`/orders/${res.body.reference}/fulfil`, 'POST', { tracking: 'x'.repeat(61) });
  assert.equal(long.status, 400);
  const csv = await shop.request('/api/admin/orders.csv', { cookie });
  assert.match(csv.raw, /GIG-999/);
});

test('a refund is recorded, takes the order out of revenue, and can put the stock back', async () => {
  const res = await shop.checkout({ email: 'a@example.com', ...item('tee', 'M', 2) });
  await pay(res.body.reference);
  assert.equal(await stockOf('tee', 'M'), 16);
  assert.equal((await api('/summary')).body.paidOrders, 1);

  const pending = await shop.checkout({ email: 'b@example.com', ...item() });
  const refusePending = await api(`/orders/${pending.body.reference}/refunded`, 'POST', {});
  assert.equal(refusePending.status, 409, 'nothing to refund on an unpaid order');

  const done = await api(`/orders/${res.body.reference}/refunded`, 'POST', { restock: true });
  assert.equal(done.status, 200, done.raw);
  assert.equal((await orderRow(res.body.reference)).status, 'refunded');
  assert.equal(await stockOf('tee', 'M'), 18 - 1, 'the two come back (one is still held by the other order)');
  const summary = (await api('/summary')).body;
  assert.equal(summary.paidOrders, 0);
  assert.equal(summary.revenueKobo, 0);
  assert.equal((await shop.request(`/api/orders/${res.body.reference}`)).body.status, 'refunded');

  const twice = await api(`/orders/${res.body.reference}/refunded`, 'POST', { restock: true });
  assert.equal(twice.status, 409, 'and only once');
  assert.equal(await stockOf('tee', 'M'), 17);
});

/* ---- back in stock -------------------------------------------------------- */

test('a sold-out size takes a "tell me when it is back" request; the owner sees who is waiting', async () => {
  const alert = (body) => shop.request('/api/stock-alerts', { method: 'POST', json: body });
  const inStock = await alert({ productId: 'tee', size: 'M', email: 'a@example.com' });
  assert.equal(inStock.status, 409, 'M is in stock — buy it');
  const ok = await alert({ productId: 'phone', size: 'ONE SIZE', email: ' Ada@Example.com ' });
  assert.equal(ok.status, 200, ok.raw);
  await alert({ productId: 'phone', size: 'ONE SIZE', email: 'ada@example.com' });       // twice is once
  await alert({ productId: 'phone', size: 'ONE SIZE', email: 'bayo@example.com' });
  assert.equal((await alert({ productId: 'phone', size: 'XL', email: 'a@example.com' })).status, 404);
  assert.equal((await alert({ productId: 'phone', size: 'ONE SIZE', email: 'nope' })).status, 400);

  const groups = (await api('/stock-alerts')).body;
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].people.map(p => p.email), ['ada@example.com', 'bayo@example.com']);
  assert.equal(groups[0].stock, 0);
  assert.equal((await api('/summary')).body.alertsReady, 0);

  await shop.query("UPDATE variants SET stock = 5 WHERE product_id = 'phone'");
  assert.equal((await api('/summary')).body.alertsReady, 2, 'the admin says these people can be told');

  const csv = await shop.request('/api/admin/stock-alerts.csv', { cookie });
  assert.match(csv.raw, /"bayo@example\.com","THE MASK CASE","ONE SIZE","5"/);

  await api(`/stock-alerts/${groups[0].people[0].id}`, 'DELETE');
  const cleared = await api('/stock-alerts/clear', 'POST', { productId: 'phone', size: 'ONE SIZE' });
  assert.equal(cleared.body.cleared, 1);
  assert.equal((await api('/stock-alerts')).body.length, 0);
});

/* ---- drop times ----------------------------------------------------------- */

test('a piece with a drop time is invisible and unbuyable until then, and the shop counts down to it', async () => {
  const at = new Date(Date.now() + 3 * 86_400_000).toISOString();
  const set = await api('/products/tee', 'PATCH', { availableAt: at });
  assert.equal(set.status, 200, set.raw);
  assert.equal(set.body.availableAt, at);

  assert.ok(!(await shop.request('/api/products')).body.find(p => p.id === 'tee'), 'not shown');
  const buy = await shop.checkout({ email: 'a@example.com', ...item() });
  assert.equal(buy.status, 404, 'not buyable');
  const site = (await shop.request('/api/site')).body;
  assert.deepEqual(site.nextDrop, { at, pieces: 1 });

  await shop.query("UPDATE products SET available_at = now() - interval '1 second' WHERE id = 'tee'");
  assert.ok((await shop.request('/api/products')).body.find(p => p.id === 'tee'), 'out once the time comes');
  assert.equal((await shop.request('/api/site')).body.nextDrop, null);

  const bad = await api('/products/tee', 'PATCH', { availableAt: 'next friday' });
  assert.equal(bad.status, 400);
  const cleared = await api('/products/tee', 'PATCH', { availableAt: null });
  assert.equal(cleared.body.availableAt, null);
});

/* ---- sales summary -------------------------------------------------------- */

test('the sales summary counts paid orders only, by week, piece and size', async () => {
  await makeCode({ code: 'TEN' });
  const a = await shop.checkout({ email: 'a@example.com', discountCode: 'TEN', ...item('tee', 'M', 2) });
  await pay(a.body.reference);
  const b = await shop.checkout({ email: 'b@example.com', ...item('cap', 'ONE SIZE') });
  await pay(b.body.reference);
  await shop.checkout({ email: 'c@example.com', ...item('jacket', 'L') });       // never paid

  const s = (await api('/sales')).body;
  assert.equal(s.weeks.length, 12);
  const thisWeek = s.weeks.at(-1);
  assert.equal(thisWeek.orders, 2);
  assert.equal(thisWeek.revenueKobo, (5_600_000 - 560_000 + 250_000) + (1_400_000 + 250_000));
  assert.equal(s.totals.orders, 2);
  assert.equal(s.totals.discountKobo, 560_000);
  assert.deepEqual(s.pieces.map(p => [p.name, p.qty]), [['THE FACE TEE', 2], ['THE MARK CAP', 1]]);
  assert.deepEqual(s.sizes.map(x => [x.size, x.qty]), [['M', 2], ['ONE SIZE', 1]]);
  assert.deepEqual(s.codes, [{ code: 'TEN', orders: 1, discountKobo: 560_000 }]);
});

/* ---- small things --------------------------------------------------------- */

test('the price-guide rates are set in the admin and reach the shop', async () => {
  assert.deepEqual((await shop.request('/api/site')).body.rates, { USD: 1550, GBP: 1980, EUR: 1690 });
  const saved = await api('/settings/rates', 'PUT', { USD: 1600, GBP: 2050, EUR: 1750 });
  assert.equal(saved.status, 200, saved.raw);
  assert.equal((await shop.request('/api/site')).body.rates.USD, 1600);
  const bad = await api('/settings/rates', 'PUT', { USD: 0, GBP: 2050, EUR: 1750 });
  assert.equal(bad.status, 400);
});

test('there is a terms of sale page, and the privacy page mentions the waiting list', async () => {
  const { pages } = (await shop.request('/api/site')).body;
  assert.match(pages.TERMS, /discount code/i);
  assert.match(pages.PRIVACY, /sold-out size/);
});
