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
  const scarf = card(page, 'THE PATTERN SCARF');
  await scarf.scrollIntoViewIfNeeded();
  await expect(scarf.getByRole('button', { name: 'ADD TO BAG' })).toBeInViewport();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).tap();
  await expect(page.locator('.cart-count')).toHaveText('1');
});

test('checkout works on a phone', async ({ page }) => {
  await page.goto('/');
  const scarf = card(page, 'THE PATTERN SCARF');
  await scarf.scrollIntoViewIfNeeded();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).tap();
  await page.locator('.cart-btn').tap();
  await page.getByRole('button', { name: 'CHECKOUT' }).tap();
  await fillDelivery(page);
  await noSidewaysScroll(page);
  await page.getByRole('button', { name: /^PAY/ }).tap();
  await expect(page.locator('h1')).toContainText('Pay ₦20,500');
});

test('every admin tab fits a phone', async ({ page }) => {
  await signIn(page);
  for (const [tab, label = tab.toUpperCase()] of [['orders'], ['visitors'], ['sales'], ['products'], ['home', 'HOME PAGE'], ['stock'], ['list'], ['settings']]) {
    await page.goto(`/admin#${tab}`);
    await expect(page.locator(`.admin-tab[aria-current="page"]`)).toHaveText(label);
    await noSidewaysScroll(page);
  }
});

test('a product page fits a phone, and its photos can be swiped', async ({ page }) => {
  await signIn(page);
  const add = await page.request.post('/api/admin/products/tee/photos', {
    data: { image: PIXEL, image2x: PIXEL }
  });
  expect(add.status()).toBe(201);

  await page.goto('/product/tee');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('THE FACE TEE');
  await noSidewaysScroll(page);
  await expect(page.locator('.pdp__dots button')).toHaveCount(2);
  await page.locator('.pdp__strip').evaluate(el => el.scrollTo({ left: el.clientWidth }));
  await expect(page.locator('.pdp__dots button').nth(1)).toHaveClass(/is-active/);

  await page.getByRole('button', { name: 'M', exact: true }).tap();
  await page.getByRole('button', { name: 'ADD TO BAG' }).tap();
  await expect(page.locator('.cart-count')).toHaveText('1');
});

test('a long page in a panel can be read to the end, and a tap outside closes it', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 }); // a small phone
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Footer' }).getByRole('button', { name: 'Terms of sale' }).tap();
  const modal = page.locator('.modal');
  await expect(modal.locator('h2')).toHaveText('TERMS OF SALE');
  await expect(modal.locator('.modal__panel')).toHaveCSS('opacity', '1');
  await noSidewaysScroll(page);

  // Taller than the screen, so it scrolls, and the last line can be reached.
  const tall = await modal.evaluate(el => el.scrollHeight > el.clientHeight);
  expect(tall, 'the terms are longer than a phone screen').toBe(true);
  await modal.evaluate(el => el.scrollTo({ top: el.scrollHeight }));
  await expect(modal.locator('.modal__text')).toBeInViewport({ ratio: 0.1 });
  const end = await modal.locator('.modal__panel').evaluate(el => el.getBoundingClientRect().bottom);
  expect(end).toBeLessThanOrEqual(page.viewportSize().height);

  // Tapping the dimmed space around the panel closes it.
  await modal.evaluate(el => el.scrollTo({ top: 0 }));
  await page.mouse.click(4, 4);
  await expect(modal).toHaveCount(0);
});

/** The smallest real WebP: one pixel. Enough for the server to accept as a photo. */
const PIXEL = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
