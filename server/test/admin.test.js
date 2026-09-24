/* Tests for the admin door. Every one of these is about someone who should
 * not be able to see your orders not being able to see your orders.
 *
 *   node --test server/test/admin.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';

const DB = './server/test-admin.db';
const PASSWORD = 'a-long-enough-test-password';

process.env.DATABASE_PATH = DB;
process.env.PAYSTACK_SECRET_KEY = 'sk_test_fake';
process.env.SESSION_SECRET = 'x'.repeat(48);

let db, seed, request, server, base;

before(async () => {
  const { hashPassword } = await import('../lib/auth.js');
  process.env.ADMIN_PASSWORD_HASH = hashPassword(PASSWORD);

  ({ db } = await import('../db.js'));
  ({ seed } = await import('../seed.js'));
  const { createApp } = await import('../index.js');
  const { createServer } = await import('node:http');

  server = createServer(createApp());
  await new Promise(r => server.listen(0, r));
  base = `http://127.0.0.1:${server.address().port}`;

  request = async (path, { cookie, ...opts } = {}) => {
    const res = await fetch(base + path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
        ...(opts.headers ?? {})
      }
    });
    const text = await res.text();
    let body; try { body = JSON.parse(text); } catch { body = text; }
    return { status: res.status, body, setCookie: res.headers.getSetCookie?.() ?? [] };
  };
});

after(() => {
  server?.close();
  for (const s of ['', '-shm', '-wal']) { try { rmSync(DB + s); } catch {} }
});

beforeEach(() => seed({ reset: true }));

const login = async (password = PASSWORD) => {
  const res = await request('/api/admin/login', {
    method: 'POST', body: JSON.stringify({ password })
  });
  const cookie = res.setCookie.map(c => c.split(';')[0]).join('; ');
  return { res, cookie };
};

/* ---- the door ------------------------------------------------------- */

const PROTECTED = [
  ['GET',  '/api/admin/orders'],
  ['GET',  '/api/admin/summary'],
  ['GET',  '/api/admin/stock'],
  ['POST', '/api/admin/stock/1'],
  ['POST', '/api/admin/orders/anything/fulfil'],
  ['GET',  '/api/admin/me']
];

test('every admin route refuses an unauthenticated caller', async () => {
  for (const [method, path] of PROTECTED) {
    const res = await request(path, {
      method,
      body: method === 'POST' ? JSON.stringify({ stock: 5 }) : undefined
    });
    assert.equal(res.status, 401, `${method} ${path} must be 401 without a session`);
  }
});

test('a forged session cookie is refused', async () => {
  for (const forged of [
    'masq_admin=totally-made-up',
    'masq_admin=eyJzdWIiOiJhZG1pbiJ9.not-a-real-signature',
    'masq_admin=.',
    'masq_admin='
  ]) {
    const res = await request('/api/admin/orders', { cookie: forged });
    assert.equal(res.status, 401, `forged cookie ${forged} must be refused`);
  }
});

test('a session payload cannot be edited without breaking its signature', async () => {
  const { cookie } = await login();
  const token = cookie.split('=')[1];
  const [payload, sig] = token.split('.');

  // extend the expiry by a year and keep the original signature
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  data.exp = Date.now() + 365 * 24 * 3600 * 1000;
  const tampered = Buffer.from(JSON.stringify(data)).toString('base64url') + '.' + sig;

  const res = await request('/api/admin/orders', { cookie: `masq_admin=${tampered}` });
  assert.equal(res.status, 401, 'a re-signed-by-nobody payload must not be accepted');
});

test('an expired session is refused', async () => {
  const { issueSession } = await import('../lib/auth.js');
  const expired = issueSession('admin', -1000);          // already past
  const res = await request('/api/admin/orders', { cookie: `masq_admin=${expired}` });
  assert.equal(res.status, 401);
});

test('the wrong password is refused and says nothing useful', async () => {
  const { res } = await login('not-the-password');
  assert.equal(res.status, 401);
  assert.match(res.body.error, /incorrect/i);
  assert.equal(res.setCookie.length, 0, 'no cookie may be issued on a failed login');
});

test('repeated wrong passwords lock the attempts out', async () => {
  let locked = false;
  for (let i = 0; i < 12; i++) {
    const { res } = await login('wrong-' + i);
    if (res.status === 429) { locked = true; break; }
  }
  assert.ok(locked, 'brute forcing must hit a lockout');
});

test('the session cookie is HttpOnly and SameSite', async () => {
  // fresh process state: the previous test tripped the lockout for this IP
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');

  const { res } = await login();
  assert.equal(res.status, 200);
  const raw = res.setCookie.join(';');
  assert.match(raw, /HttpOnly/i, 'must be unreadable from JavaScript');
  assert.match(raw, /SameSite/i, 'must not be sent cross-site');
});

/* ---- what the admin can do ------------------------------------------ */

test('signed in, orders and summary are readable', async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
  const { cookie } = await login();

  const orders = await request('/api/admin/orders', { cookie });
  assert.equal(orders.status, 200);
  assert.ok(Array.isArray(orders.body));

  const summary = await request('/api/admin/summary', { cookie });
  assert.equal(summary.status, 200);
  assert.equal(typeof summary.body.revenueKobo, 'number');
  assert.ok(Array.isArray(summary.body.lowStock));
});

test('stock can be set, and nonsense values are refused', async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
  const { cookie } = await login();

  const stock = await request('/api/admin/stock', { cookie });
  const target = stock.body.find(v => v.productId === 'cap');

  const ok = await request(`/api/admin/stock/${target.variantId}`, {
    method: 'POST', cookie, body: JSON.stringify({ stock: 42 })
  });
  assert.equal(ok.status, 200);
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(target.variantId).stock, 42);

  for (const bad of [-1, 1.5, '5', null, undefined, 1e9]) {
    const res = await request(`/api/admin/stock/${target.variantId}`, {
      method: 'POST', cookie, body: JSON.stringify({ stock: bad })
    });
    assert.equal(res.status, 400, `stock ${JSON.stringify(bad)} must be refused`);
  }
  // unchanged by the bad attempts
  assert.equal(db.prepare('SELECT stock FROM variants WHERE id = ?').get(target.variantId).stock, 42);
});

test('only a paid order can be marked fulfilled', async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
  const { cookie } = await login();

  db.prepare(`
    INSERT INTO orders (reference, email, status, subtotal_kobo)
    VALUES ('ref_pending', 'a@example.com', 'pending', 100000)
  `).run();
  db.prepare(`
    INSERT INTO orders (reference, email, status, subtotal_kobo, paid_at)
    VALUES ('ref_paid', 'b@example.com', 'paid', 100000, datetime('now'))
  `).run();

  const pending = await request('/api/admin/orders/ref_pending/fulfil', { method: 'POST', cookie });
  assert.equal(pending.status, 409, 'an unpaid order must not be fulfillable');

  const paid = await request('/api/admin/orders/ref_paid/fulfil', { method: 'POST', cookie });
  assert.equal(paid.status, 200);
  assert.ok(db.prepare("SELECT fulfilled_at FROM orders WHERE reference='ref_paid'").get().fulfilled_at);

  const missing = await request('/api/admin/orders/nope/fulfil', { method: 'POST', cookie });
  assert.equal(missing.status, 404);
});

test('summary counts only paid orders as revenue', async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
  const { cookie } = await login();

  db.prepare("INSERT INTO orders (reference,email,status,subtotal_kobo) VALUES ('p1','a@b.co','paid',2800000)").run();
  db.prepare("INSERT INTO orders (reference,email,status,subtotal_kobo) VALUES ('p2','a@b.co','paid',1400000)").run();
  db.prepare("INSERT INTO orders (reference,email,status,subtotal_kobo) VALUES ('x1','a@b.co','pending',9800000)").run();
  db.prepare("INSERT INTO orders (reference,email,status,subtotal_kobo) VALUES ('x2','a@b.co','failed',9800000)").run();

  const { body } = await request('/api/admin/summary', { cookie });
  assert.equal(body.paidOrders, 2);
  assert.equal(body.revenueKobo, 4_200_000, 'pending and failed orders are not revenue');
  assert.equal(body.pendingPayment, 1);
});
