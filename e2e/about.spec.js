/* The About page, reached from the menu, with its story button and sign-up. */
import { test, expect } from './fixtures.js';

test('About: from the menu, down to the purpose, and the footer link', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /about/i }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('More Than');
  await page.getByRole('button', { name: /OUR STORY/ }).click();
  await expect(page.getByRole('heading', { name: /Identity\.\s*Expression\.\s*Belonging\./ })).toBeInViewport();
  await expect(page.getByRole('heading', { name: 'What Drives Us' })).toBeAttached();
  await expect(page.getByRole('heading', { name: 'Join the MASQ. Community' })).toBeAttached();
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'About MASQ.' }).click();
  await expect(page).toHaveURL(/\/about$/);
});
