import express from 'express';
import { webhookRouter } from './routes/webhook.js';
import { productsRouter } from './routes/products.js';
import { checkoutRouter } from './routes/checkout.js';
import { ordersRouter } from './routes/orders.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');

  // The webhook is mounted BEFORE the JSON parser on purpose: its signature is
  // an HMAC over the raw bytes, and a parsed-then-reserialised body no longer
  // matches. It attaches its own raw parser.
  app.use('/api', webhookRouter);

  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api', productsRouter);
  app.use('/api', checkoutRouter);
  app.use('/api', ordersRouter);

  app.use((err, _req, res, _next) => {
    console.error('[server]', err);
    res.status(500).json({ error: 'Something went wrong.' });
  });

  return app;
}

// Only listen when run directly, so tests can import the app without a port.
if (process.argv[1] && process.argv[1].endsWith('server/index.js')) {
  const port = Number(process.env.PORT || 3001);
  createApp().listen(port, () => {
    console.log(`MASQ. API listening on http://localhost:${port}`);
    if (!process.env.PAYSTACK_SECRET_KEY) {
      console.warn('PAYSTACK_SECRET_KEY is not set — checkout will fail until it is.');
    }
  });
}
