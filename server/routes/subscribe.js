import { Router } from 'express';
import { query } from '../db.js';
import { rateLimit } from '../lib/limits.js';

export const subscribeRouter = Router();

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 254;

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
