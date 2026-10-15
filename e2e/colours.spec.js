/* Colours, end to end: the owner gives a piece colours in the admin, and a
 * customer picks one and buys it. */

import { test, expect, signIn, card, setStock, fillDelivery } from './fixtures.js';

test('the owner adds colours, and a customer buys the one they pick', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#products');
  const cap = page.locator('.admin-product', { has: page.locator('input[value="THE MARK CAP"]') });

  // The first colour named is the stock already counted; a second starts at 0.
  await cap.getByLabel('New colour for THE MARK CAP').fill('Black');
  await cap.locator('.admin-colours__add').getByRole('button', { name: 'ADD' }).click();
  await expect(cap.getByLabel('Name of colour Black')).toHaveValue('Black');
  await cap.getByLabel('New colour for THE MARK CAP').fill('indigo');
  await cap.locator('.admin-colours__add').getByRole('button', { name: 'ADD' }).click();
  await expect(cap.getByLabel('Name of colour Indigo')).toHaveValue('Indigo');
  await expect(cap.getByLabel('THE MARK CAP, Black, size ONE SIZE, in stock')).toHaveValue('30');
  await expect(cap.getByLabel('THE MARK CAP, Indigo, size ONE SIZE, in stock')).toHaveValue('0');

  // Indigo has none yet: struck out on the shop, with a way to hear when it is back.
  await page.goto('/product/cap?colour=Indigo');
  await expect(page.getByRole('radio', { name: 'Indigo, sold out' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: 'SOLD OUT' })).toBeDisabled();
  await page.getByRole('button', { name: 'TELL ME WHEN IT’S BACK' }).click();
  await page.fill('#restock-email', 'kemi@example.com');
  await page.getByRole('button', { name: 'NOTIFY ME' }).click();
  await expect(page.getByRole('status')).toHaveText('WE’LL LET YOU KNOW WHEN INDIGO, ONE SIZE IS BACK.');

  await setStock(page, 'cap', 'ONE SIZE', 4, 'Indigo');

  // On the grid: the card says it comes in two colours, and asks which.
  await page.goto('/');
  const shopCap = card(page, 'THE MARK CAP');
  await expect(shopCap.locator('.card__colours')).toContainText('2 colours');
  await shopCap.hover();
  await shopCap.getByRole('button', { name: 'QUICK ADD' }).click();
  await shopCap.getByRole('radio', { name: 'Indigo' }).click();
  await shopCap.getByRole('button', { name: 'Add THE MARK CAP in Indigo, ONE SIZE', exact: true }).click();
  await expect(page.locator('.cart-count')).toHaveText('1');

  await page.locator('.cart-btn').click();
  await expect(page.locator('.line-item__variant')).toHaveText('INDIGO · SIZE ONE SIZE');
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await fillDelivery(page);
  await page.getByRole('button', { name: /^PAY/ }).click();
  await page.click('#pay');
  await expect(page.locator('.status__title')).toHaveText('Payment received');
  await expect(page.locator('.status')).toContainText('THE MARK CAP Indigo, ONE SIZE');

  // The owner sees which colour to pack, and that the Indigo count went down.
  await page.goto('/admin#orders');
  await expect(page.locator('.admin-table').first()).toContainText('THE MARK CAP Indigo, ONE SIZE');
  await page.goto('/admin#list');
  await expect(page.getByText('THE MARK CAP · Indigo · ONE SIZE')).toBeVisible();
  await page.goto('/admin#stock');
  await expect(page.locator('tr', { hasText: 'Indigo, ONE SIZE' }).locator('input')).toHaveValue('3');
});

test('a colour with no photo of its own says which colour the photo shows', async ({ page }) => {
  await page.goto('/product/tee?colour=White');
  await expect(page.locator('.pdp__pictured')).toHaveText('Shown in Indigo');
  await page.getByRole('radio', { name: 'Indigo' }).click();
  await expect(page.locator('.pdp__pictured')).toHaveCount(0);
});

test('the colour swatches work from the keyboard', async ({ page }) => {
  await page.goto('/product/tee');
  await page.getByRole('radio', { name: 'Indigo' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Black' })).toBeFocused();
  await expect(page.getByRole('radio', { name: 'Black' })).toHaveAttribute('aria-checked', 'true');
});

test('a new product is made with its colours in one go', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#products');
  await page.getByRole('button', { name: '+ NEW PRODUCT' }).click();
  const form = page.locator('.admin-new');
  await form.getByLabel('Name').fill('THE WRAP SKIRT');
  await form.getByLabel('Price (₦)').fill('30000');
  await form.getByLabel(/^Sizes/).fill('S, M');
  await form.getByLabel('Colour to add', { exact: true }).fill('Black');
  await form.getByRole('button', { name: 'ADD COLOUR' }).click();
  await form.getByLabel('Colour to add', { exact: true }).fill('Sand');
  await form.getByLabel('Colour to add', { exact: true }).press('Enter');
  await expect(form.locator('.admin-new__chips li')).toHaveText(['Black×', 'Sand×']);
  await form.getByRole('button', { name: 'CREATE' }).click();

  const card = page.locator('.admin-product', { has: page.locator('input[value="THE WRAP SKIRT"]') });
  await expect(card.getByLabel('Name of colour Black')).toHaveValue('Black');
  await expect(card.getByLabel('Name of colour Sand')).toHaveValue('Sand');
  await expect(card.getByLabel('THE WRAP SKIRT, Sand, size M, in stock')).toHaveValue('0');
});
