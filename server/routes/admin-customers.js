import { Router } from 'express';
import { query, transaction } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { toCsv } from '../lib/csv.js';

/* CUSTOMERS: one record per person, by email, joined up from what the shop
 * already holds — their orders (name, phone, address, what they bought), the
 * mailing list and their "tell me when it's back" requests — plus the
 * owner's own tags and notes. Admin only.
 *
 * A buyer has at least one paid order. A prospect has none yet: on the list,
 * waiting for a size, or a checkout they did not finish. */

export const adminCustomersRouter = Router();
adminCustomersRouter.use(['/admin/customers', '/admin/customers.csv'], requireAdmin);

const MAX_TAGS = 10;

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

/** The person an address names, or a 400. */
function emailParam(raw) {
  const e = String(raw ?? '').trim().toLowerCase();
  if (e.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) throw fail(400, 'That is not an email address.');
  return e;
}

const iso = (d) => (d ? d.toISOString?.() ?? d : null);

/* Paid money: what the customer paid, delivery included, refunds excluded. */
const PEOPLE = `
  WITH people AS (
    SELECT email FROM (
      SELECT lower(email) AS email FROM orders
      UNION SELECT lower(email) FROM subscribers
      UNION SELECT lower(email) FROM stock_alerts
      UNION SELECT lower(email) FROM customers WHERE notes <> '' OR tags <> '[]'::jsonb
    ) x WHERE email NOT LIKE '%@removed.invalid'     -- orders of people who asked to be forgotten
  ),
  o AS (
    SELECT lower(email) AS email,
           COUNT(*) FILTER (WHERE status = 'paid')::int AS orders,
           COALESCE(SUM(subtotal_kobo - discount_kobo + shipping_kobo) FILTER (WHERE status = 'paid'), 0)::int AS spent,
           COUNT(*) FILTER (WHERE status IN ('pending', 'abandoned', 'failed'))::int AS unfinished,
           MIN(created_at) FILTER (WHERE status = 'paid') AS first_order,
           MAX(created_at) FILTER (WHERE status = 'paid') AS last_order,
           MIN(created_at) AS first_seen
      FROM orders GROUP BY lower(email)
  ),
  latest AS (
    SELECT DISTINCT ON (lower(email)) lower(email) AS email, customer_name, phone, address
      FROM orders WHERE customer_name IS NOT NULL ORDER BY lower(email), created_at DESC
  ),
  w AS (SELECT lower(email) AS email, COUNT(*)::int AS waiting, MIN(created_at) AS first_seen
          FROM stock_alerts GROUP BY lower(email))
  SELECT p.email, l.customer_name AS name, l.phone, l.address,
         COALESCE(o.orders, 0) AS orders, COALESCE(o.spent, 0) AS spent, COALESCE(o.unfinished, 0) AS unfinished,
         o.first_order, o.last_order, s.created_at AS subscribed_at, COALESCE(w.waiting, 0) AS waiting,
         COALESCE(c.tags, '[]'::jsonb) AS tags, COALESCE(c.notes, '') AS notes,
         LEAST(o.first_seen, s.created_at, w.first_seen, c.created_at) AS first_seen
    FROM people p
    LEFT JOIN o ON o.email = p.email
    LEFT JOIN latest l ON l.email = p.email
    LEFT JOIN subscribers s ON lower(s.email) = p.email
    LEFT JOIN w ON w.email = p.email
    LEFT JOIN customers c ON lower(c.email) = p.email`;

const shape = (r) => ({
  email: r.email,
  name: r.name ?? null,
  phone: r.phone ?? null,
  city: r.address?.city ?? null,
  state: r.address?.state ?? null,
  country: r.address?.country ?? null,
  orders: r.orders,
  spentKobo: r.spent,
  unfinished: r.unfinished,
  firstOrderAt: iso(r.first_order),
  lastOrderAt: iso(r.last_order),
  subscribed: Boolean(r.subscribed_at),
  subscribedAt: iso(r.subscribed_at),
  waiting: r.waiting,
  tags: Array.isArray(r.tags) ? r.tags : [],
  notes: r.notes,
  firstSeenAt: iso(r.first_seen),
  kind: r.orders > 0 ? 'buyer' : 'prospect'
});

async function everyone() {
  const rows = await query(`${PEOPLE} ORDER BY COALESCE(o.last_order, LEAST(o.first_seen, s.created_at, w.first_seen, c.created_at)) DESC NULLS LAST, p.email LIMIT 5000`);
  return rows.map(shape);
}

adminCustomersRouter.get('/admin/customers', async (_req, res) => {
  res.json(await everyone());
});

adminCustomersRouter.get('/admin/customers.csv', async (_req, res) => {
  const rows = await everyone();
  const day = (d) => (d ? d.slice(0, 10) : '');
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="masq-customers-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store'
  });
  res.send(toCsv(
    ['Name', 'Email', 'Phone', 'City', 'State', 'Kind', 'Paid orders', 'Spent ₦', 'First order', 'Last order',
     'On the mailing list', 'Waiting for', 'Tags', 'Notes'],
    rows.map(r => [r.name ?? '', r.email, r.phone ?? '', r.city ?? '', r.state ?? '', r.kind, r.orders,
                   (r.spentKobo / 100).toFixed(2), day(r.firstOrderAt), day(r.lastOrderAt),
                   r.subscribed ? 'yes' : 'no', r.waiting, r.tags.join('; '), r.notes])));
});

/** One person: everything above, plus each order and what they are waiting for. */
adminCustomersRouter.get('/admin/customers/:email', async (req, res) => {
  const email = emailParam(req.params.email);
  const [row] = await query(`${PEOPLE} WHERE p.email = $1`, [email]);
  if (!row) throw fail(404, 'No one with that email.');
  const orders = await query(`
    SELECT o.id, o.reference, o.status, o.created_at, o.fulfilled_at,
           o.subtotal_kobo - o.discount_kobo + o.shipping_kobo AS total
      FROM orders o WHERE lower(o.email) = $1 ORDER BY o.created_at DESC`, [email]);
  const items = orders.length ? await query(`
    SELECT order_id, name, colour, size, qty FROM order_items WHERE order_id = ANY($1::int[]) ORDER BY id`,
    [orders.map(o => o.id)]) : [];
  const waitingFor = await query(`
    SELECT a.colour, a.size, a.created_at, p.name
      FROM stock_alerts a LEFT JOIN products p ON p.id = a.product_id
     WHERE lower(a.email) = $1 ORDER BY a.created_at DESC`, [email]);
  res.json({
    ...shape(row),
    address: row.address ?? null,
    orderList: orders.map(o => ({
      reference: o.reference, status: o.status, placedAt: iso(o.created_at), sentAt: iso(o.fulfilled_at),
      totalKobo: o.total,
      items: items.filter(i => i.order_id === o.id).map(i => ({ name: i.name, colour: i.colour || null, size: i.size, qty: i.qty }))
    })),
    waitingFor: waitingFor.map(w => ({ name: w.name ?? 'A piece no longer listed', colour: w.colour || null, size: w.size, askedAt: iso(w.created_at) }))
  });
});

/** The owner's tags and notes. */
adminCustomersRouter.patch('/admin/customers/:email', async (req, res) => {
  const email = emailParam(req.params.email);
  const b = req.body ?? {};
  let tags = null, notes = null;
  if ('tags' in b) {
    if (!Array.isArray(b.tags)) throw fail(400, 'Tags must be a list.');
    tags = [...new Set(b.tags.map(t => String(t ?? '').replace(/\s+/g, ' ').trim()).filter(Boolean))];
    if (tags.length > MAX_TAGS) throw fail(400, `Up to ${MAX_TAGS} tags.`);
    if (tags.some(t => t.length > 24)) throw fail(400, 'Keep each tag under 24 characters.');
  }
  if ('notes' in b) {
    if (typeof b.notes !== 'string') throw fail(400, 'Notes must be text.');
    notes = b.notes.replace(/\r\n?/g, '\n').trim();
    if (notes.length > 2000) throw fail(400, 'Keep notes under 2,000 characters.');
  }
  const [known] = await query(`${PEOPLE} WHERE p.email = $1`, [email]);
  if (!known) throw fail(404, 'No one with that email.');
  await query(`
    INSERT INTO customers (email, tags, notes, updated_at) VALUES ($1, COALESCE($2::jsonb, '[]'::jsonb), COALESCE($3, ''), now())
    ON CONFLICT (email) DO UPDATE SET
      tags  = COALESCE($2::jsonb, customers.tags),
      notes = COALESCE($3, customers.notes),
      updated_at = now()`, [email, tags ? JSON.stringify(tags) : null, notes]);
  const [row] = await query(`${PEOPLE} WHERE p.email = $1`, [email]);
  res.json(shape(row));
});

/**
 * Forget a person, when they ask (their right under Nigeria's Data
 * Protection Act). Their list sign-up, restock requests, tags and notes go.
 * Orders are kept for the accounts but no longer say who: name, phone,
 * address and email are wiped. Not while an order of theirs is still to be
 * paid or sent — that would lose where to send it.
 */
adminCustomersRouter.delete('/admin/customers/:email', async (req, res) => {
  const email = emailParam(req.params.email);
  const result = await transaction(async (tx) => {
    const open = await tx.one(`
      SELECT COUNT(*)::int AS n FROM orders
       WHERE lower(email) = $1 AND (status = 'pending' OR (status = 'paid' AND fulfilled_at IS NULL))`, [email]);
    if (open.n > 0) return { status: 409, error: 'This person has an order still being paid for or waiting to be sent. Send it (or refund it) first.' };
    const orders = await tx.query('SELECT id FROM orders WHERE lower(email) = $1', [email]);
    for (const o of orders) {
      await tx.query(`UPDATE orders SET email = $1, customer_name = NULL, phone = NULL, address = NULL, customer_id = NULL
                       WHERE id = $2`, [`removed-${o.id}@removed.invalid`, o.id]);
    }
    const subs = await tx.query('DELETE FROM subscribers WHERE lower(email) = $1 RETURNING id', [email]);
    const alerts = await tx.query('DELETE FROM stock_alerts WHERE lower(email) = $1 RETURNING id', [email]);
    const cust = await tx.query('DELETE FROM customers WHERE lower(email) = $1 RETURNING id', [email]);
    if (!orders.length && !subs.length && !alerts.length && !cust.length) return { status: 404, error: 'No one with that email.' };
    return { orders: orders.length };
  });
  if (result.error) return res.status(result.status).json({ error: result.error });
  res.json({ ok: true, ordersKeptWithoutName: result.orders });
});
