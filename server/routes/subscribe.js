import { Router } from 'express';
import { one, query } from '../db.js';
import { onSale } from '../lib/catalogue.js';
import { rateLimit } from '../lib/limits.js';
import { isEmail } from '../lib/validate.js';

export const subscribeRouter = Router();


export const subscribeLimit = rateLimit({
  windowMs: 10 * 60_000,
  max: 10,
  message: 'Too many sign-ups from here. Please try again later.'
});

/**
 * POST /api/subscribe — join the list.
 *
 * Answers the same whether the address is new or already on the list, so the
 * form cannot be used to find out who has signed up.
 */
subscribeRouter.post('/subscribe', subscribeLimit, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  await query('INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
  res.json({ ok: true });
});

/**
 * POST /api/stock-alerts  { productId, colour, size, email }
 * "Tell me when it's back" for a size that has sold out. Only for a size that
 * exists and is at zero — anything else is a mistake, or someone fishing.
 * Shares the sign-up limit: it is the same kind of form.
 */
subscribeRouter.post('/stock-alerts', subscribeLimit, async (req, res) => {
  const email = String(req.body?.email ?? '').trim().toLowerCase();
  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  const productId = String(req.body?.productId ?? '');
  const size = String(req.body?.size ?? '');
  const colour = String(req.body?.colour ?? '');
  const v = await one(`
    SELECT v.stock FROM variants v JOIN products p ON p.id = v.product_id
     WHERE p.id = $1 AND v.colour = $2 AND v.size = $3 AND ${onSale()}
  `, [productId, colour, size]);
  if (!v) return res.status(404).json({ error: 'That piece is not available.' });
  const what = colour ? `${colour}, ${size}` : size;
  if (v.stock > 0) return res.status(409).json({ error: `${what} is in stock — you can buy it now.` });

  await query(`INSERT INTO stock_alerts (product_id, colour, size, email) VALUES ($1, $2, $3, $4)
               ON CONFLICT (product_id, colour, size, email) DO NOTHING`, [productId, colour, size, email]);
  res.json({ ok: true });
});
