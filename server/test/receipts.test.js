/* The shop's own emails about an order: the receipt once it is paid (once by
 * itself, again on request within limits, only to the order's email), and
 * the "on its way" note when the owner marks it sent.
 *
 *   node --test server/test/receipts.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, colourOf, sign } from './helpers.js';

let shop, outbox;
before(async () => {
  shop = await startShop();
  stubPaystack(shop.one);
  ({ outbox } = await import('../lib/mail.js'));
});
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); });

const items = [{ productId: 'cap', colour: colourOf('cap'), size: 'ONE SIZE', qty: 2 }];
const receipts = () => outbox.filter(m => m.kind === 'receipt');

async function paidOrder() {
  const res = await shop.checkout({ email: 'ada@example.com', items });
  assert.equal(res.status, 200, res.raw);
  return res.body.reference;
}

test('a paid order gets its receipt once, to the order’s email, with what was bought', async () => {
  const ref = await paidOrder();
  const page = await shop.request(`/api/orders/${ref}`);
  assert.equal(page.body.status, 'paid');
  assert.equal(receipts().length, 1);
  const mail = receipts()[0];
  assert.equal(mail.to, 'ada@example.com');
  assert.match(mail.lines.join('\n'), /2 × THE MARK CAP/);
  assert.match(mail.button.href, new RegExp(`/order\\?reference=${ref}$`));
  assert.ok(page.body.receipt.sentAt);
  assert.equal(page.body.receipt.left, 4);

  await shop.request(`/api/orders/${ref}`);
  assert.equal(receipts().length, 1, 'opening the page again sends nothing');
});

test('the webhook sends the receipt too, and the page then does not send a second', async () => {
  const ref = await paidOrder();
  const raw = JSON.stringify({ event: 'charge.success', data: { id: 5551, reference: ref } });
  const hook = await shop.request('/api/paystack/webhook', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-paystack-signature': sign(raw) }, body: raw });
  assert.equal(hook.status, 200, hook.raw);
  for (let i = 0; i < 20 && !receipts().length; i++) await new Promise(r => setTimeout(r, 50));
  assert.equal(receipts().length, 1);
  await shop.request(`/api/orders/${ref}`);
  assert.equal(receipts().length, 1);
});

test('Resend: waits 45 seconds, goes only to the order’s email, at most five in all', async () => {
  const ref = await paidOrder();
  await shop.request(`/api/orders/${ref}`);
  const resend = () => shop.request(`/api/orders/${ref}/receipt`, { method: 'POST', json: { email: 'thief@example.com' } });
  const soon = await resend();
  assert.equal(soon.status, 429);
  assert.ok(soon.body.wait > 0);

  for (let n = 2; n <= 5; n++) {
    await shop.query("UPDATE orders SET receipt_sent_at = now() - interval '1 minute' WHERE reference = $1", [ref]);
    const ok = await resend();
    assert.equal(ok.status, 200, ok.raw);
    assert.equal(ok.body.email, 'a•••a@example.com');
  }
  assert.equal(receipts().length, 5);
  assert.ok(receipts().every(m => m.to === 'ada@example.com'));
  await shop.query("UPDATE orders SET receipt_sent_at = now() - interval '1 minute' WHERE reference = $1", [ref]);
  assert.equal((await resend()).body.code, 'max');
});

test('an unpaid order has no receipt to send', async () => {
  const { paystack } = await import('./helpers.js');
  paystack.verify = { status: 'abandoned' };
  try {
    const ref = await paidOrder();
    const page = await shop.request(`/api/orders/${ref}`);
    assert.equal(page.body.receipt, null);
    assert.equal((await shop.request(`/api/orders/${ref}/receipt`, { method: 'POST' })).status, 409);
    assert.equal(receipts().length, 0);
  } finally { paystack.verify = { status: 'success', amount: null }; }
});

test('without email set up, nothing is sent and the page says nothing about it', async () => {
  process.env.MAIL_DRIVER = 'none';
  try {
    const ref = await paidOrder();
    const page = await shop.request(`/api/orders/${ref}`);
    assert.equal(page.body.receipt, null);
    assert.equal(receipts().length, 0);
  } finally { process.env.MAIL_DRIVER = 'memory'; }
});

test('marking an order sent emails the customer once, with the courier and tracking', async () => {
  const ref = await paidOrder();
  await shop.request(`/api/orders/${ref}`);
  const cookie = await shop.login();
  const send = (json) => shop.request(`/api/admin/orders/${ref}/fulfil`, { method: 'POST', cookie, json });
  assert.equal((await send({ courier: 'GIG Logistics', tracking: 'GIG123' })).status, 200);
  const sent = outbox.filter(m => m.kind === 'shipped');
  assert.equal(sent.length, 1);
  assert.match(sent[0].lines.join('\n'), /GIG Logistics[\s\S]*GIG123/);
  await send({ courier: 'GIG Logistics', tracking: 'GIG124' });
  assert.equal(outbox.filter(m => m.kind === 'shipped').length, 1, 'a correction sends nothing new');
});
