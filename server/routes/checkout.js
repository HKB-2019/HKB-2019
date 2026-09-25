import { Router } from 'express';
import { transaction } from '../db.js';
import { assertKobo } from '../lib/money.js';
import { initializeTransaction, newReference } from '../lib/paystack.js';
import { releaseStock } from '../lib/orders.js';

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
    order = await transaction(async (tx) => {
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
        const row = await tx.one(`
          SELECT p.id, p.name, p.price_kobo, v.id AS variant_id
            FROM products p
            JOIN variants v ON v.product_id = p.id
           WHERE p.id = $1 AND v.size = $2
        `, [productId, size]);

        if (!row) {
          throw Object.assign(new Error(`${productId} in size ${size} is not available.`), { status: 404 });
        }

        // Hold the stock in one statement that only succeeds if there is
        // enough. Reading the count and then subtracting would be two steps,
        // and on a real server two buyers can both pass the read before either
        // writes. Here the second waits on the row, re-checks, and gets no row
        // back. The CHECK constraint on variants.stock is the backstop.
        const held = await tx.one(`
          UPDATE variants SET stock = stock - $1
           WHERE id = $2 AND stock >= $1
          RETURNING stock
        `, [qty, row.variant_id]);

        if (!held) {
          const { stock } = await tx.one('SELECT stock FROM variants WHERE id = $1', [row.variant_id]);
          throw Object.assign(
            new Error(stock === 0
              ? `${row.name} (${size}) has sold out.`
              : `${row.name} (${size}) — only ${stock} left.`),
            { status: 409 }
          );
        }

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

      try { assertKobo(subtotal, 'order subtotal'); }
      catch {
        throw Object.assign(
          new Error('That is over ₦1,000,000 for one checkout. Please split it into two orders.'),
          { status: 400 });
      }

      const reference = newReference();
      const normalisedEmail = String(email).trim().toLowerCase();

      // DO UPDATE rather than DO NOTHING so RETURNING hands back the id for
      // a returning customer too.
      const customer = await tx.one(`
        INSERT INTO customers (email) VALUES ($1)
        ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
        RETURNING id
      `, [normalisedEmail]);

      const { id } = await tx.one(`
        INSERT INTO orders (reference, customer_id, email, status, subtotal_kobo, currency)
        VALUES ($1, $2, $3, 'pending', $4, 'NGN')
        RETURNING id
      `, [reference, customer.id, normalisedEmail, subtotal]);

      for (const l of lines) {
        await tx.query(`
          INSERT INTO order_items
            (order_id, product_id, variant_id, name, size, unit_price_kobo, qty)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, l.productId, l.variantId, l.name, l.size, l.unitPriceKobo, l.qty]);
      }

      return { id, reference, subtotal, email: normalisedEmail, lines };
    });
  } catch (err) {
    if (!err.status) console.error('[checkout] failed:', err);
    return res.status(err.status || 500).json({
      error: err.status ? err.message : 'Something went wrong. Nothing has been charged.'
    });
  }

  // Paystack is called AFTER the order exists, so a failure here leaves a
  // pending order we can reconcile rather than a charge with nothing behind it.
  try {
    const data = await initializeTransaction({
      email: order.email,
      amountKobo: order.subtotal,
      reference: order.reference,
      callbackUrl: callbackUrl(),
      metadata: { order_id: order.id, items: order.lines.length }
    });

    res.json({
      reference: order.reference,
      authorizationUrl: data.authorization_url,
      subtotalKobo: order.subtotal
    });
  } catch (err) {
    await releaseStock(order.reference, 'abandoned');
    res.status(502).json({ error: 'Could not reach the payment provider. Nothing has been charged.' });
    console.error('[checkout] paystack initialize failed:', err.message);
  }
});

/* Where Paystack sends the customer back to. Render sets RENDER_EXTERNAL_URL
 * to the service's own address, so on Render this needs no configuring. */
function callbackUrl() {
  if (process.env.PAYSTACK_CALLBACK_URL) return process.env.PAYSTACK_CALLBACK_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') + '/order';
  return undefined;   // Paystack falls back to the callback set in its dashboard
}
