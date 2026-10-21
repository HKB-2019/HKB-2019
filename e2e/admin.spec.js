/* The owner's journeys: photos, a new product, delivery prices. */

import { readFileSync } from 'node:fs';
import { test, expect, signIn, card } from './fixtures.js';

const PHOTO = 'e2e/files/landscape.jpg';
const NOT_A_PHOTO = 'e2e/files/not-a-photo.svg';

const productCard = (page, name) =>
  page.locator('.admin-product', { has: page.locator(`input[value="${name}"]`) });

test('a new photo is cropped, resized, uploaded and shown on the shop', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#products');
  const scarf = productCard(page, 'THE PATTERN SCARF');
  await scarf.getByLabel(/^Photo for /).setInputFiles(PHOTO);
  await expect(scarf.locator('.admin-product__photo > img')).toHaveAttribute('src', /^\/api\/images\/\d+$/);

  // What was stored: a 5:6 portrait, 700 and 1,400 px wide, from a landscape photo.
  const src = await scarf.locator('.admin-product__photo > img').getAttribute('src');
  const size = async (url) => page.evaluate(async (u) => {
    const img = new Image(); img.src = u; await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  }, url);
  expect(await size(src)).toEqual([700, 840]);
  expect(await size(src + '/2x')).toEqual([1000, 1200]);   // not enlarged past the source

  await page.goto('/');
  const shown = card(page, 'THE PATTERN SCARF').locator('img');
  await expect(shown).toHaveAttribute('src', src);
  expect(await shown.evaluate(img => img.complete && img.naturalWidth)).toBeGreaterThan(0);
});

test('a file that is not a photo is refused before it is uploaded', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#products');
  const scarf = productCard(page, 'THE PATTERN SCARF');
  await scarf.getByLabel(/^Photo for /).setInputFiles(NOT_A_PHOTO);
  await expect(scarf.locator('.admin-note--bad')).toContainText('JPEG, PNG or WebP');
  await expect(scarf.locator('.admin-product__photo > img')).toHaveAttribute('src', '/assets/img/d-scarf.webp');
});

test('a new product is made, photographed, stocked and put on sale — and a customer can buy it', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#products');
  await page.getByRole('button', { name: '+ NEW PRODUCT' }).click();
  await page.locator('.admin-new .admin-field', { hasText: 'Name' }).locator('input').fill('The Night Tee');
  await page.locator('.admin-new .admin-field', { hasText: 'Price' }).locator('input').fill('30,000');
  await page.locator('.admin-new .admin-field', { hasText: 'Sizes' }).locator('input').fill('S, M');
  await page.getByRole('button', { name: 'CREATE' }).click();

  const night = productCard(page, 'The Night Tee');
  await expect(night.locator('.admin-status').first()).toHaveText('off sale');

  // Not on sale without a photo.
  await night.locator('.admin-toggle', { hasText: 'On sale' }).click();
  await expect(night.locator('.admin-note--bad')).toContainText('Add a photo');

  await night.getByLabel(/^Photo for /).setInputFiles(PHOTO);
  await expect(night.locator('.admin-product__photo > img')).toBeVisible();
  const m = night.getByLabel('The Night Tee, size M, in stock');
  await m.fill('5');
  await m.press('Enter');
  await expect(night.getByLabel('The Night Tee, size M, in stock')).toHaveValue('5');
  await night.locator('.admin-toggle', { hasText: 'On sale' }).click();
  await expect(night.locator('.admin-status').first()).toHaveText('on sale');

  // On the shop, S is struck out (none in stock) and M can be bought.
  await page.goto('/');
  const tee = card(page, 'The Night Tee');
  await expect(tee.locator('.card__price')).toHaveText('₦30,000');
  await tee.hover();
  await tee.getByRole('button', { name: 'QUICK ADD' }).click();
  await expect(tee.getByRole('button', { name: 'S sold out' })).toBeDisabled();
  await tee.getByRole('button', { name: 'Add The Night Tee in M' }).click();
  await expect(page.locator('.cart-count')).toHaveText('1');
});

test('delivery prices set in the admin are what the customer is charged', async ({ page, shop }) => {
  await shop.reset({ delivery: false });
  await signIn(page);
  await page.goto('/admin');
  await expect(page.locator('.admin-alert')).toContainText('Checkout is closed');
  await page.getByRole('button', { name: 'Set delivery prices →' }).click();

  await page.getByLabel('Deliver to Lagos').check({ force: true });
  await page.getByLabel('Delivery fee for Lagos').fill('1800');
  await page.getByRole('button', { name: 'SAVE DELIVERY' }).click();
  await expect(page.locator('.admin-card').first().locator('.admin-note--ok')).toBeVisible();

  await page.goto('/');
  const scarf = card(page, 'THE PATTERN SCARF');
  await scarf.hover();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await page.selectOption('#d-state', 'Lagos');
  await expect(page.locator('.delivery__sum')).toContainText('₦1,800');
  await page.selectOption('#d-state', 'Kano');
  await expect(page.locator('.delivery__sum')).toContainText('NOT AVAILABLE');
});

test('a delivery fee left blank is pointed out, not saved', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#settings');
  await page.getByLabel('Deliver to Outside Nigeria').check({ force: true });
  await page.getByRole('button', { name: 'SAVE DELIVERY' }).click();
  await expect(page.locator('.admin-card').first()).toContainText('Outside Nigeria: type the fee');
  await expect(page.getByLabel('Delivery fee for Outside Nigeria')).toBeFocused();
});

test('a delivery switch works the moment it is flipped, with no SAVE needed', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#settings');
  const abroad = page.getByLabel('Deliver to Outside Nigeria');
  const toCheckout = async () => {
    await page.goto('/product/scarf');
    await page.getByRole('button', { name: 'ADD TO BAG' }).click();
    await page.getByRole('button', { name: 'VIEW BAG' }).click();
    await page.getByRole('button', { name: 'CHECKOUT' }).click();
  };

  // On, with its fee typed first: the switch alone opens it.
  await page.getByLabel('Delivery fee for Outside Nigeria').fill('40000');
  await abroad.check({ force: true });
  await expect(page.locator('.admin-card').first().locator('.admin-note--ok')).toBeVisible();
  await toCheckout();
  await expect(page.locator('#d-country')).toBeVisible();

  // Off, and straight to the shop without pressing anything else.
  await page.goto('/admin#settings');
  await expect(abroad).toBeChecked();
  await abroad.uncheck({ force: true });
  await expect(page.locator('.admin-card').first().locator('.admin-note--ok')).toBeVisible();
  await toCheckout();
  await expect(page.locator('#d-country')).toHaveCount(0);
  await expect(page.locator('select#d-state')).toBeVisible();

  // And it stays off when the admin is opened again.
  await page.goto('/admin#settings');
  await expect(abroad).not.toBeChecked();
});

test('the orders spreadsheet downloads', async ({ page }) => {
  await signIn(page);
  await page.request.post('/api/checkout', { data: {
    email: 'a@example.com', name: 'Ada Obi', phone: '0803 123 4567',
    address: { line1: '12 Admiralty Way', city: 'Lekki', state: 'Lagos', country: 'Nigeria' },
    items: [{ productId: 'scarf', size: 'ONE SIZE', qty: 1 }]
  } });
  await page.goto('/admin');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'DOWNLOAD CSV' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^masq-orders-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = readFileSync(await file.path(), 'utf8');
  expect(text).toContain('Ada Obi');
  expect(text).toContain('12 Admiralty Way');
});

test('"write it for me" drafts the words from the owner’s notes; nothing is live until SAVE', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#products');
  const cap = productCard(page, 'THE MARK CAP');
  const description = cap.getByPlaceholder('What it is, how it fits, the story behind it.');
  await cap.getByRole('button', { name: 'WRITE IT FOR ME' }).click();

  const write = cap.getByRole('button', { name: 'WRITE', exact: true });
  await expect(write).toBeDisabled();                       // notes first
  await cap.getByLabel('Notes about THE MARK CAP for the draft').fill('cotton twill, embossed mask, adjustable strap');
  await write.click();
  await expect(cap.getByRole('status')).toContainText('Draft written. Read it over, change anything, then SAVE.');
  await expect(description).toHaveValue('THE MARK CAP: a drafted description. cotton twill, embossed mask, adjustable strap');
  await expect(cap.getByPlaceholder(/100% cotton/)).toHaveValue('cotton twill\nembossed mask\nadjustable strap');

  // Not on the shop yet; undo puts the old (empty) words back.
  await cap.getByRole('button', { name: 'undo' }).click();
  await expect(description).toHaveValue('');

  // Drafted again, edited, saved: now it is on the product page.
  await cap.getByRole('button', { name: 'WRITE IT FOR ME' }).click();
  await cap.getByLabel('Notes about THE MARK CAP for the draft').fill('cotton twill');
  await cap.getByRole('button', { name: 'WRITE', exact: true }).click();
  await expect(description).toHaveValue(/a drafted description/);
  await description.fill('A structured cap in cotton twill.');
  await cap.locator('.admin-product__save').getByRole('button', { name: 'SAVE' }).click();
  await expect(cap.locator('.admin-product__save')).toContainText('saved');
  await page.goto('/product/cap');
  await expect(page.locator('.pdp__lede')).toHaveText('A structured cap in cotton twill.');
});
