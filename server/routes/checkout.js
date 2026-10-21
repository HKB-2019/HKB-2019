import { Router } from 'express';
import { transaction, one as oneRow, query } from '../db.js';
import { assertKobo } from '../lib/money.js';
import { initializeTransaction, newReference } from '../lib/paystack.js';
import { releaseStock } from '../lib/orders.js';
import { openZones, ZONE_LABELS, getSetting, deliveryFee, closedForMaintenance } from '../lib/settings.js';
import { rateLimit } from '../lib/limits.js';
import { onSale } from '../lib/catalogue.js';
import { applyCode } from '../lib/discounts.js';
import { usableCard, spendCard, recordSpend } from '../lib/giftcards.js';
import { attribution } from '../lib/analytics.js';
import { isEmail, deliveryDetails } from '../lib/validate.js';

export const checkoutRouter = Router();


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

/**
 * POST /api/checkout
 * Body: { email, name, phone, address: { line1, line2, city, state, postcode?, country },
 *         items: [{ productId, colour, size, qty }], discountCode?, giftCode? }
 *
 * A gift card pays after any discount, delivery included; what it covers is
 * taken off the card now and given back if this order is never paid. When it
 * covers everything, the order is paid at once and Paystack is not involved.
 *
 * `colour` is the colour's name for a product sold in colours, and left out
 * (or '') for one that is not.
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

  if (await closedForMaintenance(res)) return;

  // Delivery prices are the owner's decision. Until one is set, the shop can
  // take nothing — a default of ₦0 would give delivery away.
  const zones = await openZones();
  const freeDelivery = await getSetting('freeDelivery');
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

  // Which visit this came from, if the page counted one: sales by source.
  const from = await attribution(body.analyticsSession).catch(() => null);

  let order;
  try {
    order = await transaction(async (tx) => {
      const lines = [];
      let subtotal = 0;

      for (const raw of items) {
        const productId = String(raw?.productId ?? '');
        const size = String(raw?.size ?? '');
        const colour = String(raw?.colour ?? '');
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
           WHERE p.id = $1 AND v.colour = $2 AND v.size = $3 AND ${onSale()}
        `, [productId, colour, size]);

        if (!row) {
          const p = await tx.one(`
            SELECT name, EXISTS (SELECT 1 FROM product_colours c WHERE c.product_id = p.id) AS coloured
              FROM products p WHERE id = $1 AND ${onSale()}`, [productId]);
          if (p?.coloured && !colour) throw fail(400, `Please choose a colour of ${p.name}.`);
          throw fail(404, p
            ? `${p.name} is no longer available in ${colour ? `${colour}, ` : ''}size ${size}.`
            : 'Something in your bag is no longer available.');
        }
        const what = colour ? `${row.name} (${colour}, ${size})` : `${row.name} (${size})`;

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
            ? `${what} has sold out.`
            : `${what} — only ${stock} left.`);
        }

        subtotal += row.price_kobo * qty;
        lines.push({
          productId: row.id,
          variantId: row.variant_id,
          name: row.name,
          colour,
          size,
          unitPriceKobo: row.price_kobo,
          qty
        });
      }

      // A code is checked against these prices, and one use of it held for
      // this order, in the same transaction as the stock.
      const discount = body.discountCode
        ? await applyCode(tx, body.discountCode, subtotal, { hold: true })
        : null;
      const discountKobo = discount?.discountKobo ?? 0;

      // Free once the pieces (after the discount) reach the owner's amount.
      const shipping = deliveryFee(zone, subtotal - discountKobo, freeDelivery);
      try { assertKobo(subtotal - discountKobo + shipping, 'order total'); }
      catch {
        throw fail(400, 'That is over ₦1,000,000 for one checkout. Please split it into two orders.');
      }

      // A gift card, locked so two checkouts cannot both spend its balance.
      const card = body.giftCode ? await usableCard(tx, body.giftCode, { lock: true }) : null;
      const giftKobo = card ? await spendCard(tx, card, subtotal - discountKobo + shipping) : 0;
      const paidInFull = giftKobo === subtotal - discountKobo + shipping;

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
                            currency, customer_name, phone, address, delivery_zone,
                            discount_code, discount_kobo, session_id, channel, campaign,
                            gift_card_id, gift_kobo, paid_at, payment_method)
        VALUES ($1, $2, $3, $15, $4, $5, 'NGN', $6, $7, $8, $9, $10, $11, $12, $13, $14, $16, $17,
                CASE WHEN $15 = 'paid' THEN now() END, CASE WHEN $15 = 'paid' THEN 'Gift card' END)
        RETURNING id
      `, [reference, customer.id, normalisedEmail, subtotal, shipping,
          who.name, who.phone, JSON.stringify(who.address), who.zone,
          discount?.code ?? null, discountKobo,
          from?.session ?? null, from?.channel ?? null, from?.campaign ?? null,
          paidInFull ? 'paid' : 'pending', card?.id ?? null, giftKobo]);
      if (card && giftKobo) await recordSpend(tx, card.id, id, giftKobo);

      for (const l of lines) {
        await tx.query(`
          INSERT INTO order_items
            (order_id, product_id, variant_id, name, colour, size, unit_price_kobo, qty)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [id, l.productId, l.variantId, l.name, l.colour, l.size, l.unitPriceKobo, l.qty]);
      }

      return { id, reference, subtotal, shipping, discount, discountKobo, giftKobo, card, paidInFull, email: normalisedEmail, lines };
    });
  } catch (err) {
    if (!err.status) console.error('[checkout] failed:', err);
    return res.status(err.status || 500).json({
      error: err.status ? err.message : 'Something went wrong. Nothing has been charged.'
    });
  }

  const total = order.subtotal - order.discountKobo + order.shipping;
  const due = total - order.giftKobo;
  const totals = {
    subtotalKobo: order.subtotal, discountKobo: order.discountKobo, shippingKobo: order.shipping,
    giftKobo: order.giftKobo, totalKobo: total, dueKobo: due
  };

  // "Email me about new drops", ticked at checkout (never ticked for them):
  // onto the mailing list. A failure here must not cost the sale.
  if (body.newsletter === true) {
    await query('INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [order.email]).catch(() => {});
  }

  // Paid by the gift card alone: nothing to take, so straight to the order page.
  if (order.paidInFull) {
    return res.json({ reference: order.reference, authorizationUrl: null, paid: true, ...totals });
  }

  // Paystack is called AFTER the order exists, so a failure here leaves a
  // pending order we can reconcile rather than a charge with nothing behind it.
  try {
    const data = await initializeTransaction({
      email: order.email,
      amountKobo: due,
      reference: order.reference,
      callbackUrl: callbackUrl(),
      metadata: {
        order_id: order.id,
        items: order.lines.length,
        ...(order.discount ? { discount_code: order.discount.code } : {}),
        ...(order.giftKobo ? { gift_card: `…${order.card.code.slice(-4)}`, gift_kobo: order.giftKobo } : {}),
        // Shown on the transaction in the Paystack dashboard.
        custom_fields: [
          { display_name: 'Name',     variable_name: 'name',     value: who.name },
          { display_name: 'Phone',    variable_name: 'phone',    value: who.phone },
          { display_name: 'Delivery', variable_name: 'delivery', value: `${who.address.city}, ${who.address.state}` }
        ]
      }
    });

    res.json({ reference: order.reference, authorizationUrl: data.authorization_url, ...totals });
  } catch (err) {
    await releaseStock(order.reference, 'abandoned');
    res.status(502).json({ error: 'Could not reach the payment provider. Nothing has been charged.' });
    console.error('[checkout] paystack initialize failed:', err.message);
  }
});

const priceOf = (id) => oneRow(`SELECT price_kobo FROM products p WHERE id = $1 AND ${onSale()}`, [id]);

/* Codes can be guessed one by one, so trying them is limited. */
export const discountLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 30,
  message: 'Too many codes tried. Please wait a few minutes and try again.'
});

/**
 * POST /api/discount  { code, items: [{ productId, size, qty }] }
 * What a code would take off this bag, for the bag to show before paying.
 * Nothing is held: checkout checks the code again, and holds a use then.
 */
checkoutRouter.post('/discount', discountLimit, async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
  let subtotal = 0;
  for (const raw of items) {
    const qty = Number.isInteger(raw?.qty) && raw.qty > 0 && raw.qty <= 10 ? raw.qty : 0;
    const row = await priceOf(String(raw?.productId ?? ''));
    if (row) subtotal += row.price_kobo * qty;
  }
  if (!subtotal) return res.status(400).json({ error: 'Your bag is empty.' });
  res.json(await applyCode({ one: oneRow }, req.body?.code, subtotal));
});

/* Where Paystack sends the customer back to. Render sets RENDER_EXTERNAL_URL
 * to the service's own address, so on Render this needs no configuring. */
function callbackUrl() {
  if (process.env.PAYSTACK_CALLBACK_URL) return process.env.PAYSTACK_CALLBACK_URL;
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') + '/order';
  return undefined;   // Paystack falls back to the callback set in its dashboard
}
