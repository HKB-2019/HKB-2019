import { Router } from 'express';
import { one, query } from '../db.js';
import {
  verifyPassword, issueSession, requireAdmin, COOKIE,
  recordFailure, isLockedOut, clearFailures,
  storedPasswordHash, claimPassword, checkSetupCode
} from '../lib/auth.js';

export const adminRouter = Router();

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

const MIN_PASSWORD = 12;

const setSessionCookie = (res) =>
  res.cookie(COOKIE, issueSession(), {
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

adminRouter.post('/admin/logout', (_req, res) => {
  res.cookie(COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  res.json({ ok: true });
});

adminRouter.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ signedIn: true, expiresAt: req.admin.exp });
});

/* ------------------------------------------------------------- orders */

const STATUSES = ['pending', 'paid', 'failed', 'abandoned', 'refund_due'];

adminRouter.get('/admin/orders', requireAdmin, async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : null;
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 100, 1), 500);

  // $1 IS NULL rather than two versions of the query: a missing filter is a
  // value, not a different statement.
  const orders = await query(`
    SELECT id, reference, email, status, subtotal_kobo, currency,
           paid_at, fulfilled_at, created_at
      FROM orders
     WHERE ($1::text IS NULL OR status = $1)
     ORDER BY id DESC
     LIMIT $2
  `, [status, limit]);

  const items = orders.length
    ? await query(`
        SELECT order_id, name, size, qty, unit_price_kobo
          FROM order_items
         WHERE order_id = ANY($1::int[])
         ORDER BY id
      `, [orders.map(o => o.id)])
    : [];

  res.json(orders.map(o => ({
    id: o.id,
    reference: o.reference,
    email: o.email,
    status: o.status,
    subtotalKobo: o.subtotal_kobo,
    currency: o.currency,
    paidAt: o.paid_at,
    fulfilledAt: o.fulfilled_at,
    createdAt: o.created_at,
    items: items.filter(i => i.order_id === o.id).map(i => ({
      name: i.name, size: i.size, qty: i.qty, unitPriceKobo: i.unit_price_kobo
    }))
  })));
});

/** What the shop has actually taken. Only paid orders count as revenue. */
adminRouter.get('/admin/summary', requireAdmin, async (_req, res) => {
  const counts = await one(`
    SELECT COUNT(*) FILTER (WHERE status = 'paid')                         AS paid,
           COALESCE(SUM(subtotal_kobo) FILTER (WHERE status = 'paid'), 0)  AS revenue_kobo,
           COUNT(*) FILTER (WHERE status = 'paid' AND fulfilled_at IS NULL) AS awaiting,
           COUNT(*) FILTER (WHERE status = 'pending')                      AS pending,
           COUNT(*) FILTER (WHERE status = 'refund_due')                   AS refund_due
      FROM orders
  `);

  const lowStock = await query(`
    SELECT p.name, v.size, v.stock
      FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.stock <= 3
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
    lowStock
  });
});

/** Mark an order packed and sent. Only a paid order can be fulfilled. */
adminRouter.post('/admin/orders/:reference/fulfil', requireAdmin, async (req, res) => {
  const order = await one('SELECT id, status, fulfilled_at FROM orders WHERE reference = $1',
    [req.params.reference]);

  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'paid') {
    return res.status(409).json({ error: `Cannot fulfil an order that is "${order.status}".` });
  }
  if (order.fulfilled_at) return res.json({ ok: true, alreadyFulfilled: true });

  await query('UPDATE orders SET fulfilled_at = now() WHERE id = $1 AND fulfilled_at IS NULL', [order.id]);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- stock */

adminRouter.get('/admin/stock', requireAdmin, async (_req, res) => {
  const rows = await query(`
    SELECT v.id, v.size, v.stock, p.id AS product_id, p.name, p.price_kobo
      FROM variants v JOIN products p ON p.id = v.product_id
     ORDER BY p.position, p.id, v.id
  `);

  res.json(rows.map(r => ({
    variantId: r.id,
    productId: r.product_id,
    name: r.name,
    size: r.size,
    stock: r.stock,
    priceKobo: r.price_kobo
  })));
});

/**
 * Set a variant's stock to an exact number.
 *
 * Set, not adjust: an operator counting a shelf knows how many are there, not
 * how many have changed. The CHECK constraint refuses a negative anyway.
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

  const updated = await one('UPDATE variants SET stock = $1 WHERE id = $2 RETURNING id',
    [stock, variantId]);
  if (!updated) return res.status(404).json({ error: 'Variant not found.' });

  res.json({ ok: true, variantId, stock });
});
