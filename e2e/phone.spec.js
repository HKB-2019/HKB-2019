/* The same shop on a phone: nothing wider than the screen, nothing that only
 * works with a mouse. */

import { test, expect, signIn, fillDelivery, card } from './fixtures.js';

const noSidewaysScroll = async (page) => {
  const extra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(extra, 'the page must not scroll sideways').toBeLessThanOrEqual(0);
};

test('the shop fits a phone, and the add button is visible without a mouse', async ({ page }) => {
  await page.goto('/');
  await noSidewaysScroll(page);
  const cap = card(page, 'THE MARK CAP');
  await cap.scrollIntoViewIfNeeded();
  await expect(cap.getByRole('button', { name: 'ADD TO BAG' })).toBeInViewport();
  await cap.getByRole('button', { name: 'ADD TO BAG' }).tap();
  await expect(page.locator('.cart-count')).toHaveText('1');
});

test('checkout works on a phone', async ({ page }) => {
  await page.goto('/');
  const cap = card(page, 'THE MARK CAP');
  await cap.scrollIntoViewIfNeeded();
  await cap.getByRole('button', { name: 'ADD TO BAG' }).tap();
  await page.locator('.cart-btn').tap();
  await page.getByRole('button', { name: 'CHECKOUT' }).tap();
  await fillDelivery(page);
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: /^PAY/ }).tap();
  await expect(page.locator('h1')).toContainText('Pay ₦16,500');
});

test('every admin tab fits a phone', async ({ page }) => {
  await signIn(page);
  for (const tab of ['orders', 'products', 'stock', 'list', 'settings']) {
    await page.goto(`/admin#${tab}`);
    await expect(page.locator(`.admin-tab[aria-current="page"]`)).toHaveText(tab.toUpperCase());
    await noSidewaysScroll(page);
  }
});
