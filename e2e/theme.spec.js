/* Light and dark: the device's choice until the shopper makes their own. */

import { test, expect, signIn } from './fixtures.js';

test('the shop follows the device, and a choice made is kept', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-theme', 'light');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(246, 243, 238)');

  await page.getByRole('button', { name: 'Switch to the dark theme' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(5, 4, 7)');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#050407');

  // Kept: a new page, and the device still says light.
  await page.goto('/product/tee');
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await ctx.close();
});

test('on a phone the switch is in the menu', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Switch to the light theme' })).toBeHidden();
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('button', { name: 'Light theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await ctx.close();
});

test('the admin has the switch too', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin');
  const before = await page.locator('html').getAttribute('data-theme');
  await page.locator('.admin-theme').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', before);
});
