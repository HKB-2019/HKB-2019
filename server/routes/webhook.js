import { Router } from 'express';
import express from 'express';
import { one, query } from '../db.js';
import { verifyWebhookSignature } from '../lib/paystack.js';
import { reconcile, releaseStock } from '../lib/orders.js';

export const webhookRouter = Router();

/**
 * POST /api/paystack/webhook
 *
 * Three things have to be true here or a shop loses money:
 *
 *  1. The request really came from Paystack — checked by HMAC over the RAW
 *     body, which is why this route parses `raw` and not `json`.
 *  2. The amount is confirmed with Paystack directly. A webhook body is just
 *     bytes someone POSTed; the verify call inside reconcile() is the
 *     authority on what was paid.
 *  3. Handling is idempotent. Paystack retries, so the same event arrives more
 *     than once, and fulfilling an order twice is a real cost.
 */
webhookRouter.post(
  '/paystack/webhook',
  express.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    const raw = req.body;                    // Buffer, untouched
    const signature = req.get('x-paystack-signature');

    if (!Buffer.isBuffer(raw) || !verifyWebhookSignature(raw, signature)) {
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

    // Record first. If we crash below, the event is still stored to replay,
    // and the UNIQUE event_id is what stops a retry being handled twice:
    // a duplicate inserts nothing and so returns no row.
    const recorded = await one(`
      INSERT INTO webhook_events (event_id, event_type, reference, payload)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (event_id) DO NOTHING
      RETURNING id
    `, [eventId, String(event?.event ?? 'unknown'), reference, raw.toString('utf8')]);

    // Answer Paystack promptly either way — a slow 200 gets retried.
    res.json({ received: true });

    if (!recorded) {
      console.log(`[webhook] ${eventId} already seen, ignoring`);
      return;
    }

    try {
      if (event.event === 'charge.success') {
        const status = await reconcile(reference);
        if (status === null) console.warn(`[webhook] charge.success for unknown reference ${reference}`);
        else console.log(`[webhook] ${reference} → ${status}`);
      } else if (event.event === 'charge.failed') {
        // If the customer retries with another card and it goes through,
        // reconcile() takes the stock back — or flags a refund if it has gone.
        await releaseStock(reference, 'failed');
      }

      await query('UPDATE webhook_events SET processed_at = now() WHERE event_id = $1', [eventId]);
    } catch (err) {
      console.error(`[webhook] handling ${eventId} failed:`, err.message);
      // processed_at stays null so it can be found and replayed.
    }
  }
);
