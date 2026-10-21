import { randomBytes, randomInt, createHash, createHmac, createCipheriv, createDecipheriv, timingSafeEqual } from 'node:crypto';
import { one, query } from '../db.js';
import { parseAgent } from './analytics.js';

/* Customer accounts: the rules, kept apart from the routes that use them.
 *
 *   Passwords   scrypt (the same as the admin's, server/lib/auth.js), at
 *               least 8 characters with a letter and a number.
 *   Sessions    a random token in an HttpOnly cookie; only its hash is kept,
 *               one row per browser, so a customer can see and end them.
 *               12 hours, or 30 days with "Remember me".
 *   Codes       six digits to prove an email, or a new one the account is
 *               moving to (10 minutes, 5 tries), a long token in a link to
 *               set a new password (30 minutes). Hashed.
 *   Two-step    an authenticator app (TOTP, RFC 6238). The secret is kept
 *               encrypted with a key made from SESSION_SECRET.
 *   Guessing    ten wrong passwords or codes for one email in 15 minutes
 *               locks that email for the rest of the 15 minutes. */

export const COOKIE = 'masq_account';
const HOUR = 3600_000;
export const SHORT_SESSION = 12 * HOUR;
export const LONG_SESSION = 30 * 24 * HOUR;
const CODE_MINUTES = { verify: 10, reset: 30, email: 10 };
const CODE_TRIES = 5;
export const RESEND_SECONDS = 45;

const sha256 = (v) => createHash('sha256').update(v).digest('hex');
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be set to at least 32 characters');
  return s;
};

/* ------------------------------------------------------------ passwords */

/** What is wrong with a new password, or null. */
export function passwordProblem(p) {
  if (typeof p !== 'string' || p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 256) return 'That password is too long.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Use at least one letter and one number.';
  return null;
}

/* -------------------------------------------------------------- devices */

export function deviceOf(req) {
  const { os, browser } = parseAgent(req.get('user-agent') ?? '');
  return browser === 'Other' && os === 'Other' ? 'Unknown device' : `${browser} on ${os}`;
}

/* ------------------------------------------------------------- sessions */

export async function startSession(res, req, accountId, remember) {
  const token = randomBytes(32).toString('base64url');
  const ttl = remember ? LONG_SESSION : SHORT_SESSION;
  const expires = new Date(Date.now() + ttl);
  await query(`INSERT INTO account_sessions (account_id, token_hash, device, expires_at, remember)
               VALUES ($1, $2, $3, $4, $5)`, [accountId, sha256(token), deviceOf(req), expires, Boolean(remember)]);
  setCookie(res, token, ttl);
  return expires;
}

function setCookie(res, token, ttl) {
  res.cookie(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: ttl, path: '/'
  });
}

export const clearCookie = (res) =>
  res.cookie(COOKIE, '', { httpOnly: true, sameSite: 'lax', maxAge: 0, path: '/' });

/* Read straight from the header, so the photo upload (which runs before the
 * shop's cookie parser) can check it too. */
function tokenOf(req) {
  for (const part of (req.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) { try { return decodeURIComponent(v.join('=')); } catch { return null; } }
  }
  return null;
}

/** The account and session behind this request's cookie, or null. */
export async function currentAccount(req) {
  const token = tokenOf(req);
  if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
  const row = await one(`
    SELECT s.id AS session_id, s.expires_at, s.created_at AS session_started, s.remember, s.last_seen_at,
           a.id, a.email, a.name, a.phone, a.birth_date, a.gender, a.password_hash, a.password_changed_at,
           a.verified_at, a.totp_secret, a.totp_on, a.totp_last_step, a.photo_mime, a.created_at,
           a.pending_email, a.old_emails, a.sign_in_alerts
      FROM account_sessions s JOIN accounts a ON a.id = s.account_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`, [sha256(token)]);
  if (!row) return null;
  // Seen now; written at most every five minutes.
  if (Date.now() - new Date(row.last_seen_at).getTime() > 5 * 60_000) {
    await query('UPDATE account_sessions SET last_seen_at = now() WHERE id = $1', [row.session_id]);
  }
  return row;
}

/** Every account route but signing in goes through this. */
export async function requireAccount(req, res, next) {
  const account = await currentAccount(req);
  if (!account) return res.status(401).json({ error: 'Please sign in.', code: 'signed_out' });
  req.account = account;
  next();
}

/* A fresh stretch for a session still valid: as long again as it was given,
 * but never past 30 days from signing in. */
export async function renewSession(account) {
  const ttl = account.remember ? LONG_SESSION : SHORT_SESSION;
  const cap = new Date(account.session_started).getTime() + LONG_SESSION;
  const expires = new Date(Math.min(Date.now() + ttl, cap));
  await query('UPDATE account_sessions SET expires_at = $1 WHERE id = $2', [expires, account.session_id]);
  return expires;
}

export const renewCookie = (res, req, expires) =>
  setCookie(res, tokenOf(req), Math.max(0, expires.getTime() - Date.now()));

/* --------------------------------------------------------------- events */

export async function logEvent(accountId, kind, req) {
  await query('INSERT INTO account_events (account_id, kind, device) VALUES ($1, $2, $3)',
    [accountId, kind, req ? deviceOf(req) : '']);
}

/* ---------------------------------------------------------------- codes */

/** A new code (six digits) or token (for a link). Earlier unused ones stop working. */
export async function issueCode(email, purpose) {
  const code = purpose !== 'reset'
    ? String(randomInt(0, 1_000_000)).padStart(6, '0')
    : randomBytes(24).toString('base64url');
  await query("UPDATE account_codes SET used_at = now() WHERE email = $1 AND purpose = $2 AND used_at IS NULL", [email, purpose]);
  await query(`INSERT INTO account_codes (email, purpose, code_hash, expires_at)
               VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [email, purpose, sha256(`${purpose}|${email}|${code}`), CODE_MINUTES[purpose]]);
  return code;
}

/** Seconds until another code may be sent to this email (0: now). */
export async function resendWait(email, purpose) {
  const last = await one(`SELECT created_at FROM account_codes WHERE email = $1 AND purpose = $2 ORDER BY id DESC LIMIT 1`, [email, purpose]);
  if (!last) return 0;
  return Math.max(0, Math.ceil(RESEND_SECONDS - (Date.now() - new Date(last.created_at).getTime()) / 1000));
}

/** How many codes went to this email in the last hour (a mailbox is not to be flooded). */
export async function codesSentLastHour(email) {
  return (await one(`SELECT COUNT(*) AS n FROM account_codes WHERE email = $1 AND created_at > now() - interval '1 hour'`, [email])).n;
}

/**
 * Use a code: true once, if it is the newest for this email, unexpired and
 * within its tries. A wrong code spends a try.
 */
export async function useCode(email, purpose, code) {
  const row = await one(`SELECT id, code_hash, tries, expires_at FROM account_codes
                          WHERE email = $1 AND purpose = $2 AND used_at IS NULL
                          ORDER BY id DESC LIMIT 1`, [email, purpose]);
  if (!row || new Date(row.expires_at) < new Date() || row.tries >= CODE_TRIES) return { ok: false, expired: true };
  const given = sha256(`${purpose}|${email}|${String(code ?? '')}`);
  const ok = timingSafeEqual(Buffer.from(given), Buffer.from(row.code_hash));
  if (!ok) {
    await query('UPDATE account_codes SET tries = tries + 1 WHERE id = $1', [row.id]);
    return { ok: false, expired: row.tries + 1 >= CODE_TRIES };
  }
  // Spent at once, and only once: two requests racing cannot both use it.
  const spent = await one('UPDATE account_codes SET used_at = now() WHERE id = $1 AND used_at IS NULL RETURNING id', [row.id]);
  return { ok: Boolean(spent) };
}

/* ------------------------------------------------------------- guessing */

const misses = new Map();
const WINDOW = 15 * 60_000;
const MAX_MISSES = 10;

export function lockedOut(email) {
  const m = misses.get(email);
  if (!m || Date.now() - m.first > WINDOW) { misses.delete(email); return false; }
  return m.count >= MAX_MISSES;
}
export function recordMiss(email) {
  const now = Date.now();
  const m = misses.get(email);
  if (!m || now - m.first > WINDOW) misses.set(email, { first: now, count: 1 });
  else m.count += 1;
}
export const clearMisses = (email) => misses.delete(email);
export const resetMisses = () => misses.clear();

/* ------------------------------------------------- two-step sign-in ticket */

/* Between the password and the authenticator code: a signed note, five
 * minutes long, that the password was right. It is not a session. */
export function twoStepTicket(accountId, remember) {
  const payload = Buffer.from(JSON.stringify({ a: accountId, r: Boolean(remember), exp: Date.now() + 5 * 60_000 })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(`2fa|${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

export function readTicket(ticket) {
  if (typeof ticket !== 'string' || !ticket.includes('.')) return null;
  const [payload, sig] = ticket.split('.');
  const want = Buffer.from(createHmac('sha256', secret()).update(`2fa|${payload}`).digest('base64url'));
  const got = Buffer.from(String(sig));
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch { return null; }
}

/* ------------------------------------------------------- authenticator */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function toBase32(buf) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += B32[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function fromBase32(text) {
  let bits = 0, value = 0;
  const out = [];
  for (const ch of text.replace(/=+$/, '').toUpperCase()) {
    const i = B32.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
}

export function hotp(key, counter) {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', key).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/** The 30-second step a code belongs to (this one, or one either side), or null. */
export function totpStep(base32, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code ?? ''))) return null;
  const key = fromBase32(base32);
  const step = Math.floor(now / 30_000);
  for (const d of [0, -1, 1]) {
    if (timingSafeEqual(Buffer.from(hotp(key, step + d)), Buffer.from(String(code)))) return step + d;
  }
  return null;
}

/* The secret at rest: AES-256-GCM, its key made from SESSION_SECRET. */
const totpKey = () => createHash('sha256').update(`masq-totp|${secret()}`).digest();

export function sealSecret(base32) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', totpKey(), iv);
  const body = Buffer.concat([c.update(base32, 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), body].map(b => b.toString('base64url')).join('.');
}

export function openSecret(sealed) {
  const [iv, tag, body] = String(sealed).split('.').map(p => Buffer.from(p, 'base64url'));
  const d = createDecipheriv('aes-256-gcm', totpKey(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString('utf8');
}

export const newTotpSecret = () => toBase32(randomBytes(20));

/* -------------------------------------------------------------- shaping */

/** What the account's own pages are told about it. */
export function publicAccount(a, expiresAt) {
  return {
    email: a.email,
    name: a.name,
    phone: a.phone,
    birthDate: a.birth_date ? new Date(a.birth_date).toISOString().slice(0, 10) : null,
    gender: a.gender,
    verified: Boolean(a.verified_at),
    twoFactor: Boolean(a.totp_on),
    hasPhoto: Boolean(a.photo_mime),
    pendingEmail: a.pending_email ?? null,
    signInAlerts: a.sign_in_alerts !== false,
    passwordChangedAt: a.password_changed_at,
    createdAt: a.created_at,
    expiresAt: expiresAt ? new Date(expiresAt).getTime() : null
  };
}
