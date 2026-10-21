/* Customer accounts: signing up, proving the email, signing in (with and
 * without an authenticator), resetting a password, the profile, sessions,
 * orders and deleting an account. Emails are read from the memory outbox.
 *
 *   node --test server/test/accounts.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, colourOf, WHO } from './helpers.js';

let shop, outbox, lib;
before(async () => {
  shop = await startShop();
  stubPaystack(shop.one);
  ({ outbox } = await import('../lib/mail.js'));
  lib = await import('../lib/accounts.js');
});
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); });

const EMAIL = 'ada@example.com';
const PASS = 'masq-rituals-2026';
const post = (path, json, cookie) => shop.request(`/api/account${path}`, { method: 'POST', json, cookie });
const cookieOf = (res) => res.setCookie.map(c => c.split(';')[0]).filter(c => c.startsWith('masq_account=')).join('; ');
const lastCode = () => outbox.filter(m => m.kind === 'verify').at(-1)?.big;
const lastLink = () => new URL(outbox.filter(m => m.kind === 'reset').at(-1).button.href);

/** A proven, signed-in account; returns its cookie. */
async function member(email = EMAIL, password = PASS) {
  const up = await post('/signup', { name: 'Ada Obi', email, password, terms: true });
  assert.equal(up.status, 201, up.raw);
  const v = await post('/verify', { email, code: lastCode() });
  assert.equal(v.status, 200, v.raw);
  return cookieOf(v);
}

/* ---- open only with email --------------------------------------------- */

test('accounts are offered only when the shop can send email', async () => {
  assert.equal((await shop.request('/api/site')).body.accounts, true);
  process.env.MAIL_DRIVER = 'none';
  try {
    assert.equal((await shop.request('/api/site')).body.accounts, false);
    assert.equal((await post('/login', { email: EMAIL, password: PASS })).status, 404);
  } finally { process.env.MAIL_DRIVER = 'memory'; }
});

/* ---- sign up and prove the email ------------------------------------- */

test('signing up sends a six-digit code; the account works only once it is entered', async () => {
  const up = await post('/signup', { name: 'Ada Obi', email: 'Ada@Example.com', password: PASS, terms: true });
  assert.equal(up.status, 201);
  assert.equal(up.setCookie.length, 0, 'not signed in before the email is proven');
  assert.match(lastCode(), /^\d{6}$/);
  assert.equal(outbox.at(-1).to, EMAIL, 'stored and sent lower-case');

  const early = await post('/login', { email: EMAIL, password: PASS });
  assert.equal(early.status, 403);
  assert.equal(early.body.code, 'unverified');

  const wrong = await post('/verify', { email: EMAIL, code: lastCode() === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.field, 'code');

  const ok = await post('/verify', { email: EMAIL, code: lastCode() });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.verified, true);
  const me = await shop.request('/api/account/me', { cookie: cookieOf(ok) });
  assert.equal(me.status, 200);
  assert.equal(me.body.name, 'Ada Obi');
  assert.ok(me.body.expiresAt > Date.now());
});

test('sign-up says what is wrong, box by box', async () => {
  assert.equal((await post('/signup', { name: 'A', email: EMAIL, password: PASS, terms: true })).body.field, 'name');
  assert.equal((await post('/signup', { name: 'Ada Obi', email: 'nope', password: PASS, terms: true })).body.field, 'email');
  assert.equal((await post('/signup', { name: 'Ada Obi', email: EMAIL, password: 'short1', terms: true })).body.field, 'password');
  assert.equal((await post('/signup', { name: 'Ada Obi', email: EMAIL, password: 'lettersonly', terms: true })).body.field, 'password');
  assert.equal((await post('/signup', { name: 'Ada Obi', email: EMAIL, password: PASS })).body.field, 'terms');
});

test('a proven email cannot be signed up again; an unproven one goes to whoever proves it', async () => {
  await member();
  const again = await post('/signup', { name: 'Someone', email: EMAIL, password: 'another-pass-1', terms: true });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'exists');

  await post('/signup', { name: 'First', email: 'bo@example.com', password: 'first-pass-1', terms: true });
  await post('/signup', { name: 'Second', email: 'bo@example.com', password: 'second-pass-2', terms: true });
  const v = await post('/verify', { email: 'bo@example.com', code: lastCode() });
  assert.equal(v.status, 200);
  assert.equal((await post('/login', { email: 'bo@example.com', password: 'first-pass-1' })).status, 401);
  assert.equal((await post('/login', { email: 'bo@example.com', password: 'second-pass-2' })).status, 200);
});

test('a code stops working after five wrong tries, and only the newest code works', async () => {
  await post('/signup', { name: 'Ada Obi', email: EMAIL, password: PASS, terms: true });
  const code = lastCode();
  const other = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await post('/verify', { email: EMAIL, code: other });
  const late = await post('/verify', { email: EMAIL, code });
  assert.equal(late.status, 400);
  assert.equal(late.body.code, 'expired');
});

test('a new code waits 45 seconds after the last, and the answer never says who has an account', async () => {
  await post('/signup', { name: 'Ada Obi', email: EMAIL, password: PASS, terms: true });
  const soon = await post('/resend', { email: EMAIL });
  assert.equal(soon.status, 429);
  assert.ok(soon.body.wait > 0);
  const nobody = await post('/resend', { email: 'nobody@example.com' });
  assert.equal(nobody.status, 200);
  assert.equal(outbox.filter(m => m.to === 'nobody@example.com').length, 0);
});

/* ---- sign in --------------------------------------------------------- */

test('signing in: a wrong password is refused, and ten wrong tries lock the email', async () => {
  await member();
  const wrong = await post('/login', { email: EMAIL, password: 'not-it-123' });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.setCookie.length, 0);
  const nobody = await post('/login', { email: 'nobody@example.com', password: PASS });
  assert.equal(nobody.status, 401);
  assert.equal(nobody.body.error, wrong.body.error, 'the same words whether or not there is an account');

  await member('bo@example.com');
  for (let i = 0; i < 10; i++) await post('/login', { email: 'bo@example.com', password: 'not-it-123' });
  const locked = await post('/login', { email: 'bo@example.com', password: PASS });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.code, 'locked');
});

test('Remember me gives 30 days; without it, 12 hours; staying signed in renews it', async () => {
  await member();
  const short = await post('/login', { email: EMAIL, password: PASS });
  const long = await post('/login', { email: EMAIL, password: PASS, remember: true });
  const hours = (r) => (r.body.expiresAt - Date.now()) / 3600_000;
  assert.ok(hours(short) > 11.9 && hours(short) <= 12);
  assert.ok(hours(long) > 24 * 29.9);
  await shop.query("UPDATE account_sessions SET expires_at = now() + interval '1 minute'");
  const renewed = await post('/renew', {}, cookieOf(short));
  assert.equal(renewed.status, 200);
  assert.ok(renewed.body.expiresAt - Date.now() > 11.9 * 3600_000);
});

test('a made-up or expired session cookie is refused', async () => {
  assert.equal((await shop.request('/api/account/me', { cookie: 'masq_account=' + 'x'.repeat(43) })).status, 401);
  const cookie = await member();
  await shop.query("UPDATE account_sessions SET expires_at = now() - interval '1 second'");
  assert.equal((await shop.request('/api/account/me', { cookie })).status, 401);
});

test('signing out ends this session only', async () => {
  const one = await member();
  const two = cookieOf(await post('/login', { email: EMAIL, password: PASS }));
  assert.equal((await post('/logout', {}, one)).status, 200);
  assert.equal((await shop.request('/api/account/me', { cookie: one })).status, 401);
  assert.equal((await shop.request('/api/account/me', { cookie: two })).status, 200);
});

/* ---- reset ----------------------------------------------------------- */

test('forgot password: a link for a real account, silence for anyone else, the same answer both ways', async () => {
  const cookie = await member();
  const nobody = await post('/forgot', { email: 'nobody@example.com' });
  assert.equal(nobody.status, 200);
  assert.equal(outbox.filter(m => m.kind === 'reset').length, 0);

  assert.equal((await post('/forgot', { email: EMAIL })).status, 200);
  const link = lastLink();
  assert.equal(link.pathname, '/account/reset');
  const token = link.searchParams.get('token');

  assert.equal((await post('/reset', { email: EMAIL, token, password: 'weak' })).body.field, 'password');
  const ok = await post('/reset', { email: EMAIL, token, password: 'brand-new-pass-9' });
  assert.equal(ok.status, 200);
  assert.equal((await shop.request('/api/account/me', { cookie })).status, 401, 'every browser signed out');
  assert.equal((await post('/reset', { email: EMAIL, token, password: 'again-new-pass-9' })).status, 400, 'a link works once');
  assert.equal((await post('/login', { email: EMAIL, password: 'brand-new-pass-9' })).status, 200);
});

/* ---- profile, password, photo --------------------------------------- */

test('the profile saves, and refuses a birthday under 16', async () => {
  const cookie = await member();
  const patch = (json) => shop.request('/api/account/me', { method: 'PATCH', cookie, json });
  const young = new Date(); young.setFullYear(young.getFullYear() - 10);
  const bad = await patch({ name: 'Ada Obi', birthDate: young.toISOString().slice(0, 10) });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.field, 'birthDate');
  assert.equal((await patch({ name: 'Ada Obi', phone: 'call me' })).body.field, 'phone');
  const ok = await patch({ name: 'Ada Kehinde Obi', phone: '+234 801 234 5678', birthDate: '1985-10-10', gender: 'prefer-not' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.birthDate, '1985-10-10');
  assert.equal(ok.body.name, 'Ada Kehinde Obi');
});

test('changing the password needs the current one, and signs out other browsers', async () => {
  const here = await member();
  const there = cookieOf(await post('/login', { email: EMAIL, password: PASS }));
  assert.equal((await post('/password', { current: 'wrong-pass-1', password: 'next-pass-22' }, here)).body.field, 'current');
  assert.equal((await post('/password', { current: PASS, password: 'next-pass-22' }, here)).status, 200);
  assert.equal((await shop.request('/api/account/me', { cookie: here })).status, 200);
  assert.equal((await shop.request('/api/account/me', { cookie: there })).status, 401);
});

test('a profile photo: only a real picture, only for its owner', async () => {
  const cookie = await member();
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]);
  const put = (image, c = cookie) => shop.request('/api/account/photo', { method: 'PUT', cookie: c, json: { image } });
  assert.equal((await put(webp.toString('base64'), null)).status, 401);
  assert.equal((await put(Buffer.from('<svg onload=alert(1)>').toString('base64'))).status, 415);
  assert.equal((await put(webp.toString('base64'))).status, 200);
  const got = await shop.request('/api/account/photo', { cookie });
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'image/webp');
  assert.equal((await shop.request('/api/account/me', { cookie })).body.hasPhoto, true);
});

/* ---- sessions and activity -------------------------------------------- */

test('a customer sees where they are signed in, and can sign the others out', async () => {
  const here = await member();
  const there = cookieOf(await post('/login', { email: EMAIL, password: PASS }));
  const list = (await shop.request('/api/account/sessions', { cookie: here })).body;
  assert.equal(list.length, 2);
  assert.equal(list.filter(s => s.current).length, 1);
  const other = list.find(s => !s.current);
  assert.equal((await shop.request(`/api/account/sessions/${other.id}`, { method: 'DELETE', cookie: here })).status, 200);
  assert.equal((await shop.request('/api/account/me', { cookie: there })).status, 401);
  const activity = (await shop.request('/api/account/activity', { cookie: here })).body.map(e => e.kind);
  assert.ok(activity.includes('Email verified'));
  assert.ok(activity.includes('Signed out another device'));
});

/* ---- two-step verification ------------------------------------------- */

test('two-step verification: set up with a code, then asked for at every sign-in; a code works once', async () => {
  const cookie = await member();
  const setup = (await post('/2fa/setup', {}, cookie)).body;
  assert.match(setup.secret, /^[A-Z2-7]{32}$/);
  assert.match(setup.qr, /^data:image\/svg\+xml;base64,/);
  const codeAt = (ms) => lib.hotp(lib.fromBase32(setup.secret), Math.floor(ms / 30_000));

  assert.equal((await post('/2fa/enable', { code: '000000' === codeAt(Date.now()) ? '111111' : '000000' }, cookie)).status, 400);
  const on = await post('/2fa/enable', { code: codeAt(Date.now()) }, cookie);
  assert.equal(on.status, 200);
  assert.equal(on.body.twoFactor, true);

  const step1 = await post('/login', { email: EMAIL, password: PASS });
  assert.equal(step1.body.twoFactor, true);
  assert.equal(step1.setCookie.length, 0, 'the password alone does not sign in');

  // The code used to switch it on cannot be used again; the next one can.
  const replay = await post('/login/2fa', { ticket: step1.body.ticket, code: codeAt(Date.now()) });
  assert.equal(replay.status, 400);
  const next = await post('/login/2fa', { ticket: step1.body.ticket, code: codeAt(Date.now() + 30_000) });
  assert.equal(next.status, 200);
  assert.ok(cookieOf(next));

  assert.equal((await post('/login/2fa', { ticket: 'forged.ticket', code: codeAt(Date.now()) })).status, 401);
  assert.equal((await post('/2fa/disable', { password: 'wrong-one-1' }, cookie)).status, 400);
  assert.equal((await post('/2fa/disable', { password: PASS }, cookie)).body.twoFactor, false);
});

test('the authenticator secret is stored encrypted', async () => {
  const cookie = await member();
  const { secret } = (await post('/2fa/setup', {}, cookie)).body;
  const row = await shop.one('SELECT totp_secret FROM accounts');
  assert.ok(!row.totp_secret.includes(secret));
  assert.equal(lib.openSecret(row.totp_secret), secret);
});

/* ---- orders ---------------------------------------------------------- */

test('an account sees the orders placed with its email, and nobody else’s', async () => {
  const cookie = await member();
  const items = [{ productId: 'cap', colour: colourOf('cap'), size: 'ONE SIZE', qty: 2 }];
  const mine = await shop.checkout({ email: 'ADA@example.com', items });
  const theirs = await shop.checkout({ email: 'someone@example.com', items });
  await shop.request(`/api/orders/${mine.body.reference}`);     // confirmed with Paystack: paid
  await shop.request(`/api/orders/${theirs.body.reference}`);
  const list = (await shop.request('/api/account/orders', { cookie })).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].reference, mine.body.reference);
  assert.equal(list[0].status, 'paid');
  assert.equal(list[0].itemCount, 2);
  assert.equal((await shop.request('/api/account/orders')).status, 401);
});

/* ---- delete ---------------------------------------------------------- */

test('deleting an account needs the password, and ends it everywhere', async () => {
  const cookie = await member();
  const del = (json) => shop.request('/api/account', { method: 'DELETE', cookie, json });
  assert.equal((await del({ password: 'wrong-one-1' })).status, 400);
  assert.equal((await del({ password: PASS })).status, 200);
  assert.equal((await shop.request('/api/account/me', { cookie })).status, 401);
  assert.equal((await post('/login', { email: EMAIL, password: PASS })).status, 401);
  assert.equal((await shop.one('SELECT COUNT(*) AS n FROM account_sessions')).n, 0);
});

/* ---- change email ---------------------------------------------------- */

const lastOf = (kind) => outbox.filter(m => m.kind === kind).at(-1);

test('changing the email: password first, a code to the new inbox, orders under the old email still seen', async () => {
  const cookie = await member();
  const items = [{ productId: 'cap', colour: colourOf('cap'), size: 'ONE SIZE', qty: 1 }];
  const before = await shop.checkout({ email: EMAIL, items });
  await shop.request(`/api/orders/${before.body.reference}`);
  await shop.request('/api/subscribe', { method: 'POST', json: { email: EMAIL } });
  const ask = (json) => post('/email', json, cookie);

  assert.equal((await ask({ email: 'not-an-email', password: PASS })).body.field, 'email');
  assert.equal((await ask({ email: EMAIL, password: PASS })).body.field, 'email', 'already theirs');
  assert.equal((await ask({ email: 'new@example.com', password: 'wrong-one-1' })).body.field, 'password');
  await member('taken@example.com');
  assert.equal((await ask({ email: 'taken@example.com', password: PASS })).status, 409);

  const sent = await ask({ email: 'New@Example.com', password: PASS });
  assert.equal(sent.status, 200, sent.raw);
  assert.equal(lastOf('email').to, 'new@example.com');
  assert.equal((await shop.request('/api/account/me', { cookie })).body.email, EMAIL, 'nothing changes before the code');
  assert.equal((await shop.request('/api/account/me', { cookie })).body.pendingEmail, 'new@example.com');
  assert.equal((await post('/email/resend', {}, cookie)).status, 429, 'a new code waits 45 seconds');

  const wrong = await post('/email/confirm', { code: lastOf('email').big === '000000' ? '111111' : '000000' }, cookie);
  assert.equal(wrong.body.field, 'code');
  const ok = await post('/email/confirm', { code: lastOf('email').big }, cookie);
  assert.equal(ok.status, 200, ok.raw);
  assert.equal(ok.body.email, 'new@example.com');
  assert.equal(ok.body.pendingEmail, null);
  assert.equal(lastOf('email-changed').to, EMAIL, 'the old address is told');
  assert.match(lastOf('email-changed').lines[0], /n•••@example\.com/);

  // Signs in with the new one only; still sees the order placed before; still on the list.
  assert.equal((await post('/login', { email: EMAIL, password: PASS })).status, 401);
  assert.equal((await post('/login', { email: 'new@example.com', password: PASS })).status, 200);
  const list = (await shop.request('/api/account/orders', { cookie })).body;
  assert.equal(list[0].reference, before.body.reference);
  assert.equal((await shop.one("SELECT COUNT(*)::int AS n FROM subscribers WHERE email = 'new@example.com'")).n, 1);
  assert.equal((await post('/email/confirm', { code: '123456' }, cookie)).body.code, 'expired', 'one code, once');
});

test('an email change cannot take an address another account proves first', async () => {
  const cookie = await member();
  assert.equal((await post('/email', { email: 'later@example.com', password: PASS }, cookie)).status, 200);
  const code = lastOf('email').big;
  await member('later@example.com');
  const late = await post('/email/confirm', { code }, cookie);
  assert.equal(late.status, 409);
  assert.equal((await shop.request('/api/account/me', { cookie })).body.email, EMAIL);
});

/* ---- addresses ------------------------------------------------------- */

test('addresses: checked like checkout, the first is the default, one default at a time', async () => {
  const cookie = await member();
  const call = (method, path = '', json) => shop.request(`/api/account/addresses${path}`, { method, cookie, json });
  assert.deepEqual((await call('GET')).body, []);

  const bad = await call('POST', '', { ...WHO, address: { ...WHO.address, state: 'Narnia' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.body.field, 'state');
  assert.equal((await call('POST', '', { ...WHO, phone: '12' })).body.field, 'phone');

  let list = (await call('POST', '', { ...WHO, label: 'Home' })).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].isDefault, true, 'the first is the default');
  assert.equal(list[0].address.state, 'Lagos');
  list = (await call('POST', '', { ...WHO, label: 'Work', address: { ...WHO.address, state: 'fct', city: 'Wuse' } })).body;
  assert.equal(list.length, 2);
  const work = list.find(a => a.label === 'Work');
  assert.equal(work.address.state, 'FCT');
  assert.equal(work.isDefault, false);

  list = (await call('POST', `/${work.id}/default`)).body;
  assert.equal(list[0].id, work.id, 'the default comes first');
  assert.equal(list.filter(a => a.isDefault).length, 1);

  list = (await call('PUT', `/${work.id}`, { ...WHO, label: 'Office', address: { ...WHO.address, line1: '5 Broad Street' } })).body;
  assert.equal(list.find(a => a.id === work.id).label, 'Office');
  assert.equal(list.find(a => a.id === work.id).isDefault, true, 'editing keeps it the default');

  list = (await call('DELETE', `/${work.id}`)).body;
  assert.equal(list.length, 1);
  assert.equal(list[0].isDefault, true, 'the one left takes over');

  // Someone else's address is out of reach.
  const other = await member('bo@example.com');
  const theirs = (await shop.request('/api/account/addresses', { method: 'POST', cookie: other, json: WHO })).body[0];
  assert.equal((await call('PUT', `/${theirs.id}`, WHO)).status, 404);
  await call('DELETE', `/${theirs.id}`);
  assert.equal((await shop.request('/api/account/addresses', { cookie: other })).body.length, 1);
  assert.equal((await shop.request('/api/account/addresses')).status, 401);
});

test('at most ten addresses', async () => {
  const cookie = await member();
  for (let i = 0; i < 10; i++) await shop.request('/api/account/addresses', { method: 'POST', cookie, json: WHO });
  assert.equal((await shop.request('/api/account/addresses', { method: 'POST', cookie, json: WHO })).status, 400);
});

/* ---- notifications --------------------------------------------------- */

test('notifications: the mailing list, sign-in alerts, and back-in-stock requests', async () => {
  const cookie = await member();
  const get = async () => (await shop.request('/api/account/notifications', { cookie })).body;
  const set = (json) => shop.request('/api/account/notifications', { method: 'PATCH', cookie, json });

  let n = await get();
  assert.equal(n.newsletter, false);
  assert.equal(n.signInAlerts, true);
  assert.deepEqual(n.stockAlerts, []);

  assert.equal((await set({ newsletter: true })).body.newsletter, true);
  assert.equal((await shop.one(`SELECT COUNT(*)::int AS n FROM subscribers WHERE email = '${EMAIL}'`)).n, 1);
  assert.equal((await set({ newsletter: false })).body.newsletter, false);
  assert.equal((await shop.one(`SELECT COUNT(*)::int AS n FROM subscribers WHERE email = '${EMAIL}'`)).n, 0);

  await shop.one("INSERT INTO stock_alerts (product_id, colour, size, email) VALUES ('tee', 'Indigo', 'M', 'ADA@example.com')");
  await shop.one("INSERT INTO stock_alerts (product_id, colour, size, email) VALUES ('tee', 'Indigo', 'L', 'bo@example.com')");
  n = await get();
  assert.equal(n.stockAlerts.length, 1);
  assert.equal(n.stockAlerts[0].size, 'M');
  const theirs = (await shop.one("SELECT id FROM stock_alerts WHERE email = 'bo@example.com'")).id;
  await shop.request(`/api/account/notifications/stock/${theirs}`, { method: 'DELETE', cookie });
  assert.equal((await shop.one('SELECT COUNT(*)::int AS n FROM stock_alerts')).n, 2, 'someone else’s request stays');
  n = (await shop.request(`/api/account/notifications/stock/${n.stockAlerts[0].id}`, { method: 'DELETE', cookie })).body;
  assert.deepEqual(n.stockAlerts, []);
});

test('a sign-in from a new browser is told to the account’s email, unless turned off', async () => {
  await member();
  const ua = (agent) => ({ 'user-agent': agent });
  const login = (agent) => shop.request('/api/account/login', { method: 'POST', json: { email: EMAIL, password: PASS }, headers: ua(agent) });
  const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
  const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

  const count = () => outbox.filter(m => m.kind === 'sign-in').length;
  const start = count();
  const first = await login(firefox);
  assert.equal(first.status, 200);
  assert.equal(count(), start + 1);
  assert.match(outbox.at(-1).lines[0], /Firefox/);
  await login(firefox);
  assert.equal(count(), start + 1, 'not again for the same browser');

  await shop.request('/api/account/notifications', { method: 'PATCH', cookie: cookieOf(first), json: { signInAlerts: false } });
  await login(safari);
  assert.equal(count(), start + 1, 'off means off');
});
