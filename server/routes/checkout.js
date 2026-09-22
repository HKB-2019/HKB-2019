import { Router } from 'express';
import { db, transaction } from '../db.js';
import { assertKobo } from '../lib/money.js';
import { initializeTransaction, newReference } from '../lib/paystack.js';

export const checkoutRouter = Router();

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());

/**
 * POST /api/checkout
 * Body: { email, items: [{ productId, size, qty }] }
 *
 * The browser sends WHAT is being bought, never WHAT IT COSTS. Every price and
 * every total is read from this database. A request claiming the jacket costs
 * ₦1 gets charged ₦98,000, because the number it sent is simply not read.
 */
checkoutRouter.post('/checkout', async (req, res) => {
  const { email, items } = req.body ?? {};

  if (!isEmail(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your bag is empty.' });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Too many lines in one order.' });
  }

  let order;
  try {
    order = transaction(() => {
      const lines = [];
      let subtotal = 0;

      for (const raw of items) {
        const productId = String(raw?.productId ?? '');
        const size = String(raw?.size ?? '');
        // Deliberately not Number(): that coerces "2", [2] and true into 2.
        // A JSON API should be told a number, and say so when it is not.
        const qty = raw?.qty;

        if (typeof qty !== 'number' || !Number.isInteger(qty) || qty < 1 || qty > 10) {
          throw Object.assign(new Error(`Invalid quantity for ${productId || 'an item'}.`), { status: 400 });
        }

        // Price comes from here. Not from the request.
        const row = db.prepare(`
          SELECT p.id, p.name, p.price_kobo, v.id AS variant_id, v.stock
            FROM products p
            JOIN variants v ON v.product_id = p.id
           WHERE p.id = ? AND v.size = ?
        `).get(productId, size);

        if (!row) {
          throw Object.assign(new Error(`${productId} in size ${size} is not available.`), { status: 404 });
        }
        if (row.stock < qty) {
          throw Object.assign(
            new Error(`${row.name} (${size}) — only ${row.stock} left.`),
            { status: 409 }
          );
        }

        // Hold the stock now, while we are inside the transaction. The CHECK
        // constraint on variants.stock makes a negative result impossible even
        // if this arithmetic is ever wrong.
        db.prepare('UPDATE variants SET stock = stock - ? WHERE id = ?')
          .run(qty, row.variant_id);

        subtotal += row.price_kobo * qty;
        lines.push({
          productId: row.id,
          variantId: row.variant_id,
          name: row.name,
          size,
          unitPriceKobo: row.price_kobo,
          qty
        });
      }

      assertKobo(subtotal, 'order subtotal');

      const reference = newReference();
      const normalisedEmail = String(email).trim().toLowerCase();

      db.prepare('INSERT OR IGNORE INTO customers (email) VALUES (?)').run(normalisedEmail);
      const customer = db.prepare('SELECT id FROM customers WHERE email = ?').get(normalisedEmail);

      const { lastInsertRowid } = db.prepare(`
        INSERT INTO orders (reference, customer_id, email, status, subtotal_kobo, currency)
        VALUES (?, ?, ?, 'pending', ?, 'NGN')
      `).run(reference, customer.id, normalisedEmail, subtotal);

      const insertItem = db.prepare(`
        INSERT INTO order_items
          (order_id, product_id, variant_id, name, size, unit_price_kobo, qty)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const l of lines) {
        insertItem.run(lastInsertRowid, l.productId, l.variantId, l.name, l.size, l.unitPriceKobo, l.qty);
      }

      return { id: lastInsertRowid, reference, subtotal, email: normalisedEmail, lines };
    });
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message });
  }

  // Paystack is called AFTER the order exists, so a failure here leaves a
  // pending order we can reconcile rather than a charge with nothing behind it.
  try {
    const data = await initializeTransaction({
      email: order.email,
      amountKobo: order.subtotal,
      reference: order.reference,
      callbackUrl: process.env.PAYSTACK_CALLBACK_URL,
      metadata: { order_id: order.id, items: order.lines.length }
    });

    res.json({
      reference: order.reference,
      authorizationUrl: data.authorization_url,
      subtotalKobo: order.subtotal
    });
  } catch (err) {
    releaseStock(order.reference, 'abandoned');
    res.status(502).json({ error: 'Could not reach the payment provider. Nothing has been charged.' });
    console.error('[checkout] paystack initialize failed:', err.message);
  }
});

/** Put held stock back and mark the order done-for. Safe to call twice. */
export function releaseStock(reference, status) {
  transaction(() => {
    const order = db.prepare("SELECT id, status FROM orders WHERE reference = ?").get(reference);
    if (!order || order.status !== 'pending') return;   // already settled; leave it alone

    const items = db.prepare('SELECT variant_id, qty FROM order_items WHERE order_id = ?').all(order.id);
    const give = db.prepare('UPDATE variants SET stock = stock + ? WHERE id = ?');
    for (const i of items) give.run(i.qty, i.variant_id);

    db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, order.id);
  });
}
