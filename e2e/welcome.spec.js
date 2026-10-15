/* The welcome pop-up: the mailing list, offered once to a first-time visitor. */

import { test, expect, signIn } from './fixtures.js';
import { HOME_DEFAULT } from '../src/data/home.js';

/** Switch the pop-up on (the test shop starts with it off), as the owner. */
async function switchOn(page, delay = 0) {
  await signIn(page);
  const res = await page.request.put('/api/admin/settings/home', {
    data: { ...HOME_DEFAULT, welcomeTitle: 'Join the ritual.', welcome: { show: true, delay } }
  });
  expect(res.status(), await res.text()).toBe(200);
}

test('a first-time visitor is offered the list once, can join from it, and is not asked again', async ({ page }) => {
  await switchOn(page);
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Join the ritual.' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(HOME_DEFAULT.welcomeNote);

  await dialog.getByLabel('Email address').fill('ada@example.com');
  await dialog.getByRole('button', { name: 'JOIN' }).click();
  await expect(dialog.getByRole('status')).toHaveText('YOU’RE IN. WATCH YOUR INBOX FOR DROP 02.');
  await dialog.getByRole('button', { name: 'CONTINUE TO THE SHOP' }).click();
  await expect(dialog).toHaveCount(0);

  // On the owner's list.
  await page.goto('/admin#list');
  await expect(page.getByText('ada@example.com')).toBeVisible();

  // Back on the home page: not asked again.
  await page.goto('/');
  await page.waitForTimeout(800);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('closing it is remembered, it waits its turn, and the owner can switch it off', async ({ page }) => {
  await switchOn(page, 2);
  await page.goto('/');
  await expect(page.getByRole('dialog')).toHaveCount(0);                 // not straight away
  const dialog = page.getByRole('dialog', { name: 'Join the ritual.' });
  await expect(dialog).toBeVisible({ timeout: 6000 });

  // Only the visitor closes it: a tap on the page around it does nothing.
  await page.mouse.click(6, 6);
  await page.mouse.click(6, page.viewportSize().height - 6);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Close, no thanks' }).click();
  await expect(dialog).toHaveCount(0);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(dialog).toBeVisible({ timeout: 6000 });
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await page.waitForTimeout(2800);
  await expect(page.getByRole('dialog')).toHaveCount(0);                 // closed is closed

  // Not on a product page, where someone came to buy.
  await page.evaluate(() => localStorage.clear());
  await page.goto('/product/tee');
  await page.waitForTimeout(2800);
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Switched off in the admin: nobody sees it.
  await page.goto('/admin#home');
  await page.locator('.admin-toggle', { hasText: 'Show the pop-up' }).click();
  await page.getByRole('button', { name: 'SAVE WORDS' }).click();
  await expect(page.getByText('saved')).toBeVisible();
  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await page.waitForTimeout(2800);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
