/* Product editing, photo upload, settings, exports — the admin's new powers,
 * and the walls around them.
 *
 *   node --test server/test/admin-products.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { startShop, stubPaystack, PHOTO, b64, DELIVERY } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); cookie = await shop.login(); });

const api = (path, method = 'GET', json) => shop.request(`/api/admin${path}`, { method, cookie, json });
const upload = (id, image, image2x = image) =>
  shop.request(`/api/admin/products/${id}/image`, { method: 'POST', cookie, json: { image, image2x } });
const publicList = async () => (await shop.request('/api/products')).body;

/* ---- the door ------------------------------------------------------------- */

test('every new admin route refuses a caller who is not signed in', async () => {
  const routes = [
    ['GET', '/api/admin/products'], ['POST', '/api/admin/products'],
    ['PATCH', '/api/admin/products/tee'], ['POST', '/api/admin/products/tee/move'],
    ['POST', '/api/admin/products/tee/sizes'], ['DELETE', '/api/admin/products/tee/sizes/1'],
    ['POST', '/api/admin/products/tee/image'], ['DELETE', '/api/admin/products/tee/image'],
    ['GET', '/api/admin/settings'], ['PUT', '/api/admin/settings/delivery'],
    ['GET', '/api/admin/subscribers'], ['GET', '/api/admin/subscribers.csv'],
    ['DELETE', '/api/admin/subscribers/1'], ['GET', '/api/admin/orders.csv']
  ];
  for (const [method, path] of routes) {
    const res = await shop.request(path, { method, json: method === 'GET' ? undefined : {} });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test('a large upload from someone not signed in is turned away before it is read', async () => {
  const big = 'A'.repeat(6_000_000);          // bigger than any photo limit
  const res = await shop.request('/api/admin/products/tee/image', {
    method: 'POST', json: { image: big, image2x: big }
  });
  assert.equal(res.status, 401, 'refused at the door, not 413 after reading it');
});

/* ---- creating and editing ------------------------------------------------- */

test('a new product starts off sale with no stock, under a readable unique id', async () => {
  const a = await api('/products', 'POST', { name: 'Night Tee', priceNaira: 30000, sizes: ['s', 'm'] });
  assert.equal(a.status, 201, a.raw);
  assert.equal(a.body.id, 'night-tee');
  assert.equal(a.body.hidden, true);
  assert.equal(a.body.priceKobo, 3_000_000);
  assert.deepEqual(a.body.sizes.map(s => [s.size, s.stock]), [['S', 0], ['M', 0]]);

  const b = await api('/products', 'POST', { name: 'Night Tee!', priceNaira: 30000 });
  assert.equal(b.body.id, 'night-tee-2');
  assert.deepEqual(b.body.sizes.map(s => s.size), ['ONE SIZE'], 'one size when none are given');

  assert.ok(!(await publicList()).find(p => p.id === 'night-tee'), 'invisible to customers');
});

test('nonsense product details are refused', async () => {
  for (const [body, message] of [
    [{ name: '', priceNaira: 100 }, /name/],
    [{ name: 'x'.repeat(61), priceNaira: 100 }, /60/],
    [{ name: 'Tee', priceNaira: '28000' }, /whole number/],
    [{ name: 'Tee', priceNaira: 99.5 }, /whole number/],
    [{ name: 'Tee', priceNaira: 50 }, /at least/],
    [{ name: 'Tee', priceNaira: 2_000_000 }, /1,000,000/],
    [{ name: 'Tee', priceNaira: 100, sizes: ['M', 'm'] }, /once/],
    [{ name: 'Tee', priceNaira: 100, badge: 'X'.repeat(17) }, /16/]
  ]) {
    const res = await api('/products', 'POST', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.match(res.body.error, message);
  }
});

test('name, price, badge and placement can be changed, and show on the shop page', async () => {
  const res = await api('/products/tee', 'PATCH', {
    name: 'THE FACE TEE II', priceNaira: 29500, badge: 'new', featured: false, inEssentials: true
  });
  assert.equal(res.status, 200, res.raw);

  const tee = (await publicList()).find(p => p.id === 'tee');
  assert.equal(tee.name, 'THE FACE TEE II');
  assert.equal(tee.priceKobo, 2_950_000);
  assert.equal(tee.badge, 'NEW');
  assert.equal(tee.featured, false);
  assert.equal(tee.inEssentials, true);

  assert.equal((await api('/products/tee', 'PATCH', { badge: '' })).body.badge, null, 'badge removed');
  assert.equal((await api('/products/tee', 'PATCH', {})).status, 400);
  assert.equal((await api('/products/nope', 'PATCH', { name: 'X Y' })).status, 404);
  assert.equal((await api('/products/tee', 'PATCH', { hidden: 'yes' })).status, 400);
});

test('nothing goes on sale without a photo and a size', async () => {
  const { body: p } = await api('/products', 'POST', { name: 'Ghost', priceNaira: 5000 });
  const noPhoto = await api(`/products/${p.id}`, 'PATCH', { hidden: false });
  assert.equal(noPhoto.status, 409);
  assert.match(noPhoto.body.error, /photo/);

  assert.equal((await upload(p.id, b64(PHOTO.webp))).status, 200);
  const on = await api(`/products/${p.id}`, 'PATCH', { hidden: false });
  assert.equal(on.status, 200, on.raw);
  assert.ok((await publicList()).find(x => x.id === p.id), 'now on the shop page');
});

test('products can be moved earlier and later', async () => {
  const order = async () => (await publicList()).map(p => p.id);
  assert.deepEqual((await order()).slice(0, 3), ['tee', 'cap', 'backpack']);

  await api('/products/backpack/move', 'POST', { direction: 'up' });
  assert.deepEqual((await order()).slice(0, 3), ['tee', 'backpack', 'cap']);

  await api('/products/tee/move', 'POST', { direction: 'up' });        // already first
  assert.deepEqual((await order()).slice(0, 3), ['tee', 'backpack', 'cap']);

  assert.equal((await api('/products/tee/move', 'POST', { direction: 'sideways' })).status, 400);
});

/* ---- sizes ---------------------------------------------------------------- */

test('sizes can be added once each', async () => {
  const add = await api('/products/tee/sizes', 'POST', { size: 'xxl' });
  assert.equal(add.status, 201);
  assert.ok(add.body.sizes.find(s => s.size === 'XXL' && s.stock === 0));
  assert.equal((await api('/products/tee/sizes', 'POST', { size: 'XXL' })).status, 409);
});

test('a size can only be removed once it is empty and nobody is paying for one', async () => {
  const sizes = (await api('/products')).body.find(p => p.id === 'tee').sizes;
  const xl = sizes.find(s => s.size === 'XL');

  const counted = await api(`/products/tee/sizes/${xl.variantId}`, 'DELETE');
  assert.equal(counted.status, 409, 'it still has stock');
  assert.match(counted.body.error, /count to 0/);

  const order = await shop.checkout({ email: 'a@example.com', items: [{ productId: 'tee', size: 'XL', qty: 1 }] });
  assert.equal(order.status, 200, order.raw);
  await api(`/stock/${xl.variantId}`, 'POST', { stock: 0 });
  const held = await api(`/products/tee/sizes/${xl.variantId}`, 'DELETE');
  assert.equal(held.status, 409, 'an unfinished order holds one');

  await shop.query("UPDATE orders SET status = 'abandoned'");
  const gone = await api(`/products/tee/sizes/${xl.variantId}`, 'DELETE');
  assert.equal(gone.status, 200, gone.raw);
  assert.ok(!gone.body.sizes.find(s => s.size === 'XL'));
});

test('the last size of a product on sale cannot be removed', async () => {
  const cap = (await api('/products')).body.find(p => p.id === 'cap');
  await api(`/stock/${cap.sizes[0].variantId}`, 'POST', { stock: 0 });
  const res = await api(`/products/cap/sizes/${cap.sizes[0].variantId}`, 'DELETE');
  assert.equal(res.status, 409);
  assert.match(res.body.error, /off sale first/);
});

/* ---- photos --------------------------------------------------------------- */

test('WebP, PNG and JPEG photos are accepted, and served back as themselves', async () => {
  for (const [kind, mime] of [['webp', 'image/webp'], ['png', 'image/png'], ['jpeg', 'image/jpeg']]) {
    const res = await upload('tee', b64(PHOTO[kind]));
    assert.equal(res.status, 200, `${kind}: ${res.raw}`);
    assert.match(res.body.img, /^\/api\/images\/\d+$/);
    assert.equal(res.body.img2x, res.body.img + '/2x');

    const file = await shop.request(res.body.img);
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type'), mime);
    assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    assert.match(file.headers.get('cache-control'), /immutable/);
    assert.match(file.headers.get('content-security-policy'), /sandbox/);
  }
  const tee = (await publicList()).find(p => p.id === 'tee');
  assert.match(tee.img, /^\/api\/images\/\d+$/, 'the shop page uses the upload');
});

test('a file that is not a photo is refused, whatever it claims to be', async () => {
  for (const kind of ['svg', 'html', 'gif']) {
    const res = await upload('tee', b64(PHOTO[kind]));
    assert.equal(res.status, 415, kind);
  }
  // a data: URL that claims PNG but holds a script
  const liar = await upload('tee', 'data:image/png;base64,' + b64(PHOTO.html));
  assert.equal(liar.status, 415);
  assert.equal((await shop.one('SELECT COUNT(*) AS n FROM images')).n, 0, 'nothing stored');
});

test('broken, missing, mismatched and oversized uploads are refused', async () => {
  assert.equal((await upload('tee', undefined)).status, 400);
  assert.equal((await upload('tee', 'not base64 at all!!')).status, 400);
  assert.equal((await upload('tee', b64(PHOTO.webp), b64(PHOTO.png))).status, 400, 'two different formats');
  const huge = b64(Buffer.concat([PHOTO.webp, Buffer.alloc(2_600_000)]));
  assert.equal((await upload('tee', huge, b64(PHOTO.webp))).status, 413);
  assert.equal((await upload('nope', b64(PHOTO.webp))).status, 404);
});

test('replacing a photo deletes the old one; removing it goes back to the built-in photo', async () => {
  const first = await upload('tee', b64(PHOTO.webp));
  const second = await upload('tee', b64(PHOTO.png));
  assert.notEqual(first.body.img, second.body.img);
  assert.equal((await shop.request(first.body.img)).status, 404, 'the old photo is gone');
  assert.equal((await shop.one('SELECT COUNT(*) AS n FROM images')).n, 1);

  const reverted = await api('/products/tee/image', 'DELETE');
  assert.equal(reverted.body.img, 'assets/img/prod-tee.webp');
  assert.equal((await shop.one('SELECT COUNT(*) AS n FROM images')).n, 0);
});

test('a product on sale with no other photo keeps its upload', async () => {
  const { body: p } = await api('/products', 'POST', { name: 'Only Photo', priceNaira: 5000 });
  await upload(p.id, b64(PHOTO.webp));
  await api(`/products/${p.id}`, 'PATCH', { hidden: false });
  const res = await api(`/products/${p.id}/image`, 'DELETE');
  assert.equal(res.status, 409);
});

test('an image address that is not a number goes nowhere', async () => {
  for (const path of ['/api/images/abc', '/api/images/1;DROP', '/api/images/99999', '/api/images/1/3x']) {
    assert.equal((await shop.request(path)).status, 404, path);
  }
});

/* ---- settings ------------------------------------------------------------- */

const put = (key, value) => api(`/settings/${key}`, 'PUT', value);

test('delivery fees are checked before they are saved', async () => {
  for (const bad of [
    { ...DELIVERY, lagos: { enabled: true, feeKobo: null } },
    { ...DELIVERY, lagos: { enabled: true, feeKobo: -100 } },
    { ...DELIVERY, lagos: { enabled: true, feeKobo: 1.5 } },
    { ...DELIVERY, lagos: { enabled: true, feeKobo: 999_999_999 } }
  ]) {
    assert.equal((await put('delivery', bad)).status, 400, JSON.stringify(bad.lagos));
  }
  const ok = await put('delivery', { ...DELIVERY, lagos: { enabled: true, feeKobo: 0 } });
  assert.equal(ok.status, 200, 'free Lagos delivery is allowed, if chosen');
});

test('the summary says when checkout is closed', async () => {
  assert.equal((await api('/summary')).body.checkoutOpen, true);
  await put('delivery', Object.fromEntries(Object.keys(DELIVERY).map(z => [z, { enabled: false, feeKobo: null }])));
  assert.equal((await api('/summary')).body.checkoutOpen, false);
});

test('page text is plain text, not empty, not endless', async () => {
  const { body: all } = await api('/settings');
  const pages = { ...all.pages, CONTACT: 'studio@masq.ng\u0007\r\n+234 1 234 5678' };
  const res = await put('pages', pages);
  assert.equal(res.status, 200);
  assert.equal(res.body.CONTACT, 'studio@masq.ng\n+234 1 234 5678', 'control characters removed');

  assert.equal((await put('pages', { ...all.pages, FAQ: '   ' })).status, 400);
  assert.equal((await put('pages', { ...all.pages, FAQ: 'x'.repeat(4001) })).status, 400);
  assert.equal((await shop.request('/api/site')).body.pages.CONTACT, 'studio@masq.ng\n+234 1 234 5678');
});

test('social links must be real https links', async () => {
  for (const instagram of ['javascript:alert(1)', 'http://instagram.com/masq', 'data:text/html,x', 'instagram']) {
    assert.equal((await put('social', { instagram, tiktok: '', x: '' })).status, 400, instagram);
  }
  const ok = await put('social', { instagram: 'https://instagram.com/masq', tiktok: '', x: '' });
  assert.equal(ok.status, 200);
  assert.equal((await shop.request('/api/site')).body.social.instagram, 'https://instagram.com/masq');
});

test('the film link is reduced to what is safe to play', async () => {
  const cases = [
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://youtube.com/shorts/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
    ['https://cdn.example.com/films/urban-rituals.mp4', 'mp4', null]
  ];
  for (const [url, kind, youtubeId] of cases) {
    const res = await put('film', { url });
    assert.equal(res.status, 200, url);
    assert.equal(res.body.kind, kind);
    assert.equal(res.body.youtubeId, youtubeId);
  }
  for (const url of ['https://youtube.com/watch?v="><script>', 'https://vimeo.com/123', 'javascript:alert(1)']) {
    assert.equal((await put('film', { url })).status, 400, url);
  }
  assert.equal((await put('film', { url: '' })).status, 200, 'clearing it is fine');
  assert.equal((await shop.request('/api/site')).body.film, null);
});

test('an unknown setting is not a way to store things', async () => {
  assert.equal((await put('admin_password_hash', { value: 'scrypt$x$y' })).status, 404);
  assert.equal((await put('admin_password_hash', 'scrypt$x$y')).status, 400, 'a bare string is not even read');
  assert.equal((await put('anything', {})).status, 404);
  const hash = await shop.one("SELECT value FROM settings WHERE key = 'admin_password_hash'");
  assert.equal(hash, undefined, 'nothing was written');
});

/* ---- exports and the list ------------------------------------------------- */

test('the orders spreadsheet has the delivery details, and cannot run a formula', async () => {
  await shop.checkout({
    email: 'a@example.com', name: '=HYPERLINK("http://evil.test","click")',
    items: [{ productId: 'cap', size: 'ONE SIZE', qty: 2 }]
  });
  const res = await shop.request('/api/admin/orders.csv', { cookie });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/csv/);
  assert.match(res.headers.get('content-disposition'), /attachment; filename="masq-orders-\d{4}-\d{2}-\d{2}\.csv"/);
  // fetch's text() quietly drops a byte-order mark, so look at the bytes.
  const bytes = new Uint8Array(await (await fetch(shop.base + '/api/admin/orders.csv', { headers: { cookie } })).arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF], 'marked as UTF-8 so ₦ survives Excel');
  assert.ok(res.raw.includes(`"'=HYPERLINK(""http://evil.test"",""click"")"`), 'neutralised as text');
  assert.ok(res.raw.includes('"12 Admiralty Way"'));
  assert.ok(res.raw.includes('"2× THE MARK CAP (ONE SIZE)"'));
  assert.ok(res.raw.includes('"2500.00"'), 'delivery fee');
});

test('the mailing list can be read, exported and trimmed', async () => {
  await shop.request('/api/subscribe', { method: 'POST', json: { email: 'one@example.com' } });
  await shop.request('/api/subscribe', { method: 'POST', json: { email: '+cmd@example.com' } });

  const list = await api('/subscribers');
  assert.deepEqual(list.body.map(s => s.email).sort(), ['+cmd@example.com', 'one@example.com']);
  assert.equal((await api('/summary')).body.subscribers, 2);

  const csv = await shop.request('/api/admin/subscribers.csv', { cookie });
  assert.ok(csv.raw.includes(`"'+cmd@example.com"`), 'an address starting with + is kept as text');

  const id = list.body.find(s => s.email === 'one@example.com').id;
  assert.equal((await api(`/subscribers/${id}`, 'DELETE')).status, 200);
  assert.equal((await api(`/subscribers/${id}`, 'DELETE')).status, 404);
  assert.equal((await api('/subscribers/abc', 'DELETE')).status, 400);
});

test('orders show the admin who and where', async () => {
  await shop.checkout({ email: 'a@example.com', items: [{ productId: 'cap', size: 'ONE SIZE', qty: 1 }] });
  const [o] = (await api('/orders')).body;
  assert.equal(o.name, 'Ada Obi');
  assert.equal(o.phone, '+234 803 123 4567');
  assert.equal(o.address.line1, '12 Admiralty Way');
  assert.equal(o.zone, 'lagos');
  assert.equal(o.shippingKobo, 250_000);
  assert.equal(o.totalKobo, 1_400_000 + 250_000);
});

test('running low counts only what is on sale', async () => {
  const { body: p } = await api('/products', 'POST', { name: 'Setting Up', priceNaira: 5000, sizes: ['S'] });
  const low = (await api('/summary')).body.lowStock;
  assert.ok(!low.some(s => s.name === 'Setting Up'), 'a product being set up is at zero on purpose');
  assert.ok(low.some(s => s.name === 'THE MASK CASE'), 'the sold-out case on sale still shows');
  assert.ok(p.id);
});
