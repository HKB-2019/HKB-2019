import { Router } from 'express';
import { one, query } from '../db.js';
import { requireAdmin } from '../lib/auth.js';
import { newCode, shapeCard, cleanDesign, LASTS_MONTHS, MAX_KOBO } from '../lib/giftcards.js';

/* GIFT CARDS in the admin (under SALES): every card bought or made, what is
 * left on it and where it was spent; make one (a giveaway, a goodwill
 * gesture, store credit for a return); cancel one. */

export const adminGiftCardsRouter = Router();
adminGiftCardsRouter.use('/admin/gift-cards', requireAdmin);

function fail(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

const words = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

async function cardsWithUses(where = '', params = []) {
  const cards = await query(`
    SELECT * FROM gift_cards
     WHERE status IN ('active', 'cancelled') ${where}
     ORDER BY COALESCE(activated_at, created_at) DESC, id DESC
     LIMIT 1000`, params);
  const uses = cards.length ? await query(`
    SELECT u.gift_card_id, u.amount_kobo, u.kind, u.created_at, o.reference
      FROM gift_card_uses u LEFT JOIN orders o ON o.id = u.order_id
     WHERE u.gift_card_id = ANY($1::int[]) ORDER BY u.id`, [cards.map(c => c.id)]) : [];
  const owed = cards.length ? await query(`
    SELECT gift_card_id, reference, amount_kobo, email, paid_at FROM gift_card_topups
     WHERE status = 'refund_due' AND gift_card_id = ANY($1::int[]) ORDER BY id`, [cards.map(c => c.id)]) : [];
  return cards.map(c => shapeCard(c, uses.filter(u => u.gift_card_id === c.id), owed.filter(t => t.gift_card_id === c.id)));
}

adminGiftCardsRouter.get('/admin/gift-cards', async (_req, res) => {
  const cards = await cardsWithUses();
  const live = cards.filter(c => c.state === 'active');
  const toppedUp = await one(`SELECT COALESCE(SUM(amount_kobo), 0)::int AS kobo FROM gift_card_topups WHERE status = 'paid'`);
  res.json({
    cards,
    totals: {
      soldCount: cards.filter(c => c.madeBy === 'customer').length,
      // Money in for cards: what they were bought for, and every top-up since.
      soldKobo: cards.filter(c => c.madeBy === 'customer').reduce((n, c) => n + c.amountKobo, 0) + toppedUp.kobo,
      // Money customers hold on cards that still work: owed in goods.
      outstandingKobo: live.reduce((n, c) => n + c.balanceKobo, 0),
      liveCount: live.length
    }
  });
});

/** POST /admin/gift-cards  { amountKobo, recipientName?, note?, design? } — a card made by the shop, live at once. */
adminGiftCardsRouter.post('/admin/gift-cards', async (req, res) => {
  const b = req.body ?? {};
  const amount = b.amountKobo;
  if (!Number.isInteger(amount) || amount % 100 !== 0 || amount < 500_00 || amount > MAX_KOBO) {
    throw fail(400, 'Choose an amount from ₦500 to ₦500,000, in whole naira.');
  }
  let card = null;
  for (let tries = 0; !card && tries < 5; tries++) {
    card = await one(`
      INSERT INTO gift_cards (code, amount_kobo, balance_kobo, status, recipient_name, note, design, activated_at, expires_at)
      VALUES ($1, $2, $2, 'active', $3, $4, $6, now(), now() + make_interval(months => $5))
      ON CONFLICT (code) DO NOTHING
      RETURNING *`, [newCode(), amount, words(b.recipientName, 60) || null, words(b.note, 200) || null, LASTS_MONTHS, cleanDesign(b.design)]);
  }
  if (!card) throw fail(500, 'Could not make a card. Try again.');
  res.status(201).json(shapeCard(card));
});

/** POST /admin/gift-cards/:id/cancel — stops a card working. What was left on it stays on the record. */
adminGiftCardsRouter.post('/admin/gift-cards/:id/cancel', async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const card = await one(`UPDATE gift_cards SET status = 'cancelled' WHERE id = $1 AND status = 'active' RETURNING id`, [id]);
  if (!card) throw fail(404, 'No working gift card with that number.');
  const [shaped] = await cardsWithUses('AND id = $1', [id]);
  res.json(shaped);
});
