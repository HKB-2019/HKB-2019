/* Delivery, the customer-facing pages, and the rules around them.
 *
 *   node --test server/test/store.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { startShop, stubPaystack, paystack, sign, WHO, DELIVERY } from './helpers.js';

let shop;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); paystack.verify = { status: 'success', amount: null }; });

const stockOf = async (productId, size) =>
  (await shop.one('SELECT stock FROM variants WHERE product_id = $1 AND size = $2', [productId, size])).stock;

const item = (productId = 'cap', size = 'ONE SIZE', qty = 1) => ({ items: [{ productId, size, qty }] });

const orderRow = (reference) => shop.one('SELECT * FROM orders WHERE reference = $1', [reference]);

/* ---- delivery ------------------------------------------------------------ */

test('checkout stays closed until delivery has been priced', async () => {
  await shop.reset({ delivery: null });
  const res = await shop.checkout({ email: 'a@example.com', ...item() });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'delivery_not_set');
  assert.equal(await stockOf('cap', 'ONE SIZE'), 30, 'nothing held');
  assert.equal(paystack.calls.length, 0, 'Paystack never asked');
});

test('an order must say who it is for and where it is going', async () => {
  const cases = [
    [{ name: '' },                                   /full name/],
    [{ name: 'A' },                                  /full name/],
    [{ phone: 'call me maybe' },                     /phone/],
    [{ phone: '123' },                               /phone/],
    [{ address: { ...WHO.address, line1: '' } },    /street address/],
    [{ address: { ...WHO.address, city: '' } },     /city/],
    [{ address: { ...WHO.address, state: 'Atlantis' } }, /state from the list/],
    [{ address: { ...WHO.address, country: '' } },  /country/],
    [{ address: undefined },                         /country/]
  ];
  for (const [change, message] of cases) {
    const res = await shop.checkout({ email: 'a@example.com', ...item(), ...change });
    assert.equal(res.status, 400, JSON.stringify(change));
    assert.match(res.body.error, message, JSON.stringify(change));
  }
  assert.equal(await stockOf('cap', 'ONE SIZE'), 30, 'nothing held by any of them');
});

test('the delivery fee is decided by the server from the address', async () => {
  const where = async (state) => {
    const res = await shop.checkout({
      email: 'a@example.com', ...item(),
      address: { ...WHO.address, state },
      // attempts to choose the fee from the browser — none of these are read
      shippingKobo: 0, deliveryFee: 0, zone: 'lagos', feeKobo: 1
    });
    assert.equal(res.status, 200, res.raw);
    return res.body;
  };

  assert.equal((await where('Lagos')).shippingKobo, 250_000);
  assert.equal((await where('lagos state')).shippingKobo, 250_000, 'however it is typed');
  assert.equal((await where('FCT')).shippingKobo, 350_000, 'Abuja');
  const kano = await where('Kano');
  assert.equal(kano.shippingKobo, 500_000, 'rest of Nigeria, whatever the request claimed');
  assert.equal(kano.totalKobo, 1_400_000 + 500_000);
  assert.equal(paystack.calls.at(-1).body.amount, 1_900_000, 'Paystack asked for items + delivery');
});

test('a zone that is switched off is refused, with its name', async () => {
  const res = await shop.checkout({
    email: 'a@example.com', ...item(),
    address: { line1: '4 Oxford St', city: 'Accra', state: 'Greater Accra', country: 'Ghana' }
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /don't deliver to Ghana/);
});

test('abroad is charged the international fee once it is switched on', async () => {
  const { setSetting } = await import('../lib/settings.js');
  await setSetting('delivery', { ...DELIVERY, international: { enabled: true, feeKobo: 4_500_000 } });
  const res = await shop.checkout({
    email: 'a@example.com', ...item(),
    address: { line1: '4 Oxford St', city: 'Accra', state: 'Greater Accra', country: 'Ghana' }
  });
  assert.equal(res.status, 200, res.raw);
  assert.equal(res.body.shippingKobo, 4_500_000);
  assert.equal((await orderRow(res.body.reference)).delivery_zone, 'international');
});

test('the order keeps who and where, for the parcel', async () => {
  const res = await shop.checkout({ email: 'Ada@Example.com', ...item('tee', 'M', 2) });
  const o = await orderRow(res.body.reference);
  assert.equal(o.customer_name, 'Ada Obi');
  assert.equal(o.phone, '+234 803 123 4567');
  assert.equal(o.email, 'ada@example.com');
  assert.deepEqual(o.address, { line1: '12 Admiralty Way', line2: '', city: 'Lekki', state: 'Lagos', country: 'Nigeria' });
  assert.equal(o.delivery_zone, 'lagos');
  assert.equal(o.shipping_kobo, 250_000);
  assert.equal(o.subtotal_kobo, 5_600_000);
});

test('a payment that covers the items but not the delivery is not marked paid', async () => {
  const res = await shop.checkout({ email: 'a@example.com', ...item('tee', 'L') });
  paystack.verify = { status: 'success', amount: 2_800_000 };        // items only
  const raw = JSON.stringify({ event: 'charge.success', data: { id: 1, reference: res.body.reference } });
  await shop.request('/api/paystack/webhook', { method: 'POST', body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) } });
  await new Promise(r => setTimeout(r, 150));
  assert.equal((await orderRow(res.body.reference)).status, 'pending');
});

/* ---- what the customer can buy ------------------------------------------ */

test('a product taken off sale disappears and cannot be bought, even from an old bag', async () => {
  await shop.query("UPDATE products SET hidden = TRUE WHERE id = 'cap'");
  const list = (await shop.request('/api/products')).body;
  assert.ok(!list.find(p => p.id === 'cap'), 'not shown');

  const res = await shop.checkout({ email: 'a@example.com', ...item('cap') });
  assert.equal(res.status, 404);
  assert.equal(await stockOf('cap', 'ONE SIZE'), 30);
});

test('a price change applies to new orders, never to orders already placed', async () => {
  const first = await shop.checkout({ email: 'a@example.com', ...item('tee', 'M') });
  assert.equal(first.body.subtotalKobo, 2_800_000);

  const cookie = await shop.login();
  const patch = await shop.request('/api/admin/products/tee', { method: 'PATCH', cookie, json: { priceNaira: 31000 } });
  assert.equal(patch.status, 200, patch.raw);

  const second = await shop.checkout({ email: 'b@example.com', ...item('tee', 'M') });
  assert.equal(second.body.subtotalKobo, 3_100_000, 'new orders pay the new price');

  const kept = await shop.one(`SELECT i.unit_price_kobo FROM order_items i JOIN orders o ON o.id = i.order_id
                                 WHERE o.reference = $1`, [first.body.reference]);
  assert.equal(kept.unit_price_kobo, 2_800_000, 'the first customer keeps the price they were charged');

  const shown = (await shop.request('/api/products')).body.find(p => p.id === 'tee');
  assert.equal(shown.priceKobo, 3_100_000, 'and the shop page shows the new price at once');
});

test('the shop page shows a size as gone the moment its count reaches zero', async () => {
  await shop.query("UPDATE variants SET stock = 0 WHERE product_id = 'tee' AND size = 'M'");
  const tee = (await shop.request('/api/products')).body.find(p => p.id === 'tee');
  assert.equal(tee.sizes.find(s => s.size === 'M').available, false);
  assert.equal(tee.soldOut, false, 'other sizes still for sale');

  await shop.query("UPDATE variants SET stock = 0 WHERE product_id = 'tee'");
  const gone = (await shop.request('/api/products')).body.find(p => p.id === 'tee');
  assert.equal(gone.soldOut, true);
});

/* ---- references and the order page -------------------------------------- */

test('order references are unguessable and in the only characters Paystack accepts', async () => {
  const { newReference } = await import('../lib/paystack.js');
  const refs = new Set(Array.from({ length: 200 }, newReference));
  assert.equal(refs.size, 200);
  for (const r of refs) assert.match(r, /^masq-[0-9a-f]{24}$/);

  const res = await shop.checkout({ email: 'a@example.com', ...item() });
  assert.match(res.body.reference, /^[A-Za-z0-9.=-]+$/, 'Paystack: letters, digits, - . = only');
});

test('the order page shows enough to recognise the order, and no more', async () => {
  const res = await shop.checkout({ email: 'adaobi@example.com', ...item('tee', 'M') });
  const page = (await shop.request(`/api/orders/${res.body.reference}`)).body;

  assert.equal(page.email, 'a•••i@example.com');
  assert.equal(page.deliveryTo, 'Lekki, Lagos');
  assert.equal(page.subtotalKobo, 2_800_000);
  assert.equal(page.shippingKobo, 250_000);
  assert.equal(page.totalKobo, 3_050_000);

  const text = JSON.stringify(page);
  assert.ok(!text.includes('803'), 'no phone number');
  assert.ok(!text.includes('Admiralty'), 'no street address');
  assert.ok(!text.includes('adaobi@'), 'no full email');
});

/* ---- a script cannot hold the shelves ----------------------------------- */

test('checkout is rate limited per address', async () => {
  let last;
  for (let i = 0; i < 21; i++) last = await shop.checkout({ email: 'nope', ...item() });
  assert.equal(last.status, 429);
  assert.ok(last.headers.get('retry-after'));
});

/* ---- the mailing list ---------------------------------------------------- */

test('joining the list stores the address, once, and says the same either way', async () => {
  const join = (email) => shop.request('/api/subscribe', { method: 'POST', json: { email } });
  assert.equal((await join('Ada@Example.com ')).status, 200);
  const again = await join('ada@example.com');
  assert.equal(again.status, 200, 'no hint that they were already on it');
  assert.deepEqual(again.body, { ok: true });
  assert.equal((await join('not an email')).status, 400);

  const rows = await shop.query('SELECT email FROM subscribers');
  assert.deepEqual(rows.map(r => r.email), ['ada@example.com']);
});

test('the list cannot be flooded from one address', async () => {
  let last;
  for (let i = 0; i < 11; i++) {
    last = await shop.request('/api/subscribe', { method: 'POST', json: { email: `f${i}@example.com` } });
  }
  assert.equal(last.status, 429);
});

/* ---- public settings ------------------------------------------------------ */

test('/api/site shows the pages, links and open delivery zones — and nothing private', async () => {
  const { body } = await shop.request('/api/site');
  assert.deepEqual(Object.keys(body).sort(), ['delivery', 'film', 'pages', 'social', 'states']);
  assert.deepEqual(body.delivery.map(z => z.zone), ['lagos', 'abuja', 'nigeria'], 'only zones that are on');
  assert.equal(body.delivery[0].feeKobo, 250_000);
  assert.ok(body.pages.PRIVACY.includes('Paystack'));
  assert.equal(body.states.length, 37, '36 states and the FCT');
  assert.equal(body.film, null);
  assert.ok(!JSON.stringify(body).includes('scrypt'), 'no password hash');
});

/* ---- errors and headers --------------------------------------------------- */

test('broken JSON is a 400 with a reason, not a 500', async () => {
  const res = await shop.request('/api/checkout', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email": '
  });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /not valid JSON/);
});

test('an unknown API address is a JSON 404', async () => {
  const res = await shop.request('/api/nothing-here');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: 'Not found.' });
});

test('every response carries the security headers', async () => {
  const res = await shop.request('/api/products');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.equal(res.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.equal(res.headers.get('x-powered-by'), null);
});

const built = existsSync(new URL('../../dist/index.html', import.meta.url));

test('pages get a strict CSP, the admin is not indexed, and a missing file is a 404', { skip: !built && 'run npm run build first' }, async () => {
  const home = await shop.request('/');
  assert.equal(home.status, 200);
  const csp = home.headers.get('content-security-policy');
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.ok(!home.raw.includes('__ORIGIN__'), 'link-preview address filled in');
  assert.match(home.raw, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/assets\/img\/og\.jpg/);

  const admin = await shop.request('/admin');
  assert.equal(admin.headers.get('x-robots-tag'), 'noindex, nofollow');

  const missing = await shop.request('/assets/img/nope.webp');
  assert.equal(missing.status, 404, 'not the home page pretending to be a picture');

  const forged = await shop.request('/', { headers: { host: 'evil.test"><script>alert(1)</script>' } });
  assert.ok(!forged.raw.includes('<script>alert(1)'), 'a forged Host header cannot write into the page');
});

test('a customer who cancelled on Paystack is told nothing was taken — and their stock is not released early', async () => {
  const res = await shop.checkout({ email: 'a@example.com', items: [{ productId: 'jacket', size: 'XL', qty: 1 }] });
  paystack.verify = { status: 'abandoned', amount: null };
  const page = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(page.status, 'pending');
  assert.equal(page.payment, 'not_completed');
  assert.equal(await stockOf('jacket', 'XL'), 0, 'still held — the sweeper decides, not the page');

  paystack.verify = { status: 'ongoing', amount: null };
  const slow = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(slow.payment, null, 'a payment still going through is not "not completed"');
});
