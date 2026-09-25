import { one, query, transaction } from '../db.js';
import { verifyTransaction, paystackConfigured } from './paystack.js';

/* Everything that moves an order out of `pending` goes through this file.
 *
 * Three different things can learn how a payment went — Paystack's webhook,
 * the customer landing back on /order, and the sweeper below — and they
 * arrive in any order, any number of times, sometimes hours apart. Keeping
 * the decision in one place is what stops them disagreeing. */

/** Minutes before a pending order is first checked with Paystack. */
const CHECK_AFTER_MIN = Number(process.env.CHECK_AFTER_MINUTES || 5);

/** Minutes before an unpaid order gives its stock back. */
const ABANDON_AFTER_MIN = Number(process.env.ABANDON_AFTER_MINUTES || 30);

/** Hours of failed lookups before an order is given up on anyway. */
const GIVE_UP_AFTER_HOURS = 24;

/** Put held stock back and close the order. Safe to call twice. */
export async function releaseStock(reference, status) {
  await transaction(async (tx) => {
    const order = await tx.one(
      'SELECT id, status FROM orders WHERE reference = $1 FOR UPDATE', [reference]);
    if (!order || order.status !== 'pending') return;   // already settled

    const items = await tx.query(
      'SELECT variant_id, qty FROM order_items WHERE order_id = $1', [order.id]);
    for (const i of items) {
      await tx.query('UPDATE variants SET stock = stock + $1 WHERE id = $2', [i.qty, i.variant_id]);
    }
    await tx.query('UPDATE orders SET status = $1 WHERE id = $2', [status, order.id]);
  });
}

/**
 * Record a payment Paystack has confirmed. Returns the order's new status.
 *
 * Usually the order is `pending` and this just marks it paid. The hard case
 * is a payment for an order already given up on — the customer left the
 * Paystack tab open, came back an hour later and paid. Its stock went back on
 * the shelf when it was released, so it is taken again here if it is still
 * there. If someone else bought it in between, the order becomes
 * `refund_due`: the money is real, the piece is gone, and the one thing that
 * must not happen is a silent charge with nothing behind it.
 */
async function confirmPayment(orderId, paystackId) {
  return transaction(async (tx) => {
    // Locked, so the webhook and the sweeper cannot both do this at once.
    const order = await tx.one('SELECT id, status FROM orders WHERE id = $1 FOR UPDATE', [orderId]);

    if (order.status === 'paid' || order.status === 'refund_due') return order.status;

    if (order.status !== 'pending') {
      const items = await tx.query(
        'SELECT variant_id, qty FROM order_items WHERE order_id = $1', [orderId]);

      await tx.query('SAVEPOINT retake');
      let retaken = true;
      for (const i of items) {
        const took = await tx.query(
          'UPDATE variants SET stock = stock - $1 WHERE id = $2 AND stock >= $1 RETURNING id',
          [i.qty, i.variant_id]);
        if (took.length === 0) { retaken = false; break; }
      }

      if (!retaken) {
        await tx.query('ROLLBACK TO SAVEPOINT retake');
        await tx.query(
          `UPDATE orders SET status = 'refund_due', paystack_id = $1, paid_at = now() WHERE id = $2`,
          [paystackId, orderId]);
        console.error(`[orders] order ${orderId} PAID AFTER ITS STOCK WAS SOLD — refund due`);
        return 'refund_due';
      }
    }

    await tx.query(
      `UPDATE orders SET status = 'paid', paystack_id = $1, paid_at = now() WHERE id = $2`,
      [paystackId, orderId]);
    return 'paid';
  });
}

/**
 * Ask Paystack about one order and act on the answer. Returns its status.
 *
 * Paystack's verify endpoint is the authority. A webhook body or a redirect
 * is only a prompt to come and ask — either could be forged.
 *
 *   release   true lets an unpaid order give its stock back; the sweeper
 *             sets it once an order is old enough. The customer's page never
 *             does: a slow bank is not an abandoned basket.
 *   giveUp    true releases even when Paystack cannot be asked, for an order
 *             stuck for a day. If money turns up later, confirmPayment above
 *             handles it.
 */
export async function reconcile(reference, { release = false, giveUp = false, onVerify } = {}) {
  const order = await one(
    'SELECT id, status, subtotal_kobo, shipping_kobo FROM orders WHERE reference = $1', [reference]);
  if (!order) return null;
  if (order.status === 'paid' || order.status === 'refund_due') return order.status;

  let data;
  try {
    data = await verifyTransaction(reference);
    onVerify?.(data);
  } catch (err) {
    console.warn(`[orders] could not verify ${reference}: ${err.message}`);
    if (giveUp && order.status === 'pending') {
      await releaseStock(reference, 'abandoned');
      return 'abandoned';
    }
    return order.status;
  }

  if (data.status === 'success') {
    // What Paystack was asked for: the items plus delivery.
    const due = order.subtotal_kobo + order.shipping_kobo;
    if (data.amount !== due || (data.currency && data.currency !== 'NGN')) {
      console.error(
        `[orders] ${reference} AMOUNT MISMATCH: paid ${data.amount} ${data.currency ?? ''} kobo, ` +
        `order is ${due} kobo. Not marking paid.`);
      return order.status;
    }
    return confirmPayment(order.id, String(data.id));
  }

  if (release && order.status === 'pending' &&
      ['abandoned', 'failed', 'reversed'].includes(data.status)) {
    const status = data.status === 'failed' ? 'failed' : 'abandoned';
    await releaseStock(reference, status);
    return status;
  }

  // ongoing, pending, processing, queued: the customer may still be paying.
  return order.status;
}

/* ------------------------------------------------------------- sweeper */

/**
 * Check every pending order old enough to be worth asking about.
 *
 * This is what catches the two things nobody tells us about: a customer who
 * closed the Paystack tab (Paystack sends nothing for that, and without this
 * their items stay reserved forever), and a payment whose webhook arrived
 * while the server was asleep on a free host.
 */
export async function sweepPending() {
  const rows = await query(`
    SELECT reference,
           created_at < now() - make_interval(mins  => $2) AS stale,
           created_at < now() - make_interval(hours => $3) AS stuck
      FROM orders
     WHERE status = 'pending'
       AND created_at < now() - make_interval(mins => $1)
     ORDER BY id
     LIMIT 100
  `, [CHECK_AFTER_MIN, ABANDON_AFTER_MIN, GIVE_UP_AFTER_HOURS]);

  const outcome = {};
  for (const r of rows) {
    const status = await reconcile(r.reference, { release: r.stale, giveUp: r.stuck });
    outcome[status] = (outcome[status] ?? 0) + 1;
  }
  return { checked: rows.length, outcome };
}

let timer = null;
let sweeping = false;

/** Sweep shortly after boot, then every few minutes while the server is up. */
export function startSweeper({ everyMinutes = 5 } = {}) {
  if (timer || !paystackConfigured()) return;

  const run = async () => {
    if (sweeping) return;
    sweeping = true;
    try {
      const { checked, outcome } = await sweepPending();
      if (checked) console.log(`[sweeper] checked ${checked} pending order(s):`, outcome);
    } catch (err) {
      console.error('[sweeper] failed:', err.message);
    } finally {
      sweeping = false;
    }
  };

  // A free host sleeps when idle, so this interval only runs while awake —
  // which is why it also runs soon after every boot.
  setTimeout(run, 10_000).unref();
  timer = setInterval(run, everyMinutes * 60_000);
  timer.unref();
}
