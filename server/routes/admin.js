import { Router } from 'express';
import { db, transaction } from '../db.js';
import {
  verifyPassword, issueSession, requireAdmin, COOKIE,
  recordFailure, isLockedOut, clearFailures
} from '../lib/auth.js';

export const adminRouter = Router();

const clientIp = (req) => req.ip || req.socket?.remoteAddress || 'unknown';

/* ------------------------------------------------------------ sign in */

adminRouter.post('/admin/login', (req, res) => {
  const ip = clientIp(req);

  if (isLockedOut(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again later.' });
  }

  const hash = process.env.ADMIN_PASSWORD_HASH;
  if (!hash) {
    console.error('[admin] ADMIN_PASSWORD_HASH is not set; refusing all logins');
    return res.status(500).json({ error: 'Admin access is not configured.' });
  }

  const password = req.body?.password;
  if (typeof password !== 'string' || !verifyPassword(password, hash)) {
    recordFailure(ip);
    // Deliberately vague: naming which part was wrong helps an attacker.
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  clearFailures(ip);
  res.cookie?.(COOKIE, issueSession(), {
    httpOnly: true,                                   // JavaScript cannot read it
    sameSite: 'lax',                                  // not sent cross-site
    secure: process.env.NODE_ENV === 'production',    // HTTPS only in production
    maxAge: 8 * 60 * 60 * 1000,
    path: '/'
  });
  res.json({ ok: true });
});

adminRouter.post('/admin/logout', (_req, res) => {
  res.cookie?.(COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });
  res.json({ ok: true });
});

adminRouter.get('/admin/me', requireAdmin, (req, res) => {
  res.json({ signedIn: true, expiresAt: req.admin.exp });
});

/* ------------------------------------------------------------- orders */

adminRouter.get('/admin/orders', requireAdmin, (req, res) => {
  const status = req.query.status;
  const allowed = ['pending', 'paid', 'failed', 'abandoned'];
  const limit = Math.min(Number(req.query.limit) || 100, 500);

  const where = allowed.includes(status) ? 'WHERE status = ?' : '';
  const params = allowed.includes(status) ? [status, limit] : [limit];

  const orders = db.prepare(`
    SELECT id, reference, email, status, subtotal_kobo, currency,
           paid_at, fulfilled_at, created_at
      FROM orders ${where}
     ORDER BY id DESC
     LIMIT ?
  `).all(...params);

  const items = orders.length
    ? db.prepare(`
        SELECT order_id, name, size, qty, unit_price_kobo
          FROM order_items
         WHERE order_id IN (${orders.map(() => '?').join(',')})
      `).all(...orders.map(o => o.id))
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
adminRouter.get('/admin/summary', requireAdmin, (_req, res) => {
  const paid = db.prepare(`
    SELECT COUNT(*) AS orders, COALESCE(SUM(subtotal_kobo), 0) AS revenue_kobo
      FROM orders WHERE status = 'paid'
  `).get();

  const awaiting = db.prepare(`
    SELECT COUNT(*) AS n FROM orders WHERE status = 'paid' AND fulfilled_at IS NULL
  `).get();

  const pending = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'").get();

  const lowStock = db.prepare(`
    SELECT p.name, v.size, v.stock
      FROM variants v JOIN products p ON p.id = v.product_id
     WHERE v.stock <= 3
     ORDER BY v.stock ASC, p.name
  `).all();

  res.json({
    paidOrders: paid.orders,
    revenueKobo: paid.revenue_kobo,
    awaitingFulfilment: awaiting.n,
    pendingPayment: pending.n,
    lowStock
  });
});

/** Mark an order packed and sent. Only a paid order can be fulfilled. */
adminRouter.post('/admin/orders/:reference/fulfil', requireAdmin, (req, res) => {
  const order = db.prepare('SELECT id, status, fulfilled_at FROM orders WHERE reference = ?')
    .get(req.params.reference);

  if (!order) return res.status(404).json({ error: 'Order not found.' });
  if (order.status !== 'paid') {
    return res.status(409).json({ error: `Cannot fulfil an order that is "${order.status}".` });
  }
  if (order.fulfilled_at) return res.json({ ok: true, alreadyFulfilled: true });

  db.prepare("UPDATE orders SET fulfilled_at = datetime('now') WHERE id = ?").run(order.id);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- stock */

adminRouter.get('/admin/stock', requireAdmin, (_req, res) => {
  const rows = db.prepare(`
    SELECT v.id, v.size, v.stock, p.id AS product_id, p.name, p.price_kobo
      FROM variants v JOIN products p ON p.id = v.product_id
     ORDER BY p.rowid, v.id
  `).all();

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
adminRouter.post('/admin/stock/:variantId', requireAdmin, (req, res) => {
  const variantId = Number(req.params.variantId);
  const stock = req.body?.stock;

  if (!Number.isInteger(variantId)) {
    return res.status(400).json({ error: 'Bad variant.' });
  }
  if (typeof stock !== 'number' || !Number.isInteger(stock) || stock < 0 || stock > 100000) {
    return res.status(400).json({ error: 'Stock must be a whole number, zero or more.' });
  }

  const exists = db.prepare('SELECT id FROM variants WHERE id = ?').get(variantId);
  if (!exists) return res.status(404).json({ error: 'Variant not found.' });

  transaction(() => {
    db.prepare('UPDATE variants SET stock = ? WHERE id = ?').run(stock, variantId);
  });

  res.json({ ok: true, variantId, stock });
});
