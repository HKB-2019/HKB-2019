/* Tests for the parts where a bug costs real money.
 *
 *   node --test server/test/shop.test.js
 *
 * Paystack is stubbed via global.fetch — these prove OUR logic, not theirs.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { rmSync } from 'node:fs';

const DB = './server/test-shop.db';
process.env.DATABASE_PATH = DB;
process.env.PAYSTACK_SECRET_KEY = 'sk_test_fake_key_for_tests';

let app, db, seed, request;

before(async () => {
  ({ db } = await import('../db.js'));
  ({ seed } = await import('../seed.js'));
  const { createApp } = await import('../index.js');
  app = createApp();

  const { createServer } = await import('node:http');
  const server = createServer(app);
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  request = async (path, opts = {}) => {
    const realFetch = globalThis.__realFetch ?? fetch;
    const res = await realFetch(base + path, opts);
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  };

  globalThis.__server = server;
});

after(() => {
  globalThis.__server?.close();
  for (const suffix of ['', '-shm', '-wal']) {
    try { rmSync(DB + suffix); } catch {}
  }
});

beforeEach(() => {
  seed({ reset: true });
});

/* ---- Paystack stub -------------------------------------------------- */

globalThis.__realFetch = globalThis.fetch;
let paystackCalls = [];
let paystackVerifyAmount = null;

function stubPaystack({ initFails = false, verifyAmount = null, verifyStatus = 'success' } = {}) {
  paystackCalls = [];
  paystackVerifyAmount = verifyAmount;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith('https://api.paystack.co')) return globalThis.__realFetch(url, opts);

    paystackCalls.push({ url: u, body: opts.body ? JSON.parse(opts.body) : null });

    if (u.includes('/transaction/initialize')) {
      if (initFails) return new Response(JSON.stringify({ status: false, message: 'nope' }), { status: 400 });
      return new Response(JSON.stringify({
        status: true,
        data: { authorization_url: 'https://checkout.paystack.com/fake', reference: JSON.parse(opts.body).reference }
      }), { status: 200 });
    }
    if (u.includes('/transaction/verify/')) {
      const ref = decodeURIComponent(u.split('/verify/')[1]);
      const order = db.prepare('SELECT subtotal_kobo FROM orders WHERE reference = ?').get(ref);
      return new Response(JSON.stringify({
        status: true,
        data: {
          id: 99887766,
          status: verifyStatus,
          reference: ref,
          amount: paystackVerifyAmount ?? order?.subtotal_kobo ?? 0
        }
      }), { status: 200 });
    }
    return new Response('{}', { status: 200 });
  };
}

const sign = (raw) =>
  createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex');

const postWebhook = (event, { signature } = {}) => {
  const raw = JSON.stringify(event);
  return request('/api/paystack/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': signature ?? sign(raw) },
    body: raw
  });
};

const checkout = (body) => request('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

/* ---- the money tests ------------------------------------------------ */

test('a forged price in the request is ignored; the catalogue decides', async () => {
  stubPaystack();
  const res = await checkout({
    email: 'thief@example.com',
    // every one of these is an attempt to set the price from the browser
    items: [{ productId: 'jacket', size: 'M', qty: 1, price: 1, priceKobo: 100, amount: 1, unit_price_kobo: 1 }]
  });

  assert.equal(res.status, 200);
  assert.equal(res.body.subtotalKobo, 9_800_000, 'must charge the jacket price from the database');

  const sentToPaystack = paystackCalls.find(c => c.url.includes('initialize'));
  assert.equal(sentToPaystack.body.amount, 9_800_000, 'Paystack must be asked for the real amount');
});

test('subtotal is exact across mixed quantities (integer kobo, no float drift)', async () => {
  stubPaystack();
  const res = await checkout({
    email: 'buyer@example.com',
    items: [
      { productId: 'tee',   size: 'M',        qty: 3 },   // 3 x 28,000
      { productId: 'scarf', size: 'ONE SIZE', qty: 2 },   // 2 x 18,000
      { productId: 'cap',   size: 'ONE SIZE', qty: 1 }    // 1 x 14,000
    ]
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.subtotalKobo, (3 * 28000 + 2 * 18000 + 1 * 14000) * 100);
  assert.equal(res.body.subtotalKobo, 13_400_000);
  assert.ok(Number.isInteger(res.body.subtotalKobo));
});

test('stock is held at checkout and cannot be oversold', async () => {
  stubPaystack();
  // the jacket has 2 in size M
  const first = await checkout({ email: 'a@example.com', items: [{ productId: 'jacket', size: 'M', qty: 2 }] });
  assert.equal(first.status, 200);

  const second = await checkout({ email: 'b@example.com', items: [{ productId: 'jacket', size: 'M', qty: 1 }] });
  assert.equal(second.status, 409, 'second buyer must be refused, not oversold');

  const left = db.prepare("SELECT stock FROM variants WHERE product_id='jacket' AND size='M'").get();
  assert.equal(left.stock, 0);
});

test('a sold-out variant cannot be bought at all', async () => {
  stubPaystack();
  const res = await checkout({ email: 'a@example.com', items: [{ productId: 'phone', size: 'ONE SIZE', qty: 1 }] });
  assert.equal(res.status, 409);
});

test('held stock is returned when the payment provider cannot be reached', async () => {
  stubPaystack({ initFails: true });
  const before = db.prepare("SELECT stock FROM variants WHERE product_id='backpack' AND size='ONE SIZE'").get().stock;

  const res = await checkout({ email: 'a@example.com', items: [{ productId: 'backpack', size: 'ONE SIZE', qty: 2 }] });
  assert.equal(res.status, 502);

  const after = db.prepare("SELECT stock FROM variants WHERE product_id='backpack' AND size='ONE SIZE'").get().stock;
  assert.equal(after, before, 'stock must not stay held when checkout failed');
});

test('unknown product or size is rejected', async () => {
  stubPaystack();
  assert.equal((await checkout({ email: 'a@example.com', items: [{ productId: 'nope', size: 'M', qty: 1 }] })).status, 404);
  assert.equal((await checkout({ email: 'a@example.com', items: [{ productId: 'cap', size: 'XXL', qty: 1 }] })).status, 404);
});

test('nonsense quantities are rejected', async () => {
  stubPaystack();
  for (const qty of [0, -1, 1.5, 999, '2', null]) {
    const res = await checkout({ email: 'a@example.com', items: [{ productId: 'cap', size: 'ONE SIZE', qty }] });
    assert.equal(res.status, 400, `qty ${JSON.stringify(qty)} should be refused`);
  }
});

test('a bad email is rejected before anything is reserved', async () => {
  stubPaystack();
  const res = await checkout({ email: 'not-an-email', items: [{ productId: 'cap', size: 'ONE SIZE', qty: 1 }] });
  assert.equal(res.status, 400);
  assert.equal(paystackCalls.length, 0);
});

/* ---- the webhook tests ---------------------------------------------- */

test('a webhook with a bad signature is refused', async () => {
  stubPaystack();
  const { reference } = (await checkout({ email: 'a@example.com', items: [{ productId: 'cap', size: 'ONE SIZE', qty: 1 }] })).body;

  const res = await postWebhook(
    { event: 'charge.success', data: { id: 1, reference } },
    { signature: 'deadbeef'.repeat(16) }
  );
  assert.equal(res.status, 401);

  const order = db.prepare('SELECT status FROM orders WHERE reference = ?').get(reference);
  assert.equal(order.status, 'pending', 'an unsigned webhook must not mark an order paid');
});

test('a webhook with no signature at all is refused', async () => {
  stubPaystack();
  const res = await request('/api/paystack/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'charge.success', data: { reference: 'x' } })
  });
  assert.equal(res.status, 401);
});

test('a correctly signed charge.success marks the order paid', async () => {
  stubPaystack();
  const { reference } = (await checkout({ email: 'a@example.com', items: [{ productId: 'tee', size: 'L', qty: 1 }] })).body;

  await postWebhook({ event: 'charge.success', data: { id: 555, reference } });
  await new Promise(r => setTimeout(r, 120));      // handled after the 200

  const order = db.prepare('SELECT status, paystack_id FROM orders WHERE reference = ?').get(reference);
  assert.equal(order.status, 'paid');
  assert.equal(order.paystack_id, '99887766');
});

test('a replayed webhook does not fulfil twice', async () => {
  stubPaystack();
  const { reference } = (await checkout({ email: 'a@example.com', items: [{ productId: 'tee', size: 'L', qty: 1 }] })).body;
  const event = { event: 'charge.success', data: { id: 777, reference } };

  await postWebhook(event);
  await new Promise(r => setTimeout(r, 120));
  await postWebhook(event);
  await postWebhook(event);
  await new Promise(r => setTimeout(r, 120));

  const rows = db.prepare('SELECT COUNT(*) n FROM webhook_events WHERE reference = ?').get(reference);
  assert.equal(rows.n, 1, 'the same event must be stored once');

  const order = db.prepare('SELECT status FROM orders WHERE reference = ?').get(reference);
  assert.equal(order.status, 'paid');
});

test('an underpayment is NOT fulfilled', async () => {
  stubPaystack({ verifyAmount: 100 });             // paid ₦1 for a ₦28,000 tee
  const { reference } = (await checkout({ email: 'a@example.com', items: [{ productId: 'tee', size: 'L', qty: 1 }] })).body;

  await postWebhook({ event: 'charge.success', data: { id: 888, reference } });
  await new Promise(r => setTimeout(r, 120));

  const order = db.prepare('SELECT status FROM orders WHERE reference = ?').get(reference);
  assert.equal(order.status, 'pending', 'an amount mismatch must never be marked paid');
});

test('charge.failed returns the held stock', async () => {
  stubPaystack();
  const before = db.prepare("SELECT stock FROM variants WHERE product_id='tee' AND size='S'").get().stock;
  const { reference } = (await checkout({ email: 'a@example.com', items: [{ productId: 'tee', size: 'S', qty: 2 }] })).body;

  assert.equal(db.prepare("SELECT stock FROM variants WHERE product_id='tee' AND size='S'").get().stock, before - 2);

  await postWebhook({ event: 'charge.failed', data: { id: 999, reference } });
  await new Promise(r => setTimeout(r, 120));

  assert.equal(db.prepare("SELECT stock FROM variants WHERE product_id='tee' AND size='S'").get().stock, before);
  assert.equal(db.prepare('SELECT status FROM orders WHERE reference = ?').get(reference).status, 'failed');
});

/* ---- catalogue ------------------------------------------------------- */

test('the catalogue reports real stock and computes soldOut', async () => {
  const res = await request('/api/products');
  assert.equal(res.status, 200);

  const phone = res.body.find(p => p.id === 'phone');
  assert.equal(phone.soldOut, true, 'the mask case has no stock');

  const tee = res.body.find(p => p.id === 'tee');
  assert.equal(tee.soldOut, false);
  assert.equal(tee.priceKobo, 2_800_000);
  assert.deepEqual(tee.sizes, ['S', 'M', 'L', 'XL']);
});
