/* The Shop and Collections pages' details on each product: category, type,
 * collections, SKU, materials, fit, NEW, pre-order, partner, season and
 * "complete the look" — set in the admin, read by the shop.
 *
 *   node --test server/test/shop-pages.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); cookie = await shop.login(); });

const patch = (id, json) => shop.request(`/api/admin/products/${id}`, { method: 'PATCH', cookie, json });
const publicOne = async (id) => (await shop.request('/api/products')).body.find(p => p.id === id);

test('the shop gets each piece’s category, type and collections from the start', async () => {
  const tee = await publicOne('tee');
  assert.equal(tee.category, 'tshirts');
  assert.equal(tee.type, 'graphic');
  assert.deepEqual(tee.collections, ['drop-01']);
  assert.equal(tee.isNew, true);
  assert.equal(tee.preorder, false);
  assert.deepEqual(tee.look, []);
  assert.ok(!Number.isNaN(Date.parse(tee.addedAt)));
  const jacket = await publicOne('jacket');
  assert.deepEqual(jacket.collections, ['drop-01', 'essentials', 'limited']);
});

test('the owner sets every detail, and the shop shows them', async () => {
  const res = await patch('tee', {
    category: 'tshirts', type: 'essential', collections: ['limited', 'drop-01', 'limited'],
    sku: ' msq-ts-001 ', materials: '100% cotton', fit: 'Relaxed fit.\nModel wears M.',
    isNew: false, preorder: true, shipsNote: 'Ships from 1 Dec', partner: 'Kòlẹ́', season: '2024 — Drop 01',
    look: ['cap', 'backpack', 'tee']
  });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const tee = await publicOne('tee');
  assert.equal(tee.type, 'essential');
  assert.deepEqual(tee.collections, ['drop-01', 'limited'], 'in the shop’s own order, once each');
  assert.equal(tee.sku, 'MSQ-TS-001');
  assert.equal(tee.fit, 'Relaxed fit.\nModel wears M.');
  assert.equal(tee.preorder, true);
  assert.equal(tee.shipsNote, 'Ships from 1 Dec');
  assert.equal(tee.partner, 'Kòlẹ́');
  assert.equal(tee.season, '2024 — Drop 01');
  assert.deepEqual(tee.look, ['cap', 'backpack'], 'never itself');
});

test('a type must belong to the category, and a new category clears an old type', async () => {
  let res = await patch('tee', { type: 'caps' });
  assert.equal(res.status, 400);
  res = await patch('tee', { category: 'headwear' });
  assert.equal(res.status, 200);
  let tee = await publicOne('tee');
  assert.equal(tee.category, 'headwear');
  assert.equal(tee.type, null, 'graphic is not a kind of headwear');
  res = await patch('tee', { category: 'headwear', type: 'caps' });
  assert.equal(res.status, 200);
  res = await patch('tee', { category: '' });
  tee = await publicOne('tee');
  assert.equal(tee.category, null);
  assert.equal(tee.type, null);
});

test('nonsense is refused with a reason', async () => {
  for (const body of [
    { category: 'shoes' }, { collections: ['summer'] }, { collections: 'drop-01' },
    { sku: 'X'.repeat(40) }, { isNew: 'yes' }, { look: ['nope'] }, { look: ['a', 'b', 'c', 'd', 'e'] }
  ]) {
    const res = await patch('tee', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok(res.body.error);
  }
});
