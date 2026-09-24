import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto';

/* Admin authentication.
 *
 * One operator, one password. The password itself is never stored or committed
 * — only a scrypt hash of it, in ADMIN_PASSWORD_HASH. Generate one with:
 *
 *     npm run admin:password
 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;

  const expected = Buffer.from(keyHex, 'hex');
  let actual;
  try {
    actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT);
  } catch {
    return false;
  }
  // Constant time: a length-dependent or early-exit compare leaks the answer.
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/* ------------------------------------------------------------- sessions */

function sessionSecret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error('SESSION_SECRET must be set to at least 32 characters');
  }
  return s;
}

const EIGHT_HOURS = 8 * 60 * 60 * 1000;

export function issueSession(subject = 'admin', ttlMs = EIGHT_HOURS) {
  const payload = Buffer.from(JSON.stringify({
    sub: subject,
    exp: Date.now() + ttlMs,
    jti: randomBytes(8).toString('hex')
  })).toString('base64url');

  const sig = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function readSession(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');

  const expected = createHmac('sha256', sessionSecret()).update(payload).digest('base64url');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(sig));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')); }
  catch { return null; }

  if (!data?.exp || Date.now() > data.exp) return null;
  return data;
}

/* ---------------------------------------------------- brute force guard */

/* In memory, which is the right scope for one process. If this ever runs on
 * more than one instance, move it to the database — a per-process counter
 * lets an attacker get N attempts per instance. */
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export function recordFailure(ip) {
  const now = Date.now();
  const entry = attempts.get(ip) ?? { count: 0, first: now };
  if (now - entry.first > WINDOW_MS) { entry.count = 0; entry.first = now; }
  entry.count += 1;
  attempts.set(ip, entry);
}

export function isLockedOut(ip) {
  const entry = attempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.first > WINDOW_MS) { attempts.delete(ip); return false; }
  return entry.count >= MAX_ATTEMPTS;
}

export function clearFailures(ip) { attempts.delete(ip); }

/* ------------------------------------------------------------ middleware */

export const COOKIE = 'masq_admin';

function readCookie(req, name) {
  const header = req.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

/** Every admin route goes through this. No session, no data. */
export function requireAdmin(req, res, next) {
  const session = readSession(readCookie(req, COOKIE));
  if (!session) return res.status(401).json({ error: 'Not signed in.' });
  req.admin = session;
  next();
}
