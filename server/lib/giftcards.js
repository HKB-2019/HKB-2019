import { randomInt, randomBytes } from 'node:crypto';
import { one, query, transaction } from '../db.js';
import { verifyTransaction } from './paystack.js';

/* Gift cards: what one may be bought for, its code, and every movement of
 * its balance.
 *
 * A card is money held for the customer. It is spent at checkout like cash,
 * on pieces and delivery, after any discount code. The amount it pays is
 * taken off the card when the order is placed and given back if that order
 * is never paid (as held stock is), so a card cannot be spent twice. */

export const PRESETS_KOBO = [10_000_00, 25_000_00, 50_000_00, 100_000_00];
export const MIN_KOBO = 5_000_00;
export const MAX_KOBO = 500_000_00;
export const LASTS_MONTHS = 12;
/* The colours a card comes in (src/components/GiftCard.jsx draws them). */
export const DESIGNS = ['violet', 'night', 'teal', 'clay', 'rose'];
export const cleanDesign = (v) => DESIGNS.includes(v) ? v : 'violet';

function fail(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

/* No 0/O, 1/I/L: a code is read off a phone and typed. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function newCode() {
  const pick = (n) => Array.from({ length: n }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
  return `MASQ-${pick(4)}-${pick(4)}`;
}

/** "masq 7k3p q9xd" → "MASQ-7K3P-Q9XD", or null if it cannot be one. */
export function cleanGiftCode(v) {
  const raw = String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const body = raw.startsWith('MASQ') ? raw.slice(4) : raw;
  if (!/^[A-Z0-9]{8}$/.test(body)) return null;
  return `MASQ-${body.slice(0, 4)}-${body.slice(4)}`;
}

export const newGiftReference = () => 'gift-' + randomBytes(12).toString('hex');
export const isGiftReference = (ref) => /^gift-[a-f0-9]{24}$/.test(String(ref ?? ''));

/** A whole-naira amount a customer may buy: one of the four, or ₦5,000–₦500,000. */
export function checkAmount(kobo) {
  if (!Number.isInteger(kobo) || kobo % 100 !== 0 || kobo < MIN_KOBO || kobo > MAX_KOBO) {
    throw fail(400, 'Choose an amount from ₦5,000 to ₦500,000, in whole naira.');
  }
  return kobo;
}

const naira = (kobo) => `₦${(kobo / 100).toLocaleString('en-NG')}`;

/**
 * The card a code names, checked for spending, as { id, code, balanceKobo, expiresAt }.
 * With `tx` and `lock`, the row is locked for the rest of the transaction.
 * Throws a 400 a customer can act on.
 */
export async function usableCard(db, rawCode, { lock = false } = {}) {
  const code = cleanGiftCode(rawCode);
  if (!code) throw fail(400, 'That is not a gift card code. It looks like MASQ-XXXX-XXXX.');
  const card = await db.one(
    `SELECT id, code, status, balance_kobo, expires_at FROM gift_cards WHERE code = $1${lock ? ' FOR UPDATE' : ''}`, [code]);
  if (!card || card.status === 'pending' || card.status === 'abandoned') throw fail(400, `${code} is not a gift card we recognise.`);
  if (card.status === 'cancelled') throw fail(400, `${code} has been cancelled.`);
  if (card.expires_at && new Date(card.expires_at) <= new Date()) throw fail(400, `${code} ran out on ${new Date(card.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`);
  if (card.balance_kobo <= 0) throw fail(400, `${code} has been spent.`);
  return { id: card.id, code: card.code, balanceKobo: card.balance_kobo, expiresAt: card.expires_at };
}

/** Take up to `dueKobo` off a locked card for an order. Returns what it took. */
export async function spendCard(tx, card, dueKobo) {
  const take = Math.min(card.balanceKobo, dueKobo);
  if (take <= 0) return 0;
  await tx.query('UPDATE gift_cards SET balance_kobo = balance_kobo - $1 WHERE id = $2', [take, card.id]);
  return take;
}

export async function recordSpend(tx, cardId, orderId, kobo) {
  await tx.query(`INSERT INTO gift_card_uses (gift_card_id, order_id, amount_kobo, kind) VALUES ($1, $2, $3, 'spend')`,
    [cardId, orderId, -kobo]);
}

/** Give an order's gift amount back to its card: the order will not be paid, or was refunded. */
export async function returnToCard(tx, order) {
  if (!order.gift_card_id || !order.gift_kobo) return;
  await tx.query('UPDATE gift_cards SET balance_kobo = balance_kobo + $1 WHERE id = $2', [order.gift_kobo, order.gift_card_id]);
  await tx.query(`INSERT INTO gift_card_uses (gift_card_id, order_id, amount_kobo, kind) VALUES ($1, $2, $3, 'return')`,
    [order.gift_card_id, order.id, order.gift_kobo]);
}

/**
 * Take an order's gift amount again: it was given back when the order was
 * let go, and the customer has paid after all. False if the card no longer
 * holds that much (spent elsewhere in between) — then the order is a refund.
 */
export async function retakeFromCard(tx, order) {
  if (!order.gift_card_id || !order.gift_kobo) return true;
  const took = await tx.query(
    'UPDATE gift_cards SET balance_kobo = balance_kobo - $1 WHERE id = $2 AND balance_kobo >= $1 RETURNING id',
    [order.gift_kobo, order.gift_card_id]);
  if (!took.length) return false;
  await recordSpend(tx, order.gift_card_id, order.id, order.gift_kobo);
  return true;
}

/* --------------------------------------------------------- buying one */

/** Make a card live: the money for it has arrived. Safe to call twice. */
async function activate(cardId, paystackId) {
  return transaction(async (tx) => {
    const card = await tx.one('SELECT id, status FROM gift_cards WHERE id = $1 FOR UPDATE', [cardId]);
    if (card.status === 'active' || card.status === 'cancelled') return card.status;
    await tx.query(`
      UPDATE gift_cards SET status = 'active', balance_kobo = amount_kobo, paystack_id = $1,
             activated_at = now(), expires_at = now() + make_interval(months => $2)
       WHERE id = $3`, [paystackId, LASTS_MONTHS, cardId]);
    return 'active';
  });
}

/**
 * Ask Paystack about a card's purchase and act on it, as orders do
 * (server/lib/orders.js): verify is the authority, never the webhook body.
 * `release` lets an unpaid purchase be marked abandoned. Returns its status.
 */
export async function reconcileGift(reference, { release = false, onVerify } = {}) {
  const card = await one('SELECT id, status, amount_kobo FROM gift_cards WHERE reference = $1', [reference]);
  if (!card) return null;
  if (card.status === 'active' || card.status === 'cancelled') return card.status;

  let data;
  try {
    data = await verifyTransaction(reference);
    onVerify?.(data);
  } catch (err) {
    console.warn(`[gift] could not verify ${reference}: ${err.message}`);
    return card.status;
  }

  if (data.status === 'success') {
    if (data.amount !== card.amount_kobo || (data.currency && data.currency !== 'NGN')) {
      console.error(`[gift] ${reference} AMOUNT MISMATCH: paid ${data.amount}, card is ${card.amount_kobo}. Not activated.`);
      return card.status;
    }
    return activate(card.id, String(data.id));
  }
  if (release && card.status === 'pending' && ['abandoned', 'failed', 'reversed'].includes(data.status)) {
    await query(`UPDATE gift_cards SET status = 'abandoned' WHERE id = $1 AND status = 'pending'`, [card.id]);
    return 'abandoned';
  }
  return card.status;
}

/** Pending purchases worth asking Paystack about (the sweeper's share). */
export async function pendingGiftReferences({ checkAfterMin, abandonAfterMin }) {
  return query(`
    SELECT reference, created_at < now() - make_interval(mins => $2) AS stale
      FROM gift_cards
     WHERE status = 'pending' AND reference IS NOT NULL
       AND created_at < now() - make_interval(mins => $1)
     ORDER BY id LIMIT 100`, [checkAfterMin, abandonAfterMin]);
}

/** A card as the owner sees it. */
export function shapeCard(c, uses = []) {
  const expired = c.status === 'active' && c.expires_at && new Date(c.expires_at) <= new Date();
  return {
    id: c.id,
    code: c.code,
    amountKobo: c.amount_kobo,
    balanceKobo: c.balance_kobo,
    state: c.status === 'cancelled' ? 'cancelled' : expired ? 'expired' : c.balance_kobo === 0 ? 'spent' : 'active',
    madeBy: c.reference ? 'customer' : 'shop',
    buyerEmail: c.buyer_email,
    recipientName: c.recipient_name,
    recipientEmail: c.recipient_email,
    message: c.message,
    design: c.design,
    note: c.note,
    activatedAt: c.activated_at,
    expiresAt: c.expires_at,
    uses: uses.map(u => ({ orderReference: u.reference, amountKobo: u.amount_kobo, kind: u.kind, at: u.created_at }))
  };
}

export { naira as giftNaira };
