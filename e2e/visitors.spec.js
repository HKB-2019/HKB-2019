/* Visits are counted as a shopper browses, and the owner sees them in
 * VISITORS — with charts, maps and tables — but never their own visits. */

import { test, expect, signIn, card } from './fixtures.js';

test('a shopper’s visit is counted, and shows up in VISITORS', async ({ page }) => {
  // Arrive from a tagged Instagram link, look at a piece, add it to the bag.
  await page.goto('/?utm_source=instagram&utm_campaign=drop02');
  await card(page, 'THE FACE TEE').getByRole('link', { name: 'THE FACE TEE' }).click();
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await expect(page.locator('.cart-count')).toHaveText('1');
  await page.getByRole('button', { name: 'VIEW BAG' }).click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await page.waitForTimeout(300);                          // let the last event land

  await signIn(page);
  await page.goto('/admin#visitors');
  await expect(page.locator('.viz-tile', { hasText: 'Visits' }).first().locator('.viz-tile__value')).toHaveText('1');
  const funnel = page.locator('.viz-funnel__row');
  await expect(funnel.nth(0)).toContainText('Visited');
  await expect(funnel.nth(2).locator('.viz-funnel__num')).toHaveText('1');     // added to bag
  await expect(funnel.nth(3).locator('.viz-funnel__num')).toHaveText('1');     // started checkout
  await expect(page.locator('.viz-card', { hasText: 'Where visitors came from' })).toContainText('Instagram');
  await expect(page.locator('.viz-card', { hasText: 'Campaigns and websites' })).toContainText('drop02');
  await expect(page.locator('.viz-card', { hasText: 'Pieces' })).toContainText('THE FACE TEE');
  await expect(page.locator('.viz-map__svg')).toHaveCount(2);
  await expect(page.locator('.viz-live')).toContainText('1 on the site now');

  // Every chart can be read as a table.
  const overTime = page.locator('.viz-card', { hasText: 'Visitors over time' });
  await overTime.getByRole('button', { name: 'show as table' }).click();
  await expect(overTime.locator('table')).toBeVisible();

  // The owner browsing the shop while signed in is not a visitor.
  await page.goto('/');
  await page.goto('/product/cap');
  await page.goto('/admin#visitors');
  await expect(page.locator('.viz-tile', { hasText: 'Visits' }).first().locator('.viz-tile__value')).toHaveText('1');

  // The tracked-link maker.
  await page.locator('.viz-linkform select').selectOption('whatsapp');
  await page.locator('.viz-linkform .admin-field', { hasText: 'Campaign' }).locator('input').fill('Drop 02 Launch');
  await expect(page.locator('.viz-link__url')).toContainText('utm_source=whatsapp&utm_campaign=drop-02-launch');
});
