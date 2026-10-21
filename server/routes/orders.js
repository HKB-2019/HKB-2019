import { Router } from 'express';
import { one, query } from '../db.js';
import { reconcile } from '../lib/orders.js';
import { paystackConfigured } from '../lib/paystack.js';
import { getSetting } from '../lib/settings.js';
import { rateLimit } from '../lib/limits.js';
import { sendReceipt, receiptState } from '../lib/receipts.js';

export const ordersRouter = Router();

/* GET /api/orders/:reference — what the customer sees when Paystack sends them
 * back. The webhook usually lands first, but not always — on a free host it
 * may have arrived while the server was asleep — so any order not yet known
 * to be paid is checked with Paystack directly.
 *
 * That includes orders already given up on. A customer who paid on a stale
 * tab, whose webhook was missed, would otherwise be told "nothing was taken"
 * about money that was. */
ordersRouter.get('/orders/:reference', async (req, res) => {
  const { reference } = req.params;

  const load = () => one(`
    SELECT id, reference, email, status, subtotal_kobo, shipping_kobo, discount_code, discount_kobo, gift_kobo,
           currency, address, paid_at, fulfilled_at, courier, tracking, refunded_at, created_at,
           payment_method, delivery_zone, receipt_sent_at, receipt_count
      FROM orders WHERE reference = $1
  `, [reference]);

  let order = await load();

  if (!order) return res.status(404).json({ error: 'Order not found.' });

  // What Paystack says about the payment itself, when we asked. Lets the page
  // tell someone who cancelled on Paystack that nothing was taken, instead of
  // "still confirming" about a payment that is not coming.
  let paystackStatus = null;
  let gatewaySaid = null;

  if (['pending', 'abandoned', 'failed'].includes(order.status) && paystackConfigured()) {
    const status = await reconcile(reference, { onVerify: (d) => { paystackStatus = d.status; gatewaySaid = d.gateway_response; } });
    // ↑ never releases stock from here
    if (status !== order.status) order = await load();
  }

  // Paid, and no receipt yet (the webhook usually sends it): send it now, so
  // the page can say where it went.
  if (order.status === 'paid' && !order.receipt_sent_at) {
    const sent = await sendReceipt(reference, { req }).catch((err) => { console.error(`[mail] receipt for ${reference}:`, err.message); return null; });
    if (sent) order = await load();
  }

  const items = await query(`
    SELECT name, colour, size, unit_price_kobo, qty FROM order_items WHERE order_id = $1 ORDER BY id
  `, [order.id]);

  // Anyone holding the link sees this page, so it says enough for the
  // customer to recognise their order and no more: part of the email, the
  // town it is going to, never the phone number or the street.
  const addr = order.address ?? null;
  const notPaid = ['failed', 'abandoned'].includes(order.status) || ['abandoned', 'failed'].includes(paystackStatus);
  // When to expect it: the zone's delivery time from the day it was paid,
  // while it is paid and not yet sent.
  let deliveryEstimate = null;
  if (order.status === 'paid' && !order.fulfilled_at && order.paid_at && order.delivery_zone) {
    const days = (await getSetting('delivery'))[order.delivery_zone]?.days;
    if (days) {
      const day = (n) => new Date(new Date(order.paid_at).getTime() + n * 86_400_000).toISOString().slice(0, 10);
      deliveryEstimate = { from: day(days.min), to: day(days.max) };
    }
  }
  const card = order.payment_method;
  res.set('Cache-Control', 'no-store');
  res.json({
    reference: order.reference,
    status: order.status,
    email: maskEmail(order.email),
    subtotalKobo: order.subtotal_kobo,
    discountCode: order.discount_code,
    discountKobo: order.discount_kobo,
    shippingKobo: order.shipping_kobo,
    totalKobo: order.subtotal_kobo - order.discount_kobo + order.shipping_kobo,
    // What a gift card paid, and what was left for the card.
    giftKobo: order.gift_kobo,
    paidByCardKobo: order.subtotal_kobo - order.discount_kobo + order.shipping_kobo - order.gift_kobo,
    // Sent: when, and how to follow it. Only for a paid order.
    sentAt: order.status === 'paid' ? order.fulfilled_at : null,
    courier: order.status === 'paid' && order.fulfilled_at ? order.courier : null,
    tracking: order.status === 'paid' && order.fulfilled_at ? order.tracking : null,
    refundedAt: order.refunded_at,
    deliveryTo: addr ? [addr.city, addr.state].filter(Boolean).join(', ') : null,
    // 'not_completed': still pending here, but Paystack says the customer
    // left or the charge failed. Stock stays held; the sweeper returns it.
    payment: order.status === 'pending' && ['abandoned', 'failed'].includes(paystackStatus)
      ? 'not_completed' : null,
    currency: order.currency,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    // How it was paid, once it was: "Visa •••• 4242", "Bank transfer", "Gift card".
    paymentMethod: card && order.gift_kobo > 0 && card !== 'Gift card' ? `${card} + gift card` : card,
    // Why it did not go through, in the bank's words ("Insufficient Funds"), when it did not.
    failureReason: notPaid && gatewaySaid && !/^approved|successful/i.test(gatewaySaid)
      ? String(gatewaySaid).replace(/[^\p{L}\p{N} .,'-]/gu, '').slice(0, 80) : null,
    deliveryEstimate,
    // The shop's own receipt by email (null until the shop can send email).
    receipt: order.status === 'paid' ? receiptState(order) : null,
    itemCount: items.reduce((n, i) => n + i.qty, 0),
    items: items.map(i => ({
      name: i.name, colour: i.colour || null, size: i.size, qty: i.qty, unitPriceKobo: i.unit_price_kobo
    }))
  });
});

/* POST /api/orders/:reference/receipt — "Resend receipt". Only ever to the
 * email on the order, 45 seconds apart, five in all. */
export const receiptLimit = rateLimit({ windowMs: 60 * 60_000, max: 10, message: 'Too many emails asked for. Please wait a while and try again.' });

ordersRouter.post('/orders/:reference/receipt', receiptLimit, async (req, res) => {
  const order = await one('SELECT status, email, receipt_sent_at, receipt_count FROM orders WHERE reference = $1', [req.params.reference]);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const state = receiptState(order);
  if (!state) return res.status(404).json({ error: 'Receipts by email are not set up yet.' });
  if (order.status !== 'paid') return res.status(409).json({ error: 'A receipt goes once the payment is confirmed.' });
  if (state.left === 0) return res.status(429).json({ error: 'We’ve sent this receipt the most times we can. Please contact us if it hasn’t arrived.', code: 'max' });
  if (state.wait > 0) return res.status(429).json({ error: `Please wait ${state.wait} seconds before asking again.`, wait: state.wait });
  const sent = await sendReceipt(req.params.reference, { again: true, req });
  if (!sent) return res.status(429).json({ error: 'Please wait a moment before asking again.', wait: 45 });
  res.json({ ok: true, email: maskEmail(order.email), receipt: sent });
});

/** ada.obi@gmail.com → a•••i@gmail.com */
export function maskEmail(email) {
  const [user, domain] = String(email ?? '').split('@');
  if (!domain) return '';
  const shown = user.length <= 2 ? user[0] : user[0] + '•••' + user[user.length - 1];
  return `${shown}@${domain}`;
}
