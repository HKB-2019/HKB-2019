/* A stand-in for Paystack, for the browser tests only.
 *
 * It speaks the three parts of Paystack the shop uses — start a payment,
 * verify one, and send a signed webhook — plus a payment page with two
 * buttons, so a test can click "pay" or "cancel" like a customer would.
 * The shop only talks to it when PAYSTACK_API_BASE points here, which the
 * server ignores in production. */

import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';

export function startFakePaystack({ port, secretKey, shopUrl }) {
  const transactions = new Map();   // reference → { amount, email, callbackUrl, status }
  let nextId = 1;

  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const readBody = (req) => new Promise((resolve) => {
    let raw = '';
    req.on('data', c => { raw += c; });
    req.on('end', () => resolve(raw));
  });

  const authorised = (req) => req.headers.authorization === `Bearer ${secretKey}`;

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (req.method === 'POST' && url.pathname === '/transaction/initialize') {
      if (!authorised(req)) return json(res, 401, { status: false, message: 'Invalid key' });
      const body = JSON.parse(await readBody(req));
      // Paystack's own rule for references, which the shop must follow.
      if (!/^[A-Za-z0-9.=-]+$/.test(body.reference)) {
        return json(res, 400, { status: false, message: 'Invalid reference' });
      }
      transactions.set(body.reference, {
        id: nextId++, amount: body.amount, email: body.email,
        callbackUrl: body.callback_url, status: 'abandoned'
      });
      return json(res, 200, { status: true, data: {
        authorization_url: `http://localhost:${port}/pay/${body.reference}`,
        reference: body.reference
      } });
    }

    const verify = url.pathname.match(/^\/transaction\/verify\/(.+)$/);
    if (req.method === 'GET' && verify) {
      if (!authorised(req)) return json(res, 401, { status: false, message: 'Invalid key' });
      const t = transactions.get(decodeURIComponent(verify[1]));
      if (!t) return json(res, 404, { status: false, message: 'Transaction reference not found' });
      return json(res, 200, { status: true, data: {
        id: t.id, reference: verify[1], amount: t.amount, currency: 'NGN', status: t.status
      } });
    }

    const pay = url.pathname.match(/^\/pay\/([^/]+)(?:\/(success|cancel))?$/);
    if (pay) {
      const reference = decodeURIComponent(pay[1]);
      const t = transactions.get(reference);
      if (!t) { res.writeHead(404); return res.end('no such payment'); }

      if (req.method === 'GET' && !pay[2]) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(`<!doctype html><meta charset="utf-8"><title>Fake Paystack</title>
          <h1>Pay ₦${(t.amount / 100).toLocaleString('en-NG')}</h1>
          <p id="email">${t.email}</p>
          <form method="post" action="/pay/${reference}/success"><button id="pay">Pay</button></form>
          <form method="post" action="/pay/${reference}/cancel"><button id="cancel">Cancel</button></form>`);
      }

      if (req.method === 'POST' && pay[2] === 'success') {
        t.status = 'success';
        // Paystack tells the shop, signed with the secret key…
        const raw = JSON.stringify({ event: 'charge.success', data: { id: t.id, reference, amount: t.amount } });
        await fetch(`${shopUrl}/api/paystack/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-paystack-signature': createHmac('sha512', secretKey).update(raw).digest('hex')
          },
          body: raw
        }).catch(() => {});
      }
      // …and sends the customer back to the shop either way.
      const back = new URL(t.callbackUrl);
      back.searchParams.set('trxref', reference);
      back.searchParams.set('reference', reference);
      res.writeHead(302, { Location: back.toString() });
      return res.end();
    }

    res.writeHead(404); res.end();
  });

  return new Promise(resolve => server.listen(port, () => resolve(server)));
}
