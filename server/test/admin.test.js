/* Tests for the admin door. Every one of these is about someone who should
 * not be able to see your orders not being able to see your orders.
 *
 *   node --test server/test/admin.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

const PASSWORD = 'a-long-enough-test-password';

// In-memory Postgres by default. Set TEST_DATABASE_URL to run the same tests
// against a real server — it must be a throwaway database: every test wipes it.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
else { process.env.PGLITE_DIR = 'memory://'; delete process.env.DATABASE_URL; }
process.env.PAYSTACK_SECRET_KEY = 'sk_test_' + 'f'.repeat(40);
process.env.SESSION_SECRET = 'x'.repeat(48);

let one, query, seed, request, server, base;

before(async () => {
  const { hashPassword } = await import('../lib/auth.js');
  process.env.ADMIN_PASSWORD_HASH = hashPassword(PASSWORD);

  ({ one, query } = await import('../db.js'));
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

after(async () => {
  server?.close();
  const { close } = await import('../db.js');
  await close();
});

beforeEach(async () => { await seed({ reset: true }); });

const stockOfVariant = async (id) => (await one('SELECT stock FROM variants WHERE id = $1', [id])).stock;

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
  assert.equal(await stockOfVariant(target.variantId), 42);

  for (const bad of [-1, 1.5, '5', null, undefined, 1e9]) {
    const res = await request(`/api/admin/stock/${target.variantId}`, {
      method: 'POST', cookie, body: JSON.stringify({ stock: bad })
    });
    assert.equal(res.status, 400, `stock ${JSON.stringify(bad)} must be refused`);
  }
  // unchanged by the bad attempts
  assert.equal(await stockOfVariant(target.variantId), 42);

  // an id Postgres cannot even hold as an integer is a bad request, not a crash
  for (const id of ['99999999999', 'abc', '0']) {
    const res = await request(`/api/admin/stock/${id}`, {
      method: 'POST', cookie, body: JSON.stringify({ stock: 1 })
    });
    assert.equal(res.status, 400, `variant id ${id} must be refused`);
  }
  const missing = await request('/api/admin/stock/424242', {
    method: 'POST', cookie, body: JSON.stringify({ stock: 1 })
  });
  assert.equal(missing.status, 404);
});

test('only a paid order can be marked fulfilled', async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
  const { cookie } = await login();

  await query(`
    INSERT INTO orders (reference, email, status, subtotal_kobo)
    VALUES ('ref_pending', 'a@example.com', 'pending', 100000)
  `);
  await query(`
    INSERT INTO orders (reference, email, status, subtotal_kobo, paid_at)
    VALUES ('ref_paid', 'b@example.com', 'paid', 100000, now())
  `);
  await query(`
    INSERT INTO orders (reference, email, status, subtotal_kobo, paid_at)
    VALUES ('ref_refund', 'c@example.com', 'refund_due', 100000, now())
  `);

  const pending = await request('/api/admin/orders/ref_pending/fulfil', { method: 'POST', cookie });
  assert.equal(pending.status, 409, 'an unpaid order must not be fulfillable');

  const paid = await request('/api/admin/orders/ref_paid/fulfil', { method: 'POST', cookie });
  assert.equal(paid.status, 200);
  assert.ok((await one("SELECT fulfilled_at FROM orders WHERE reference = 'ref_paid'")).fulfilled_at);

  const refund = await request('/api/admin/orders/ref_refund/fulfil', { method: 'POST', cookie });
  assert.equal(refund.status, 409, 'an order owed a refund must not be marked sent');

  const missing = await request('/api/admin/orders/nope/fulfil', { method: 'POST', cookie });
  assert.equal(missing.status, 404);
});

test('summary counts only paid orders as revenue', async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
  const { cookie } = await login();

  await query(`
    INSERT INTO orders (reference, email, status, subtotal_kobo) VALUES
      ('p1', 'a@b.co', 'paid',       2800000),
      ('p2', 'a@b.co', 'paid',       1400000),
      ('x1', 'a@b.co', 'pending',    9800000),
      ('x2', 'a@b.co', 'failed',     9800000),
      ('x3', 'a@b.co', 'refund_due', 9800000)
  `);

  const { body } = await request('/api/admin/summary', { cookie });
  assert.equal(body.paidOrders, 2);
  assert.equal(body.revenueKobo, 4_200_000, 'pending, failed and refunded orders are not revenue');
  assert.equal(typeof body.revenueKobo, 'number', 'a number, not the string Postgres would send');
  assert.equal(body.pendingPayment, 1);
  assert.equal(body.refundDue, 1, 'a customer owed money must show up');
});

test('orders can be filtered by status, and a made-up status is ignored', async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
  const { cookie } = await login();

  await query(`
    INSERT INTO orders (reference, email, status, subtotal_kobo) VALUES
      ('a1', 'a@b.co', 'paid', 100), ('a2', 'a@b.co', 'refund_due', 100), ('a3', 'a@b.co', 'pending', 100)
  `);

  const paid = await request('/api/admin/orders?status=paid', { cookie });
  assert.deepEqual(paid.body.map(o => o.reference), ['a1']);

  const refunds = await request('/api/admin/orders?status=refund_due', { cookie });
  assert.deepEqual(refunds.body.map(o => o.reference), ['a2']);

  const junk = await request("/api/admin/orders?status=' OR 1=1 --", { cookie });
  assert.equal(junk.status, 200);
  assert.equal(junk.body.length, 3, 'an unknown status means no filter, not an error or an injection');
});

/* ---- first run: choosing a password in the browser -------------------- */

const resetLockouts = async () => {
  const { clearFailures } = await import('../lib/auth.js');
  clearFailures('::ffff:127.0.0.1'); clearFailures('127.0.0.1'); clearFailures('::1');
};

/** Run `fn` as a shop with no ADMIN_PASSWORD_HASH and nothing stored yet. */
async function unconfigured(fn) {
  const saved = process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_PASSWORD_HASH;
  await query('DELETE FROM settings');
  await resetLockouts();
  try { await fn(); }
  finally {
    process.env.ADMIN_PASSWORD_HASH = saved;
    await query('DELETE FROM settings');
    await resetLockouts();
  }
}

const setup = (code, password) => request('/api/admin/setup', {
  method: 'POST', body: JSON.stringify({ code, password })
});

test('with a password configured, the page is told to show sign-in, and setup is closed', async () => {
  await resetLockouts();
  assert.deepEqual((await request('/api/admin/status')).body, { configured: true });

  const { currentSetupCode } = await import('../lib/auth.js');
  const res = await setup(currentSetupCode(), 'an-attacker-password');
  assert.equal(res.status, 409, 'setup must never replace an existing password');
  assert.equal(res.setCookie.length, 0);
});

test('with no password yet, sign-in explains itself instead of failing', async () => {
  await unconfigured(async () => {
    assert.deepEqual((await request('/api/admin/status')).body, { configured: false });
    const { res } = await login('anything-at-all');
    assert.equal(res.status, 409);
    assert.equal(res.body.needsSetup, true);
  });
});

test('reaching /admin first is not enough: setup needs the code from the log', async () => {
  await unconfigured(async () => {
    const { currentSetupCode } = await import('../lib/auth.js');
    const real = currentSetupCode();

    for (const code of [undefined, '', 'guess', real.slice(0, -1), real + 'x', real.toLowerCase() === real ? real.toUpperCase() : real.toLowerCase()]) {
      const res = await setup(code, 'a-perfectly-good-password');
      assert.equal(res.status, 401, `setup code ${JSON.stringify(code)} must be refused`);
      assert.equal(res.setCookie.length, 0);
    }
    assert.deepEqual((await request('/api/admin/status')).body, { configured: false }, 'still unclaimed');
  });
});

test('guessing setup codes hits the same lockout as guessing passwords', async () => {
  await unconfigured(async () => {
    let locked = false;
    for (let i = 0; i < 12; i++) {
      const res = await setup('wrong-' + i, 'a-perfectly-good-password');
      if (res.status === 429) { locked = true; break; }
    }
    assert.ok(locked);
  });
});

test('the right code and a short password is refused without spending the code', async () => {
  await unconfigured(async () => {
    const { currentSetupCode } = await import('../lib/auth.js');
    const code = currentSetupCode();
    assert.equal((await setup(code, 'short')).status, 400);
    assert.equal((await setup(code, 'now-long-enough-pw')).status, 200, 'the code still works');
  });
});

test('the right code sets the password once, signs you in, and is then spent', async () => {
  await unconfigured(async () => {
    const { currentSetupCode, checkSetupCode } = await import('../lib/auth.js');
    const code = currentSetupCode();

    const res = await setup(code, 'my-brand-new-admin-password');
    assert.equal(res.status, 200);
    assert.match(res.setCookie.join(';'), /HttpOnly/i);

    const cookie = res.setCookie.map(c => c.split(';')[0]).join('; ');
    assert.equal((await request('/api/admin/orders', { cookie })).status, 200, 'signed in straight away');

    assert.equal(checkSetupCode(code), false, 'the code works once');
    assert.equal((await setup(code, 'a-second-attempt-password')).status, 409);

    const stored = await one("SELECT value FROM settings WHERE key = 'admin_password_hash'");
    assert.match(stored.value, /^scrypt\$/, 'only a hash is stored');
    assert.ok(!stored.value.includes('my-brand-new-admin-password'));

    assert.equal((await login('my-brand-new-admin-password')).res.status, 200);
    assert.equal((await login('a-second-attempt-password')).res.status, 401);
  });
});

test('two browsers claiming at the same moment: exactly one wins', async () => {
  await unconfigured(async () => {
    const { currentSetupCode } = await import('../lib/auth.js');
    const code = currentSetupCode();
    const results = await Promise.all([
      setup(code, 'first-browser-password'),
      setup(code, 'second-browser-password')
    ]);
    // The loser sees 409 if it got past the code check before the winner
    // spent the code, 401 if after. Either way it did not get in.
    const statuses = results.map(r => r.status);
    assert.equal(statuses.filter(s => s === 200).length, 1);
    assert.ok(statuses.every(s => [200, 401, 409].includes(s)), String(statuses));
    assert.equal(results.filter(r => r.setCookie.length).length, 1, 'only the winner is signed in');
    assert.equal((await one('SELECT COUNT(*) AS n FROM settings')).n, 1);
  });
});
