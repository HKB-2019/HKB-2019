import express from 'express';
import cookieParser from 'cookie-parser';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webhookRouter } from './routes/webhook.js';
import { productsRouter } from './routes/products.js';
import { checkoutRouter } from './routes/checkout.js';
import { ordersRouter } from './routes/orders.js';
import { adminRouter } from './routes/admin.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // The webhook is mounted BEFORE the JSON parser on purpose: its signature is
  // an HMAC over the raw bytes, and a parsed-then-reserialised body no longer
  // matches. It attaches its own raw parser.
  app.use('/api', webhookRouter);

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', productsRouter);
  app.use('/api', checkoutRouter);
  app.use('/api', ordersRouter);
  app.use('/api', adminRouter);

  /* In production the built front end is served by this same process, so
   * /admin and /order survive a refresh or a link opened cold. Client routing
   * means any non-/api path has to fall back to index.html — the React router
   * decides what it is, not the file system. In dev, Vite does this instead. */
  const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
  if (existsSync(join(dist, 'index.html'))) {
    app.use(express.static(dist, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(join(dist, 'index.html')));
  }

  app.use((err, _req, res, _next) => {
    console.error('[server]', err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}

// Only listen when run directly, so tests can import the app without a port.
if (process.argv[1] && process.argv[1].endsWith('server/index.js')) {
  const port = Number(process.env.PORT || 3001);

  // A shop with no catalogue is a blank page, and on a fresh host there is no
  // chance to run the seed by hand before the first visitor arrives.
  const { db } = await import('./db.js');
  if (!db.prepare('SELECT COUNT(*) AS n FROM products').get().n) {
    const { seed } = await import('./seed.js');
    console.log(`Empty database — loaded ${seed()} pieces.`);
  }

  createApp().listen(port, () => {
    console.log(`MASQ. running on http://localhost:${port}`);
    console.log(`Admin at      http://localhost:${port}/admin`);
    if (!process.env.ADMIN_PASSWORD_HASH) {
      console.warn('ADMIN_PASSWORD_HASH is not set — run `npm run setup` before signing in.');
    }
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.warn('PAYSTACK_SECRET_KEY is not set — checkout stays off until it is.');
    }
  });
}
