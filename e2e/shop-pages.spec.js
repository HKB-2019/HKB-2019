/* The Shop and Collections pages, their menus, and the product page's
 * quantity and Buy now, from the owner's designs. */
import { test, expect, signIn, adminPatch } from './fixtures.js';

test('SHOP opens all products; a category, a filter and the pages narrow them', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: 'SHOP' }).click();
  await expect(page).toHaveURL(/\/shop$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Wear Identity.');
  // More than one page of pieces: twelve to a page.
  await expect(page.locator('.sh-grid .card')).toHaveCount(12);
  await page.getByRole('navigation', { name: 'Pages' }).getByRole('button', { name: 'Page 2' }).click();
  await expect(page).toHaveURL(/page=2/);

  await page.getByRole('navigation', { name: 'Kinds of piece' }).getByRole('link', { name: /T-Shirts/ }).click();
  await expect(page).toHaveURL(/\/shop\/tshirts$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Identity.');
  const count = page.locator('.sh-bar__count');
  await expect(count).toHaveText('11 PRODUCTS');

  // A type from the panels, then a size and the filters' own button.
  await page.getByRole('button', { name: /Essential Tees/ }).first().click();
  await expect(count).toHaveText('3 PRODUCTS');
  await page.getByRole('button', { name: 'XXL', exact: true }).click();
  await expect(count).toHaveText('3 PRODUCTS');                       // nothing changes until applied
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page).toHaveURL(/size=XXL/);
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(count).toHaveText('11 PRODUCTS');
});

test('the SHOP menu opens wide, and its links go to their pages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'More in SHOP' }).click();
  const menu = page.locator('#mega');
  await expect(menu.getByText('SHOP BY CATEGORY')).toBeVisible();
  await menu.getByRole('link', { name: /Headwear/ }).click();
  await expect(page).toHaveURL(/\/shop\/headwear$/);
  await expect(menu).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Cap.');
});

test('the Collections: the index, Limited Edition, and Collaborations waiting for real partners', async ({ page }) => {
  await page.goto('/collections');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Collections');
  await page.getByRole('link', { name: /^Limited Edition \d+ PRODUCTS/ }).click();
  await expect(page).toHaveURL(/\/collections\/limited$/);
  await expect(page.locator('.sh-grid .card__badge').first()).toHaveText('LIMITED EDITION');

  await page.goto('/collections/collaborations');
  await expect(page.getByRole('heading', { name: 'Our first collaborations are on their way.' })).toBeVisible();
});

test('a quantity goes in the bag at once, and Buy now goes straight to delivery', async ({ page }) => {
  await page.goto('/product/scarf');
  await page.getByRole('button', { name: 'One more' }).click();
  await expect(page.getByRole('group', { name: 'Quantity' }).locator('output')).toHaveText('2');
  await page.getByRole('button', { name: /BUY NOW/ }).click();
  await expect(page.locator('.cart-count')).toHaveText('2');
  await expect(page.locator('#d-name, #d-email').first()).toBeVisible();
});

test('the owner puts a piece in a collection, and it shows there', async ({ page }) => {
  await signIn(page);
  await page.goto('/collections/archive');
  await expect(page.getByRole('heading', { name: 'The archive opens after our first season.' })).toBeVisible();
  await adminPatch(page, 'cap', { collections: ['archive'], season: '2025 — Drop 00' });
  await page.goto('/collections/archive');
  await expect(page.getByRole('heading', { name: 'The Mark Cap (2025)' })).toBeVisible();   // title case, with its year
  await expect(page.getByRole('navigation', { name: 'Seasons' })).toContainText('2025');
});
