import { Router } from 'express';
import { transaction } from '../db.js';
import { assertKobo } from '../lib/money.js';
import { initializeTransaction, newReference } from '../lib/paystack.js';
import { releaseStock } from '../lib/orders.js';
import { openZones, zoneFor, NIGERIAN_STATES, ZONE_LABELS } from '../lib/settings.js';
import { rateLimit } from '../lib/limits.js';

export const checkoutRouter = Router();

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v ?? '').trim());

/* Every checkout holds stock for half an hour, so a script calling this in a
 * loop could empty the shelves during a drop without paying for anything.
 * Twenty tries in ten minutes is plenty for a real person fixing a typo. */
export const checkoutLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 20,
  message: 'Too many checkout attempts. Please wait a few minutes and try again.'
});

function fail(status, message, extra) {
  return Object.assign(new Error(message), { status, ...extra });
}

/* ------------------------------------------------------ delivery details */

const text = (v, { label, min = 1, max }) => {
  const s = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (s.length < min) throw fail(400, `Please enter your ${label}.`);
  if (s.length > max) throw fail(400, `Your ${label} is too long.`);
  return s;
};

/**
 * Who the order goes to and where. Without these an order is paid for and
 * undeliverable, so they are required, and checked here — the browser's
 * checks are a convenience for the customer, not a guarantee for the shop.
 */
function deliveryDetails(body) {
  const name = text(body.name, { label: 'full name', min: 2, max: 80 });

  const phone = String(body.phone ?? '').trim();
  const digits = phone.replace(/\D/g, '');
  if (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15) {
    throw fail(400, 'Please enter a phone number the rider can call.');
  }

  const a = body.address ?? {};
  const country = text(a.country, { label: 'country', min: 2, max: 56 });
  const inNigeria = ['nigeria', 'ng'].includes(country.toLowerCase());

  let state = text(a.state, { label: inNigeria ? 'state' : 'state or region', min: 2, max: 60 });
  if (inNigeria) {
    const match = NIGERIAN_STATES.find(s => s.toLowerCase() === state.toLowerCase().replace(/\s+state$/, ''));
    if (!match) throw fail(400, 'Please choose your state from the list.');
    state = match;
  }

  const address = {
    line1: text(a.line1, { label: 'street address', min: 3, max: 120 }),
    line2: String(a.line2 ?? '').replace(/\s+/g, ' ').trim().slice(0, 120),
    city: text(a.city, { label: 'city or area', min: 2, max: 60 }),
    state,
    country: inNigeria ? 'Nigeria' : country
  };

  return { name, phone, address, zone: zoneFor(address) };
}

/**
 * POST /api/checkout
 * Body: { email, name, phone, address: { line1, line2, city, state, country },
 *         items: [{ productId, size, qty }] }
 *
 * The browser sends WHAT is being bought and WHERE it is going, never WHAT IT
 * COSTS. Every price and the delivery fee are read from this database. A
 * request claiming the jacket costs ₦1 gets charged ₦98,000, because the
 * number it sent is simply not read.
 */
checkoutRouter.post('/checkout', checkoutLimit, async (req, res) => {
  const body = req.body ?? {};
  const { email, items } = body;

  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address for your receipt.' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Your bag is empty.' });
  }
  if (items.length > 50) {
    return res.status(400).json({ error: 'Too many lines in one order.' });
  }

  // Delivery prices are the owner's decision. Until one is set, the shop can
  // take nothing — a default of ₦0 would give delivery away.
  const zones = await openZones();
  if (!zones.length) {
    return res.status(503).json({
      error: 'Checkout is not open yet. Please try again soon.',
      code: 'delivery_not_set'
    });
  }

  let who;
  try { who = deliveryDetails(body); }
  catch (err) { return res.status(err.status).json({ error: err.message }); }

  const zone = zones.find(z => z.zone === who.zone);
  if (!zone) {
    return res.status(400).json({
      error: `Sorry — we don't deliver to ${who.zone === 'international' ? who.address.country : ZONE_LABELS[who.zone]} yet.`
    });
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
          throw fail(400, 'Each item can be bought up to 10 at a time.');
        }

        // Price comes from here. Not from the request. A product taken off
        // sale cannot be bought, even from a bag filled before it was.
        const row = await tx.one(`
          SELECT p.id, p.name, p.price_kobo, v.id AS variant_id
            FROM products p
            JOIN variants v ON v.product_id = p.id
           WHERE p.id = $1 AND v.size = $2 AND p.hidden = FALSE
        `, [productId, size]);

        if (!row) {
          const p = await tx.one('SELECT name FROM products WHERE id = $1 AND hidden = FALSE', [productId]);
          throw fail(404, p
            ? `${p.name} is no longer available in size ${size}.`
            : 'Something in your bag is no longer available.');
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
          throw fail(409, stock === 0
            ? `${row.name} (${size}) has sold out.`
            : `${row.name} (${size}) — only ${stock} left.`);
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

      const shipping = zone.feeKobo;
      try { assertKobo(subtotal + shipping, 'order total'); }
      catch {
        throw fail(400, 'That is over ₦1,000,000 for one checkout. Please split it into two orders.');
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
        INSERT INTO orders (reference, customer_id, email, status, subtotal_kobo, shipping_kobo,
                            currency, customer_name, phone, address, delivery_zone)
        VALUES ($1, $2, $3, 'pending', $4, $5, 'NGN', $6, $7, $8, $9)
        RETURNING id
      `, [reference, customer.id, normalisedEmail, subtotal, shipping,
          who.name, who.phone, JSON.stringify(who.address), who.zone]);

      for (const l of lines) {
        await tx.query(`
          INSERT INTO order_items
            (order_id, product_id, variant_id, name, size, unit_price_kobo, qty)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [id, l.productId, l.variantId, l.name, l.size, l.unitPriceKobo, l.qty]);
      }

      return { id, reference, subtotal, shipping, email: normalisedEmail, lines };
    });
  } catch (err) {
    if (!err.status) console.error('[checkout] failed:', err);
    return res.status(err.status || 500).json({
      error: err.status ? err.message : 'Something went wrong. Nothing has been charged.'
    });
  }

  const total = order.subtotal + order.shipping;

  // Paystack is called AFTER the order exists, so a failure here leaves a
  // pending order we can reconcile rather than a charge with nothing behind it.
  try {
    const data = await initializeTransaction({
      email: order.email,
      amountKobo: total,
      reference: order.reference,
      callbackUrl: callbackUrl(),
      metadata: {
        order_id: order.id,
        items: order.lines.length,
        // Shown on the transaction in the Paystack dashboard.
        custom_fields: [
          { display_name: 'Name',     variable_name: 'name',     value: who.name },
          { display_name: 'Phone',    variable_name: 'phone',    value: who.phone },
          { display_name: 'Delivery', variable_name: 'delivery', value: `${who.address.city}, ${who.address.state}` }
        ]
      }
    });

    res.json({
      reference: order.reference,
      authorizationUrl: data.authorization_url,
      subtotalKobo: order.subtotal,
      shippingKobo: order.shipping,
      totalKobo: total
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
