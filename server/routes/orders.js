import { Router } from 'express';
import { db } from '../db.js';
import { verifyTransaction } from '../lib/paystack.js';

export const ordersRouter = Router();

/* GET /api/orders/:reference — what the customer sees when Paystack sends them
 * back. The webhook usually lands first, but not always, so if the order is
 * still pending we ask Paystack directly rather than showing a false negative. */
ordersRouter.get('/orders/:reference', async (req, res) => {
  const { reference } = req.params;

  const order = db.prepare(`
    SELECT id, reference, email, status, subtotal_kobo, currency, paid_at, created_at
      FROM orders WHERE reference = ?
  `).get(reference);

  if (!order) return res.status(404).json({ error: 'Order not found.' });

  if (order.status === 'pending' && process.env.PAYSTACK_SECRET_KEY) {
    try {
      const data = await verifyTransaction(reference);
      if (data.status === 'success' && data.amount === order.subtotal_kobo) {
        db.prepare(`
          UPDATE orders SET status = 'paid', paystack_id = ?, paid_at = datetime('now')
           WHERE id = ? AND status = 'pending'
        `).run(String(data.id), order.id);
        order.status = 'paid';
      }
    } catch (err) {
      console.warn(`[orders] verify ${reference} failed:`, err.message);
    }
  }

  const items = db.prepare(`
    SELECT name, size, unit_price_kobo, qty FROM order_items WHERE order_id = ?
  `).all(order.id);

  res.json({
    reference: order.reference,
    status: order.status,
    email: order.email,
    subtotalKobo: order.subtotal_kobo,
    currency: order.currency,
    paidAt: order.paid_at,
    createdAt: order.created_at,
    items: items.map(i => ({
      name: i.name, size: i.size, qty: i.qty, unitPriceKobo: i.unit_price_kobo
    }))
  });
});
