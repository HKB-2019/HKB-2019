/* Tests for the parts where a bug costs real money.
 *
 *   node --test server/test/shop.test.js
 *
 * Runs against an in-memory Postgres (PGlite), so the SQL tested here is the
 * SQL that runs in production. Paystack is stubbed via global.fetch — these
 * prove OUR logic, not theirs.
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

// In-memory Postgres by default. Set TEST_DATABASE_URL to run the same tests
// against a real server — it must be a throwaway database: every test wipes it.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else { process.env.PGLITE_DIR = 'memory://'; delete process.env.DATABASE_URL; }
process.env.PAYSTACK_SECRET_KEY = 'sk_test_' + 'f'.repeat(40);   // the shape of a real key

let one, query, seed, request, server;
let sweepPending, reconcile, setSetting, checkoutLimit;

/* Delivery as the tests assume it: Lagos ₦2,500, Abuja ₦3,500, rest of
 * Nigeria ₦5,000, nowhere abroad. */
const LAGOS_FEE = 250_000;
const DELIVERY = {
  lagos:         { enabled: true,  feeKobo: LAGOS_FEE },
  abuja:         { enabled: true,  feeKobo: 350_000 },
  nigeria:       { enabled: true,  feeKobo: 500_000 },
  international: { enabled: false, feeKobo: null }
};

/** A complete, valid set of delivery details, overridable per test. */
const WHO = {
  name: 'Ada Obi',
  phone: '+234 803 123 4567',
  address: { line1: '12 Admiralty Way', line2: '', city: 'Lekki', state: 'Lagos', country: 'Nigeria' }
};

before(async () => {
  ({ one, query } = await import('../db.js'));
  ({ seed } = await import('../seed.js'));
  ({ sweepPending, reconcile } = await import('../lib/orders.js'));
  ({ setSetting } = await import('../lib/settings.js'));
  ({ checkoutLimit } = await import('../routes/checkout.js'));
  const { createApp } = await import('../index.js');
  const { createServer } = await import('node:http');

  server = createServer(createApp());
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  request = async (path, opts = {}) => {
    const res = await realFetch(base + path, opts);
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body };
  };
});

after(async () => {
  server?.close();
  const { close } = await import('../db.js');
  await close();
});

beforeEach(async () => {
  await seed({ reset: true });
  await setSetting('delivery', DELIVERY);
  checkoutLimit.reset();            // every test here checks out from 127.0.0.1
});

/* ---- helpers ---------------------------------------------------------- */

const stockOf = async (productId, size) =>
  (await one('SELECT stock FROM variants WHERE product_id = $1 AND size = $2', [productId, size])).stock;

const statusOf = async (reference) =>
  (await one('SELECT status FROM orders WHERE reference = $1', [reference])).status;

/** Pretend an order was placed `minutes` ago. */
const age = (reference, minutes) =>
  query(`UPDATE orders SET created_at = now() - make_interval(mins => $2) WHERE reference = $1`,
    [reference, minutes]);

/* ---- Paystack stub ---------------------------------------------------- */

const realFetch = globalThis.fetch;
let paystackCalls = [];

/**
 *   initFails     the initialize call fails (Paystack unreachable at checkout)
 *   verifyAmount  what Paystack says was paid; defaults to the order's total
 *   verifyStatus  what Paystack says happened: success, abandoned, ongoing…
 *   verifyFails   the verify call itself fails
 */
function stubPaystack({ initFails = false, verifyAmount = null, verifyStatus = 'success', verifyFails = false } = {}) {
  paystackCalls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith('https://api.paystack.co')) return realFetch(url, opts);

    paystackCalls.push({ url: u, body: opts.body ? JSON.parse(opts.body) : null });

    if (u.includes('/transaction/initialize')) {
      if (initFails) return new Response(JSON.stringify({ status: false, message: 'nope' }), { status: 400 });
      return new Response(JSON.stringify({
        status: true,
        data: { authorization_url: 'https://checkout.paystack.com/fake', reference: JSON.parse(opts.body).reference }
      }), { status: 200 });
    }
    if (u.includes('/transaction/verify/')) {
      if (verifyFails) return new Response(JSON.stringify({ status: false, message: 'down' }), { status: 503 });
      const ref = decodeURIComponent(u.split('/verify/')[1]);
      const order = await one('SELECT subtotal_kobo + shipping_kobo AS due FROM orders WHERE reference = $1', [ref]);
      return new Response(JSON.stringify({
        status: true,
        data: { id: 99887766, status: verifyStatus, reference: ref, currency: 'NGN',
                amount: verifyAmount ?? order?.due ?? 0 }
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

/** The webhook answers before it acts; wait for it to finish acting. */
const settle = () => new Promise(r => setTimeout(r, 150));

const checkout = (body) => request('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...WHO, ...body })
});

const buy = async (productId, size, qty = 1, email = 'a@example.com') => {
  const res = await checkout({ email, items: [{ productId, size, qty }] });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  return res.body.reference;
};

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
  assert.equal(res.body.totalKobo, 9_800_000 + LAGOS_FEE, 'plus Lagos delivery');

  const sentToPaystack = paystackCalls.find(c => c.url.includes('initialize'));
  assert.equal(sentToPaystack.body.amount, 9_800_000 + LAGOS_FEE, 'Paystack must be asked for the real amount');
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
  await buy('jacket', 'M', 2);

  const second = await checkout({ email: 'b@example.com', items: [{ productId: 'jacket', size: 'M', qty: 1 }] });
  assert.equal(second.status, 409, 'second buyer must be refused, not oversold');
  assert.equal(await stockOf('jacket', 'M'), 0);
});

test('ten buyers at once for two jackets: exactly two get one', async () => {
  stubPaystack();
  const results = await Promise.all(Array.from({ length: 10 }, (_, i) =>
    checkout({ email: `rush${i}@example.com`, items: [{ productId: 'jacket', size: 'M', qty: 1 }] })));

  assert.equal(results.filter(r => r.status === 200).length, 2);
  assert.equal(results.filter(r => r.status === 409).length, 8);
  assert.equal(await stockOf('jacket', 'M'), 0);
});

test('a failed line leaves nothing held from the lines before it', async () => {
  stubPaystack();
  const res = await checkout({
    email: 'a@example.com',
    items: [
      { productId: 'cap',   size: 'ONE SIZE', qty: 2 },   // fine on its own
      { productId: 'phone', size: 'ONE SIZE', qty: 1 }    // sold out
    ]
  });
  assert.equal(res.status, 409);
  assert.equal(await stockOf('cap', 'ONE SIZE'), 30, 'the caps must not stay held');
  assert.equal((await one('SELECT COUNT(*) AS n FROM orders')).n, 0, 'no half-made order');
});

test('a sold-out variant cannot be bought at all', async () => {
  stubPaystack();
  const res = await checkout({ email: 'a@example.com', items: [{ productId: 'phone', size: 'ONE SIZE', qty: 1 }] });
  assert.equal(res.status, 409);
});

test('held stock is returned when the payment provider cannot be reached', async () => {
  stubPaystack({ initFails: true });
  const before = await stockOf('backpack', 'ONE SIZE');

  const res = await checkout({ email: 'a@example.com', items: [{ productId: 'backpack', size: 'ONE SIZE', qty: 2 }] });
  assert.equal(res.status, 502);
  assert.equal(await stockOf('backpack', 'ONE SIZE'), before, 'stock must not stay held when checkout failed');
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

test('a returning customer is recognised, not duplicated', async () => {
  stubPaystack();
  await buy('cap', 'ONE SIZE', 1, 'Same@Example.com');
  await buy('tee', 'M', 1, 'same@example.com ');
  assert.equal((await one('SELECT COUNT(*) AS n FROM customers')).n, 1);
});

/* ---- the webhook tests ---------------------------------------------- */

test('a webhook with a bad signature is refused', async () => {
  stubPaystack();
  const reference = await buy('cap', 'ONE SIZE');

  const res = await postWebhook(
    { event: 'charge.success', data: { id: 1, reference } },
    { signature: 'deadbeef'.repeat(16) }
  );
  assert.equal(res.status, 401);
  assert.equal(await statusOf(reference), 'pending', 'an unsigned webhook must not mark an order paid');
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
  const reference = await buy('tee', 'L');

  await postWebhook({ event: 'charge.success', data: { id: 555, reference } });
  await settle();

  const order = await one('SELECT status, paystack_id, paid_at FROM orders WHERE reference = $1', [reference]);
  assert.equal(order.status, 'paid');
  assert.equal(order.paystack_id, '99887766');
  assert.ok(order.paid_at);
});

test('a replayed webhook does not fulfil twice', async () => {
  stubPaystack();
  const reference = await buy('tee', 'L');
  const event = { event: 'charge.success', data: { id: 777, reference } };

  await postWebhook(event);
  await settle();
  await postWebhook(event);
  await postWebhook(event);
  await settle();

  const rows = await one('SELECT COUNT(*) AS n FROM webhook_events WHERE reference = $1', [reference]);
  assert.equal(rows.n, 1, 'the same event must be stored once');
  assert.equal(await statusOf(reference), 'paid');
});

test('an underpayment is NOT fulfilled', async () => {
  stubPaystack({ verifyAmount: 100 });             // paid ₦1 for a ₦28,000 tee
  const reference = await buy('tee', 'L');

  await postWebhook({ event: 'charge.success', data: { id: 888, reference } });
  await settle();

  assert.equal(await statusOf(reference), 'pending', 'an amount mismatch must never be marked paid');
});

test('charge.failed returns the held stock', async () => {
  stubPaystack();
  const before = await stockOf('tee', 'S');
  const reference = await buy('tee', 'S', 2);
  assert.equal(await stockOf('tee', 'S'), before - 2);

  await postWebhook({ event: 'charge.failed', data: { id: 999, reference } });
  await settle();

  assert.equal(await stockOf('tee', 'S'), before);
  assert.equal(await statusOf(reference), 'failed');
});

/* ---- orders nobody tells us about ------------------------------------ */

test('a checkout left on the Paystack page gives its stock back', async () => {
  stubPaystack({ verifyStatus: 'abandoned' });
  const before = await stockOf('jacket', 'L');
  const reference = await buy('jacket', 'L');
  await age(reference, 45);

  await sweepPending();

  assert.equal(await statusOf(reference), 'abandoned');
  assert.equal(await stockOf('jacket', 'L'), before, 'the jacket must go back on sale');
});

test('a recent unpaid checkout keeps its stock — the customer may still be paying', async () => {
  stubPaystack({ verifyStatus: 'abandoned' });
  const before = await stockOf('jacket', 'L');
  const reference = await buy('jacket', 'L');
  await age(reference, 10);                        // checked, but not yet given up on

  await sweepPending();

  assert.equal(await statusOf(reference), 'pending');
  assert.equal(await stockOf('jacket', 'L'), before - 1);
});

test('a payment still going through is never released', async () => {
  stubPaystack({ verifyStatus: 'ongoing' });
  const reference = await buy('jacket', 'L');
  await age(reference, 120);

  await sweepPending();
  assert.equal(await statusOf(reference), 'pending');
});

test('a payment whose webhook never arrived is still marked paid', async () => {
  // The server was asleep when Paystack called. Nobody retried in time.
  stubPaystack({ verifyStatus: 'success' });
  const reference = await buy('hoodie', 'M');
  await age(reference, 8);

  await sweepPending();
  assert.equal(await statusOf(reference), 'paid');
});

test('the customer\'s return page never releases stock', async () => {
  stubPaystack({ verifyStatus: 'abandoned' });
  const reference = await buy('jacket', 'L');
  await age(reference, 90);

  const res = await request(`/api/orders/${reference}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'pending', 'a slow bank is not an abandoned basket');
});

test('the customer\'s return page catches a payment the webhook missed', async () => {
  stubPaystack({ verifyStatus: 'success' });
  const reference = await buy('tee', 'M');

  const res = await request(`/api/orders/${reference}`);
  assert.equal(res.body.status, 'paid');
});

test('a late payer whose webhook was missed is not told "nothing was taken"', async () => {
  stubPaystack({ verifyStatus: 'abandoned' });
  const reference = await buy('hoodie', 'S');
  await age(reference, 45);
  await sweepPending();
  assert.equal(await statusOf(reference), 'abandoned');

  // They pay on the old tab. The server is asleep; no webhook lands.
  // Then Paystack sends them back to the shop.
  stubPaystack({ verifyStatus: 'success' });
  const res = await request(`/api/orders/${reference}`);
  assert.equal(res.body.status, 'paid', 'their page must show what actually happened');
});

test('an order stuck for a day is released even if Paystack cannot be asked', async () => {
  stubPaystack({ verifyFails: true });
  const before = await stockOf('scarf', 'ONE SIZE');
  const reference = await buy('scarf', 'ONE SIZE');

  await age(reference, 60);
  await sweepPending();
  assert.equal(await statusOf(reference), 'pending', 'an hour of Paystack trouble is not enough');

  await age(reference, 25 * 60);
  await sweepPending();
  assert.equal(await statusOf(reference), 'abandoned');
  assert.equal(await stockOf('scarf', 'ONE SIZE'), before);
});

test('paying after being given up on takes the stock back when it is still there', async () => {
  stubPaystack({ verifyStatus: 'abandoned' });
  const before = await stockOf('hoodie', 'L');
  const reference = await buy('hoodie', 'L');
  await age(reference, 45);
  await sweepPending();
  assert.equal(await stockOf('hoodie', 'L'), before, 'released');

  // an hour later they find the tab and pay
  stubPaystack({ verifyStatus: 'success' });
  await postWebhook({ event: 'charge.success', data: { id: 4242, reference } });
  await settle();

  assert.equal(await statusOf(reference), 'paid');
  assert.equal(await stockOf('hoodie', 'L'), before - 1, 'their hoodie is theirs again');
});

test('paying after the last one sold to someone else is flagged for a refund, never oversold', async () => {
  stubPaystack({ verifyStatus: 'abandoned' });
  const late = await buy('jacket', 'XL', 1, 'late@example.com');   // the only XL
  await age(late, 45);
  await sweepPending();
  assert.equal(await stockOf('jacket', 'XL'), 1, 'released back to the shelf');

  stubPaystack({ verifyStatus: 'success' });
  const quick = await buy('jacket', 'XL', 1, 'quick@example.com');
  await reconcile(quick);
  assert.equal(await statusOf(quick), 'paid');
  assert.equal(await stockOf('jacket', 'XL'), 0);

  // now the first customer pays on their stale tab
  await postWebhook({ event: 'charge.success', data: { id: 5151, reference: late } });
  await settle();

  assert.equal(await statusOf(late), 'refund_due', 'charged for a jacket that has gone');
  assert.equal(await stockOf('jacket', 'XL'), 0, 'and the stock count never went negative');
});

test('a late payment for a multi-piece order takes back all of it or none of it', async () => {
  stubPaystack({ verifyStatus: 'abandoned' });
  const res = await checkout({ email: 'late@example.com', items: [
    { productId: 'cap',    size: 'ONE SIZE', qty: 1 },
    { productId: 'jacket', size: 'XL',       qty: 1 }
  ]});
  const late = res.body.reference;
  await age(late, 45);
  await sweepPending();
  const caps = await stockOf('cap', 'ONE SIZE');

  stubPaystack({ verifyStatus: 'success' });
  await buy('jacket', 'XL', 1, 'quick@example.com');           // the XL goes

  await postWebhook({ event: 'charge.success', data: { id: 6161, reference: late } });
  await settle();

  assert.equal(await statusOf(late), 'refund_due');
  assert.equal(await stockOf('cap', 'ONE SIZE'), caps, 'the cap must not be taken for an order that cannot ship');
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
  assert.deepEqual(tee.sizes.map(s => s.size), ['S', 'M', 'L', 'XL']);
  assert.ok(tee.sizes.every(s => s.available));
  assert.equal(tee.sizes.find(s => s.size === 'XL').left, 6, 'a low count is shown');
  assert.equal(tee.sizes.find(s => s.size === 'M').left, null, 'a healthy count is nobody\'s business');
  assert.equal(tee.img, 'assets/img/prod-tee.webp');
  assert.equal(tee.img2x, 'assets/img/prod-tee@2x.webp');

  assert.ok(!res.body.find(p => p.id === 'airpods').inDrop, 'the pod shell is carousel-only');
  assert.ok(res.body.find(p => p.id === 'airpods').inEssentials);

  assert.deepEqual(res.body.map(p => p.id).slice(0, 4), ['tee', 'cap', 'backpack', 'scarf'],
    'display order is the catalogue order');
});

/* ---- a placeholder is not a key ---------------------------------------- */

test('with a placeholder Paystack key, webhooks cannot be forged with it', async () => {
  stubPaystack();
  const reference = await buy('tee', 'M');
  const real = process.env.PAYSTACK_SECRET_KEY;

  try {
    for (const placeholder of ['none', 'sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', 'changeme', '']) {
      process.env.PAYSTACK_SECRET_KEY = placeholder;
      const raw = JSON.stringify({ event: 'charge.failed', data: { id: 1, reference } });
      const forged = createHmac('sha512', placeholder || 'x').update(raw).digest('hex');
      const res = await request('/api/paystack/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-paystack-signature': forged },
        body: raw
      });
      assert.equal(res.status, 401, `a webhook signed with "${placeholder}" must be refused`);
    }
  } finally {
    process.env.PAYSTACK_SECRET_KEY = real;
  }
  assert.equal(await statusOf(reference), 'pending', 'the order was not touched');
});
