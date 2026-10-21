import { one, query } from '../db.js';
import { canSendMail, sendMail, publicOrigin } from './mail.js';
import { orderEmail, naira } from './emails.js';
import { photoUrls } from './catalogue.js';
import { getSetting } from './settings.js';

/* The shop's own emails about an order, once it can send email (mail.js):
 *
 *   receipt   when an order is paid: what was bought, what it cost, where it
 *             is going, and a link to its page. Sent once by itself (claimed
 *             in the database, so the webhook and the customer's page cannot
 *             both send it); the customer can ask for it again, 45 seconds
 *             apart, five times in all.
 *   on its way when the owner marks it sent, with the courier and tracking.
 *
 * Only ever to the email on the order: asking again cannot send it anywhere
 * else. Paystack's own receipt still goes as well. */

export const RESEND_SECONDS = 45;
export const MAX_RECEIPTS = 5;

// One line a piece, as the tests and the server's log read the message.
const what = (i) => `${i.qty} × ${i.name} (${[i.colour, i.size].filter(Boolean).join(', ')}) — ${naira(i.unit_price_kobo * i.qty)}`;

const COLUMNS = `id, reference, email, paid_at, created_at, payment_method, subtotal_kobo, discount_kobo, discount_code,
                 shipping_kobo, gift_kobo, address, courier, tracking, fulfilled_at, receipt_count`;

/* Everything the email shows: the pieces with their photos (full addresses,
 * as an email needs), the shop's links and its contact email. */
async function emailFor(kind, order, req) {
  const origin = publicOrigin(req);
  const rows = await query(`SELECT oi.name, oi.colour, oi.size, oi.qty, oi.unit_price_kobo, p.img, p.image_id
                              FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
                             WHERE oi.order_id = $1 ORDER BY oi.id`, [order.id]);
  const items = rows.map(r => ({ ...r, img: (photoUrls(r).img && origin) ? origin + photoUrls(r).img : '' }));
  const [social, pages] = await Promise.all([getSetting('social'), getSetting('pages')]);
  const contact = String(pages?.CONTACT ?? '').match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/)?.[0] ?? '';
  return { ...orderEmail({ kind, order, items, origin, social, contact }), items };
}

/**
 * Send the receipt for a paid order. `again`: the customer asked (Resend).
 * Resolves to the order's new receipt state, or null when there was nothing
 * to send (not paid, already sent, too soon, too many).
 */
export async function sendReceipt(reference, { again = false, req } = {}) {
  if (!canSendMail()) return null;
  // Claimed first: of two callers at once, one sends.
  const claim = again
    ? `UPDATE orders SET receipt_sent_at = now(), receipt_count = receipt_count + 1
        WHERE reference = $1 AND status = 'paid' AND receipt_count < ${MAX_RECEIPTS}
          AND (receipt_sent_at IS NULL OR receipt_sent_at < now() - interval '${RESEND_SECONDS} seconds')
        RETURNING ${COLUMNS}`
    : `UPDATE orders SET receipt_sent_at = now(), receipt_count = receipt_count + 1
        WHERE reference = $1 AND status = 'paid' AND receipt_sent_at IS NULL AND receipt_count = 0
          AND paid_at > now() - interval '1 day'
        RETURNING ${COLUMNS}`;
  const order = await one(claim, [reference]);
  if (!order) return null;

  try {
    const mail = await emailFor('receipt', order, req);
    await sendMail({
      to: order.email, kind: 'receipt', subject: mail.subject, html: mail.html, text: mail.text,
      message: { heading: 'Thanks for your order!', lines: mail.items.map(what), button: { label: 'View Order', href: mail.link } }
    });
  } catch (err) {
    // Not sent: not counted, so it can be tried again.
    await query(`UPDATE orders SET receipt_count = receipt_count - 1,
                   receipt_sent_at = CASE WHEN receipt_count - 1 = 0 THEN NULL ELSE receipt_sent_at END
                 WHERE id = $1`, [order.id]);
    throw err;
  }
  return receiptState({ receipt_sent_at: new Date(), receipt_count: order.receipt_count });
}

/** What the order page is told: when it went, and whether it can go again. */
export function receiptState(o) {
  if (!canSendMail()) return null;
  const sentAt = o.receipt_sent_at ? new Date(o.receipt_sent_at) : null;
  const wait = sentAt ? Math.max(0, Math.ceil(RESEND_SECONDS - (Date.now() - sentAt.getTime()) / 1000)) : 0;
  return { sentAt: sentAt?.toISOString() ?? null, wait, left: Math.max(0, MAX_RECEIPTS - (o.receipt_count ?? 0)) };
}

/** The note when the owner marks an order sent. Once, and never holds up the admin. */
export async function sendShipped(reference, req) {
  if (!canSendMail()) return;
  const order = await one(`UPDATE orders SET sent_email_at = now()
                            WHERE reference = $1 AND status = 'paid' AND fulfilled_at IS NOT NULL AND sent_email_at IS NULL
                            RETURNING ${COLUMNS}`, [reference]);
  if (!order) return;
  try {
    const mail = await emailFor('shipped', order, req);
    await sendMail({
      to: order.email, kind: 'shipped', subject: mail.subject, html: mail.html, text: mail.text,
      message: { heading: 'Your order is on its way!', button: { label: 'Track Order', href: mail.link },
        lines: [...mail.items.map(what), ...(order.courier ? [`Courier: ${order.courier}`] : []), ...(order.tracking ? [`Tracking number: ${order.tracking}`] : [])] }
    });
  } catch (err) {
    await query('UPDATE orders SET sent_email_at = NULL WHERE id = $1', [order.id]);
    console.error(`[mail] "on its way" for ${reference} not sent:`, err.message);
  }
}
