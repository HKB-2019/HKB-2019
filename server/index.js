import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webhookRouter } from './routes/webhook.js';
import { productsRouter } from './routes/products.js';
import { checkoutRouter } from './routes/checkout.js';
import { ordersRouter } from './routes/orders.js';
import { subscribeRouter } from './routes/subscribe.js';
import { adminRouter } from './routes/admin.js';
import { adminProductsRouter, adminUploadRouter } from './routes/admin-products.js';

/* What the browser may load on the shop's pages. Scripts only from the shop
 * itself, so an injected <script> has nowhere to come from; no framing by
 * other sites, so nobody can lay an invisible admin page under a fake button.
 * Inline styles stay allowed because the animation library sets them. */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' https:",
  "frame-src https://www.youtube-nocookie.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

function securityHeaders(req, res, next) {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()'
  });
  if (process.env.NODE_ENV === 'production') {
    res.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
  next();
}

/* Errors a visitor caused are answered as such (400, 413…), in words they can
 * act on. Only genuine faults are 500s, and only those are logged loudly. */
function errorHandler(err, _req, res, _next) {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'That request was not valid JSON.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'That is too large.' });
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error('[server]', err);
  res.status(status).json({ error: status >= 500 ? 'Something went wrong.' : err.message });
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // Behind a host's load balancer every request arrives from the balancer's
  // address, so the admin lockout would count everyone as one person. This
  // trusts exactly the number of proxies named — never `true`, which would
  // believe whatever X-Forwarded-For a client chose to send and let an
  // attacker dodge the lockout by inventing a new address per guess.
  const hops = Number.parseInt(process.env.TRUST_PROXY ?? '', 10);
  if (hops > 0) app.set('trust proxy', hops);

  app.use(securityHeaders);

  // The webhook is mounted BEFORE the JSON parser on purpose: its signature is
  // an HMAC over the raw bytes, and a parsed-then-reserialised body no longer
  // matches. It attaches its own raw parser.
  app.use('/api', webhookRouter);

  // Photo uploads need a bigger body than anything else, and must check the
  // admin is signed in before reading it. They bring their own parser.
  app.use('/api', adminUploadRouter);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', productsRouter);
  app.use('/api', checkoutRouter);
  app.use('/api', ordersRouter);
  app.use('/api', subscribeRouter);
  app.use('/api', adminRouter);
  app.use('/api', adminProductsRouter);

  // An address under /api that matched nothing is a mistake, and says so in
  // JSON — not a copy of the home page.
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  /* In production the built front end is served by this same process, so
   * /admin and /order survive a refresh or a link opened cold. Client routing
   * means a page address has to fall back to index.html — the React router
   * decides what it is. In dev, Vite does this instead. */
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (existsSync(join(dist, 'index.html'))) {
    const html = readFileSync(join(dist, 'index.html'), 'utf8');

    app.get('/index.html', (_req, res) => res.redirect(301, '/'));

    app.use(express.static(dist, {
      index: false,
      maxAge: '1d',
      setHeaders(res, path) {
        // Vite puts a content hash in these names, so they never change.
        if (/-[A-Za-z0-9_-]{8,}\.(js|css|woff2)$/.test(path)) {
          res.set('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));

    app.get(/.*/, (req, res) => {
      // A missing file (anything with an extension) is a 404, not the home
      // page served as a picture.
      if (/\.[a-z0-9]{1,6}$/i.test(req.path)) return res.status(404).type('text/plain').send('Not found');

      // Link previews (WhatsApp, Instagram, X) need the site's full address.
      // Taken from the host's own setting where there is one; otherwise from
      // the request, and only if it looks like a host name — it is written
      // into the page, so it must not be able to carry anything else.
      const host = req.get('host') ?? '';
      const origin = (process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL ||
        (/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host) ? `${req.protocol}://${host}` : '')).replace(/\/$/, '');
      res.set({ 'Content-Security-Policy': CSP, 'Cache-Control': 'no-cache' });
      if (req.path.startsWith('/admin')) res.set('X-Robots-Tag', 'noindex, nofollow');
      res.type('html').send(html.replaceAll('__ORIGIN__', origin));
    });
  }

  app.use(errorHandler);
  return app;
}

// Only listen when run directly, so tests can import the app without a port.
if (process.argv[1] && process.argv[1].endsWith('server/index.js')) {
  const port = Number(process.env.PORT || 3001);

  // A shop with no catalogue is a blank page, and on a fresh host there is no
  // chance to run the seed by hand before the first visitor arrives.
  const { one, driver } = await import('./db.js');
  if (!(await one('SELECT COUNT(*) AS n FROM products')).n) {
    const { seed } = await import('./seed.js');
    console.log(`Empty database — loaded ${await seed()} pieces.`);
  }
  console.log(`Database: ${(await driver()) === 'pglite'
    ? 'built-in (server/data/) — set DATABASE_URL to use a hosted one'
    : 'Postgres at DATABASE_URL'}`);

  const { startSweeper } = await import('./lib/orders.js');
  startSweeper();

  // No password yet: print the one-time code that lets the owner choose one
  // at /admin. Only the host's log shows it, and only the owner reads that.
  const { storedPasswordHash, currentSetupCode } = await import('./lib/auth.js');
  if (!(await storedPasswordHash())) {
    console.log('');
    console.log('  ┌──────────────────────────────────────────────────────────┐');
    console.log('  │  No admin password yet. Open /admin and enter this code: │');
    console.log(`  │      ${currentSetupCode().padEnd(52)}│`);
    console.log('  │  It works once, and a new one appears after a restart.   │');
    console.log('  └──────────────────────────────────────────────────────────┘');
    console.log('');
  }

  createApp().listen(port, async () => {
    console.log(`MASQ. running on http://localhost:${port}`);
    console.log(`Admin at      http://localhost:${port}/admin`);
    if (!process.env.SESSION_SECRET) {
      console.warn('SESSION_SECRET is not set — nobody can sign in to the admin until it is.');
    }
    const { paystackConfigured } = await import('./lib/paystack.js');
    if (!paystackConfigured()) {
      console.warn('No Paystack secret key yet — the shop and admin work, checkout stays off until it is set.');
    }
  });
}
