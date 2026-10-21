/* The Journal: the starter stories, what the shop sees (published, not
 * hidden), and the owner's writing, editing, hiding and deleting.
 *
 *   node --test server/test/journal.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, PHOTO, b64 } from './helpers.js';
import { STARTER_STORIES } from '../../src/data/journal.js';

let shop;
before(async () => { shop = await startShop(); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); });

const story = (over = {}) => ({
  title: 'A Night in Yaba', topic: 'lifestyle-community', dek: 'Where the city goes after dark.',
  body: 'First paragraph about the night.\n\n## A heading\n\nSecond paragraph.', ...over
});

test('the Journal starts with its starter stories, newest first, with reading times', async () => {
  const res = await shop.request('/api/journal');
  assert.equal(res.status, 200);
  assert.equal(res.body.length, STARTER_STORIES.length);
  const dates = res.body.map(s => s.publishedAt);
  assert.deepEqual(dates, [...dates].sort().reverse());
  assert.ok(res.body.every(s => s.readMinutes >= 1 && s.title && s.topic && !('body' in s)));
  const one = await shop.request(`/api/journal/${res.body[0].slug}`);
  assert.ok(one.body.body.length > 100);
  assert.equal(one.body.related.length, 3);
});

test('a story the owner deletes stays deleted', async () => {
  await shop.request('/api/journal');
  const cookie = await shop.login();
  await shop.request('/api/admin/journal/gift-cards-are-here', { method: 'DELETE', cookie });
  const list = (await shop.request('/api/journal')).body;
  assert.ok(!list.some(s => s.slug === 'gift-cards-are-here'));
});

test('the owner writes a story: checked, given an address, shown once published', async () => {
  const cookie = await shop.login();
  const post = (json) => shop.request('/api/admin/journal', { method: 'POST', cookie, json });
  assert.equal((await post(story({ topic: 'gossip' }))).body.field, 'topic');
  assert.equal((await post(story({ title: 'A' }))).body.field, 'title');
  assert.equal((await post(story({ body: 'Too short.' }))).body.field, 'body');

  const made = await post(story());
  assert.equal(made.status, 201, made.raw);
  assert.equal(made.body.slug, 'a-night-in-yaba');
  assert.equal((await post(story())).body.slug, 'a-night-in-yaba-2', 'the same title gets its own address');
  assert.equal((await shop.request('/api/journal/a-night-in-yaba')).status, 200);

  // Hidden, or published later: not in the shop yet; the admin still has it.
  await shop.request('/api/admin/journal/a-night-in-yaba', { method: 'PUT', cookie, json: story({ hidden: true }) });
  await shop.request('/api/admin/journal/a-night-in-yaba-2', { method: 'PUT', cookie,
    json: story({ publishedAt: new Date(Date.now() + 86_400_000).toISOString() }) });
  assert.equal((await shop.request('/api/journal/a-night-in-yaba')).status, 404);
  assert.equal((await shop.request('/api/journal/a-night-in-yaba-2')).status, 404);
  const admin = (await shop.request('/api/admin/journal', { cookie })).body;
  assert.equal(admin.find(s => s.slug === 'a-night-in-yaba').live, false);
  assert.equal(admin.find(s => s.slug === 'a-night-in-yaba-2').live, false);
});

test('a cover photo: uploaded for a story, served, and replaced cleanly', async () => {
  const cookie = await shop.login();
  await shop.request('/api/admin/journal', { method: 'POST', cookie, json: story() });
  const up = (bytes) => shop.request('/api/admin/journal/a-night-in-yaba/image', { method: 'POST', cookie,
    json: { image: b64(bytes), image2x: b64(bytes) } });
  assert.equal((await up(PHOTO.jpeg)).status, 200);
  const live = (await shop.request('/api/journal/a-night-in-yaba')).body;
  assert.match(live.img, /^\/api\/images\/\d+$/);
  assert.equal((await shop.request(live.img)).status, 200);
  await up(PHOTO.jpeg);
  assert.equal((await shop.one('SELECT COUNT(*)::int AS n FROM images')).n, 1, 'the old one is gone');
  assert.equal((await up(Buffer.from('not a picture'))).status, 415, 'not a picture: refused');
});

test('only the owner can write', async () => {
  for (const [method, path] of [['GET', '/api/admin/journal'], ['POST', '/api/admin/journal'],
    ['PUT', '/api/admin/journal/x'], ['DELETE', '/api/admin/journal/x'], ['POST', '/api/admin/journal/x/image']]) {
    assert.equal((await shop.request(path, method === 'GET' ? {} : { method, json: {} })).status, 401, `${method} ${path}`);
  }
});
