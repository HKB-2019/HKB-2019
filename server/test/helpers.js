/* Shared setup for the API tests: a real server on a random port, an
 * in-memory Postgres (or TEST_DATABASE_URL), Paystack stubbed, and a signed-in
 * admin on request.
 *
 * Import this before anything from the server, so the environment is set
 * before the database module reads it. */

import { createHmac } from 'node:crypto';

export const PASSWORD = 'a-long-enough-test-password';
export const SECRET_KEY = 'sk_test_' + 'f'.repeat(40);    // the shape of a real key

if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else { process.env.PGLITE_DIR = 'memory://'; delete process.env.DATABASE_URL; }
process.env.PAYSTACK_SECRET_KEY = SECRET_KEY;
process.env.SESSION_SECRET = 'x'.repeat(48);
delete process.env.NODE_ENV;
delete process.env.PAYSTACK_API_BASE;

/** Delivery as the tests assume it: Lagos ₦2,500, Abuja ₦3,500, rest of Nigeria ₦5,000. */
export const DELIVERY = {
  lagos:         { enabled: true,  feeKobo: 250_000 },
  abuja:         { enabled: true,  feeKobo: 350_000 },
  nigeria:       { enabled: true,  feeKobo: 500_000 },
  international: { enabled: false, feeKobo: null }
};

/** A complete, valid set of delivery details. */
export const WHO = {
  name: 'Ada Obi',
  phone: '+234 803 123 4567',
  address: { line1: '12 Admiralty Way', line2: '', city: 'Lekki', state: 'Lagos', country: 'Nigeria' }
};

const realFetch = globalThis.fetch;

export async function startShop() {
  const { hashPassword, clearFailures } = await import('../lib/auth.js');
  process.env.ADMIN_PASSWORD_HASH = hashPassword(PASSWORD);

  const db = await import('../db.js');
  const { seed } = await import('../seed.js');
  const { setSetting } = await import('../lib/settings.js');
  const { checkoutLimit } = await import('../routes/checkout.js');
  const { subscribeLimit } = await import('../routes/subscribe.js');
  const { createApp } = await import('../index.js');
  const { createServer } = await import('node:http');

  const server = createServer(createApp());
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  /** Any request. `json` is sent as a JSON body; `cookie` as the Cookie header. */
  const request = async (path, { cookie, json, headers, ...opts } = {}) => {
    const res = await realFetch(base + path, {
      ...opts,
      headers: {
        ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { cookie } : {}),
        ...(headers ?? {})
      },
      body: json !== undefined ? JSON.stringify(json) : opts.body
    });
    const raw = await res.text();
    let body; try { body = JSON.parse(raw); } catch { body = raw; }
    return { status: res.status, body, raw, headers: res.headers, setCookie: res.headers.getSetCookie?.() ?? [] };
  };

  const resetLimits = () => {
    for (const ip of ['::ffff:127.0.0.1', '127.0.0.1', '::1']) clearFailures(ip);
    checkoutLimit.reset();
    subscribeLimit.reset();
  };

  /** Signed in as the admin; returns the Cookie header to send. */
  const login = async () => {
    resetLimits();
    const res = await request('/api/admin/login', { method: 'POST', json: { password: PASSWORD } });
    if (res.status !== 200) throw new Error(`login failed: ${res.status} ${res.raw}`);
    return res.setCookie.map(c => c.split(';')[0]).join('; ');
  };

  /** A clean shop: catalogue as designed, delivery priced, no orders. */
  const reset = async ({ delivery = DELIVERY } = {}) => {
    await seed({ reset: true });
    await db.query('DELETE FROM settings WHERE key <> $1', ['admin_password_hash']);
    if (delivery) await setSetting('delivery', delivery);
    resetLimits();
    paystack.calls = [];
  };

  const checkout = (body = {}) => request('/api/checkout', { method: 'POST', json: { ...WHO, ...body } });

  const close = async () => {
    server.closeAllConnections?.();
    await new Promise(r => server.close(r));
    globalThis.fetch = realFetch;
    await db.close();
  };

  // The database's exports first, so this file's own `close` (which also
  // stops the server) wins over the database module's.
  return { ...db, base, request, login, reset, resetLimits, checkout, close };
}

/* ------------------------------------------------------------ Paystack */

/**
 * Stand in for Paystack. `paystack.verify` decides what the verify call says:
 * { status, amount } — amount defaults to what the order is due.
 */
export const paystack = { calls: [], initFails: false, verify: { status: 'success', amount: null } };

export function stubPaystack(one) {
  paystack.calls = [];
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (!u.startsWith('https://api.paystack.co')) return realFetch(url, opts);
    paystack.calls.push({ url: u, body: opts.body ? JSON.parse(opts.body) : null });

    if (u.includes('/transaction/initialize')) {
      if (paystack.initFails) return Response.json({ status: false, message: 'nope' }, { status: 400 });
      return Response.json({ status: true, data: {
        authorization_url: 'https://checkout.paystack.com/fake', reference: JSON.parse(opts.body).reference } });
    }
    if (u.includes('/transaction/verify/')) {
      const ref = decodeURIComponent(u.split('/verify/')[1]);
      const order = await one('SELECT subtotal_kobo + shipping_kobo AS due FROM orders WHERE reference = $1', [ref]);
      return Response.json({ status: true, data: {
        id: 99887766, reference: ref, currency: 'NGN',
        status: paystack.verify.status, amount: paystack.verify.amount ?? order?.due ?? 0 } });
    }
    return Response.json({});
  };
}

export const sign = (raw) => createHmac('sha512', SECRET_KEY).update(raw).digest('hex');

/* --------------------------------------------------------------- photos */

/** Bytes that start like a real file of each kind — all the server inspects. */
export const PHOTO = {
  webp: Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBPVP8 '), Buffer.alloc(64, 7)]),
  png:  Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(64, 7)]),
  jpeg: Buffer.concat([Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), Buffer.alloc(64, 7)]),
  svg:  Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>'),
  html: Buffer.from('<!doctype html><script>fetch("/api/admin/orders")</script>'),
  gif:  Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(64, 7)])
};

export const b64 = (buf) => buf.toString('base64');
