import express, { Router } from 'express';
import QRCode from 'qrcode';
import { one, query, transaction } from '../db.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { isEmail, normEmail, deliveryDetails } from '../lib/validate.js';
import { rateLimit } from '../lib/limits.js';
import { canSendMail, sendMail, publicOrigin } from '../lib/mail.js';
import { decodePhoto } from '../lib/images.js';
import { photoUrls } from '../lib/catalogue.js';
import {
  COOKIE, startSession, clearCookie, currentAccount, requireAccount, renewSession, renewCookie,
  logEvent, issueCode, resendWait, codesSentLastHour, useCode, passwordProblem, deviceOf,
  lockedOut, recordMiss, clearMisses, twoStepTicket, readTicket,
  newTotpSecret, sealSecret, openSecret, totpStep, publicAccount, RESEND_SECONDS
} from '../lib/accounts.js';

/* Customer accounts: /api/account/…  (rules in server/lib/accounts.js)
 *
 * Optional for customers and off for the whole shop until it can send email
 * (server/lib/mail.js): every route here answers 404 until then, and the
 * shop's pages show no sign-in. */

export const accountRouter = Router();
export const accountUploadRouter = Router();

/* Generous for a person, tight for a script. */
export const accountLimit = rateLimit({ windowMs: 10 * 60_000, max: 60, message: 'Too many tries. Please wait a few minutes.' });
export const mailLimit = rateLimit({ windowMs: 60 * 60_000, max: 12, message: 'Too many emails asked for. Please wait a while and try again.' });

const fail = (status, message, extra = {}) => Object.assign(new Error(message), { status, ...extra });

function open(_req, res, next) {
  if (!canSendMail()) return res.status(404).json({ error: 'Accounts are not open yet.' });
  next();
}
accountRouter.use('/account', open);
accountUploadRouter.use('/account', open);

const origin = publicOrigin;

/* -------------------------------------------------------------- emails */

async function sendVerifyCode(email, name) {
  const code = await issueCode(email, 'verify');
  await sendMail({
    to: email, kind: 'verify', subject: `${code} is your MASQ. code`,
    message: {
      heading: 'Check it’s you',
      lines: [`${name ? `Hi ${name.split(' ')[0]}, h` : 'H'}ere is your code to finish setting up your MASQ. account. It works for 10 minutes.`],
      big: code
    }
  });
}

async function sendResetLink(req, email) {
  const token = await issueCode(email, 'reset');
  const link = `${origin(req)}/account/reset?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;
  await sendMail({
    to: email, kind: 'reset', subject: 'Reset your MASQ. password',
    message: {
      heading: 'Reset your password',
      lines: ['Someone asked to reset the password for your MASQ. account. The link works for 30 minutes, once.'],
      button: { label: 'SET A NEW PASSWORD', href: link }
    }
  });
  return link;
}

/* A sign-in from a browser this account has not been signed in from before:
 * told to the account's email, unless turned off (Notifications). Never
 * holds up the sign-in itself. */
async function alertNewDevice(account, req) {
  if (account.sign_in_alerts === false) return;
  const device = deviceOf(req);
  const seen = await one("SELECT 1 FROM account_events WHERE account_id = $1 AND kind LIKE 'Signed in%' AND device = $2 LIMIT 1",
    [account.id, device]);
  if (seen) return;
  const at = new Date().toLocaleString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  await sendMail({
    to: account.email, kind: 'sign-in', subject: 'New sign-in to your MASQ. account',
    message: {
      heading: 'New sign-in',
      lines: [`Your MASQ. account was signed in on ${device}, ${at} (Lagos time).`,
        'If this was you, there’s nothing to do. If not, reset your password now and turn on two-step verification.'],
      button: { label: 'RESET YOUR PASSWORD', href: `${origin(req)}/account/forgot` }
    }
  }).catch(err => console.error('[account] sign-in alert not sent:', err.message));
}

/* --------------------------------------------------------------- reads */

accountRouter.get('/account/me', requireAccount, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(publicAccount(req.account, req.account.expires_at));
});

/* ------------------------------------------------------------- sign up */

accountRouter.post('/account/signup', accountLimit, mailLimit, async (req, res) => {
  const b = req.body ?? {};
  const name = String(b.name ?? '').trim().replace(/\s+/g, ' ');
  const email = normEmail(b.email);
  if (name.length < 2 || name.length > 80) throw fail(400, 'Please enter your full name.', { field: 'name' });
  if (!isEmail(email)) throw fail(400, 'Please enter a valid email address.', { field: 'email' });
  const weak = passwordProblem(b.password);
  if (weak) throw fail(400, weak, { field: 'password' });
  if (b.terms !== true) throw fail(400, 'Please accept the Terms of Sale to continue.', { field: 'terms' });

  const existing = await one('SELECT id, verified_at FROM accounts WHERE email = $1', [email]);
  if (existing?.verified_at) throw fail(409, 'An account with this email already exists. Sign in instead.', { field: 'email', code: 'exists' });
  if (await codesSentLastHour(email) >= 6) throw fail(429, 'Too many codes sent to this email. Please wait an hour.');

  // Not yet proven: whoever proves the email first owns the account.
  if (existing) {
    await query('UPDATE accounts SET name = $1, password_hash = $2, password_changed_at = now() WHERE id = $3',
      [name, hashPassword(b.password), existing.id]);
  } else {
    await query('INSERT INTO accounts (email, name, password_hash) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING',
      [email, name, hashPassword(b.password)]);
  }
  if (b.newsletter === true) {
    await query('INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [email]);
  }
  await sendVerifyCode(email, name);
  res.status(201).json({ ok: true, email, wait: RESEND_SECONDS });
});

/* -------------------------------------------------- prove the email */

accountRouter.post('/account/verify', accountLimit, async (req, res) => {
  const email = normEmail(req.body?.email);
  const code = String(req.body?.code ?? '').replace(/\D/g, '');
  if (lockedOut(email)) throw fail(429, 'Too many tries. Please wait 15 minutes.');
  const account = await one('SELECT id, verified_at FROM accounts WHERE email = $1', [email]);
  if (!account) throw fail(400, 'That code is not right. Check the email and try again.', { field: 'code' });
  const used = await useCode(email, 'verify', code);
  if (!used.ok) {
    recordMiss(email);
    throw fail(400, used.expired ? 'That code has expired. Send a new one.' : 'That code is not right. Check the email and try again.',
      { field: 'code', code: used.expired ? 'expired' : 'wrong' });
  }
  clearMisses(email);
  await query('UPDATE accounts SET verified_at = COALESCE(verified_at, now()) WHERE id = $1', [account.id]);
  if (!account.verified_at) await logEvent(account.id, 'Email verified', req);
  const expires = await startSession(res, req, account.id, false);
  await logEvent(account.id, 'Signed in', req);
  const fresh = await one('SELECT * FROM accounts WHERE id = $1', [account.id]);
  res.json(publicAccount(fresh, expires));
});

/* A new code. Says the same whatever the email, so it cannot be used to
 * find out who has an account; only an unproven account is sent one. */
accountRouter.post('/account/resend', accountLimit, mailLimit, async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!isEmail(email)) throw fail(400, 'Please enter a valid email address.');
  const wait = await resendWait(email, 'verify');
  if (wait > 0) return res.status(429).json({ error: `Please wait ${wait} seconds before asking again.`, wait });
  const account = await one('SELECT name, verified_at FROM accounts WHERE email = $1', [email]);
  if (account && !account.verified_at && await codesSentLastHour(email) < 6) await sendVerifyCode(email, account.name);
  res.json({ ok: true, wait: RESEND_SECONDS });
});

/* -------------------------------------------------------------- sign in */

accountRouter.post('/account/login', accountLimit, async (req, res) => {
  const email = normEmail(req.body?.email);
  const password = req.body?.password;
  const remember = req.body?.remember === true;
  if (!isEmail(email) || typeof password !== 'string' || !password) throw fail(400, 'Enter your email and password.');
  if (lockedOut(email)) throw fail(429, 'Too many tries. Please wait 15 minutes, or reset your password.', { code: 'locked' });

  const account = await one('SELECT * FROM accounts WHERE email = $1', [email]);
  // A missing account costs as long as a wrong password, so timing says nothing.
  const ok = verifyPassword(password, account?.password_hash ?? 'scrypt$00$00');
  if (!account || !ok) {
    recordMiss(email);
    throw fail(401, 'That email and password don’t match. Try again or reset your password.');
  }
  clearMisses(email);
  if (!account.verified_at) {
    if (await resendWait(email, 'verify') === 0 && await codesSentLastHour(email) < 6) await sendVerifyCode(email, account.name);
    throw fail(403, 'Please confirm your email first. We’ve sent you a code.', { code: 'unverified' });
  }
  if (account.totp_on) return res.json({ twoFactor: true, ticket: twoStepTicket(account.id, remember) });

  const expires = await startSession(res, req, account.id, remember);
  await alertNewDevice(account, req);
  await logEvent(account.id, 'Signed in', req);
  res.json(publicAccount(account, expires));
});

accountRouter.post('/account/login/2fa', accountLimit, async (req, res) => {
  const ticket = readTicket(req.body?.ticket);
  if (!ticket) throw fail(401, 'That took too long. Please sign in again.', { code: 'ticket' });
  const account = await one('SELECT * FROM accounts WHERE id = $1', [ticket.a]);
  if (!account?.totp_on) throw fail(401, 'Please sign in again.', { code: 'ticket' });
  if (lockedOut(account.email)) throw fail(429, 'Too many tries. Please wait 15 minutes.', { code: 'locked' });
  const step = totpStep(openSecret(account.totp_secret), String(req.body?.code ?? '').replace(/\D/g, ''));
  // A code is good once: one already used, even if still on the app, is refused.
  const fresh = step !== null && (account.totp_last_step === null || step > Number(account.totp_last_step)) &&
    await one('UPDATE accounts SET totp_last_step = $1 WHERE id = $2 AND (totp_last_step IS NULL OR totp_last_step < $1) RETURNING id', [step, account.id]);
  if (!fresh) {
    recordMiss(account.email);
    throw fail(400, 'That code is not right. Use the newest code in your authenticator app.', { field: 'code' });
  }
  clearMisses(account.email);
  const expires = await startSession(res, req, account.id, ticket.r);
  await alertNewDevice(account, req);
  await logEvent(account.id, 'Signed in with two-step verification', req);
  res.json(publicAccount(account, expires));
});

accountRouter.post('/account/logout', async (req, res) => {
  const account = await currentAccount(req);
  if (account) {
    await query('DELETE FROM account_sessions WHERE id = $1', [account.session_id]);
    await logEvent(account.id, 'Signed out', req);
  }
  clearCookie(res);
  res.json({ ok: true });
});

/* "Stay signed in", from the warning before a session ends. */
accountRouter.post('/account/renew', requireAccount, async (req, res) => {
  const expires = await renewSession(req.account);
  renewCookie(res, req, expires);
  res.json({ ok: true, expiresAt: expires.getTime() });
});

/* ------------------------------------------------------ forgot password */

accountRouter.post('/account/forgot', accountLimit, mailLimit, async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!isEmail(email)) throw fail(400, 'Please enter a valid email address.', { field: 'email' });
  const account = await one('SELECT id FROM accounts WHERE email = $1', [email]);
  if (account && await resendWait(email, 'reset') === 0 && await codesSentLastHour(email) < 6) await sendResetLink(req, email);
  // The same answer whether or not there is an account.
  res.json({ ok: true });
});

accountRouter.post('/account/reset', accountLimit, async (req, res) => {
  const email = normEmail(req.body?.email);
  const weak = passwordProblem(req.body?.password);
  if (weak) throw fail(400, weak, { field: 'password' });
  if (lockedOut(email)) throw fail(429, 'Too many tries. Please wait 15 minutes.');
  const account = await one('SELECT id FROM accounts WHERE email = $1', [email]);
  const used = account ? await useCode(email, 'reset', String(req.body?.token ?? '')) : { ok: false, expired: true };
  if (!used.ok) {
    recordMiss(email);
    throw fail(400, 'This reset link has expired or was already used. Ask for a new one.', { code: 'expired' });
  }
  await transaction(async (tx) => {
    // The link proved the email too. Every browser signed in before is signed out.
    await tx.query(`UPDATE accounts SET password_hash = $1, password_changed_at = now(),
                    verified_at = COALESCE(verified_at, now()) WHERE id = $2`, [hashPassword(req.body.password), account.id]);
    await tx.query('DELETE FROM account_sessions WHERE account_id = $1', [account.id]);
  });
  clearMisses(email);
  await logEvent(account.id, 'Password reset by email link', req);
  res.json({ ok: true });
});

/* -------------------------------------------------------------- profile */

const GENDERS = ['', 'female', 'male', 'non-binary', 'prefer-not'];

accountRouter.patch('/account/me', requireAccount, async (req, res) => {
  const b = req.body ?? {};
  const name = String(b.name ?? '').trim().replace(/\s+/g, ' ');
  const phone = String(b.phone ?? '').trim();
  const gender = String(b.gender ?? '');
  if (name.length < 2 || name.length > 80) throw fail(400, 'Please enter your full name.', { field: 'name' });
  const digits = phone.replace(/\D/g, '');
  if (phone && (!/^\+?[\d\s()-]+$/.test(phone) || digits.length < 7 || digits.length > 15)) {
    throw fail(400, 'Please enter a valid phone number.', { field: 'phone' });
  }
  if (!GENDERS.includes(gender)) throw fail(400, 'Please choose from the list.', { field: 'gender' });
  let birth = null;
  if (b.birthDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.birthDate) || Number.isNaN(Date.parse(`${b.birthDate}T00:00:00Z`))) {
      throw fail(400, 'Please enter a real date.', { field: 'birthDate' });
    }
    const d = new Date(`${b.birthDate}T00:00:00Z`);
    const sixteen = new Date(); sixteen.setUTCFullYear(sixteen.getUTCFullYear() - 16);
    if (d > sixteen) throw fail(400, 'You must be 16 or older to have an account.', { field: 'birthDate' });
    if (d.getUTCFullYear() < 1900) throw fail(400, 'Please check the year.', { field: 'birthDate' });
    birth = b.birthDate;
  }
  const row = await one(`UPDATE accounts SET name = $1, phone = $2, gender = $3, birth_date = $4 WHERE id = $5 RETURNING *`,
    [name, phone, gender, birth, req.account.id]);
  await logEvent(req.account.id, 'Profile updated', req);
  res.json(publicAccount(row, req.account.expires_at));
});

/* --------------------------------------------------------------- photo */

const photoBody = express.json({ limit: '600kb' });

accountUploadRouter.put('/account/photo', requireAccount, photoBody, async (req, res) => {
  const { bytes, mime } = decodePhoto(req.body?.image, 'profile');
  if (bytes.length > 400_000) throw fail(413, 'That photo is too large. Please use one under 400 KB.');
  await query('UPDATE accounts SET photo = $1, photo_mime = $2 WHERE id = $3', [bytes, mime, req.account.id]);
  res.json({ ok: true });
});

accountRouter.delete('/account/photo', requireAccount, async (req, res) => {
  await query('UPDATE accounts SET photo = NULL, photo_mime = NULL WHERE id = $1', [req.account.id]);
  res.json({ ok: true });
});

accountRouter.get('/account/photo', requireAccount, async (req, res) => {
  const row = await one('SELECT photo, photo_mime FROM accounts WHERE id = $1', [req.account.id]);
  if (!row?.photo) return res.status(404).json({ error: 'No photo.' });
  res.set({
    'Content-Type': row.photo_mime, 'Cache-Control': 'private, no-cache',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox"
  });
  res.send(Buffer.from(row.photo));
});

/* ------------------------------------------------------------ password */

accountRouter.post('/account/password', requireAccount, accountLimit, async (req, res) => {
  const { current, password } = req.body ?? {};
  if (lockedOut(req.account.email)) throw fail(429, 'Too many tries. Please wait 15 minutes.');
  if (typeof current !== 'string' || !verifyPassword(current, req.account.password_hash)) {
    recordMiss(req.account.email);
    throw fail(400, 'Your current password is not right.', { field: 'current' });
  }
  const weak = passwordProblem(password);
  if (weak) throw fail(400, weak, { field: 'password' });
  await transaction(async (tx) => {
    await tx.query('UPDATE accounts SET password_hash = $1, password_changed_at = now() WHERE id = $2', [hashPassword(password), req.account.id]);
    // Everywhere else is signed out; this browser stays.
    await tx.query('DELETE FROM account_sessions WHERE account_id = $1 AND id <> $2', [req.account.id, req.account.session_id]);
  });
  await logEvent(req.account.id, 'Password changed', req);
  res.json({ ok: true });
});

/* ------------------------------------------------------------- sessions */

accountRouter.get('/account/sessions', requireAccount, async (req, res) => {
  const rows = await query(`SELECT id, device, created_at, last_seen_at FROM account_sessions
                             WHERE account_id = $1 AND expires_at > now() ORDER BY last_seen_at DESC`, [req.account.id]);
  res.json(rows.map(r => ({ id: r.id, device: r.device, signedInAt: r.created_at, lastSeenAt: r.last_seen_at, current: r.id === req.account.session_id })));
});

accountRouter.delete('/account/sessions/:id', requireAccount, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (id === req.account.session_id) throw fail(400, 'Use Sign out for this device.');
  await query('DELETE FROM account_sessions WHERE id = $1 AND account_id = $2', [id, req.account.id]);
  await logEvent(req.account.id, 'Signed out another device', req);
  res.json({ ok: true });
});

accountRouter.post('/account/sessions/sign-out-others', requireAccount, async (req, res) => {
  await query('DELETE FROM account_sessions WHERE account_id = $1 AND id <> $2', [req.account.id, req.account.session_id]);
  await logEvent(req.account.id, 'Signed out all other devices', req);
  res.json({ ok: true });
});

accountRouter.get('/account/activity', requireAccount, async (req, res) => {
  const rows = await query('SELECT kind, device, at FROM account_events WHERE account_id = $1 ORDER BY at DESC, id DESC LIMIT 30', [req.account.id]);
  res.json(rows);
});

/* ------------------------------------------------- two-step verification */

accountRouter.post('/account/2fa/setup', requireAccount, async (req, res) => {
  if (req.account.totp_on) throw fail(409, 'Two-step verification is already on.');
  const secret = newTotpSecret();
  await query('UPDATE accounts SET totp_secret = $1, totp_last_step = NULL WHERE id = $2', [sealSecret(secret), req.account.id]);
  const url = `otpauth://totp/${encodeURIComponent(`MASQ.:${req.account.email}`)}?secret=${secret}&issuer=${encodeURIComponent('MASQ.')}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, color: { dark: '#050407', light: '#ffffff' } });
  res.json({ secret, qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` });
});

accountRouter.post('/account/2fa/enable', requireAccount, async (req, res) => {
  if (req.account.totp_on) throw fail(409, 'Two-step verification is already on.');
  if (!req.account.totp_secret) throw fail(400, 'Start again: the setup has expired.');
  const step = totpStep(openSecret(req.account.totp_secret), String(req.body?.code ?? '').replace(/\D/g, ''));
  if (step === null) throw fail(400, 'That code is not right. Use the newest code in your authenticator app.', { field: 'code' });
  const row = await one('UPDATE accounts SET totp_on = TRUE, totp_last_step = $1 WHERE id = $2 RETURNING *', [step, req.account.id]);
  await logEvent(req.account.id, 'Two-step verification turned on', req);
  res.json(publicAccount(row, req.account.expires_at));
});

accountRouter.post('/account/2fa/disable', requireAccount, accountLimit, async (req, res) => {
  if (typeof req.body?.password !== 'string' || !verifyPassword(req.body.password, req.account.password_hash)) {
    recordMiss(req.account.email);
    throw fail(400, 'Your password is not right.', { field: 'password' });
  }
  const row = await one('UPDATE accounts SET totp_on = FALSE, totp_secret = NULL, totp_last_step = NULL WHERE id = $1 RETURNING *', [req.account.id]);
  await logEvent(req.account.id, 'Two-step verification turned off', req);
  res.json(publicAccount(row, req.account.expires_at));
});

/* ---------------------------------------------------------- change email */

async function sendEmailCode(email, name) {
  const code = await issueCode(email, 'email');
  await sendMail({
    to: email, kind: 'email', subject: `${code} is your MASQ. code`,
    message: {
      heading: 'Confirm your new email',
      lines: [`${name ? `Hi ${name.split(' ')[0]}, h` : 'H'}ere is your code to move your MASQ. account to this email. It works for 10 minutes.`],
      big: code
    }
  });
}

/* Step one: the new address and the password. A code goes to the new
 * address; nothing changes until it comes back. */
accountRouter.post('/account/email', requireAccount, accountLimit, mailLimit, async (req, res) => {
  const email = normEmail(req.body?.email);
  if (!isEmail(email)) throw fail(400, 'Please enter a valid email address.', { field: 'email' });
  if (email === req.account.email) throw fail(400, 'That’s already your email.', { field: 'email' });
  if (lockedOut(req.account.email)) throw fail(429, 'Too many tries. Please wait 15 minutes.');
  if (typeof req.body?.password !== 'string' || !verifyPassword(req.body.password, req.account.password_hash)) {
    recordMiss(req.account.email);
    throw fail(400, 'Your password is not right.', { field: 'password' });
  }
  clearMisses(req.account.email);
  if (await one('SELECT 1 FROM accounts WHERE email = $1 AND verified_at IS NOT NULL', [email])) {
    throw fail(409, 'Another account already uses this email.', { field: 'email' });
  }
  const wait = await resendWait(email, 'email');
  if (wait > 0) return res.status(429).json({ error: `Please wait ${wait} seconds before asking again.`, wait });
  if (await codesSentLastHour(email) >= 6) throw fail(429, 'Too many codes sent to this email. Please wait an hour.');
  await query('UPDATE accounts SET pending_email = $1 WHERE id = $2', [email, req.account.id]);
  await sendEmailCode(email, req.account.name);
  res.json({ ok: true, email, wait: RESEND_SECONDS });
});

accountRouter.post('/account/email/resend', requireAccount, accountLimit, mailLimit, async (req, res) => {
  const email = req.account.pending_email;
  if (!email) throw fail(400, 'Start again: enter your new email.', { code: 'expired' });
  const wait = await resendWait(email, 'email');
  if (wait > 0) return res.status(429).json({ error: `Please wait ${wait} seconds before asking again.`, wait });
  if (await codesSentLastHour(email) >= 6) throw fail(429, 'Too many codes sent to this email. Please wait an hour.');
  await sendEmailCode(email, req.account.name);
  res.json({ ok: true, wait: RESEND_SECONDS });
});

/* Step two: the code from the new inbox. The account moves; its orders under
 * the old email stay visible; the old address is told. */
accountRouter.post('/account/email/confirm', requireAccount, accountLimit, async (req, res) => {
  const next = req.account.pending_email;
  const old = req.account.email;
  if (!next) throw fail(400, 'Start again: enter your new email.', { code: 'expired' });
  if (lockedOut(old)) throw fail(429, 'Too many tries. Please wait 15 minutes.');
  const used = await useCode(next, 'email', String(req.body?.code ?? '').replace(/\D/g, ''));
  if (!used.ok) {
    recordMiss(old);
    throw fail(400, used.expired ? 'That code has expired. Send a new one.' : 'That code is not right. Check the email and try again.',
      { field: 'code', code: used.expired ? 'expired' : 'wrong' });
  }
  clearMisses(old);
  const row = await transaction(async (tx) => {
    const holder = await tx.one('SELECT id, verified_at FROM accounts WHERE email = $1', [next]);
    if (holder?.verified_at) throw fail(409, 'Another account now uses this email.', { field: 'code' });
    // An unfinished sign-up with that address: proving the inbox wins it, as at sign-up.
    if (holder) await tx.query('DELETE FROM accounts WHERE id = $1', [holder.id]);
    // The mailing list and back-in-stock requests follow the customer.
    await tx.query(`UPDATE subscribers SET email = $1 WHERE email = $2
                     AND NOT EXISTS (SELECT 1 FROM subscribers WHERE email = $1)`, [next, old]);
    await tx.query(`UPDATE stock_alerts a SET email = $1 WHERE lower(a.email) = $2 AND NOT EXISTS (
                      SELECT 1 FROM stock_alerts b WHERE b.email = $1 AND b.product_id = a.product_id
                         AND b.colour = a.colour AND b.size = a.size)`, [next, old]);
    return tx.one(`UPDATE accounts SET email = $1, pending_email = NULL,
                          old_emails = array_append(array_remove(old_emails, $1::text), $2::text)
                    WHERE id = $3 RETURNING *`, [next, old, req.account.id]);
  });
  await logEvent(req.account.id, 'Email changed', req);
  await sendMail({
    to: old, kind: 'email-changed', subject: 'Your MASQ. email was changed',
    message: {
      heading: 'Your email was changed',
      lines: [`Your MASQ. account now signs in with ${next.replace(/^(.).*?(@.*)$/, '$1•••$2')}. This address won’t get its emails any more.`,
        'If you didn’t do this, reply to this email or contact us straight away.']
    }
  }).catch(err => console.error('[account] email-change notice not sent:', err.message));
  res.json(publicAccount(row, req.account.expires_at));
});

accountRouter.delete('/account/email', requireAccount, async (req, res) => {
  await query('UPDATE accounts SET pending_email = NULL WHERE id = $1', [req.account.id]);
  res.json({ ok: true });
});

/* ------------------------------------------------------------ addresses */

const MAX_ADDRESSES = 10;
const shapeAddress = (r) => ({
  id: r.id, label: r.label, name: r.name, phone: r.phone, address: r.address, isDefault: r.is_default
});

async function listAddresses(accountId) {
  const rows = await query(`SELECT * FROM account_addresses WHERE account_id = $1
                             ORDER BY is_default DESC, created_at, id`, [accountId]);
  return rows.map(shapeAddress);
}

/** Checked by checkout's own rules, so a saved address always checks out. */
function addressBody(b) {
  const label = String(b?.label ?? '').replace(/\s+/g, ' ').trim();
  if (label.length > 30) throw fail(400, 'Keep the label under 30 characters.', { field: 'label' });
  const { name, phone, address } = deliveryDetails(b ?? {});
  return { label, name, phone, address };
}

accountRouter.get('/account/addresses', requireAccount, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await listAddresses(req.account.id));
});

accountRouter.post('/account/addresses', requireAccount, accountLimit, async (req, res) => {
  const a = addressBody(req.body);
  await transaction(async (tx) => {
    const { n } = await tx.one('SELECT COUNT(*)::int AS n FROM account_addresses WHERE account_id = $1', [req.account.id]);
    if (n >= MAX_ADDRESSES) throw fail(400, `You can keep up to ${MAX_ADDRESSES} addresses. Remove one first.`);
    const first = n === 0;
    if (req.body?.isDefault && !first) await tx.query('UPDATE account_addresses SET is_default = FALSE WHERE account_id = $1', [req.account.id]);
    await tx.query(`INSERT INTO account_addresses (account_id, label, name, phone, address, is_default)
                    VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.account.id, a.label, a.name, a.phone, JSON.stringify(a.address), first || req.body?.isDefault === true]);
  });
  res.status(201).json(await listAddresses(req.account.id));
});

accountRouter.put('/account/addresses/:id', requireAccount, accountLimit, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const a = addressBody(req.body);
  await transaction(async (tx) => {
    const mine = await tx.one('SELECT is_default FROM account_addresses WHERE id = $1 AND account_id = $2', [id, req.account.id]);
    if (!mine) throw fail(404, 'That address has gone. Refresh and try again.');
    const isDefault = mine.is_default || req.body?.isDefault === true;
    if (isDefault && !mine.is_default) await tx.query('UPDATE account_addresses SET is_default = FALSE WHERE account_id = $1', [req.account.id]);
    await tx.query(`UPDATE account_addresses SET label = $1, name = $2, phone = $3, address = $4, is_default = $5
                     WHERE id = $6 AND account_id = $7`,
      [a.label, a.name, a.phone, JSON.stringify(a.address), isDefault, id, req.account.id]);
  });
  res.json(await listAddresses(req.account.id));
});

accountRouter.post('/account/addresses/:id/default', requireAccount, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  await transaction(async (tx) => {
    const mine = await tx.one('SELECT 1 FROM account_addresses WHERE id = $1 AND account_id = $2', [id, req.account.id]);
    if (!mine) throw fail(404, 'That address has gone. Refresh and try again.');
    await tx.query('UPDATE account_addresses SET is_default = (id = $1) WHERE account_id = $2', [id, req.account.id]);
  });
  res.json(await listAddresses(req.account.id));
});

accountRouter.delete('/account/addresses/:id', requireAccount, async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  await transaction(async (tx) => {
    const gone = await tx.one('DELETE FROM account_addresses WHERE id = $1 AND account_id = $2 RETURNING is_default', [id, req.account.id]);
    // The default went: the oldest left takes its place.
    if (gone?.is_default) {
      await tx.query(`UPDATE account_addresses SET is_default = TRUE WHERE id = (
                        SELECT id FROM account_addresses WHERE account_id = $1 ORDER BY created_at, id LIMIT 1)`, [req.account.id]);
    }
  });
  res.json(await listAddresses(req.account.id));
});

/* -------------------------------------------------------- notifications */

/* What the account hears about: the mailing list (its own table, shared with
 * the footer's sign-up), sign-in alerts, and the back-in-stock requests made
 * with its email. */
async function notifications(account) {
  const list = await one('SELECT 1 FROM subscribers WHERE email = $1', [account.email]);
  const alerts = await query(`
    SELECT a.id, a.colour, a.size, a.created_at, p.name, p.id AS product_id
      FROM stock_alerts a LEFT JOIN products p ON p.id = a.product_id
     WHERE lower(a.email) = $1 ORDER BY a.created_at DESC`, [account.email]);
  return {
    newsletter: Boolean(list),
    signInAlerts: account.sign_in_alerts !== false,
    stockAlerts: alerts.map(a => ({ id: a.id, productId: a.product_id, name: a.name ?? 'A piece no longer sold', colour: a.colour || null, size: a.size, createdAt: a.created_at }))
  };
}

accountRouter.get('/account/notifications', requireAccount, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(await notifications(req.account));
});

accountRouter.patch('/account/notifications', requireAccount, async (req, res) => {
  const b = req.body ?? {};
  if (typeof b.newsletter === 'boolean') {
    if (b.newsletter) await query('INSERT INTO subscribers (email) VALUES ($1) ON CONFLICT (email) DO NOTHING', [req.account.email]);
    else await query('DELETE FROM subscribers WHERE email = $1', [req.account.email]);
  }
  if (typeof b.signInAlerts === 'boolean') {
    await query('UPDATE accounts SET sign_in_alerts = $1 WHERE id = $2', [b.signInAlerts, req.account.id]);
    req.account.sign_in_alerts = b.signInAlerts;
    await logEvent(req.account.id, b.signInAlerts ? 'Sign-in alerts turned on' : 'Sign-in alerts turned off', req);
  }
  res.json(await notifications(req.account));
});

accountRouter.delete('/account/notifications/stock/:id', requireAccount, async (req, res) => {
  await query('DELETE FROM stock_alerts WHERE id = $1 AND lower(email) = $2', [Number.parseInt(req.params.id, 10), req.account.email]);
  res.json(await notifications(req.account));
});

/* --------------------------------------------------------------- orders */

/* The orders placed with this account's email, and with any email it had
 * before. Only a proven email ever gets here (signing in, or changing it,
 * needs a code), so nobody sees another's orders by using their address. */
accountRouter.get('/account/orders', requireAccount, async (req, res) => {
  const orders = await query(`
    SELECT id, reference, status, created_at, paid_at, fulfilled_at, refunded_at,
           subtotal_kobo - discount_kobo + shipping_kobo AS total_kobo
      FROM orders
     WHERE lower(email) = ANY($1::text[]) AND status IN ('paid', 'refund_due', 'refunded', 'pending')
     ORDER BY created_at DESC LIMIT 100`, [[req.account.email, ...(req.account.old_emails ?? [])]]);
  const ids = orders.map(o => o.id);
  const items = ids.length ? await query(`
    SELECT oi.order_id, oi.name, oi.colour, oi.size, oi.qty, p.img, p.image_id
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ANY($1::int[]) ORDER BY oi.id`, [ids]) : [];
  res.set('Cache-Control', 'no-store');
  res.json(orders.map(o => {
    const mine = items.filter(i => i.order_id === o.id);
    return {
      reference: o.reference,
      status: o.status === 'paid' && o.fulfilled_at ? 'sent' : o.status,
      createdAt: o.created_at, paidAt: o.paid_at,
      totalKobo: o.total_kobo,
      itemCount: mine.reduce((n, i) => n + i.qty, 0),
      items: mine.slice(0, 3).map(i => ({ name: i.name, colour: i.colour || null, size: i.size, qty: i.qty, img: photoUrls(i).img || null }))
    };
  }));
});

/* --------------------------------------------------------------- delete */

accountRouter.delete('/account', requireAccount, accountLimit, async (req, res) => {
  if (typeof req.body?.password !== 'string' || !verifyPassword(req.body.password, req.account.password_hash)) {
    recordMiss(req.account.email);
    throw fail(400, 'Your password is not right.', { field: 'password' });
  }
  // Sessions, codes and the activity go with it. Orders stay in the shop's
  // records (they are its accounts), as they would without an account.
  await transaction(async (tx) => {
    await tx.query('DELETE FROM account_codes WHERE email = $1', [req.account.email]);
    await tx.query('DELETE FROM accounts WHERE id = $1', [req.account.id]);
  });
  clearCookie(res);
  res.json({ ok: true });
});

export { COOKIE };
