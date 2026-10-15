/* The STOCK tab: shelf counts, with sold-but-unsent and being-paid-for pieces
 * taken off by the shop; several lines saved at once; a record of changes;
 * a spreadsheet.
 *
 *   node --test server/test/stock.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, sign, colourOf } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); cookie = await shop.login(); });

const api = (path, method = 'GET', json) => shop.request(`/api/admin${path}`, { method, cookie, json });
const item = (productId, size, qty = 1) => ({ email: 'a@example.com', items: [{ productId, colour: colourOf(productId), size, qty }] });
const line = async (productId, size) => (await api('/stock')).body.find(r =>
  r.productId === productId && r.size === size && (r.colour ?? '') === colourOf(productId));

let eventId = 5000;
async function pay(reference) {
  const raw = JSON.stringify({ event: 'charge.success', data: { id: ++eventId, reference } });
  await shop.request('/api/paystack/webhook', { method: 'POST', body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) } });
  await new Promise(r => setTimeout(r, 150));
}

test('the new stock routes refuse a caller who is not signed in', async () => {
  for (const [method, path] of [['POST', '/api/admin/stock'], ['POST', '/api/admin/stock/receive'], ['GET', '/api/admin/stock/history'], ['GET', '/api/admin/stock.csv']]) {
    assert.equal((await shop.request(path, { method, json: method === 'GET' ? undefined : {} })).status, 401, `${method} ${path}`);
  }
});

test('each line shows the shelf, what is waiting to be sent, what is being paid for, and what is left', async () => {
  const before = await line('cap', 'ONE SIZE');
  assert.deepEqual([before.shelf, before.toSend, before.held, before.stock, before.state], [30, 0, 0, 30, 'ok']);

  const sold = await shop.checkout(item('cap', 'ONE SIZE', 2));
  await pay(sold.body.reference);
  await shop.checkout({ ...item('cap', 'ONE SIZE', 1), email: 'b@example.com' });   // still paying

  const now = await line('cap', 'ONE SIZE');
  assert.equal(now.stock, 27, 'left to sell');
  assert.equal(now.toSend, 2, 'paid, not yet sent');
  assert.equal(now.held, 1, 'someone is paying');
  assert.equal(now.shelf, 30, 'all still on the shelf');

  // Once sent, they have left the shelf.
  await api(`/orders/${sold.body.reference}/fulfil`, 'POST');
  const sent = await line('cap', 'ONE SIZE');
  assert.deepEqual([sent.shelf, sent.toSend, sent.held, sent.stock], [28, 0, 1, 27]);
});

test('shelf counts for several lines save together, and the shop takes off what is spoken for', async () => {
  const sold = await shop.checkout(item('cap', 'ONE SIZE', 2));
  await pay(sold.body.reference);
  const cap = await line('cap', 'ONE SIZE');
  const scarf = await line('scarf', 'ONE SIZE');

  const res = await api('/stock', 'POST', { counts: [
    { variantId: cap.variantId, shelf: 10 },        // 2 of these are sold, waiting to go
    { variantId: scarf.variantId, shelf: scarf.shelf }   // unchanged: not logged
  ] });
  assert.equal(res.status, 200, res.raw);
  assert.equal(res.body.changed, 1);
  const after = res.body.stock.find(r => r.variantId === cap.variantId);
  assert.deepEqual([after.shelf, after.toSend, after.stock, after.state], [10, 2, 8, 'ok']);

  // A low line and an empty one say so.
  await api('/stock', 'POST', { counts: [{ variantId: cap.variantId, shelf: 4 }, { variantId: scarf.variantId, shelf: 0 }] });
  assert.equal((await line('cap', 'ONE SIZE')).state, 'low');
  assert.equal((await line('scarf', 'ONE SIZE')).state, 'out');

  // Every change is on the record, newest first, with the count it came from.
  const history = (await api('/stock/history')).body;
  assert.deepEqual(history.slice(0, 3).map(h => [h.name, h.before, h.after, h.shelf]), [
    ['THE PATTERN SCARF', 22, 0, 0],
    ['THE MARK CAP', 8, 2, 4],
    ['THE MARK CAP', 28, 8, 10]
  ]);
  assert.equal(history[1].colour, 'Black');
});

test('a shelf count below what is already sold saves nothing, and says which line', async () => {
  const sold = await shop.checkout(item('cap', 'ONE SIZE', 3));
  await pay(sold.body.reference);
  const cap = await line('cap', 'ONE SIZE');
  const scarf = await line('scarf', 'ONE SIZE');

  const res = await api('/stock', 'POST', { counts: [
    { variantId: scarf.variantId, shelf: 5 },
    { variantId: cap.variantId, shelf: 2 }
  ] });
  assert.equal(res.status, 409);
  assert.match(res.body.error, /^Nothing was saved\. THE MARK CAP, Black, ONE SIZE: you counted 2, but 3 are sold/);
  assert.equal((await line('scarf', 'ONE SIZE')).stock, 22, 'the good line was not saved either');
  assert.equal((await api('/stock/history')).body.length, 0);
});

test('bad shelf counts are refused before anything is touched', async () => {
  const cap = await line('cap', 'ONE SIZE');
  for (const body of [{}, { counts: [] }, { counts: [{ variantId: cap.variantId, shelf: -1 }] },
    { counts: [{ variantId: cap.variantId, shelf: 1.5 }] }, { counts: [{ variantId: 'x', shelf: 1 }] }]) {
    assert.equal((await api('/stock', 'POST', body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await api('/stock', 'POST', { counts: [{ variantId: 424242, shelf: 1 }] })).status, 404);
});

test('a delivery adds what arrived on top, for several lines at once, with a note', async () => {
  const sold = await shop.checkout(item('cap', 'ONE SIZE', 2));
  await pay(sold.body.reference);                      // 28 left, 2 waiting to be sent
  const cap = await line('cap', 'ONE SIZE');
  const scarf = await line('scarf', 'ONE SIZE');

  const res = await api('/stock/receive', 'POST', { note: '  Aba workshop,   invoice 12 ', lines: [
    { variantId: cap.variantId, qty: 20 }, { variantId: scarf.variantId, qty: 5 }
  ] });
  assert.equal(res.status, 200, res.raw);
  assert.deepEqual([res.body.received, res.body.lines], [25, 2]);
  const after = res.body.stock.find(r => r.variantId === cap.variantId);
  assert.deepEqual([after.stock, after.toSend, after.shelf], [48, 2, 50], 'the sold two are untouched');

  const [h1, h2] = (await api('/stock/history')).body;
  assert.deepEqual([h1.kind, h1.note, h1.before, h1.after], ['delivery', 'Aba workshop, invoice 12', 22, 27]);
  assert.deepEqual([h2.kind, h2.name, h2.before, h2.after], ['delivery', 'THE MARK CAP', 28, 48]);

  for (const body of [{ lines: [] }, { lines: [{ variantId: cap.variantId, qty: 0 }] },
    { lines: [{ variantId: cap.variantId, qty: 2.5 }] }, { lines: [{ variantId: cap.variantId, qty: 1 }], note: 'x'.repeat(121) }]) {
    assert.equal((await api('/stock/receive', 'POST', body)).status, 400, JSON.stringify(body));
  }
  assert.equal((await api('/stock/receive', 'POST', { lines: [{ variantId: 424242, qty: 1 }] })).status, 404);
  assert.equal((await line('cap', 'ONE SIZE')).stock, 48, 'refused deliveries add nothing');
});

test('setting one line directly is on the record too', async () => {
  const cap = await line('cap', 'ONE SIZE');
  await api(`/stock/${cap.variantId}`, 'POST', { stock: 12 });
  const [h] = (await api('/stock/history')).body;
  assert.deepEqual([h.name, h.before, h.after, h.shelf, h.kind], ['THE MARK CAP', 30, 12, null, 'set']);
});

test('stock downloads as a spreadsheet', async () => {
  const res = await shop.request('/api/admin/stock.csv', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition'), /masq-stock-\d{4}-\d{2}-\d{2}\.csv/);
  const lines = res.raw.trim().split(/\r?\n/);
  const cells = (l) => l.replace(/^\uFEFF/, '').split(',').map(c => c.replace(/^"|"$/g, ''));
  assert.deepEqual(cells(lines[0]), ['Piece', 'Colour', 'Size', 'Price ₦', 'On the shelf', 'Waiting to be sent', 'Being paid for', 'Left to sell', 'On sale']);
  assert.ok(lines.map(cells).some(c => c.join('|') === 'THE MARK CAP|Black|ONE SIZE|14000.00|30|0|0|30|yes'), lines.slice(0, 6).join('\n'));
});
