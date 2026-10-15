/* Colours: a piece sold as colour + size, each with its own stock.
 *
 *   node --test server/test/colours.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, PHOTO, b64 } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); cookie = await shop.login(); });

const api = (path, method = 'GET', json) => shop.request(`/api/admin${path}`, { method, cookie, json });
const product = async (id) => (await api('/products')).body.find(p => p.id === id);
const shopProduct = async (id) => (await shop.request('/api/products')).body.find(p => p.id === id);
const stock = async (id, colour, size) =>
  (await shop.one('SELECT stock FROM variants WHERE product_id = $1 AND colour = $2 AND size = $3', [id, colour, size]))?.stock;
const buy = (items) => shop.checkout({ email: 'a@example.com', items });

test('every colour route refuses a caller who is not signed in', async () => {
  for (const [method, path] of [
    ['POST', '/api/admin/products/cap/colours'], ['PATCH', '/api/admin/products/tee/colours/1'],
    ['DELETE', '/api/admin/products/tee/colours/1'], ['POST', '/api/admin/products/tee/colours/1/image'],
    ['DELETE', '/api/admin/products/tee/colours/1/image']
  ]) {
    assert.equal((await shop.request(path, { method, json: {} })).status, 401, `${method} ${path}`);
  }
});

test('the colour bought is the colour whose stock goes down, and the order says which', async () => {
  const res = await buy([{ productId: 'tee', colour: 'Black', size: 'M', qty: 2 }]);
  assert.equal(res.status, 200, res.raw);
  assert.equal(await stock('tee', 'Black', 'M'), 8);
  assert.equal(await stock('tee', 'Indigo', 'M'), 18, 'another colour is untouched');

  const line = await shop.one('SELECT colour, size FROM order_items');
  assert.deepEqual(line, { colour: 'Black', size: 'M' });
  const page = await shop.request(`/api/orders/${res.body.reference}`);
  assert.equal(page.body.items[0].colour, 'Black', 'the customer\'s order page says which');
  const admin = (await api('/orders')).body[0];
  assert.equal(admin.items[0].colour, 'Black');
  const csv = await shop.request('/api/admin/orders.csv', { cookie });
  assert.match(csv.raw, /2× THE FACE TEE \(Black, M\)/);
});

test('a piece sold in colours cannot be bought without choosing one, or in one it does not come in', async () => {
  const none = await buy([{ productId: 'tee', size: 'M', qty: 1 }]);
  assert.equal(none.status, 400);
  assert.match(none.body.error, /choose a colour of THE FACE TEE/i);

  const pink = await buy([{ productId: 'tee', colour: 'Pink', size: 'M', qty: 1 }]);
  assert.equal(pink.status, 404);
  assert.match(pink.body.error, /no longer available in Pink, size M/);

  await shop.query("UPDATE variants SET stock = 1 WHERE product_id = 'tee' AND colour = 'White' AND size = 'XL'");
  const short = await buy([{ productId: 'tee', colour: 'White', size: 'XL', qty: 2 }]);
  assert.equal(short.status, 409);
  assert.match(short.body.error, /THE FACE TEE \(White, XL\) — only 1 left/);

  // And a piece with no colours is bought by size alone, as before.
  assert.equal((await buy([{ productId: 'scarf', size: 'ONE SIZE', qty: 1 }])).status, 200);
});

test('a colour sold out in one size shows so, while the others stay on sale', async () => {
  await shop.query("UPDATE variants SET stock = 0 WHERE product_id = 'tee' AND colour = 'White'");
  const tee = await shopProduct('tee');
  const white = tee.colours.find(c => c.name === 'White');
  assert.equal(white.soldOut, true);
  assert.ok(white.sizes.every(s => !s.available));
  assert.equal(tee.soldOut, false, 'the piece itself is still on sale in other colours');

  // Asking to hear when White, M is back, and the owner seeing exactly that.
  const ask = await shop.request('/api/stock-alerts', { method: 'POST',
    json: { productId: 'tee', colour: 'White', size: 'M', email: 'ada@example.com' } });
  assert.equal(ask.status, 200, ask.raw);
  const inStock = await shop.request('/api/stock-alerts', { method: 'POST',
    json: { productId: 'tee', colour: 'Black', size: 'M', email: 'ada@example.com' } });
  assert.equal(inStock.status, 409);
  assert.match(inStock.body.error, /Black, M is in stock/);
  const [group] = (await api('/stock-alerts')).body;
  assert.equal(group.colour, 'White');
  assert.equal(group.size, 'M');
  await shop.query("UPDATE variants SET stock = 3 WHERE product_id = 'tee' AND colour = 'White' AND size = 'M'");
  assert.equal((await api('/summary')).body.alertsReady, 1);
});

test('giving a piece its first colour keeps the stock already counted', async () => {
  const add = await api('/products/scarf/colours', 'POST', { name: 'black', hex: '#111111' });
  assert.equal(add.status, 201, add.raw);
  assert.deepEqual(add.body.colours.map(c => c.name), ['Black'], 'names are tidied');
  assert.equal(await stock('scarf', 'Black', 'ONE SIZE'), 22, 'the 22 already counted are the black ones');

  const second = await api('/products/scarf/colours', 'POST', { name: 'Indigo', hex: '#3D2F9E' });
  assert.equal(second.status, 201);
  assert.equal(await stock('scarf', 'Indigo', 'ONE SIZE'), 0, 'a new colour starts at 0');
  assert.equal(second.body.colours[1].hex, '#3d2f9e');

  assert.equal((await api('/products/scarf/colours', 'POST', { name: 'BLACK', hex: '#000000' })).status, 409, 'once each');
  assert.equal((await api('/products/scarf/colours', 'POST', { name: 'Red', hex: 'red' })).status, 400, 'a swatch is a colour code');
  assert.equal((await api('/products/scarf/colours', 'POST', { name: '  ', hex: '#ff0000' })).status, 400);

  // A size added later comes in every colour.
  await api('/products/scarf/sizes', 'POST', { size: 'Kids' });
  assert.equal(await stock('scarf', 'Black', 'KIDS'), 0);
  assert.equal(await stock('scarf', 'Indigo', 'KIDS'), 0);
});

test('a colour is renamed everywhere it is counted; past orders keep the old name', async () => {
  await buy([{ productId: 'tee', colour: 'Black', size: 'S', qty: 1 }]);
  await shop.request('/api/stock-alerts', { method: 'POST',
    json: { productId: 'phone', size: 'ONE SIZE', email: 'b@example.com' } });
  const black = (await product('tee')).colours.find(c => c.name === 'Black');

  const renamed = await api(`/products/tee/colours/${black.id}`, 'PATCH', { name: 'Jet Black', hex: '#000000' });
  assert.equal(renamed.status, 200, renamed.raw);
  assert.equal(await stock('tee', 'Jet Black', 'S'), 7);
  assert.equal(await stock('tee', 'Black', 'S'), undefined);
  assert.equal((await shop.one('SELECT colour FROM order_items')).colour, 'Black', 'what was sold stays as sold');

  const clash = await api(`/products/tee/colours/${black.id}`, 'PATCH', { name: 'white' });
  assert.equal(clash.status, 409);
});

test('a colour goes only once it is empty and nobody is paying for one; the last one leaves sizes behind', async () => {
  const tee = await product('tee');
  const white = tee.colours.find(c => c.name === 'White');
  const counted = await api(`/products/tee/colours/${white.id}`, 'DELETE');
  assert.equal(counted.status, 409);
  assert.match(counted.body.error, /Set the White counts to 0/);

  await shop.query("UPDATE variants SET stock = 0 WHERE product_id = 'tee' AND colour = 'White'");
  await shop.query("UPDATE variants SET stock = 1 WHERE product_id = 'tee' AND colour = 'White' AND size = 'S'");
  assert.equal((await buy([{ productId: 'tee', colour: 'White', size: 'S', qty: 1 }])).status, 200);
  const held = await api(`/products/tee/colours/${white.id}`, 'DELETE');
  assert.equal(held.status, 409);
  assert.match(held.body.error, /paying for a White one/);

  await shop.query("UPDATE orders SET status = 'abandoned'");
  const gone = await api(`/products/tee/colours/${white.id}`, 'DELETE');
  assert.equal(gone.status, 200, gone.raw);
  assert.deepEqual(gone.body.colours.map(c => c.name), ['Indigo', 'Black']);
  assert.ok(!gone.body.sizes.some(s => s.colour === 'White'));

  // The hoodie down to one colour, then none: its counts stay, by size alone.
  const hoodie = await product('hoodie');
  await shop.query("UPDATE variants SET stock = 0 WHERE product_id = 'hoodie' AND colour = 'Indigo'");
  await api(`/products/hoodie/colours/${hoodie.colours[1].id}`, 'DELETE');
  const last = await api(`/products/hoodie/colours/${hoodie.colours[0].id}`, 'DELETE');
  assert.equal(last.status, 200, last.raw);
  assert.deepEqual(last.body.colours, []);
  assert.equal(await stock('hoodie', '', 'M'), 9, 'the black ones counted are kept');
  assert.equal((await buy([{ productId: 'hoodie', size: 'M', qty: 1 }])).status, 200);
});

test('a colour can have its own photo, shown for it on the shop', async () => {
  const tee = await product('tee');
  const white = tee.colours.find(c => c.name === 'White');
  const up = await shop.request(`/api/admin/products/tee/colours/${white.id}/image`, {
    method: 'POST', cookie, json: { image: b64(PHOTO.webp), image2x: b64(PHOTO.webp) }
  });
  assert.equal(up.status, 200, up.raw);
  const shown = (await shopProduct('tee')).colours.find(c => c.name === 'White');
  assert.match(shown.img, /^\/api\/images\/\d+$/);
  assert.equal((await shop.request(shown.img)).status, 200);

  const svg = await shop.request(`/api/admin/products/tee/colours/${white.id}/image`, {
    method: 'POST', cookie, json: { image: b64(PHOTO.svg), image2x: b64(PHOTO.svg) }
  });
  assert.equal(svg.status, 415, 'the same photo checks as any other: an SVG is refused');

  const removed = await api(`/products/tee/colours/${white.id}/image`, 'DELETE');
  assert.equal(removed.body.colours.find(c => c.name === 'White').img, null, 'back to no photo of its own');
  const { n } = await shop.one('SELECT COUNT(*) AS n FROM images');
  assert.equal(n, 0, 'the photo is deleted, not left behind');
});

test('a colour can show a photo that shipped with the site, and an upload takes over from it', async () => {
  const black = (await shopProduct('tee')).colours.find(c => c.name === 'Black');
  assert.equal(black.img, '/assets/img/prod-tee-black.webp');
  assert.equal(black.img2x, '/assets/img/prod-tee-black@2x.webp');
  assert.equal((await shop.request(black.img)).status, 200);
});

test('the sales summary names the colours that sell', async () => {
  const ref = (await buy([{ productId: 'tee', colour: 'White', size: 'M', qty: 3 }])).body.reference;
  await shop.query("UPDATE orders SET status = 'paid', paid_at = now() WHERE reference = $1", [ref]);
  const { colours } = (await api('/sales')).body;
  assert.deepEqual(colours, [{ name: 'THE FACE TEE', colour: 'White', qty: 3 }]);
});

test('a new product can be made with its colours from the start', async () => {
  const res = await api('/products', 'POST', {
    name: 'The Wrap Skirt', priceNaira: 30000, sizes: ['S', 'M'],
    colours: [{ name: 'black', hex: '#111111' }, { name: 'Sand', hex: '#C8B48A' }]
  });
  assert.equal(res.status, 201, res.raw);
  assert.deepEqual(res.body.colours.map(c => [c.name, c.hex]), [['Black', '#111111'], ['Sand', '#c8b48a']]);
  assert.deepEqual(res.body.sizes.map(s => `${s.colour} ${s.size} ${s.stock}`),
    ['Black S 0', 'Black M 0', 'Sand S 0', 'Sand M 0'], 'every size in every colour, at 0');

  const twice = await api('/products', 'POST', { name: 'Twice', priceNaira: 1000,
    colours: [{ name: 'Red', hex: '#aa0000' }, { name: 'red', hex: '#bb0000' }] });
  assert.equal(twice.status, 400);
  const noSwatch = await api('/products', 'POST', { name: 'No swatch', priceNaira: 1000, colours: [{ name: 'Red' }] });
  assert.equal(noSwatch.status, 400);
});
