import { Router } from 'express';
import { one, query } from '../db.js';
import { initializeTransaction, paystackConfigured } from '../lib/paystack.js';
import { rateLimit } from '../lib/limits.js';
import {
  checkAmount, newCode, newGiftReference, isGiftReference, reconcileGift, usableCard, giftNaira,
  cleanGiftCode, cleanDesign
} from '../lib/giftcards.js';

/* Gift cards, for customers: buy one, see it once paid, and check one at
 * checkout. Spending happens in POST /api/checkout (server/routes/checkout.js). */

export const giftCardsRouter = Router();

const isEmail = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
const words = (v, max) => String(v ?? '').replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, max);

/* Each purchase starts a payment, and each check tries a code: both limited. */
export const giftBuyLimit = rateLimit({ windowMs: 10 * 60_000, max: 20, message: 'Too many tries. Please wait a few minutes.' });
export const giftCheckLimit = rateLimit({ windowMs: 10 * 60_000, max: 30, message: 'Too many codes tried. Please wait a few minutes and try again.' });

/* Where Paystack sends a buyer back to: the gift card page, beside /order. */
function callbackUrl() {
  if (process.env.PAYSTACK_CALLBACK_URL) return process.env.PAYSTACK_CALLBACK_URL.replace(/\/order\/?$/, '') + '/gift-card';
  if (process.env.RENDER_EXTERNAL_URL) return process.env.RENDER_EXTERNAL_URL.replace(/\/$/, '') + '/gift-card';
  return undefined;
}

/**
 * POST /api/gift-cards  { amountKobo, email, recipientName?, recipientEmail?, message?, design? }
 * Starts the payment for a card. The card exists from now, but only works
 * once Paystack confirms the money (server/lib/giftcards.js).
 */
giftCardsRouter.post('/gift-cards', giftBuyLimit, async (req, res) => {
  const b = req.body ?? {};
  if (!paystackConfigured()) return res.status(503).json({ error: 'Gift cards are not on sale yet. Please try again soon.' });
  let amount;
  try { amount = checkAmount(b.amountKobo); } catch (err) { return res.status(400).json({ error: err.message }); }
  if (!isEmail(b.email)) return res.status(400).json({ error: 'Please enter your email, for the receipt.' });
  if (b.recipientEmail && !isEmail(b.recipientEmail)) return res.status(400).json({ error: 'That is not an email address for the person receiving it.' });

  const reference = newGiftReference();
  const email = b.email.trim().toLowerCase();
  let card = null;
  for (let tries = 0; !card && tries < 5; tries++) {
    card = await one(`
      INSERT INTO gift_cards (code, amount_kobo, balance_kobo, status, reference, buyer_email,
                              recipient_name, recipient_email, message, design)
      VALUES ($1, $2, 0, 'pending', $3, $4, $5, $6, $7, $8)
      ON CONFLICT (code) DO NOTHING
      RETURNING id`, [newCode(), amount, reference, email, words(b.recipientName, 60) || null,
        b.recipientEmail ? b.recipientEmail.trim().toLowerCase() : null, words(b.message, 300) || null, cleanDesign(b.design)]);
  }
  if (!card) return res.status(500).json({ error: 'Something went wrong. Nothing has been charged.' });

  try {
    const data = await initializeTransaction({
      email, amountKobo: amount, reference, callbackUrl: callbackUrl(),
      metadata: { gift_card: true, custom_fields: [
        { display_name: 'Gift card', variable_name: 'gift_card', value: giftNaira(amount) }
      ] }
    });
    res.json({ reference, authorizationUrl: data.authorization_url, amountKobo: amount });
  } catch (err) {
    await query(`UPDATE gift_cards SET status = 'abandoned' WHERE id = $1`, [card.id]);
    console.error('[gift] paystack initialize failed:', err.message);
    res.status(502).json({ error: 'Could not reach the payment provider. Nothing has been charged.' });
  }
});

/**
 * GET /api/gift-cards/:reference — the buyer's page once Paystack sends them
 * back. The code is shown only once the card is paid for; the reference is
 * long and random, as an order's is, so the link is the key.
 */
giftCardsRouter.get('/gift-cards/:reference', async (req, res) => {
  const { reference } = req.params;
  if (!isGiftReference(reference)) return res.status(404).json({ error: 'Gift card not found.' });
  const load = () => one(`
    SELECT status, code, amount_kobo, balance_kobo, recipient_name, message, design, expires_at
      FROM gift_cards WHERE reference = $1`, [reference]);
  let card = await load();
  if (!card) return res.status(404).json({ error: 'Gift card not found.' });

  let paystackStatus = null;
  if (card.status === 'pending' && paystackConfigured()) {
    await reconcileGift(reference, { onVerify: (d) => { paystackStatus = d.status; } });
    card = await load();
  }
  const live = card.status === 'active';
  res.set('Cache-Control', 'no-store');
  res.json({
    reference,
    status: card.status,
    amountKobo: card.amount_kobo,
    balanceKobo: live ? card.balance_kobo : null,
    code: live ? card.code : null,
    expiresAt: live ? card.expires_at : null,
    recipientName: card.recipient_name,
    message: card.message,
    design: card.design,
    payment: card.status === 'pending' && ['abandoned', 'failed'].includes(paystackStatus) ? 'not_completed' : null
  });
});

/**
 * POST /api/gift-cards/check  { code } — what a card holds, for the bag to
 * show before paying. Nothing is held: checkout checks it again.
 */
giftCardsRouter.post('/gift-cards/check', giftCheckLimit, async (req, res) => {
  const card = await usableCard({ one }, req.body?.code);
  res.json({ code: card.code, balanceKobo: card.balanceKobo, expiresAt: card.expiresAt });
});

/**
 * POST /api/gift-cards/open  { code } — the card as the person given it sees
 * it, from the link the buyer sends (/gift/MASQ-XXXX-XXXX): its colour, the
 * name and message on it, and what is left. The code is the key, as it is at
 * checkout, and tries count against the same limit.
 */
giftCardsRouter.post('/gift-cards/open', giftCheckLimit, async (req, res) => {
  const code = cleanGiftCode(req.body?.code);
  const card = code && await one(`
    SELECT code, status, amount_kobo, balance_kobo, recipient_name, message, design, expires_at
      FROM gift_cards WHERE code = $1 AND status IN ('active', 'cancelled')`, [code]);
  if (!card) return res.status(404).json({ error: 'We could not find a gift card with that code. Check it against the message you were sent.' });
  const expired = card.expires_at && new Date(card.expires_at) <= new Date();
  res.set('Cache-Control', 'no-store');
  res.json({
    code: card.code,
    state: card.status === 'cancelled' ? 'cancelled' : expired ? 'expired' : card.balance_kobo === 0 ? 'spent' : 'active',
    amountKobo: card.amount_kobo,
    balanceKobo: card.balance_kobo,
    expiresAt: card.expires_at,
    recipientName: card.recipient_name,
    message: card.message,
    design: cleanDesign(card.design)
  });
});
