import { Router } from 'express';
import { one, query } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { cleanCode, describe } from '../lib/discounts.js';
import { toCsv } from '../lib/csv.js';

/* The owner's view of money and demand: what has sold, the discount codes,
 * and who is waiting for a sold-out size to come back. */

export const adminSalesRouter = Router();
// Listed in full: a prefix covers "/admin/stock-alerts/1" but not "/admin/stock-alerts.csv".
adminSalesRouter.use(['/admin/sales', '/admin/discounts', '/admin/stock-alerts', '/admin/stock-alerts.csv'], requireAdmin);

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

const iso = (d) => (d ? new Date(d).toISOString() : null);

/* ---------------------------------------------------------------- sales */

const WEEKS = 12;
const LAGOS_OFFSET_MS = 60 * 60_000;      // WAT is UTC+1 all year: no clock changes

/** Monday 00:00 in Lagos, as a UTC instant, for the week containing `t`. */
function weekStart(t) {
  const local = new Date(new Date(t).getTime() + LAGOS_OFFSET_MS);
  const day = (local.getUTCDay() + 6) % 7;                     // Monday = 0
  local.setUTCHours(0, 0, 0, 0);
  local.setUTCDate(local.getUTCDate() - day);
  return local.getTime() - LAGOS_OFFSET_MS;
}

/**
 * Paid orders only: a pending, failed, abandoned or refunded order is not
 * money the shop has. Amounts are what customers paid, delivery included,
 * after discounts.
 */
adminSalesRouter.get('/admin/sales', async (_req, res) => {
  const thisWeek = weekStart(Date.now());
  const from = thisWeek - (WEEKS - 1) * 7 * 86_400_000;

  const recent = await query(`
    SELECT paid_at, subtotal_kobo - discount_kobo + shipping_kobo AS total
      FROM orders WHERE status = 'paid' AND paid_at >= $1
  `, [new Date(from).toISOString()]);

  const weeks = Array.from({ length: WEEKS }, (_, i) => ({
    start: new Date(from + i * 7 * 86_400_000).toISOString(), revenueKobo: 0, orders: 0
  }));
  for (const o of recent) {
    const i = Math.round((weekStart(o.paid_at) - from) / (7 * 86_400_000));
    if (weeks[i]) { weeks[i].revenueKobo += o.total; weeks[i].orders += 1; }
  }

  const totals = await one(`
    SELECT COUNT(*) AS orders,
           COALESCE(SUM(subtotal_kobo - discount_kobo + shipping_kobo), 0) AS revenue_kobo,
           COALESCE(SUM(discount_kobo), 0) AS discount_kobo,
           COALESCE(SUM(shipping_kobo), 0) AS shipping_kobo
      FROM orders WHERE status = 'paid'
  `);

  const pieces = await query(`
    SELECT i.product_id, i.name, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price_kobo) AS revenue_kobo
      FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status = 'paid'
     GROUP BY i.product_id, i.name
     ORDER BY qty DESC, revenue_kobo DESC
     LIMIT 8
  `);

  const sizes = await query(`
    SELECT i.size, SUM(i.qty) AS qty
      FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status = 'paid'
     GROUP BY i.size
     ORDER BY qty DESC, i.size
     LIMIT 8
  `);

  // Best-selling colours, for pieces sold in colours: what to reorder.
  const colours = await query(`
    SELECT i.name, i.colour, SUM(i.qty) AS qty
      FROM order_items i JOIN orders o ON o.id = i.order_id
     WHERE o.status = 'paid' AND i.colour <> ''
     GROUP BY i.name, i.colour
     ORDER BY qty DESC, i.name, i.colour
     LIMIT 8
  `);

  const codes = await query(`
    SELECT discount_code AS code, COUNT(*) AS orders, SUM(discount_kobo) AS discount_kobo
      FROM orders WHERE status = 'paid' AND discount_code IS NOT NULL
     GROUP BY discount_code ORDER BY orders DESC
  `);

  res.json({
    weeks,
    totals: {
      orders: totals.orders,
      revenueKobo: totals.revenue_kobo,
      discountKobo: totals.discount_kobo,
      averageKobo: totals.orders ? Math.round(totals.revenue_kobo / totals.orders) : 0
    },
    pieces: pieces.map(p => ({ productId: p.product_id, name: p.name, qty: p.qty, revenueKobo: p.revenue_kobo })),
    sizes: sizes.map(s => ({ size: s.size, qty: s.qty })),
    colours: colours.map(c => ({ name: c.name, colour: c.colour, qty: c.qty })),
    codes: codes.map(c => ({ code: c.code, orders: c.orders, discountKobo: c.discount_kobo }))
  });
});

/* ------------------------------------------------------- discount codes */

function shapeCode(r) {
  return {
    code: r.code, kind: r.kind, amount: r.amount, label: describe(r),
    minSpendKobo: r.min_spend_kobo, maxUses: r.max_uses, uses: r.uses,
    endsAt: iso(r.ends_at), active: r.active,
    ended: Boolean(r.ends_at && new Date(r.ends_at) <= new Date()),
    usedUp: r.max_uses !== null && r.uses >= r.max_uses
  };
}

const wholeNaira = (v, label, { min = 0, max = 1_000_000 } = {}) => {
  if (!Number.isInteger(v) || v < min || v > max) {
    throw fail(400, `${label} must be a whole number of naira from ₦${min.toLocaleString('en-NG')} to ₦${max.toLocaleString('en-NG')}.`);
  }
  return v * 100;
};

function cleanEnd(v) {
  if (v === null || v === undefined || v === '') return null;
  const d = new Date(v);
  if (typeof v !== 'string' || Number.isNaN(d.getTime())) throw fail(400, 'That end date is not a date.');
  if (d.getTime() > Date.now() + 2 * 365 * 86_400_000) throw fail(400, 'Choose an end date within two years.');
  return d.toISOString();
}

function cleanMaxUses(v) {
  if (v === null || v === undefined || v === '') return null;
  if (!Number.isInteger(v) || v < 1 || v > 100_000) throw fail(400, 'The limit must be a whole number of uses, 1 or more.');
  return v;
}

adminSalesRouter.get('/admin/discounts', async (_req, res) => {
  const rows = await query('SELECT * FROM discount_codes ORDER BY active DESC, created_at DESC');
  res.json(rows.map(shapeCode));
});

/**
 * Create a code.
 *   kind 'percent': amount is 1–90 (per cent off the items)
 *   kind 'fixed':   amount is whole naira off the items
 */
adminSalesRouter.post('/admin/discounts', async (req, res) => {
  const b = req.body ?? {};
  const code = cleanCode(b.code);
  if (b.kind !== 'percent' && b.kind !== 'fixed') throw fail(400, 'Choose per cent off or naira off.');
  let amount;
  if (b.kind === 'percent') {
    if (!Number.isInteger(b.amount) || b.amount < 1 || b.amount > 90) throw fail(400, 'Per cent off must be a whole number from 1 to 90.');
    amount = b.amount;
  } else {
    amount = wholeNaira(b.amount, 'Naira off', { min: 100 });
  }
  const minSpend = b.minSpendNaira ? wholeNaira(b.minSpendNaira, 'The minimum spend') : 0;
  const maxUses = cleanMaxUses(b.maxUses);
  const endsAt = cleanEnd(b.endsAt);

  const made = await one(`
    INSERT INTO discount_codes (code, kind, amount, min_spend_kobo, max_uses, ends_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (code) DO NOTHING
    RETURNING *
  `, [code, b.kind, amount, minSpend, maxUses, endsAt]);
  if (!made) throw fail(409, `${code} already exists.`);
  res.status(201).json(shapeCode(made));
});

/** Switch a code on or off, or change its end date or limit. Its value is fixed once made. */
adminSalesRouter.patch('/admin/discounts/:code', async (req, res) => {
  const b = req.body ?? {};
  const sets = [];
  const params = [];
  const set = (col, v) => { params.push(v); sets.push(`${col} = $${params.length}`); };
  if ('active' in b) {
    if (typeof b.active !== 'boolean') throw fail(400, 'On or off.');
    set('active', b.active);
  }
  if ('endsAt' in b) set('ends_at', cleanEnd(b.endsAt));
  if ('maxUses' in b) set('max_uses', cleanMaxUses(b.maxUses));
  if (!sets.length) throw fail(400, 'Nothing to change.');
  params.push(String(req.params.code).toUpperCase());
  const row = await one(`UPDATE discount_codes SET ${sets.join(', ')} WHERE code = $${params.length} RETURNING *`, params);
  if (!row) throw fail(404, 'That code does not exist.');
  res.json(shapeCode(row));
});

/** Delete a code. Orders that used it keep its name and what it took off. */
adminSalesRouter.delete('/admin/discounts/:code', async (req, res) => {
  const row = await one('DELETE FROM discount_codes WHERE code = $1 RETURNING code', [String(req.params.code).toUpperCase()]);
  if (!row) throw fail(404, 'That code does not exist.');
  res.json({ ok: true });
});

/* --------------------------------------------------- back-in-stock list */

const ALERTS = `
  SELECT a.id, a.product_id, a.colour, a.size, a.email, a.created_at, p.name, v.stock
    FROM stock_alerts a
    JOIN products p ON p.id = a.product_id
    LEFT JOIN variants v ON v.product_id = a.product_id AND v.colour = a.colour AND v.size = a.size
   ORDER BY p.position, p.id, a.colour, a.size, a.id
`;

/** Grouped by piece, colour and size, with whether that one is back in stock now. */
adminSalesRouter.get('/admin/stock-alerts', async (_req, res) => {
  const rows = await query(ALERTS);
  const groups = [];
  for (const r of rows) {
    let g = groups.at(-1);
    if (!g || g.productId !== r.product_id || g.colour !== (r.colour || null) || g.size !== r.size) {
      g = { productId: r.product_id, name: r.name, colour: r.colour || null, size: r.size, stock: r.stock ?? 0, people: [] };
      groups.push(g);
    }
    g.people.push({ id: r.id, email: r.email, askedAt: iso(r.created_at) });
  }
  res.json(groups);
});

adminSalesRouter.get('/admin/stock-alerts.csv', async (_req, res) => {
  const rows = await query(ALERTS);
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="masq-waiting-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store'
  });
  res.send(toCsv(['Email', 'Piece', 'Colour', 'Size', 'In stock now', 'Asked'],
    rows.map(r => [r.email, r.name, r.colour, r.size, r.stock ?? 0, iso(r.created_at)])));
});

/** Clear one size's waiting list — once those people have been told. */
adminSalesRouter.post('/admin/stock-alerts/clear', async (req, res) => {
  const productId = String(req.body?.productId ?? '');
  const colour = String(req.body?.colour ?? '');
  const size = String(req.body?.size ?? '');
  const gone = await query('DELETE FROM stock_alerts WHERE product_id = $1 AND colour = $2 AND size = $3 RETURNING id',
    [productId, colour, size]);
  res.json({ ok: true, cleared: gone.length });
});

/** Take one person off a waiting list, if they ask. */
adminSalesRouter.delete('/admin/stock-alerts/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 2_147_483_647) throw fail(400, 'Bad id.');
  const row = await one('DELETE FROM stock_alerts WHERE id = $1 RETURNING id', [id]);
  if (!row) throw fail(404, 'Already gone.');
  res.json({ ok: true });
});
