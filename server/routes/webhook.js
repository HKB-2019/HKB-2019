import { Router } from 'express';
import express from 'express';
import { db, transaction } from '../db.js';
import { verifyWebhookSignature, verifyTransaction } from '../lib/paystack.js';
import { releaseStock } from './checkout.js';

export const webhookRouter = Router();

/**
 * POST /api/paystack/webhook
 *
 * Three things have to be true here or a shop loses money:
 *
 *  1. The request really came from Paystack — checked by HMAC over the RAW
 *     body, which is why this route parses `raw` and not `json`.
 *  2. The amount is confirmed with Paystack directly. A webhook body is just
 *     bytes someone POSTed; the verify call is the authority on what was paid.
 *  3. Handling is idempotent. Paystack retries, so the same event arrives more
 *     than once, and fulfilling an order twice is a real cost.
 */
webhookRouter.post(
  '/paystack/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    const raw = req.body;                    // Buffer, untouched
    const signature = req.get('x-paystack-signature');

    if (!verifyWebhookSignature(raw, signature)) {
      console.warn('[webhook] rejected: bad signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    let event;
    try { event = JSON.parse(raw.toString('utf8')); }
    catch { return res.status(400).json({ error: 'Malformed payload' }); }

    const reference = event?.data?.reference ?? null;
    // Paystack does not always send a stable event id, so fall back to
    // something derived from the event itself rather than inventing one.
    const eventId = event?.data?.id
      ? `${event.event}:${event.data.id}`
      : `${event.event}:${reference}`;

    // Record first. If we crash below, the event is still on disk to replay,
    // and the UNIQUE constraint is what stops a retry being handled twice.
    let firstTime = true;
    try {
      db.prepare(`
        INSERT INTO webhook_events (event_id, event_type, reference, payload)
        VALUES (?, ?, ?, ?)
      `).run(eventId, String(event?.event ?? 'unknown'), reference, raw.toString('utf8'));
    } catch (err) {
      if (String(err.message).includes('UNIQUE')) firstTime = false;
      else throw err;
    }

    // Answer Paystack promptly either way — a slow 200 gets retried.
    res.json({ received: true });

    if (!firstTime) {
      console.log(`[webhook] ${eventId} already seen, ignoring`);
      return;
    }

    try {
      if (event.event === 'charge.success') await onChargeSuccess(reference);
      else if (event.event === 'charge.failed') releaseStock(reference, 'failed');

      db.prepare("UPDATE webhook_events SET processed_at = datetime('now') WHERE event_id = ?")
        .run(eventId);
    } catch (err) {
      console.error(`[webhook] handling ${eventId} failed:`, err.message);
      // processed_at stays null so it can be found and replayed.
    }
  }
);

async function onChargeSuccess(reference) {
  const order = db.prepare(`
    SELECT id, status, subtotal_kobo FROM orders WHERE reference = ?
  `).get(reference);

  if (!order) {
    console.warn(`[webhook] charge.success for unknown reference ${reference}`);
    return;
  }
  if (order.status === 'paid') return;        // already fulfilled

  // Ask Paystack what was actually paid rather than believing the payload.
  const data = await verifyTransaction(reference);

  if (data.status !== 'success') {
    console.warn(`[webhook] ${reference} verify says "${data.status}", not fulfilling`);
    return;
  }
  if (data.amount !== order.subtotal_kobo) {
    console.error(
      `[webhook] ${reference} AMOUNT MISMATCH: paid ${data.amount} kobo, ` +
      `order is ${order.subtotal_kobo} kobo. Not fulfilling.`
    );
    return;
  }

  transaction(() => {
    db.prepare(`
      UPDATE orders
         SET status = 'paid', paystack_id = ?, paid_at = datetime('now')
       WHERE id = ? AND status = 'pending'
    `).run(String(data.id), order.id);
  });

  // Stock was already taken at checkout, so payment does not touch it.
  console.log(`[webhook] ${reference} paid, order ${order.id} fulfilled`);
}
