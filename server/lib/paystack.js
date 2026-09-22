import { createHmac, timingSafeEqual } from 'node:crypto';

/* Paystack's REST API, called directly.
 *
 * Not via @paystack/paystack-sdk: version 1.2.1 is published without its dist/
 * directory, so requiring it throws MODULE_NOT_FOUND. The REST surface we need
 * is two calls, and a payment path is a bad place to depend on a broken
 * package. */

const BASE = 'https://api.paystack.co';

function secretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return key;
}

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error(`Paystack returned non-JSON (${res.status}): ${text.slice(0, 200)}`); }

  if (!res.ok || json.status === false) {
    throw new Error(`Paystack ${method} ${path} failed: ${json.message || res.status}`);
  }
  return json.data;
}

/**
 * Start a transaction. `amountKobo` must already be the server's own figure —
 * never a number that arrived from the browser.
 */
export function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  return call('/transaction/initialize', {
    method: 'POST',
    body: {
      email,
      amount: amountKobo,        // Paystack takes kobo for NGN
      reference,
      currency: 'NGN',
      callback_url: callbackUrl,
      metadata
    }
  });
}

/** Ask Paystack what actually happened. The webhook is a nudge; this is truth. */
export function verifyTransaction(reference) {
  return call(`/transaction/verify/${encodeURIComponent(reference)}`);
}

/**
 * Verify a webhook came from Paystack: HMAC-SHA512 of the RAW request body,
 * keyed with the secret key, compared against the x-paystack-signature header.
 *
 * It must be the raw bytes — re-serialising the parsed JSON changes key order
 * and whitespace, and the signature stops matching. Compared in constant time
 * so the comparison itself cannot be used to guess a valid signature.
 */
export function verifyWebhookSignature(rawBody, signature) {
  if (!signature) return false;
  const expected = createHmac('sha512', secretKey()).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Reference the customer and our records share. Unpredictable on purpose. */
export function newReference() {
  return 'masq_' + Date.now().toString(36) + '_' +
    Math.random().toString(36).slice(2, 10);
}
