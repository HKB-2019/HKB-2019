/* The shop as the browser tests see it: the real server and the built front
 * end, an in-memory database, the stand-in Paystack, and a small control
 * port the tests use to start each test from a clean shop.
 *
 *   npm run build && node e2e/serve.js
 *
 * The control port is part of this test harness only — the shop itself has
 * no reset route. */

import { createServer } from 'node:http';
import { startFakePaystack } from './fake-paystack.js';

export const PORT = Number(process.env.E2E_PORT || 4173);
export const PAYSTACK_PORT = PORT + 1;
export const CONTROL_PORT = PORT + 2;
export const ADMIN_PASSWORD = 'e2e-admin-password';
const SECRET_KEY = 'sk_test_' + 'e'.repeat(40);

const shopUrl = `http://localhost:${PORT}`;

Object.assign(process.env, {
  PGLITE_DIR: 'memory://',
  PAYSTACK_SECRET_KEY: SECRET_KEY,
  PAYSTACK_API_BASE: `http://localhost:${PAYSTACK_PORT}`,
  PAYSTACK_CALLBACK_URL: `${shopUrl}/order`,
  SESSION_SECRET: 's'.repeat(48)
});
delete process.env.DATABASE_URL;
delete process.env.NODE_ENV;

const { hashPassword, clearFailures } = await import('../server/lib/auth.js');
process.env.ADMIN_PASSWORD_HASH = hashPassword(ADMIN_PASSWORD);

const { query } = await import('../server/db.js');
const { seed } = await import('../server/seed.js');
const { setSetting } = await import('../server/lib/settings.js');
const { checkoutLimit } = await import('../server/routes/checkout.js');
const { subscribeLimit } = await import('../server/routes/subscribe.js');
const { createApp } = await import('../server/index.js');

export const DELIVERY = {
  lagos:         { enabled: true,  feeKobo: 250_000 },
  abuja:         { enabled: true,  feeKobo: 350_000 },
  nigeria:       { enabled: true,  feeKobo: 500_000 },
  international: { enabled: false, feeKobo: null }
};

async function reset({ delivery = true } = {}) {
  await seed({ reset: true });
  await query("DELETE FROM settings WHERE key <> 'admin_password_hash'");
  if (delivery) await setSetting('delivery', DELIVERY);
  for (const ip of ['::ffff:127.0.0.1', '127.0.0.1', '::1']) clearFailures(ip);
  checkoutLimit.reset();
  subscribeLimit.reset();
}

await reset();
await startFakePaystack({ port: PAYSTACK_PORT, secretKey: SECRET_KEY, shopUrl });
createApp().listen(PORT, () => console.log(`e2e shop on ${shopUrl}`));

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/reset') {
    await reset({ delivery: url.searchParams.get('delivery') !== 'off' });
    res.writeHead(204); return res.end();
  }
  res.writeHead(404); res.end();
}).listen(CONTROL_PORT);
