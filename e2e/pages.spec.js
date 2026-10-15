/* Product pages, and the home page as the owner sets it in the admin. */

import { test, expect, signIn, card, setStock } from './fixtures.js';

const PHOTO = 'e2e/files/landscape.jpg';

test('a product card opens its page, where a size is chosen and bought', async ({ page }) => {
  await page.goto('/');
  await card(page, 'THE FACE TEE').getByRole('link', { name: 'THE FACE TEE' }).click();
  await expect(page).toHaveURL(/\/product\/tee$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE FACE TEE');
  await expect(page).toHaveTitle('THE FACE TEE — MASQ.');

  // Adding without a size asks for one, instead of guessing.
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await expect(page.getByRole('alert')).toHaveText('CHOOSE A SIZE FIRST');
  await expect(page.locator('.cart-count')).toHaveText('0');

  // It comes in colours: the first in stock is chosen, and another can be.
  await expect(page.getByRole('radio', { name: 'Indigo' })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: 'Black' }).click();
  await expect(page.getByText('COLOUR — BLACK')).toBeVisible();
  await expect(page).toHaveURL(/\/product\/tee\?colour=Black$/);

  await page.getByRole('button', { name: 'L', exact: true }).click();
  await expect(page.getByRole('button', { name: 'L', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await expect(page.locator('.cart-count')).toHaveText('1');

  await page.locator('.cart-btn').click();
  await expect(page.locator('.line-item__variant')).toHaveText('BLACK · SIZE L');
});

test('the size guide, low-stock note and other pieces are on the product page', async ({ page }) => {
  await signIn(page);
  await setStock(page, 'jacket', 'XL', 0);
  await page.goto('/product/jacket');
  await expect(page.getByRole('button', { name: 'XL, sold out' })).toBeDisabled();
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await expect(page.locator('.pdp__hint')).toHaveText('ONLY 2 LEFT IN M');

  await page.locator('#main').getByRole('button', { name: 'SIZE GUIDE' }).click();
  await expect(page.getByRole('dialog')).toContainText('true to size');
  await page.keyboard.press('Escape');

  const more = page.locator('.pdp__more-like .card');
  await expect(more).toHaveCount(4);
  await more.first().getByRole('link').click();
  await expect(page).not.toHaveURL(/\/product\/jacket$/);
  await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('THE SYMBOL JACKET');
});

test('the menu on a product page goes back to that part of the home page', async ({ page }) => {
  await page.goto('/product/cap');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'ESSENTIALS' }).click();
  await expect(page).toHaveURL(/\/#essentials$/);
  await expect(page.locator('#essentials')).toBeInViewport();
});

test('BACK on a product page returns to the same spot, with VIEW ALL still open', async ({ page }) => {
  await page.goto('/');
  await page.locator('#drop').getByRole('button', { name: 'VIEW ALL' }).click();
  const jacket = card(page, 'THE SYMBOL JACKET');
  await jacket.scrollIntoViewIfNeeded();
  await jacket.getByRole('link', { name: 'THE SYMBOL JACKET' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE SYMBOL JACKET');

  await page.locator('.pdp__back').click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#drop .link-arrow')).toHaveAttribute('aria-expanded', 'true');
  await expect(card(page, 'THE SYMBOL JACKET')).toBeInViewport();

  // The browser's own back does the same.
  await card(page, 'THE SYMBOL JACKET').getByRole('link', { name: 'THE SYMBOL JACKET' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE SYMBOL JACKET');
  await page.goBack();
  await expect(card(page, 'THE SYMBOL JACKET')).toBeInViewport();
});

test('someone who arrived from a shared link goes BACK into the shop, not off the site', async ({ page }) => {
  await page.goto('/product/airpods');   // only in the Essentials carousel
  await page.locator('.pdp__back').click();
  await expect(page).toHaveURL(/\/#essentials$/);
  await expect(page.locator('#essentials')).toBeInViewport();

  await page.goto('/product/tee');
  await page.locator('.pdp__back').click();
  await expect(page).toHaveURL(/\/#drop$/);
  await expect(page.locator('#drop')).toBeInViewport();
});

test('a product off sale, or never made, says so', async ({ page }) => {
  await page.goto('/product/no-such-thing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This piece is no longer available.');
  await page.getByRole('link', { name: 'SEE THE COLLECTION' }).click();
  await expect(page.locator('#drop')).toBeInViewport();
});

test('a description and extra photos written in the admin appear on the product page', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#products');
  const tee = page.locator('.admin-product', { has: page.locator('input[value="THE FACE TEE"]') });
  await tee.getByLabel(/^Description/).fill('Heavyweight cotton.\n\nPrinted by hand in Lagos.');
  await tee.getByLabel(/^Details and care/).fill('100% cotton\nWash cold');
  await tee.locator('.admin-product__details').getByRole('button', { name: 'SAVE', exact: true }).click();
  await expect(tee.locator('.admin-note--ok').first()).toBeVisible();

  await tee.getByLabel('Extra photo file for THE FACE TEE').setInputFiles(PHOTO);
  await expect(tee.locator('.admin-gallery__item img')).toHaveCount(1);

  await page.goto('/product/tee');
  await expect(page.locator('.pdp__text').first()).toHaveText('Heavyweight cotton.\n\nPrinted by hand in Lagos.');
  await expect(page.getByText('DETAILS & CARE')).toBeVisible();
  await expect(page.locator('.pdp__thumbs button')).toHaveCount(2);
  await page.getByRole('button', { name: 'Show photo 2 of 2' }).click();
  await expect(page.getByRole('button', { name: 'Show photo 2 of 2' })).toHaveAttribute('aria-current', 'true');

  // The photo can be taken away again.
  await page.goto('/admin#products');
  await page.getByRole('button', { name: 'Remove extra photo 1 of THE FACE TEE' }).click();
  await expect(page.locator('.admin-gallery__item')).toHaveCount(0);
});

test('a product photo opens full screen, where it can be looked at closely', async ({ page }) => {
  await page.goto('/product/tee');
  await page.getByRole('button', { name: 'Enlarge photo 1 of THE FACE TEE' }).click();
  const viewer = page.getByRole('dialog', { name: 'THE FACE TEE: photos' });
  await expect(viewer).toBeVisible();
  // The sharper copy is the one shown.
  await expect(viewer.locator('.zoom__img')).toHaveAttribute('src', /@2x/);

  await viewer.locator('.zoom__img').click();
  await expect(viewer.locator('.zoom__img')).toHaveClass(/is-zoomed/);
  await expect(viewer.getByRole('button', { name: 'Zoom out' })).toHaveAttribute('aria-pressed', 'true');
  await viewer.getByRole('button', { name: 'Zoom out' }).click();
  await expect(viewer.locator('.zoom__img')).not.toHaveClass(/is-zoomed/);

  await page.keyboard.press('Escape');
  await expect(viewer).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enlarge photo 1 of THE FACE TEE' })).toBeFocused();
});

test('a device set to reduce motion gets the shop without the extra movement', async ({ browser }) => {
  const calm = await browser.newPage({ reducedMotion: 'reduce' });
  await calm.goto('/');
  await expect(calm.locator('.hero__title')).toHaveText('MASQ.');
  await expect(calm.locator('.hero__title')).toBeVisible();
  // No smooth scrolling and no drifting photos.
  await expect(calm.locator('html')).not.toHaveClass(/lenis|has-drift/);
  await calm.close();
});

test('the home page words, menu and photos are changed from the admin', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#home');
  await page.getByLabel('Small line above MASQ.').fill('DROP 02');
  await page.getByLabel('Heading over the product grid').fill('Drop 02 — Night Rituals');
  await page.getByLabel('Menu item that goes to the Essentials carousel').fill('lookbook');
  const journal = page.locator('.admin-menu-row', { has: page.getByLabel('Menu item that goes to the film strip') });
  await journal.locator('.admin-toggle').click();
  await page.getByRole('button', { name: 'SAVE WORDS' }).click();
  await expect(page.locator('.admin-note--ok')).toBeVisible();

  const hero = page.locator('.admin-home-photo--hero');
  await hero.getByLabel('Photo for Top of the page').setInputFiles(PHOTO);
  await expect(hero.locator('.admin-home-photo__tag')).toHaveText('YOUR PHOTO');

  await page.goto('/');
  await expect(page.locator('.hero .eyebrow')).toHaveText('DROP 02');
  await expect(page.locator('#drop .section__title')).toHaveText('Drop 02 — Night Rituals');
  const nav = page.getByRole('navigation', { name: 'Primary' });
  await expect(nav.getByRole('link')).toHaveText(['SHOP', 'LOOKBOOK', 'ABOUT']);
  await expect(page.locator('.hero__media img')).toHaveAttribute('src', /^\/api\/images\/\d+$/);
  expect(await page.locator('.hero__media img').evaluate(img => img.decode().then(() => img.naturalWidth))).toBeGreaterThan(0);

  // And back to the design's own photo.
  await page.goto('/admin#home');
  await hero.getByRole('button', { name: 'use original' }).click();
  await expect(hero.locator('.admin-home-photo__tag')).toHaveText('ORIGINAL');
  await page.goto('/');
  await expect(page.locator('.hero__media img')).toHaveAttribute('src', '/assets/img/hero-model.webp');
});
