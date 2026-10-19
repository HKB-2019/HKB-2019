/* The settings and order details behind the owner's message screens: free
 * delivery, maintenance, the announcement line, delivery times, and what the
 * order page says about how an order was paid (or why it was not).
 *
 *   node --test server/test/messages.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, paystack, DELIVERY, colourOf } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); paystack.verify = { status: 'success', amount: null }; cookie = await shop.login(); });

const put = (key, value) => shop.request(`/api/admin/settings/${key}`, { method: 'PUT', cookie, json: value });
const item = (productId = 'cap', size = 'ONE SIZE', qty = 1) => ({ items: [{ productId, colour: colourOf(productId), size, qty }] });
const site = async () => (await shop.request('/api/site')).body;

/* ---- free delivery ---------------------------------------------------- */

test('free delivery: off by default, and an amount is needed to switch it on', async () => {
  assert.equal((await site()).freeDelivery, null);
  assert.equal((await put('freeDelivery', { enabled: true, overKobo: null })).status, 400);
  assert.equal((await put('freeDelivery', { enabled: true, overKobo: 50 })).status, 400, 'under ₦100');
  assert.equal((await put('freeDelivery', { enabled: true, overKobo: 5_000_000 })).status, 200);
  assert.deepEqual((await site()).freeDelivery, { overKobo: 5_000_000 });
});

test('an order at or over the free-delivery amount pays no delivery; one under it pays the zone fee', async () => {
  await put('freeDelivery', { enabled: true, overKobo: 2_800_000 });   // ₦28,000: one tee exactly
  const tee = { items: [{ productId: 'tee', colour: colourOf('tee'), size: 'M', qty: 1 }] };
  const free = await shop.checkout({ email: 'a@example.com', ...tee });
  assert.equal(free.status, 200);
  assert.equal(free.body.shippingKobo, 0);
  const cap = await shop.checkout({ email: 'b@example.com', ...item() });   // ₦14,000
  assert.equal(cap.body.shippingKobo, DELIVERY.lagos.feeKobo);
  const call = paystack.calls.filter(c => c.url.includes('/initialize')).at(-1);
  assert.equal(call.body.amount, 1_400_000 + DELIVERY.lagos.feeKobo, 'Paystack is asked for the fee too');
});

test('a discount that takes the pieces under the amount brings the delivery fee back', async () => {
  await put('freeDelivery', { enabled: true, overKobo: 2_800_000 });
  const made = await shop.request('/api/admin/discounts', { method: 'POST', cookie, json: { code: 'TEN', kind: 'percent', amount: 10 } });
  assert.equal(made.status < 300, true, made.raw);
  const res = await shop.checkout({ email: 'a@example.com', discountCode: 'TEN',
    items: [{ productId: 'tee', colour: colourOf('tee'), size: 'M', qty: 1 }] });
  assert.equal(res.status, 200);
  assert.equal(res.body.shippingKobo, DELIVERY.lagos.feeKobo);
});

/* ---- maintenance ------------------------------------------------------- */

test('maintenance closes payments, and the shop is told — the owner still sees it', async () => {
  assert.equal((await site()).maintenance, null);
  assert.equal((await put('maintenance', { on: true, message: 'New drop going up', minutes: 30 })).status, 200);

  const shopper = await site();
  assert.deepEqual(shopper.maintenance, { message: 'New drop going up', minutes: 30, ownerView: false });
  const owner = (await shop.request('/api/site', { cookie })).body;
  assert.equal(owner.maintenance.ownerView, true);

  const res = await shop.checkout({ email: 'a@example.com', ...item() });
  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'maintenance');
  const gift = await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo: 1_000_000, email: 'a@example.com' } });
  assert.equal(gift.status, 503);
  assert.equal(paystack.calls.length, 0, 'Paystack never asked');

  await put('maintenance', { on: false, message: '', minutes: null });
  assert.equal((await shop.checkout({ email: 'a@example.com', ...item() })).status, 200);
});

test('maintenance and announcement settings are checked', async () => {
  assert.equal((await put('maintenance', { on: true, message: 'x'.repeat(201) })).status, 400);
  assert.equal((await put('maintenance', { on: true, message: '', minutes: 0 })).status, 400);
  assert.equal((await put('announcement', { on: true, tone: 'info', title: '', text: '' })).status, 400, 'a title first');
  assert.equal((await put('announcement', { on: true, tone: 'ok', title: 'Free delivery this week', text: 'On orders over ₦50,000.' })).status, 200);
  assert.deepEqual((await site()).announcement, { tone: 'ok', title: 'Free delivery this week', text: 'On orders over ₦50,000.' });
  const odd = await put('announcement', { on: true, tone: 'shouty', title: 'Hi', text: '' });
  assert.equal(odd.body.tone, 'info', 'an unknown tone becomes plain news');
});

/* ---- delivery times and the order page ---------------------------------- */

test('delivery times are checked, and shown with the open zones', async () => {
  assert.equal((await put('delivery', { ...DELIVERY, lagos: { ...DELIVERY.lagos, days: { min: 3, max: 1 } } })).status, 400);
  assert.equal((await put('delivery', { ...DELIVERY, lagos: { ...DELIVERY.lagos, days: { min: 1, max: 99 } } })).status, 400);
  assert.equal((await put('delivery', { ...DELIVERY, lagos: { ...DELIVERY.lagos, days: { min: 1, max: 2 } } })).status, 200);
  const lagos = (await site()).delivery.find(z => z.zone === 'lagos');
  assert.deepEqual(lagos.days, { min: 1, max: 2 });
});

test('a paid order says how it was paid, how many pieces, and when to expect it', async () => {
  await put('delivery', { ...DELIVERY, lagos: { ...DELIVERY.lagos, days: { min: 1, max: 3 } } });
  const res = await shop.checkout({ email: 'ada@example.com', items: [{ productId: 'cap', colour: colourOf('cap'), size: 'ONE SIZE', qty: 2 }] });
  const order = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(order.status, 'paid', 'confirmed with Paystack on the way back');
  assert.equal(order.paymentMethod, 'Visa •••• 4081');
  assert.equal(order.itemCount, 2);
  assert.equal(order.failureReason, null);
  const paid = new Date(order.paidAt).getTime();
  assert.equal(order.deliveryEstimate.from, new Date(paid + 86_400_000).toISOString().slice(0, 10));
  assert.equal(order.deliveryEstimate.to, new Date(paid + 3 * 86_400_000).toISOString().slice(0, 10));
});

test('a bank transfer is named as one; nothing but the brand and last four of a card is kept', async () => {
  paystack.verify = { status: 'success', amount: null, channel: 'bank_transfer', authorization: { bank: 'Wema Bank', channel: 'bank_transfer' } };
  const res = await shop.checkout({ email: 'ada@example.com', ...item() });
  const order = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(order.paymentMethod, 'Bank transfer · Wema Bank');
  paystack.verify = { status: 'success', amount: null, authorization: { card_type: '<b>visa</b>', last4: '42<script>', bin: '408408' } };
  const res2 = await shop.checkout({ email: 'ada2@example.com', ...item() });
  const order2 = (await shop.request(`/api/orders/${res2.body.reference}`)).body;
  assert.equal(order2.paymentMethod, 'Bvisab', 'markup stripped, a bad last four left out');
});

test('a declined payment says why, in the bank’s words', async () => {
  paystack.verify = { status: 'failed', amount: null, gateway: 'Insufficient Funds' };
  const res = await shop.checkout({ email: 'ada@example.com', ...item() });
  const order = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(order.payment, 'not_completed');
  assert.equal(order.failureReason, 'Insufficient Funds');
  assert.equal(order.paymentMethod, null);
});

test('an order paid in full by a gift card says so', async () => {
  const card = await shop.request('/api/admin/gift-cards', { method: 'POST', cookie, json: { amountKobo: 5_000_000, recipientName: 'Tolu' } });
  assert.equal(card.status, 201, card.raw);
  const res = await shop.checkout({ email: 'ada@example.com', giftCode: card.body.code, ...item() });
  assert.equal(res.status, 200);
  const order = (await shop.request(`/api/orders/${res.body.reference}`)).body;
  assert.equal(order.status, 'paid');
  assert.equal(order.paymentMethod, 'Gift card');
});
