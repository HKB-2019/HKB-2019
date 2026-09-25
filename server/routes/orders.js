import { Router } from 'express';
import { one, query } from '../db.js';
import { reconcile } from '../lib/orders.js';
import { paystackConfigured } from '../lib/paystack.js';

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
    SELECT id, reference, email, status, subtotal_kobo, shipping_kobo, currency,
           address, paid_at, created_at
      FROM orders WHERE reference = $1
  `, [reference]);

  let order = await load();

  if (!order) return res.status(404).json({ error: 'Order not found.' });

  // What Paystack says about the payment itself, when we asked. Lets the page
  // tell someone who cancelled on Paystack that nothing was taken, instead of
  // "still confirming" about a payment that is not coming.
  let paystackStatus = null;

  if (['pending', 'abandoned', 'failed'].includes(order.status) && paystackConfigured()) {
    const status = await reconcile(reference, { onVerify: (d) => { paystackStatus = d.status; } });
    // ↑ never releases stock from here
    if (status !== order.status) order = await load();
  }

  const items = await query(`
    SELECT name, size, unit_price_kobo, qty FROM order_items WHERE order_id = $1 ORDER BY id
  `, [order.id]);

  // Anyone holding the link sees this page, so it says enough for the
  // customer to recognise their order and no more: part of the email, the
  // town it is going to, never the phone number or the street.
  const addr = order.address ?? null;
  res.set('Cache-Control', 'no-store');
  res.json({
    reference: order.reference,
    status: order.status,
    email: maskEmail(order.email),
    subtotalKobo: order.subtotal_kobo,
    shippingKobo: order.shipping_kobo,
    totalKobo: order.subtotal_kobo + order.shipping_kobo,
    deliveryTo: addr ? [addr.city, addr.state].filter(Boolean).join(', ') : null,
    // 'not_completed': still pending here, but Paystack says the customer
    // left or the charge failed. Stock stays held; the sweeper returns it.
    payment: order.status === 'pending' && ['abandoned', 'failed'].includes(paystackStatus)
      ? 'not_completed' : null,
    currency: order.currency,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    items: items.map(i => ({
      name: i.name, size: i.size, qty: i.qty, unitPriceKobo: i.unit_price_kobo
    }))
  });
});

/** ada.obi@gmail.com → a•••i@gmail.com */
export function maskEmail(email) {
  const [user, domain] = String(email ?? '').split('@');
  if (!domain) return '';
  const shown = user.length <= 2 ? user[0] : user[0] + '•••' + user[user.length - 1];
  return `${shown}@${domain}`;
}
