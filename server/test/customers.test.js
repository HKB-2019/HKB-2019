/* CUSTOMERS: one record per person from orders, the mailing list and
 * restock requests; the owner's tags and notes; forgetting someone.
 *
 *   node --test server/test/customers.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, sign, colourOf } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); cookie = await shop.login(); });

const api = (path, method = 'GET', json) => shop.request(`/api/admin${path}`, { method, cookie, json });
const buy = (email, productId = 'cap', size = 'ONE SIZE', qty = 1, extra = {}) =>
  shop.checkout({ email, items: [{ productId, colour: colourOf(productId), size, qty }], ...extra });
const person = async (email) => (await api('/customers')).body.find(p => p.email === email);

let eventId = 9000;
async function pay(reference) {
  const raw = JSON.stringify({ event: 'charge.success', data: { id: ++eventId, reference } });
  await shop.request('/api/paystack/webhook', { method: 'POST', body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) } });
  await new Promise(r => setTimeout(r, 150));
}

test('only the owner can see or change customers', async () => {
  for (const [method, path] of [['GET', '/api/admin/customers'], ['GET', '/api/admin/customers.csv'],
    ['GET', '/api/admin/customers/a%40b.co'], ['PATCH', '/api/admin/customers/a%40b.co'], ['DELETE', '/api/admin/customers/a%40b.co']]) {
    assert.equal((await shop.request(path, { method, json: method === 'PATCH' ? {} : undefined })).status, 401, `${method} ${path}`);
  }
});

test('buyers and prospects are joined up from orders, the list and restock requests', async () => {
  const a = await buy('Ada@Example.com', 'cap', 'ONE SIZE', 2);
  await pay(a.body.reference);
  const b = await buy('ada@example.com', 'scarf', 'ONE SIZE', 1);
  await pay(b.body.reference);
  await buy('tolu@example.com');                                      // started, never paid
  await shop.request('/api/subscribe', { method: 'POST', json: { email: 'ada@example.com' } });
  await shop.request('/api/subscribe', { method: 'POST', json: { email: 'nneka@example.com' } });
  await shop.request('/api/stock-alerts', { method: 'POST', json: { productId: 'phone', size: 'ONE SIZE', email: 'kemi@example.com' } });

  const ada = await person('ada@example.com');
  assert.equal(ada.kind, 'buyer');
  assert.equal(ada.orders, 2, 'one person, whatever case they typed');
  assert.equal(ada.spentKobo, 2 * 1_400_000 + 1_800_000 + 2 * 250_000, 'two caps and a scarf, two Lagos deliveries');
  assert.equal(ada.name, 'Ada Obi');
  assert.equal(ada.city, 'Lekki');
  assert.equal(ada.subscribed, true);

  assert.deepEqual([(await person('tolu@example.com')).kind, (await person('tolu@example.com')).unfinished], ['prospect', 1]);
  assert.deepEqual([(await person('nneka@example.com')).kind, (await person('nneka@example.com')).subscribed], ['prospect', true]);
  assert.equal((await person('kemi@example.com')).waiting, 1);

  const detail = (await api('/customers/ada%40example.com')).body;
  assert.equal(detail.orderList.length, 2);
  assert.deepEqual(detail.orderList[1].items, [{ name: 'THE MARK CAP', colour: 'Black', size: 'ONE SIZE', qty: 2 }]);
  assert.equal((await api('/customers/kemi%40example.com')).body.waitingFor[0].name, 'THE MASK CASE');
  assert.equal((await api('/customers/nobody%40example.com')).status, 404);
  assert.equal((await api('/customers/not-an-email')).status, 400);
});

test('ticking "email me about new drops" at checkout puts them on the list; leaving it does not', async () => {
  await buy('yes@example.com', 'cap', 'ONE SIZE', 1, { newsletter: true });
  await buy('no@example.com');
  assert.equal((await person('yes@example.com')).subscribed, true);
  assert.equal((await person('no@example.com')).subscribed, false);
});

test('the owner tags and notes a person', async () => {
  await shop.request('/api/subscribe', { method: 'POST', json: { email: 'nneka@example.com' } });
  const res = await api('/customers/nneka%40example.com', 'PATCH', { tags: [' VIP ', 'wholesale', 'VIP', ''], notes: 'Stylist in Ikoyi.\r\nWants the hoodie in XL.' });
  assert.equal(res.status, 200, res.raw);
  assert.deepEqual(res.body.tags, ['VIP', 'wholesale']);
  assert.equal(res.body.notes, 'Stylist in Ikoyi.\nWants the hoodie in XL.');

  const notesOnly = await api('/customers/nneka%40example.com', 'PATCH', { notes: '' });
  assert.deepEqual(notesOnly.body.tags, ['VIP', 'wholesale'], 'tags kept when only notes change');

  for (const body of [{ tags: 'VIP' }, { tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }, { tags: ['x'.repeat(25)] },
    { notes: 'x'.repeat(2001) }, { notes: 5 }]) {
    assert.equal((await api('/customers/nneka%40example.com', 'PATCH', body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await api('/customers/stranger%40example.com', 'PATCH', { notes: 'hi' })).status, 404);
});

test('forgetting someone wipes who they are but keeps the accounts, and waits for unsent orders', async () => {
  const o = await buy('ada@example.com', 'cap', 'ONE SIZE', 1, { newsletter: true });
  await pay(o.body.reference);
  await api('/customers/ada%40example.com', 'PATCH', { tags: ['VIP'] });

  const early = await api('/customers/ada%40example.com', 'DELETE');
  assert.equal(early.status, 409, 'the order still has to be sent');

  await api(`/orders/${o.body.reference}/fulfil`, 'POST');
  const res = await api('/customers/ada%40example.com', 'DELETE');
  assert.equal(res.status, 200, res.raw);
  assert.equal(res.body.ordersKeptWithoutName, 1);

  assert.equal(await person('ada@example.com'), undefined);
  assert.ok(!(await api('/customers')).body.some(p => p.email.endsWith('@removed.invalid')), 'their old orders do not come back as someone');
  const row = await shop.one('SELECT email, customer_name, phone, address, subtotal_kobo FROM orders WHERE reference = $1', [o.body.reference]);
  assert.match(row.email, /^removed-\d+@removed\.invalid$/);
  assert.deepEqual([row.customer_name, row.phone, row.address], [null, null, null]);
  assert.equal(row.subtotal_kobo, 1_400_000, 'the sale is still in the books');
  assert.equal((await shop.one("SELECT COUNT(*)::int AS n FROM subscribers WHERE email = 'ada@example.com'")).n, 0);
  assert.equal((await api('/customers/ada%40example.com', 'DELETE')).status, 404);
});

test('customers download as a spreadsheet', async () => {
  const o = await buy('ada@example.com');
  await pay(o.body.reference);
  const res = await shop.request('/api/admin/customers.csv', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /masq-customers-\d{4}-\d{2}-\d{2}\.csv/);
  const cells = (l) => l.replace(/^﻿/, '').split('","').map(c => c.replace(/^"|"$/g, ''));
  const lines = res.raw.trim().split(/\r?\n/);
  assert.equal(cells(lines[0])[0], 'Name');
  assert.deepEqual(cells(lines[1]).slice(0, 8), ['Ada Obi', 'ada@example.com', "'+234 803 123 4567", 'Lekki', 'Lagos', 'buyer', '1', '16500.00']);
});
