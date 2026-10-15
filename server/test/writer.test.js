/* "Write it for me": drafts of product words from Claude, with Anthropic's
 * API stood in for, so nothing is called or paid for.
 *
 *   node --test server/test/writer.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop } from './helpers.js';

const KEY = 'sk-ant-test-' + 'a1B2'.repeat(10);   // shaped like a key, not one

let shop, cookie, realFetch;
/** What the stand-in answers next, and every request it was sent. */
const anthropic = { calls: [], reply: null };

before(async () => {
  shop = await startShop();
  delete process.env.ANTHROPIC_BASE_URL;
  delete process.env.ANTHROPIC_AUTH_TOKEN;
  realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url instanceof Request ? url.url : url);
    if (!u.startsWith('https://api.anthropic.com/')) return realFetch(url, opts);
    anthropic.calls.push({ url: u, headers: new Headers(opts.headers), body: JSON.parse(opts.body) });
    const { status = 200, body } = anthropic.reply;
    return Response.json(body, { status });
  };
});
after(async () => { globalThis.fetch = realFetch; delete process.env.ANTHROPIC_API_KEY; await shop.close(); });
beforeEach(async () => {
  await shop.reset();
  cookie = await shop.login();
  process.env.ANTHROPIC_API_KEY = KEY;
  anthropic.calls = [];
  anthropic.reply = written({
    description: 'A heavyweight tee carrying the face of MASQ., cut boxy.',
    details: '100% cotton, 240gsm\nWash cold, inside out'
  });
});

/** A finished reply from Claude carrying `draft` as its JSON. */
function written(draft, stop = 'end_turn') {
  return { body: {
    id: 'msg_test', type: 'message', role: 'assistant', model: 'claude-opus-5-5',
    content: [{ type: 'text', text: JSON.stringify(draft) }],
    stop_reason: stop, usage: { input_tokens: 420, output_tokens: 180 }
  } };
}

const draft = (id, notes) => shop.request(`/api/admin/products/${id}/draft`, { method: 'POST', cookie, json: { notes } });

test('only a signed-in owner can ask for a draft, or ask whether the helper is on', async () => {
  assert.equal((await shop.request('/api/admin/writer')).status, 401);
  const res = await shop.request('/api/admin/products/tee/draft', { method: 'POST', json: { notes: 'heavy cotton' } });
  assert.equal(res.status, 401);
  assert.equal(anthropic.calls.length, 0);
});

test('with no key set, the helper is off and says so', async () => {
  for (const off of [undefined, 'sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx', 'your-key-here']) {
    if (off === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = off;
    const status = await shop.request('/api/admin/writer', { cookie });
    assert.deepEqual(status.body, { ready: false }, `key ${off}`);
    const res = await draft('tee', 'heavy cotton');
    assert.equal(res.status, 503);
  }
  assert.equal(anthropic.calls.length, 0, 'nothing sent without a real key');

  process.env.ANTHROPIC_API_KEY = KEY;
  assert.deepEqual((await shop.request('/api/admin/writer', { cookie })).body, { ready: true });
});

test('a draft comes back from the owner’s notes, and nothing is saved', async () => {
  const res = await draft('tee', '  Heavy 240gsm cotton, boxy fit.\r\nPrint from Yoruba carvings.  ');
  assert.equal(res.status, 200, res.raw);
  assert.deepEqual(res.body, {
    description: 'A heavyweight tee carrying the face of MASQ., cut boxy.',
    details: '100% cotton, 240gsm\nWash cold, inside out'
  });

  // What was asked: the right model, the brief, JSON back, and a fallback on a decline.
  const [call] = anthropic.calls;
  assert.match(call.url, /\/v1\/messages/);
  assert.equal(call.headers.get('x-api-key'), KEY);
  assert.match(call.headers.get('anthropic-beta'), /server-side-fallback-2026-07-01/);
  assert.equal(call.body.model, 'claude-opus-5-5');
  assert.equal(call.body.fallbacks, 'default');
  assert.equal(call.body.output_config.format.type, 'json_schema');
  assert.deepEqual(call.body.output_config.format.schema.required, ['description', 'details']);
  assert.match(call.body.system, /Never invent a material/);
  const brief = call.body.messages[0].content;
  assert.match(brief, /Product name: THE FACE TEE/);
  assert.match(brief, /Colours: Indigo, Black, White/);
  assert.match(brief, /Sizes: S, M, L, XL/);
  assert.match(brief, /Owner's notes:\nHeavy 240gsm cotton, boxy fit.\nPrint from Yoruba carvings.$/);

  const saved = await shop.one("SELECT description, details FROM products WHERE id = 'tee'");
  assert.deepEqual(saved, { description: '', details: '' }, 'a draft is only a draft');
});

test('the words already there are sent along, to be improved', async () => {
  await shop.request('/api/admin/products/cap', { method: 'PATCH', cookie, json: { description: 'A cap.', details: 'Cotton twill' } });
  await draft('cap', 'make it richer');
  const brief = anthropic.calls[0].body.messages[0].content;
  assert.match(brief, /Current description \(may be improved or replaced\):\nA cap\./);
  assert.match(brief, /Current details and care:\nCotton twill/);
});

test('notes that are missing or too long, and products that do not exist, are refused before any call', async () => {
  assert.equal((await draft('tee', '  ')).status, 400);
  assert.equal((await draft('tee', 'x'.repeat(1501))).status, 400);
  assert.equal((await draft('nope', 'heavy cotton')).status, 404);
  assert.equal(anthropic.calls.length, 0);
});

test('a refusal, a refused key or a broken reply each say what happened', async () => {
  anthropic.reply = { body: { ...written({}).body, content: [], stop_reason: 'refusal' } };
  let res = await draft('tee', 'heavy cotton');
  assert.equal(res.status, 422);
  assert.match(res.body.error, /would not write this one/);

  anthropic.reply = { status: 401, body: { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } } };
  res = await draft('tee', 'heavy cotton');
  assert.equal(res.status, 503);
  assert.match(res.body.error, /ANTHROPIC_API_KEY/);

  anthropic.reply = { body: { ...written({}).body, content: [{ type: 'text', text: '{"descr' }], stop_reason: 'max_tokens' } };
  res = await draft('tee', 'heavy cotton');
  assert.equal(res.status, 502);
  assert.match(res.body.error, /unfinished/);

  anthropic.reply = written({ description: '   ', details: '' });
  res = await draft('tee', 'heavy cotton');
  assert.equal(res.status, 502);
  assert.match(res.body.error, /empty/);
});
