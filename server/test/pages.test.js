/* Product pages and the home page: words and photos the owner sets in the
 * admin, and what a shared link shows.
 *
 *   node --test server/test/pages.test.js
 */
import { test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { startShop, stubPaystack, PHOTO, b64 } from './helpers.js';

let shop, cookie;
before(async () => { shop = await startShop(); stubPaystack(shop.one); });
after(async () => { await shop.close(); });
beforeEach(async () => { await shop.reset(); cookie = await shop.login(); });

const api = (path, method = 'GET', json) => shop.request(`/api/admin${path}`, { method, cookie, json });
const photo = (buf = PHOTO.webp) => ({ image: b64(buf), image2x: b64(buf) });
const publicProduct = async (id) => (await shop.request('/api/products')).body.find(p => p.id === id);
const site = async () => (await shop.request('/api/site')).body;
const imageCount = async () => (await shop.one('SELECT COUNT(*) AS n FROM images')).n;

/* ---- the door ------------------------------------------------------------- */

test('the new admin routes refuse a caller who is not signed in', async () => {
  for (const [method, path] of [
    ['POST', '/api/admin/products/tee/photos'], ['DELETE', '/api/admin/products/tee/photos/1'],
    ['POST', '/api/admin/home/image/hero'], ['DELETE', '/api/admin/home/image/hero'],
    ['PUT', '/api/admin/settings/home']
  ]) {
    const res = await shop.request(path, { method, json: {} });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
  const big = 'A'.repeat(6_000_000);
  const res = await shop.request('/api/admin/home/image/hero', { method: 'POST', json: { image: big, image2x: big } });
  assert.equal(res.status, 401, 'turned away before the body is read');
});

/* ---- product words -------------------------------------------------------- */

test('a description and care details can be written, and show to customers as plain text', async () => {
  const res = await api('/products/tee', 'PATCH', {
    description: '  Heavyweight cotton.\r\n\r\n\r\n\r\nCut boxy. <b>bold</b>  ',
    details: '100% cotton\nWash cold'
  });
  assert.equal(res.status, 200, res.raw);
  assert.equal(res.body.description, 'Heavyweight cotton.\n\nCut boxy. <b>bold</b>', 'trimmed, runs of blank lines squeezed; stored as typed, shown as text');
  const tee = await publicProduct('tee');
  assert.equal(tee.details, '100% cotton\nWash cold');

  const cleared = await api('/products/tee', 'PATCH', { description: '' });
  assert.equal(cleared.body.description, '', 'may be left empty');
});

test('product words that are too long, or not words, are refused', async () => {
  for (const [body, message] of [
    [{ description: 'x'.repeat(2001) }, /2000/],
    [{ details: 'x'.repeat(1001) }, /1000/],
    [{ description: 42 }, /missing/]
  ]) {
    const res = await api('/products/tee', 'PATCH', body);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    assert.match(res.body.error, message);
  }
  const made = await api('/products', 'POST', { name: 'Night Tee', priceNaira: 30000, description: 'Soft.' });
  assert.equal(made.body.description, 'Soft.', 'a new product can start with one');
});

/* ---- gallery -------------------------------------------------------------- */

test('extra photos join the gallery after the main one, and can be removed', async () => {
  const before = await imageCount();
  const a = await shop.request('/api/admin/products/tee/photos', { method: 'POST', cookie, json: photo(PHOTO.webp) });
  assert.equal(a.status, 201, a.raw);
  const b = await shop.request('/api/admin/products/tee/photos', { method: 'POST', cookie, json: photo(PHOTO.jpeg) });
  assert.equal(b.body.photos.length, 3, 'main + 2');
  assert.equal(b.body.photos[0].img, '/assets/img/prod-tee.webp', 'the main photo first');

  const tee = await publicProduct('tee');
  assert.deepEqual(tee.photos.map(p => p.img), b.body.photos.map(p => p.img), 'customers see the same gallery');
  const served = await fetch(shop.base + tee.photos[2].img);
  assert.equal(served.headers.get('content-type'), 'image/jpeg');

  const gone = await api(`/products/tee/photos/${b.body.photos[1].id}`, 'DELETE');
  assert.equal(gone.status, 200);
  assert.equal(gone.body.photos.length, 2);
  assert.equal(await imageCount(), before + 1, 'the removed photo is deleted, not left behind');

  const again = await api(`/products/tee/photos/${b.body.photos[1].id}`, 'DELETE');
  assert.equal(again.status, 404);
  const other = await api(`/products/cap/photos/${b.body.photos[2].id}`, 'DELETE');
  assert.equal(other.status, 404, 'a photo can only be removed through its own product');
});

test('a gallery photo is checked like any other, and there is a limit', async () => {
  const svg = await shop.request('/api/admin/products/tee/photos', { method: 'POST', cookie, json: photo(PHOTO.svg) });
  assert.equal(svg.status, 415);
  const none = await shop.request('/api/admin/products/nope/photos', { method: 'POST', cookie, json: photo() });
  assert.equal(none.status, 404);

  for (let i = 0; i < 6; i++) {
    const r = await shop.request('/api/admin/products/tee/photos', { method: 'POST', cookie, json: photo() });
    assert.equal(r.status, 201);
  }
  const seventh = await shop.request('/api/admin/products/tee/photos', { method: 'POST', cookie, json: photo() });
  assert.equal(seventh.status, 409);
  assert.match(seventh.body.error, /6 extra photos/);
});

test('reseeding clears gallery photos with the rest', async () => {
  await shop.request('/api/admin/products/tee/photos', { method: 'POST', cookie, json: photo() });
  await shop.reset();
  assert.equal((await shop.one('SELECT COUNT(*) AS n FROM product_photos')).n, 0);
});

/* ---- home page words ------------------------------------------------------ */

test('the home page starts with the design’s own words', async () => {
  const { home } = await site();
  assert.equal(home.heroEyebrow, 'URBAN RITUALS');
  assert.equal(home.heroSub, 'Modern identity wear\nrooted in culture.');
  assert.deepEqual(home.nav.collections, { label: 'COLLECTIONS', show: true });
  assert.deepEqual(home.images, { hero: null, band: null, film: null }, 'built-in photos until replaced');
});

test('the home page words and menu can be changed, and a hidden menu item says so', async () => {
  const { body: current } = await api('/settings');
  const home = structuredClone(current.home);
  home.heroEyebrow = '  Drop  02  ';
  home.manifestoLine1 = 'We make masks.';
  home.nav.collections = { label: 'lookbook', show: true };
  home.nav.journal = { label: 'FILM', show: false };
  const res = await api('/settings/home', 'PUT', home);
  assert.equal(res.status, 200, res.raw);

  const after = (await site()).home;
  assert.equal(after.heroEyebrow, 'Drop 02', 'one line, spaces tidied');
  assert.equal(after.manifestoLine1, 'We make masks.');
  assert.deepEqual(after.nav.collections, { label: 'LOOKBOOK', show: true });
  assert.equal(after.nav.journal.show, false);
});

test('the welcome pop-up is on by default, and its switch and timing are checked', async () => {
  assert.deepEqual((await site()).home.welcome, { show: true, delay: 4 });
  assert.equal((await site()).home.welcomeTitle, 'Be first to the next drop.');

  const { body: current } = await api('/settings');
  const off = await api('/settings/home', 'PUT', { ...current.home, welcome: { show: false, delay: 15 } });
  assert.equal(off.status, 200, off.raw);
  assert.deepEqual((await site()).home.welcome, { show: false, delay: 15 });

  const odd = await api('/settings/home', 'PUT', { ...current.home, welcome: { show: true, delay: 7 } });
  assert.equal(odd.status, 400);
  assert.match(odd.body.error, /0, 2, 4, 8, 15, 30, 60 seconds/);

  // Words saved before the pop-up existed still read, with its defaults.
  const { welcome, welcomeTitle, welcomeNote, ...older } = current.home;
  await shop.query("UPDATE settings SET value = $1 WHERE key = 'home'", [JSON.stringify(older)]);
  assert.deepEqual((await site()).home.welcome, { show: true, delay: 4 });
});

test('home page words that would break the page are refused', async () => {
  const { body: current } = await api('/settings');
  for (const [field, value, message] of [
    ['heroButton', '', /blank/],
    ['heroEyebrow', 'x'.repeat(41), /40/],
    ['craftText', 7, /missing/]
  ]) {
    const res = await api('/settings/home', 'PUT', { ...current.home, [field]: value });
    assert.equal(res.status, 400, field);
    assert.match(res.body.error, message);
  }
  const blankMenu = await api('/settings/home', 'PUT', { ...current.home, nav: { ...current.home.nav, shop: { label: ' ', show: true } } });
  assert.equal(blankMenu.status, 400);
  const sneaky = await api('/settings/home', 'PUT', { ...current.home, images: { hero: 1 } });
  assert.equal(sneaky.status, 200);
  assert.deepEqual((await site()).home.images.hero, null, 'photos cannot be pointed anywhere through the words');
});

/* ---- home page photos ----------------------------------------------------- */

test('a home photo can be replaced, replaced again, and put back', async () => {
  const before = await imageCount();
  const first = await shop.request('/api/admin/home/image/hero', { method: 'POST', cookie, json: photo(PHOTO.webp) });
  assert.equal(first.status, 200, first.raw);
  const hero1 = (await site()).home.images.hero;
  assert.match(hero1.img, /^\/api\/images\/\d+$/);
  assert.equal(hero1.img2x, hero1.img + '/2x');

  await shop.request('/api/admin/home/image/hero', { method: 'POST', cookie, json: photo(PHOTO.jpeg) });
  const hero2 = (await site()).home.images.hero;
  assert.notEqual(hero2.img, hero1.img);
  assert.equal(await imageCount(), before + 1, 'the replaced photo is deleted');
  assert.equal((await fetch(shop.base + hero1.img)).status, 404);

  const back = await api('/home/image/hero', 'DELETE');
  assert.equal(back.status, 200);
  assert.equal((await site()).home.images.hero, null);
  assert.equal(await imageCount(), before);
});

test('only the three home photo places exist, and each takes only a real photo', async () => {
  const wrong = await shop.request('/api/admin/home/image/logo', { method: 'POST', cookie, json: photo() });
  assert.equal(wrong.status, 404);
  const svg = await shop.request('/api/admin/home/image/band', { method: 'POST', cookie, json: photo(PHOTO.svg) });
  assert.equal(svg.status, 415);
  const mixed = await shop.request('/api/admin/home/image/film', { method: 'POST', cookie,
    json: { image: b64(PHOTO.webp), image2x: b64(PHOTO.png) } });
  assert.equal(mixed.status, 400);
  assert.deepEqual((await site()).home.images, { hero: null, band: null, film: null });
});

test('the home photo setting cannot be written through the ordinary settings door', async () => {
  const res = await api('/settings/home_images', 'PUT', { hero: 1 });
  assert.equal(res.status, 404);
  const read = await api('/settings/home_images');
  assert.equal(read.status, 404);
});

/* ---- link previews -------------------------------------------------------- */

const built = existsSync(new URL('../../dist/index.html', import.meta.url));

test('a shared product link shows its name, price, words and photo', { skip: !built && 'run npm run build first' }, async () => {
  await api('/products/tee', 'PATCH', { description: 'Heavy "cotton" <script>alert(1)</script> & more.' });
  const page = await shop.request('/product/tee');
  assert.equal(page.status, 200);
  assert.match(page.raw, /<title>THE FACE TEE — MASQ\.<\/title>/);
  assert.match(page.raw, /og:title" content="THE FACE TEE — MASQ\."/);
  assert.match(page.raw, /og:description" content="₦28,000 · Heavy &quot;cotton&quot; &lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; more\."/);
  assert.ok(!page.raw.includes('<script>alert(1)'), 'the owner’s words cannot become code');
  assert.match(page.raw, /og:image" content="http:\/\/127\.0\.0\.1:\d+\/assets\/img\/prod-tee@2x\.webp"/);
  assert.match(page.raw, /og:type" content="product"/);
  assert.ok(!page.raw.includes('og:image:width'), 'the built-in preview’s size no longer applies');
  assert.ok(page.raw.includes('<link rel="preload" as="image" fetchpriority="high" href="/assets/img/prod-tee.webp" ' +
    'imagesrcset="/assets/img/prod-tee.webp 700w, /assets/img/prod-tee@2x.webp 1400w" imagesizes="(max-width:900px) 100vw, 50vw">'),
    'the big photo starts loading with the page');

  const hidden = await api('/products/tee', 'PATCH', { hidden: true });
  assert.equal(hidden.status, 200);
  const off = await shop.request('/product/tee');
  assert.equal(off.status, 404, 'a product off sale is not found');
  assert.match(off.raw, /<div id="root">/, 'but still gets the page, which says so');

  const odd = await shop.request('/product/..%2Fadmin');
  assert.equal(odd.status, 200, 'not a product address; the page decides');
});

test('an uploaded hero becomes the home page’s preview photo', { skip: !built && 'run npm run build first' }, async () => {
  const before = await shop.request('/');
  assert.ok(before.raw.includes('<link rel="preload" as="image" fetchpriority="high" href="/assets/img/hero-model.webp">'),
    'the built-in hero starts loading with the page');
  await shop.request('/api/admin/home/image/hero', { method: 'POST', cookie, json: photo() });
  const { img } = (await site()).home.images.hero;
  const home = await shop.request('/');
  assert.ok(home.raw.includes(`og:image" content="${shop.base}${img}"`));
  assert.ok(home.raw.includes(`href="${img}" imagesrcset="${img} 1x, ${img}/2x 2x">`), 'and is the one loaded early');
  assert.ok(!home.raw.includes('hero-model.webp'), 'the built-in one is not fetched for nothing');
});
