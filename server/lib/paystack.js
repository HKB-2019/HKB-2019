import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto';

/* Paystack's REST API, called directly.
 *
 * Not via @paystack/paystack-sdk: version 1.2.1 is published without its dist/
 * directory, so requiring it throws MODULE_NOT_FOUND. The REST surface we need
 * is two calls, and a payment path is a bad place to depend on a broken
 * package. */

/* The address can be pointed at a stand-in Paystack for the browser tests —
 * never in production, where it is always the real one. */
const BASE = process.env.NODE_ENV !== 'production' && process.env.PAYSTACK_API_BASE
  ? process.env.PAYSTACK_API_BASE.replace(/\/$/, '')
  : 'https://api.paystack.co';

/**
 * Whether a real Paystack secret key is set. Placeholders ("none", "xxx", the
 * .env.example sample) count as unset: the key also signs webhooks, so a
 * guessable placeholder would let anyone forge one.
 */
export function paystackConfigured() {
  const key = process.env.PAYSTACK_SECRET_KEY ?? '';
  return /^sk_(test|live)_[A-Za-z0-9]{20,}$/.test(key) && !/x{8}/i.test(key);
}

function secretKey() {
  if (!paystackConfigured()) throw new Error('PAYSTACK_SECRET_KEY is not set to a real Paystack key');
  return process.env.PAYSTACK_SECRET_KEY;
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
  if (!signature || !paystackConfigured()) return false;
  const expected = createHmac('sha512', secretKey()).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Reference the customer and our records share.
 *
 * It is the key to the order's status page, so it must be unguessable: 96
 * bits from the operating system's random source, not Math.random, whose
 * output can be predicted from a few samples. Hex only, because Paystack
 * accepts nothing in a reference but letters, digits, '-', '.' and '='.
 */
export function newReference() {
  return 'masq-' + randomBytes(12).toString('hex');
}
