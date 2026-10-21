import { Router } from 'express';
import { sendShipped } from '../lib/receipts.js';
import { one, query, transaction } from '../db.js';
import { onSale } from '../lib/catalogue.js';
import { openZones, getSettings, setSetting, SETTING_KEYS, ZONE_LABELS } from '../lib/settings.js';
import { toCsv } from '../lib/csv.js';
import { returnToCard } from '../lib/giftcards.js';
import {
  verifyPassword, issueSession, requireAdmin, currentSession, signOutEverywhere, COOKIE,
  recordFailure, isLockedOut, clearFailures,
  storedPasswordHash, claimPassword, checkSetupCode, RENEW_LIMIT
} from '../lib/auth.js';

export const adminRouter = Router();

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const MIN_PASSWORD = 12;

const setSessionCookie = (res, authAt = null) =>
  res.cookie(COOKIE, issueSession('admin', undefined, authAt), {
    httpOnly: true,                                   // JavaScript cannot read it
    sameSite: 'lax',                                  // not sent cross-site
    secure: process.env.NODE_ENV === 'production',    // HTTPS only in production
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });

/* ----------------------------------------------------------- first run */

/** Whether a password exists yet — so the page knows to show setup or sign-in. */
adminRouter.get('/admin/status', async (_req, res) => {
  res.json({ configured: Boolean(await storedPasswordHash()) });
});

/**
 * Choose the first password. Needs the one-time code from the server's log.
 * Refused for good once any password exists; changing it later is done on
 * the host (see README), not through a form anyone can reach.
 */
adminRouter.post('/admin/setup', async (req, res) => {
  const ip = clientIp(req);
  if (isLockedOut(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }
  if (await storedPasswordHash()) {
    return res.status(409).json({ error: 'A password is already set. Sign in instead.' });
  }
  // Checked before anything is stored, so a missing secret cannot leave a
  // password saved that nobody is able to sign in with.
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.error('[admin] SESSION_SECRET is missing or short; setup refused');
    return res.status(500).json({ error: 'The server is missing SESSION_SECRET. Set it on the host, then try again.' });
  }

  const { code, password } = req.body ?? {};
  if (!checkSetupCode(code)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'That setup code is not right. Copy it again from the log.' });
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD) {
    return res.status(400).json({ error: `Use at least ${MIN_PASSWORD} characters.` });
  }
  if (password.length > 256) {
    return res.status(400).json({ error: 'That password is too long.' });
  }

  if (!(await claimPassword(password))) {
    return res.status(409).json({ error: 'A password is already set. Sign in instead.' });
  }

  clearFailures(ip);
  console.log('[admin] password set through the setup code');
  setSessionCookie(res);
  res.json({ ok: true });
});

/* ------------------------------------------------------------ sign in */

adminRouter.post('/admin/login', async (req, res) => {
  const ip = clientIp(req);

  if (isLockedOut(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const hash = await storedPasswordHash();
  if (!hash) {
    return res.status(409).json({ error: 'No password has been set yet.', needsSetup: true });
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || !verifyPassword(password, hash)) {
    recordFailure(ip);
    // Deliberately vague: naming which part was wrong helps an attacker.
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  clearFailures(ip);
  setSessionCookie(res);
  res.json({ ok: true });
});

adminRouter.post('/admin/logout', async (req, res) => {
  // Only a signed-in owner can sign everyone out; anyone may clear their own cookie.
  if (await currentSession(req)) await signOutEverywhere();
  res.cookie(COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  res.json({ ok: true });
});

adminRouter.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ signedIn: true, expiresAt: req.admin.exp });
});

/* "Stay signed in", from the admin's warning before a session runs out: a
 * fresh eight hours, for a session that is still valid, up to a day after
 * the password was last typed. After that, the password again. */
adminRouter.post('/admin/renew', requireAdmin, (req, res) => {
  const authAt = req.admin.auth ?? req.admin.iat ?? 0;
  if (Date.now() - authAt > RENEW_LIMIT) {
    return res.status(401).json({ error: 'Please sign in again.', code: 'reauth' });
  }
  setSessionCookie(res, authAt);
  res.json({ ok: true, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
});

/* ------------------------------------------------------------- orders */

const STATUSES = ['pending', 'paid', 'failed', 'abandoned', 'refund_due', 'refunded'];

adminRouter.get('/admin/orders', requireAdmin, async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);

  // $1 IS NULL rather than two versions of the query: a missing filter is a
  // value, not a different statement.
  const orders = await query(`
    SELECT id, reference, email, status, subtotal_kobo, shipping_kobo, currency,
           customer_name, phone, address, delivery_zone, discount_code, discount_kobo,
           courier, tracking, paid_at, fulfilled_at, refunded_at, created_at, gift_kobo
      FROM orders
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY id DESC
     LIMIT $2
  `, [status, limit]);

  const items = orders.length
    ? await query(`
        SELECT order_id, name, colour, size, qty, unit_price_kobo
          FROM order_items
         WHERE order_id = ANY($1::int[])
         ORDER BY id
      `, [orders.map(o => o.id)])
    : [];

  res.json(orders.map(o => ({
    id: o.id,
    reference: o.reference,
    email: o.email,
    name: o.customer_name,
    phone: o.phone,
    address: o.address,
    zone: o.delivery_zone,
    status: o.status,
    subtotalKobo: o.subtotal_kobo,
    discountCode: o.discount_code,
    discountKobo: o.discount_kobo,
    shippingKobo: o.shipping_kobo,
    totalKobo: o.subtotal_kobo - o.discount_kobo + o.shipping_kobo,
    giftKobo: o.gift_kobo,
    currency: o.currency,
    paidAt: o.paid_at,
    fulfilledAt: o.fulfilled_at,
    courier: o.courier,
    tracking: o.tracking,
    refundedAt: o.refunded_at,
    createdAt: o.created_at,
    items: items.filter(i => i.order_id === o.id).map(i => ({
      name: i.name, colour: i.colour || null, size: i.size, qty: i.qty, unitPriceKobo: i.unit_price_kobo
    }))
  })));
});

/** What the shop has actually taken. Only paid orders count as revenue. */
adminRouter.get('/admin/summary', requireAdmin, async (_req, res) => {
  const counts = await one(`
    SELECT COUNT(*) FILTER (WHERE status = 'paid')                         AS paid,
           COALESCE(SUM(subtotal_kobo - discount_kobo + shipping_kobo) FILTER (WHERE status = 'paid'), 0) AS revenue_kobo,
           COUNT(*) FILTER (WHERE status = 'paid' AND fulfilled_at IS NULL) AS awaiting,
           COUNT(*) FILTER (WHERE status = 'pending')                      AS pending,
           COUNT(*) FILTER (WHERE status = 'refund_due')                   AS refund_due
      FROM orders
  `);

  // Only what customers can buy: a product still being set up, or taken off
  // sale, is at zero on purpose and would bury the warnings that matter.
  const lowStock = await query(`
    SELECT p.name, NULLIF(v.colour, '') AS colour, v.size, v.stock
      FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.stock <= ${LOW_STOCK} AND p.hidden = FALSE
     ORDER BY v.stock ASC, p.name, v.id
  `);

  res.json({
    paidOrders: counts.paid,
    revenueKobo: counts.revenue_kobo,
    awaitingFulfilment: counts.awaiting,
    pendingPayment: counts.pending,
    // Customers charged for something that could not be sent. Not revenue,
    // and the one number here that means someone is owed money.
    refundDue: counts.refund_due,
    lowStock,
    // Checkout takes nothing until the owner has priced delivery somewhere.
    checkoutOpen: (await openZones()).length > 0,
    subscribers: (await one('SELECT COUNT(*) AS n FROM subscribers')).n,
    // People asked to hear when a size came back, and it is back: worth
    // telling them before it sells out again.
    alertsReady: (await one(`
      SELECT COUNT(*) AS n FROM stock_alerts a
        JOIN variants v ON v.product_id = a.product_id AND v.colour = a.colour AND v.size = a.size
        JOIN products p ON p.id = a.product_id
       WHERE v.stock > 0 AND ${onSale()}
    `)).n
  });
});

/** Short free text for the courier and tracking boxes. Empty is fine. */
function shortText(v, label, max) {
  const t = String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (t.length > max) throw Object.assign(new Error(`Keep the ${label} under ${max} characters.`), { status: 400 });
  return t || null;
}

/**
 * Mark an order packed and sent, with the courier and tracking number if
 * there is one — the customer sees both on their order page. Sending it again
 * for a sent order corrects those two and nothing else. Only a paid order can
 * be sent.
 */
adminRouter.post('/admin/orders/:reference/fulfil', requireAdmin, async (req, res) => {
  const courier = shortText(req.body?.courier, 'courier', 40);
  const tracking = shortText(req.body?.tracking, 'tracking number', 60);
  const order = await one('SELECT id, status, fulfilled_at FROM orders WHERE reference = $1',
    [req.params.reference]);

  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'paid') {
    return res.status(409).json({ error: `Cannot fulfil an order that is "${order.status}".` });
  }

  await query(`UPDATE orders SET fulfilled_at = COALESCE(fulfilled_at, now()), courier = $2, tracking = $3
                WHERE id = $1`, [order.id, courier, tracking]);
  // The customer is told by email, once (when the shop can send email).
  await sendShipped(req.params.reference, req);
  res.json({ ok: true, alreadyFulfilled: Boolean(order.fulfilled_at) });
});

/**
 * Record a refund the owner has made from Paystack's dashboard. The shop
 * cannot move money back itself; this keeps its books matching Paystack's.
 * `restock` puts the pieces back on the shelf — right for an order that was
 * never sent, wrong for one that left (or, for refund_due, never had stock).
 */
adminRouter.post('/admin/orders/:reference/refunded', requireAdmin, async (req, res) => {
  const restock = req.body?.restock === true;
  const result = await transaction(async (tx) => {
    const order = await tx.one('SELECT id, status, fulfilled_at, gift_card_id, gift_kobo FROM orders WHERE reference = $1 FOR UPDATE',
      [req.params.reference]);
    if (!order) return { status: 404, error: 'Order not found.' };
    if (!['paid', 'refund_due'].includes(order.status)) {
      return { status: 409, error: `Only a paid order can be refunded; this one is "${order.status}".` };
    }
    if (restock && order.status === 'paid') {
      const items = await tx.query('SELECT variant_id, qty FROM order_items WHERE order_id = $1', [order.id]);
      for (const i of items) {
        await tx.query('UPDATE variants SET stock = stock + $1 WHERE id = $2', [i.qty, i.variant_id]);
      }
    }
    // What a gift card paid goes back on the card; Paystack refunds only its own part.
    await returnToCard(tx, order);
    await tx.query(`UPDATE orders SET status = 'refunded', refunded_at = now() WHERE id = $1`, [order.id]);
    return { giftReturnedKobo: order.gift_kobo };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, giftReturnedKobo: result.giftReturnedKobo });
});

/* -------------------------------------------------------------- stock */

/* Stock, as the owner counts it.
 *
 * A variant's `stock` is what is left to sell. The shelf holds more than
 * that: pieces sold but not yet sent, and pieces someone is paying for right
 * now (taken off at checkout, put back if the payment fails). So the owner
 * types what is on the shelf, and the shop takes those off itself — typing
 * the shelf as "left to sell" would sell pieces that are already spoken for. */

/** At or below this many left (and above none), a line counts as running low. */
export const LOW_STOCK = 3;

/** Per variant: sold and waiting to be sent, and held while someone pays. */
const COMMITTED = `
  SELECT i.variant_id,
         COALESCE(SUM(i.qty) FILTER (WHERE o.status = 'paid' AND o.fulfilled_at IS NULL), 0)::int AS to_send,
         COALESCE(SUM(i.qty) FILTER (WHERE o.status = 'pending'), 0)::int AS held
    FROM order_items i JOIN orders o ON o.id = i.order_id
   WHERE (o.status = 'paid' AND o.fulfilled_at IS NULL) OR o.status = 'pending'
   GROUP BY i.variant_id`;

async function stockList(db = { query }) {
  const rows = await db.query(`
    SELECT v.id, v.colour, v.size, v.stock, p.id AS product_id, p.name, p.price_kobo, p.hidden,
           COALESCE(c2.to_send, 0) AS to_send, COALESCE(c2.held, 0) AS held
      FROM variants v JOIN products p ON p.id = v.product_id
      LEFT JOIN product_colours c ON c.product_id = v.product_id AND c.name = v.colour
      LEFT JOIN (${COMMITTED}) c2 ON c2.variant_id = v.id
     ORDER BY p.position, p.id, c.position NULLS FIRST, c.id, v.id
  `);
  return rows.map(r => ({
    variantId: r.id,
    productId: r.product_id,
    name: r.name,
    colour: r.colour || null,
    size: r.size,
    stock: r.stock,                          // left to sell
    toSend: r.to_send,
    held: r.held,
    shelf: r.stock + r.to_send + r.held,     // what should be on the shelf
    priceKobo: r.price_kobo,
    offSale: r.hidden,
    state: r.stock === 0 ? 'out' : r.stock <= LOW_STOCK ? 'low' : 'ok'
  }));
}

adminRouter.get('/admin/stock', requireAdmin, async (_req, res) => {
  res.json(await stockList());
});

const label = (v) => `${v.name}, ${v.colour ? `${v.colour}, ` : ''}${v.size}`;

/**
 * Save the shelf counts of any number of lines at once: { counts: [{ variantId,
 * shelf }] }. All or nothing: if any line has fewer on the shelf than are
 * already spoken for, nothing is saved and the answer says which.
 */
adminRouter.post('/admin/stock', requireAdmin, async (req, res) => {
  const counts = req.body?.counts;
  if (!Array.isArray(counts) || counts.length === 0 || counts.length > 1000) {
    return res.status(400).json({ error: 'Nothing to save.' });
  }
  const want = new Map();
  for (const c of counts) {
    const id = c?.variantId, shelf = c?.shelf;
    if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) return res.status(400).json({ error: 'Bad variant.' });
    if (!Number.isInteger(shelf) || shelf < 0 || shelf > 100000) {
      return res.status(400).json({ error: 'Counts must be whole numbers, zero or more.' });
    }
    want.set(id, shelf);
  }

  const result = await transaction(async (tx) => {
    // In id order, so two saves at once cannot deadlock; locked, so a
    // checkout in between waits and is counted.
    const ids = [...want.keys()].sort((a, b) => a - b);
    const rows = await tx.query(`
      SELECT v.id, v.product_id, v.colour, v.size, v.stock, p.name
        FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ANY($1::int[]) ORDER BY v.id FOR UPDATE OF v`, [ids]);
    if (rows.length !== ids.length) return { status: 404, error: 'One of those lines no longer exists. Reload the page.' };
    const committed = new Map((await tx.query(`SELECT * FROM (${COMMITTED}) c WHERE c.variant_id = ANY($1::int[])`, [ids]))
      .map(r => [r.variant_id, r.to_send + r.held]));

    const short = [];
    const changes = [];
    for (const v of rows) {
      const shelf = want.get(v.id);
      const spoken = committed.get(v.id) ?? 0;
      if (shelf < spoken) { short.push(`${label(v)}: you counted ${shelf}, but ${spoken} ${spoken === 1 ? 'is' : 'are'} sold or being paid for and not yet sent`); continue; }
      const after = shelf - spoken;
      if (after !== v.stock) changes.push({ v, after, shelf });
    }
    if (short.length) {
      return { status: 409, error: `Nothing was saved. ${short.join('; ')}. Count again, or mark those orders sent first.` };
    }
    for (const { v, after, shelf } of changes) {
      await tx.query('UPDATE variants SET stock = $1 WHERE id = $2', [after, v.id]);
      await tx.query(`INSERT INTO stock_log (variant_id, product_id, name, colour, size, stock_before, stock_after, shelf)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [v.id, v.product_id, v.name, v.colour, v.size, v.stock, after, shelf]);
    }
    return { changed: changes.length };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ changed: result.changed, stock: await stockList() });
});

/**
 * A delivery arrived: { lines: [{ variantId, qty }], note }. Each quantity is
 * added to what is there — the owner knows how many came, not the new total.
 * All lines together, logged as one delivery with the note.
 */
adminRouter.post('/admin/stock/receive', requireAdmin, async (req, res) => {
  const lines = req.body?.lines;
  const note = typeof req.body?.note === 'string' ? req.body.note.replace(/\s+/g, ' ').trim() : '';
  if (!Array.isArray(lines) || lines.length === 0 || lines.length > 1000) {
    return res.status(400).json({ error: 'Type how many arrived on at least one line.' });
  }
  if (note.length > 120) return res.status(400).json({ error: 'Keep the note under 120 characters.' });
  const add = new Map();
  for (const l of lines) {
    const id = l?.variantId, qty = l?.qty;
    if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) return res.status(400).json({ error: 'Bad variant.' });
    if (!Number.isInteger(qty) || qty < 1 || qty > 10000) {
      return res.status(400).json({ error: 'How many arrived must be a whole number, 1 or more.' });
    }
    add.set(id, (add.get(id) ?? 0) + qty);
  }

  const result = await transaction(async (tx) => {
    const ids = [...add.keys()].sort((a, b) => a - b);
    const rows = await tx.query(`
      SELECT v.id, v.product_id, v.colour, v.size, v.stock, p.name
        FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ANY($1::int[]) ORDER BY v.id FOR UPDATE OF v`, [ids]);
    if (rows.length !== ids.length) return { status: 404, error: 'One of those lines no longer exists. Reload the page.' };
    if (rows.some(v => v.stock + add.get(v.id) > 100000)) return { status: 400, error: 'That is more than a line can hold.' };
    for (const v of rows) {
      const after = v.stock + add.get(v.id);
      await tx.query('UPDATE variants SET stock = $1 WHERE id = $2', [after, v.id]);
      await tx.query(`INSERT INTO stock_log (variant_id, product_id, name, colour, size, stock_before, stock_after, kind, note)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, 'delivery', $8)`,
        [v.id, v.product_id, v.name, v.colour, v.size, v.stock, after, note]);
    }
    return { received: [...add.values()].reduce((a, b) => a + b, 0), lines: rows.length };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ...result, stock: await stockList() });
});

/**
 * Set one line's "left to sell" to an exact number (the older, single-line
 * way; the admin now saves shelf counts above). Logged like any change.
 */
adminRouter.post('/admin/stock/:variantId', requireAdmin, async (req, res) => {
  const variantId = Number(req.params.variantId);
  const stock = req.body?.stock;

  if (!Number.isInteger(variantId) || variantId < 1 || variantId > 2_147_483_647) {
    return res.status(400).json({ error: 'Bad variant.' });
  }
  if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0 || stock > 100000) {
    return res.status(400).json({ error: 'Stock must be a whole number, zero or more.' });
  }

  const updated = await transaction(async (tx) => {
    const v = await tx.one(`SELECT v.id, v.product_id, v.colour, v.size, v.stock, p.name
                              FROM variants v JOIN products p ON p.id = v.product_id
                             WHERE v.id = $1 FOR UPDATE OF v`, [variantId]);
    if (!v) return null;
    if (v.stock !== stock) {
      await tx.query('UPDATE variants SET stock = $1 WHERE id = $2', [stock, variantId]);
      await tx.query(`INSERT INTO stock_log (variant_id, product_id, name, colour, size, stock_before, stock_after, kind)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, 'set')`,
        [v.id, v.product_id, v.name, v.colour, v.size, v.stock, stock]);
    }
    return v;
  });
  if (!updated) return res.status(404).json({ error: 'Variant not found.' });

  res.json({ ok: true, variantId, stock });
});

/** The most recent count changes, newest first. */
adminRouter.get('/admin/stock/history', requireAdmin, async (_req, res) => {
  const rows = await query(`
    SELECT id, name, colour, size, stock_before, stock_after, shelf, kind, note, created_at
      FROM stock_log ORDER BY created_at DESC, id DESC LIMIT 100`);
  res.json(rows.map(r => ({
    id: r.id, name: r.name, colour: r.colour || null, size: r.size,
    before: r.stock_before, after: r.stock_after, shelf: r.shelf, kind: r.kind, note: r.note || null,
    at: r.created_at?.toISOString?.() ?? r.created_at
  })));
});

/* ---------------------------------------------------------- exports */

const stamp = () => new Date().toISOString().slice(0, 10);

/** Stock as a spreadsheet: for a stocktake, or to send a supplier. */
adminRouter.get('/admin/stock.csv', requireAdmin, async (_req, res) => {
  const rows = await stockList();
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="masq-stock-${stamp()}.csv"`,
    'Cache-Control': 'no-store'
  });
  res.send(toCsv(
    ['Piece', 'Colour', 'Size', 'Price ₦', 'On the shelf', 'Waiting to be sent', 'Being paid for', 'Left to sell', 'On sale'],
    rows.map(r => [r.name, r.colour ?? '', r.size, (r.priceKobo / 100).toFixed(2), r.shelf, r.toSend, r.held, r.stock,
                   r.offSale ? 'no' : 'yes'])));
});

/** Orders as a spreadsheet, for packing and dispatch. */
adminRouter.get('/admin/orders.csv', requireAdmin, async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const orders = await query(`
    SELECT o.id, o.reference, o.status, o.created_at, o.paid_at, o.fulfilled_at,
           o.customer_name, o.email, o.phone, o.address, o.delivery_zone,
           o.subtotal_kobo, o.shipping_kobo, o.discount_code, o.discount_kobo, o.gift_kobo, o.courier, o.tracking,
           COALESCE(string_agg(i.qty || '× ' || i.name || ' (' || CASE WHEN i.colour <> '' THEN i.colour || ', ' ELSE '' END || i.size || ')', '; ' ORDER BY i.id), '') AS items
      FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
     WHERE ($1::text IS NULL OR o.status = $1)
     GROUP BY o.id
     ORDER BY o.id DESC
  `, [status]);

  const naira = (k) => (k / 100).toFixed(2);
  const csv = toCsv(
    ['Reference', 'Status', 'Placed', 'Paid', 'Sent', 'Name', 'Email', 'Phone',
     'Address', 'City', 'State', 'Postcode', 'Country', 'Delivery', 'Items', 'Items ₦', 'Discount code', 'Discount ₦',
     'Delivery ₦', 'Total ₦', 'Paid by gift card ₦', 'Courier', 'Tracking'],
    orders.map(o => {
      const a = o.address ?? {};
      return [
        o.reference, o.status, o.created_at?.toISOString?.() ?? o.created_at,
        o.paid_at?.toISOString?.() ?? o.paid_at ?? '', o.fulfilled_at?.toISOString?.() ?? o.fulfilled_at ?? '',
        o.customer_name ?? '', o.email, o.phone ?? '',
        [a.line1, a.line2].filter(Boolean).join(', '), a.city ?? '', a.state ?? '', a.postcode ?? '', a.country ?? '',
        ZONE_LABELS[o.delivery_zone] ?? '', o.items,
        naira(o.subtotal_kobo), o.discount_code ?? '', naira(o.discount_kobo), naira(o.shipping_kobo),
        naira(o.subtotal_kobo - o.discount_kobo + o.shipping_kobo), naira(o.gift_kobo), o.courier ?? '', o.tracking ?? ''
      ];
    })
  );

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="masq-orders-${stamp()}.csv"`,
    'Cache-Control': 'no-store'
  });
  res.send(csv);
});

/* ------------------------------------------------------ mailing list */

adminRouter.get('/admin/subscribers', requireAdmin, async (_req, res) => {
  const rows = await query('SELECT id, email, created_at FROM subscribers ORDER BY id DESC LIMIT 5000');
  res.json(rows.map(r => ({ id: r.id, email: r.email, joinedAt: r.created_at })));
});

adminRouter.get('/admin/subscribers.csv', requireAdmin, async (_req, res) => {
  const rows = await query('SELECT email, created_at FROM subscribers ORDER BY id');
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="masq-list-${stamp()}.csv"`,
    'Cache-Control': 'no-store'
  });
  res.send(toCsv(['Email', 'Joined'],
    rows.map(r => [r.email, r.created_at?.toISOString?.() ?? r.created_at])));
});

/** Remove someone from the list — for when they ask. */
adminRouter.delete('/admin/subscribers/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) {
    return res.status(400).json({ error: 'Bad subscriber.' });
  }
  const gone = await one('DELETE FROM subscribers WHERE id = $1 RETURNING id', [id]);
  if (!gone) return res.status(404).json({ error: 'Not on the list.' });
  res.json({ ok: true });
});

/* ---------------------------------------------------------- settings */

adminRouter.get('/admin/settings', requireAdmin, async (_req, res) => {
  res.json(await getSettings());
});

/** Save one setting: delivery, pages, social or film. Validated before storing. */
adminRouter.put('/admin/settings/:key', requireAdmin, async (req, res) => {
  if (!SETTING_KEYS.includes(req.params.key)) {
    return res.status(404).json({ error: 'There is no such setting.' });
  }
  res.json(await setSetting(req.params.key, req.body));
});
