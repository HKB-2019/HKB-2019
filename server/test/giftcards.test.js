/* Gift cards: bought like an order, live only once Paystack confirms the
 * money; spent at checkout after any discount, delivery included; given back
 * when an order is not paid or is refunded; made and cancelled by the owner.
 *
 *   node --test server/test/giftcards.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, paystack, sign, colourOf } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => {
  await shop.reset(); cookie = await shop.login();
  paystack.verify = { status: 'success', amount: null };
  paystack.initFails = false;
});

const api = (path, method = 'GET', json) => shop.request(`/api/admin${path}`, { method, cookie, json });
const cap = (extra = {}) => ({ email: 'ada@example.com', items: [{ productId: 'cap', colour: colourOf('cap'), size: 'ONE SIZE', qty: 1 }], ...extra });
const card = (kobo) => shop.one('SELECT * FROM gift_cards WHERE amount_kobo = $1 ORDER BY id DESC LIMIT 1', [kobo]);
const inits = () => paystack.calls.filter(c => c.url.includes('/initialize'));

let eventId = 7000;
async function webhook(reference, event = 'charge.success') {
  const raw = JSON.stringify({ event, data: { id: ++eventId, reference } });
  await shop.request('/api/paystack/webhook', { method: 'POST', body: raw,
    headers: { 'Content-Type': 'application/json', 'x-paystack-signature': sign(raw) } });
  await new Promise(r => setTimeout(r, 150));
}

/** A live card made by the owner; returns its code. */
async function made(naira) {
  const res = await api('/gift-cards', 'POST', { amountKobo: naira * 100, recipientName: 'Tolu' });
  assert.equal(res.status, 201, res.raw);
  return res.body.code;
}

test('the owner side is for the owner only', async () => {
  for (const [method, path] of [['GET', '/api/admin/gift-cards'], ['POST', '/api/admin/gift-cards'], ['POST', '/api/admin/gift-cards/1/cancel']]) {
    assert.equal((await shop.request(path, { method, json: method === 'POST' ? {} : undefined })).status, 401, `${method} ${path}`);
  }
});

test('a card is bought with its own payment and works only once Paystack confirms it', async () => {
  for (const amountKobo of [4_000_00, 600_000_00, 12_345_50, '25000']) {
    const res = await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo, email: 'buyer@example.com' } });
    assert.equal(res.status, 400, `amount ${amountKobo}`);
  }
  assert.equal((await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo: 25_000_00, email: 'nope' } })).status, 400);

  const res = await shop.request('/api/gift-cards', { method: 'POST', json: {
    amountKobo: 25_000_00, email: 'Buyer@Example.com', recipientName: '  Tolu  ', message: 'Happy birthday.\r\nWear it well.' } });
  assert.equal(res.status, 200, res.raw);
  assert.match(res.body.reference, /^gift-[a-f0-9]{24}$/);
  const [init] = inits();
  assert.equal(init.body.amount, 25_000_00);
  assert.equal(init.body.reference, res.body.reference);

  // Before the money: no code.
  paystack.verify = { status: 'ongoing', amount: null };
  const waiting = await shop.request(`/api/gift-cards/${res.body.reference}`);
  assert.deepEqual([waiting.body.status, waiting.body.code], ['pending', null]);
  assert.equal(waiting.body.message, 'Happy birthday.\nWear it well.');

  // Paystack confirms: the card is live for twelve months, its code shown.
  paystack.verify = { status: 'success', amount: null };
  await webhook(res.body.reference);
  const live = await shop.request(`/api/gift-cards/${res.body.reference}`);
  assert.equal(live.body.status, 'active');
  assert.match(live.body.code, /^MASQ-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(live.body.balanceKobo, 25_000_00);
  const months = (new Date(live.body.expiresAt) - Date.now()) / (30.44 * 864e5);
  assert.ok(months > 11.8 && months < 12.2, `expires in ${months} months`);
  const row = await card(25_000_00);
  assert.deepEqual([row.buyer_email, row.recipient_name], ['buyer@example.com', 'Tolu']);

  // Any other amount from ₦5,000 to ₦500,000 is fine too.
  assert.equal((await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo: 7_500_00, email: 'b@example.com' } })).status, 200);
});

test('a payment for the wrong amount does not make a card', async () => {
  const res = await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo: 10_000_00, email: 'b@example.com' } });
  paystack.verify = { status: 'success', amount: 100 };
  await webhook(res.body.reference);
  assert.equal((await shop.request(`/api/gift-cards/${res.body.reference}`)).body.code, null);
});

test('a card pays part of an order, delivery included, and Paystack is asked for the rest', async () => {
  const code = await made(10_000);
  const check = await shop.request('/api/gift-cards/check', { method: 'POST', json: { code: code.toLowerCase().replace(/-/g, ' ') } });
  assert.deepEqual([check.status, check.body.balanceKobo], [200, 10_000_00]);

  const res = await shop.checkout(cap({ giftCode: code }));
  assert.equal(res.status, 200, res.raw);
  assert.deepEqual([res.body.totalKobo, res.body.giftKobo, res.body.dueKobo], [16_500_00, 10_000_00, 6_500_00]);
  assert.equal(inits().at(-1).body.amount, 6_500_00, 'Paystack charges only what is left');
  assert.equal((await card(10_000_00)).balance_kobo, 0);

  await webhook(res.body.reference);
  const page = await shop.request(`/api/orders/${res.body.reference}`);
  assert.deepEqual([page.body.status, page.body.giftKobo, page.body.paidByCardKobo], ['paid', 10_000_00, 6_500_00]);

  // Spent: it says so.
  const again = await shop.request('/api/gift-cards/check', { method: 'POST', json: { code } });
  assert.equal(again.status, 400);
  assert.match(again.body.error, /has been spent/);
});

test('a card that covers everything pays the order at once, without Paystack', async () => {
  const code = await made(50_000);
  const before = await shop.one("SELECT stock FROM variants v JOIN products p ON p.id = v.product_id WHERE p.id = 'cap' AND v.colour = $1", [colourOf('cap')]);
  const res = await shop.checkout(cap({ giftCode: code }));
  assert.equal(res.status, 200, res.raw);
  assert.deepEqual([res.body.authorizationUrl, res.body.paid, res.body.dueKobo], [null, true, 0]);
  assert.equal(inits().length, 0, 'nothing sent to Paystack');
  const order = await shop.one('SELECT status, paid_at, gift_kobo FROM orders WHERE reference = $1', [res.body.reference]);
  assert.equal(order.status, 'paid');
  assert.ok(order.paid_at);
  assert.equal((await card(50_000_00)).balance_kobo, 50_000_00 - 16_500_00, 'the rest stays on the card');
  const after = await shop.one("SELECT stock FROM variants v JOIN products p ON p.id = v.product_id WHERE p.id = 'cap' AND v.colour = $1", [colourOf('cap')]);
  assert.equal(after.stock, before.stock - 1);
  assert.equal((await api('/summary')).body.paidOrders, 1);
});

test('an order not paid gives the card its money back; paying later takes it again', async () => {
  const code = await made(10_000);
  const res = await shop.checkout(cap({ giftCode: code }));
  assert.equal((await card(10_000_00)).balance_kobo, 0);

  paystack.verify = { status: 'failed', amount: null };
  await webhook(res.body.reference, 'charge.failed');
  assert.equal((await card(10_000_00)).balance_kobo, 10_000_00, 'given back');

  // The customer pays on the old tab after all: the card's share is taken again.
  paystack.verify = { status: 'success', amount: null };
  await webhook(res.body.reference);
  assert.equal((await shop.one('SELECT status FROM orders WHERE reference = $1', [res.body.reference])).status, 'paid');
  assert.equal((await card(10_000_00)).balance_kobo, 0);
  const uses = await shop.query('SELECT kind, amount_kobo FROM gift_card_uses ORDER BY id');
  assert.deepEqual(uses.map(u => [u.kind, u.amount_kobo]), [['spend', -10_000_00], ['return', 10_000_00], ['spend', -10_000_00]]);
});

test('paying late when the card has since been spent elsewhere becomes a refund, not a free order', async () => {
  const code = await made(10_000);
  const first = await shop.checkout(cap({ giftCode: code }));            // the card pays ₦10,000, Paystack the rest
  paystack.verify = { status: 'failed', amount: null };
  await webhook(first.body.reference, 'charge.failed');                   // the ₦10,000 goes back on the card
  await shop.checkout(cap({ email: 'b@example.com', giftCode: code }));  // and someone else spends it
  paystack.verify = { status: 'success', amount: null };
  await webhook(first.body.reference);
  assert.equal((await shop.one('SELECT status FROM orders WHERE reference = $1', [first.body.reference])).status, 'refund_due');
});

test('a discount comes off first, then the card', async () => {
  await api('/discounts', 'POST', { code: 'TEN', kind: 'percent', amount: 10 });
  const code = await made(5_000);
  const res = await shop.checkout(cap({ discountCode: 'TEN', giftCode: code }));
  assert.equal(res.status, 200, res.raw);
  // ₦14,000 − ₦1,400 + ₦2,500 = ₦15,100; the card pays ₦5,000 of it.
  assert.deepEqual([res.body.discountKobo, res.body.totalKobo, res.body.giftKobo, res.body.dueKobo],
    [1_400_00, 15_100_00, 5_000_00, 10_100_00]);
});

test('unknown, cancelled and expired cards are refused, and nothing is held', async () => {
  const bad = await shop.checkout(cap({ giftCode: 'MASQ-AAAA-BBBB' }));
  assert.equal(bad.status, 400);
  assert.match(bad.body.error, /not a gift card we recognise/);
  assert.match((await shop.checkout(cap({ giftCode: 'hello' }))).body.error, /looks like MASQ-XXXX-XXXX/);

  const code = await made(10_000);
  const [{ id }] = (await api('/gift-cards')).body.cards;
  const cancelled = await api(`/gift-cards/${id}/cancel`, 'POST');
  assert.equal(cancelled.body.state, 'cancelled');
  assert.match((await shop.checkout(cap({ giftCode: code }))).body.error, /has been cancelled/);

  const old = await made(10_000);
  await shop.query("UPDATE gift_cards SET expires_at = now() - interval '1 day' WHERE code = $1", [old]);
  assert.match((await shop.checkout(cap({ giftCode: old }))).body.error, /ran out on/);
  assert.equal((await shop.one("SELECT COUNT(*)::int AS n FROM orders")).n, 0, 'no order made, no stock held');
});

test('a refund puts what the card paid back on the card', async () => {
  const code = await made(10_000);
  const res = await shop.checkout(cap({ giftCode: code }));
  await webhook(res.body.reference);
  const refunded = await api(`/orders/${res.body.reference}/refunded`, 'POST', { restock: true });
  assert.equal(refunded.status, 200, refunded.raw);
  assert.equal(refunded.body.giftReturnedKobo, 10_000_00);
  assert.equal((await card(10_000_00)).balance_kobo, 10_000_00);
});

test('the owner sees every card, what is left and where it went', async () => {
  const bought = await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo: 25_000_00, email: 'buyer@example.com', recipientName: 'Kemi' } });
  await webhook(bought.body.reference);
  await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo: 10_000_00, email: 'never@example.com' } });  // never paid
  const code = await made(10_000);
  const order = await shop.checkout(cap({ giftCode: code }));

  const { cards, totals } = (await api('/gift-cards')).body;
  assert.equal(cards.length, 2, 'an unpaid purchase is not a card');
  const mine = cards.find(c => c.code === code);
  assert.deepEqual([mine.madeBy, mine.state, mine.balanceKobo, mine.recipientName], ['shop', 'spent', 0, 'Tolu']);
  assert.deepEqual(mine.uses.map(u => [u.orderReference, u.kind, u.amountKobo]), [[order.body.reference, 'spend', -10_000_00]]);
  const theirs = cards.find(c => c.madeBy === 'customer');
  assert.deepEqual([theirs.buyerEmail, theirs.recipientName, theirs.state], ['buyer@example.com', 'Kemi', 'active']);
  assert.deepEqual(totals, { soldCount: 1, soldKobo: 25_000_00, outstandingKobo: 25_000_00, liveCount: 1 });

  for (const amountKobo of [400_00, 600_000_00, 1_000_50]) {
    assert.equal((await api('/gift-cards', 'POST', { amountKobo })).status, 400, `owner amount ${amountKobo}`);
  }
  const csv = await shop.request('/api/admin/orders.csv', { cookie });
  assert.ok(csv.raw.split(/\r?\n/)[0].includes('"Paid by gift card ₦"'));
});

test('a card keeps the colour it was bought in, and the person given it can open it by its code', async () => {
  const res = await shop.request('/api/gift-cards', { method: 'POST', json: {
    amountKobo: 25_000_00, email: 'buyer@example.com', recipientName: 'Kemi', message: 'For you.', design: 'teal' } });
  const open = (code) => shop.request('/api/gift-cards/open', { method: 'POST', json: { code } });

  // Not paid yet: there is nothing to open, even with the code.
  const pending = await card(25_000_00);
  assert.equal(pending.design, 'teal');
  assert.equal((await open(pending.code)).status, 404);

  await webhook(res.body.reference);
  assert.equal((await shop.request(`/api/gift-cards/${res.body.reference}`)).body.design, 'teal');
  const seen = await open(pending.code.toLowerCase());
  assert.equal(seen.status, 200, seen.raw);
  assert.deepEqual(
    [seen.body.code, seen.body.state, seen.body.amountKobo, seen.body.balanceKobo, seen.body.recipientName, seen.body.message, seen.body.design],
    [pending.code, 'active', 25_000_00, 25_000_00, 'Kemi', 'For you.', 'teal']);
  assert.equal(seen.body.buyerEmail, undefined, 'who bought it is not shown');

  // Spent, it still opens, and says so. A wrong code does not.
  await shop.checkout(cap({ giftCode: pending.code }));
  await shop.query('UPDATE gift_cards SET balance_kobo = 0 WHERE code = $1', [pending.code]);
  assert.equal((await open(pending.code)).body.state, 'spent');
  assert.equal((await open('MASQ-AAAA-BBBB')).status, 404);
  assert.equal((await open('hello')).status, 404);

  // A colour we do not make is violet; the owner's cards choose one too.
  await shop.request('/api/gift-cards', { method: 'POST', json: { amountKobo: 10_000_00, email: 'b@example.com', design: 'gold' } });
  assert.equal((await card(10_000_00)).design, 'violet');
  const mine = await api('/gift-cards', 'POST', { amountKobo: 20_000_00, design: 'clay' });
  assert.equal(mine.body.design, 'clay');
});
