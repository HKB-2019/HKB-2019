/* STOCK: a read-only list; the owner counts the shelf or receives a
 * delivery in a mode of its own, saves every line at once, and can see what
 * changed. Pieces sold but not yet sent stay on the shelf. */

import { test, expect, signIn, card, setStock, fillDelivery } from './fixtures.js';

const shelf = (page, line) => page.getByLabel(`${line}, on the shelf`);
const row = (page, line) => page.locator('tr', { has: page.getByLabel(`${line}, on the shelf`) });
/** A line as the read-only list shows it: piece, then "colour, size". */
const viewRow = (page, name, rest) => page.locator('.admin-stock__table tbody tr')
  .filter({ has: page.getByRole('cell', { name, exact: true }) }).filter({ has: page.getByRole('cell', { name: rest, exact: true }) });
const count = (page) => page.getByRole('button', { name: 'COUNT THE SHELF' }).click();

test('the owner counts the shelf, saves all at once, and sees the record', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#stock');

  // Read only until the owner chooses to count.
  await expect(page.locator('.admin-stock__table input')).toHaveCount(0);
  await count(page);
  await expect(page.getByText('Counting the shelf.')).toBeVisible();

  // Two lines counted, one saved press.
  await shelf(page, 'THE MARK CAP, Black, ONE SIZE').fill('2');
  await shelf(page, 'THE PATTERN SCARF, ONE SIZE').fill('0');
  await expect(row(page, 'THE MARK CAP, Black, ONE SIZE')).toContainText('low');
  await expect(row(page, 'THE PATTERN SCARF, ONE SIZE')).toContainText('sold out');
  await page.getByRole('button', { name: 'SAVE ALL (2)' }).click();
  await expect(page.getByRole('status')).toHaveText('2 lines saved.');
  await expect(page.locator('.admin-stock__table input')).toHaveCount(0);           // back to the list

  // Only what needs attention.
  await page.locator('.admin-toggle', { hasText: 'Only low or sold out' }).click();
  await expect(viewRow(page, 'THE MARK CAP', 'Black, ONE SIZE')).toBeVisible();
  await expect(viewRow(page, 'THE PATTERN SCARF', 'ONE SIZE')).toBeVisible();
  await expect(viewRow(page, 'THE CARRIER BACKPACK', 'ONE SIZE')).toHaveCount(0);   // 8 left: fine

  // The record of what changed.
  await page.getByText('Recent changes (2)').click();
  await expect(page.locator('.admin-stock__history li').first()).toContainText('THE PATTERN SCARF · ONE SIZE');
  await expect(page.locator('.admin-stock__history li').first()).toContainText('left to sell 22 → 0 (0 counted on the shelf)');

  // The shop follows: the scarf is sold out.
  await page.goto('/');
  await expect(card(page, 'THE PATTERN SCARF').locator('.card__price')).toHaveText('SOLD OUT');
});

test('a shelf count below what is already sold is caught, and nothing is saved', async ({ page }) => {
  await signIn(page);
  await setStock(page, 'backpack', 'ONE SIZE', 2);

  // A customer buys both, and pays; they are not sent yet.
  await page.goto('/product/backpack');
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'Increase quantity of THE CARRIER BACKPACK' }).click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await fillDelivery(page);
  await page.getByRole('button', { name: /^PAY/ }).click();
  await page.click('#pay');
  await expect(page.locator('.status__title')).toHaveText('Payment received');

  await page.goto('/admin#stock');
  await count(page);
  const bag = 'THE CARRIER BACKPACK, ONE SIZE';
  await expect(shelf(page, bag)).toHaveValue('2');                       // still on the shelf
  await expect(row(page, bag).locator('td').nth(4)).toHaveText('2');     // waiting to be sent
  await expect(row(page, bag).locator('td').nth(6)).toHaveText('0');     // none left to sell

  // Counting one: fewer than are sold. Flagged, and the save is refused whole.
  await shelf(page, bag).fill('1');
  await shelf(page, 'THE PATTERN SCARF, ONE SIZE').fill('5');
  await expect(row(page, bag)).toContainText('fewer than sold');
  await page.getByRole('button', { name: 'SAVE ALL (2)' }).click();
  await expect(page.getByRole('alert')).toContainText('Nothing was saved. THE CARRIER BACKPACK, ONE SIZE: you counted 1, but 2 are sold');
  await page.reload();
  await count(page);
  await expect(shelf(page, 'THE PATTERN SCARF, ONE SIZE')).toHaveValue('22');

  // Not a number: caught before it is sent.
  await shelf(page, bag).fill('abc');
  await expect(page.getByText('Type whole numbers only.')).toBeVisible();
  await expect(page.getByRole('button', { name: /SAVE ALL/ })).toBeDisabled();
  await page.getByRole('button', { name: 'undo changes' }).click();
  await expect(shelf(page, bag)).toHaveValue('2');
});

test('a delivery is received: only what arrived is typed, it is added on top, and recorded', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#stock');
  await page.getByRole('button', { name: 'RECEIVE A DELIVERY' }).click();
  await expect(page.getByText('Receiving a delivery.')).toBeVisible();

  const arrived = (line) => page.getByLabel(`${line}, how many arrived`);
  await arrived('THE MARK CAP, Black, ONE SIZE').fill('20');
  await arrived('THE SYMBOL JACKET, M').fill('4');
  await expect(page.locator('tr', { has: arrived('THE MARK CAP, Black, ONE SIZE') })).toContainText('shelf 30 → 50');
  await page.getByLabel(/^Note/).fill('Aba workshop, invoice 12');
  await page.getByRole('button', { name: 'ADD TO STOCK (2)' }).click();
  await expect(page.getByRole('status').last()).toHaveText('Delivery added: 24 pieces on 2 lines.');

  // Back to the list, with the new numbers.
  await expect(viewRow(page, 'THE MARK CAP', 'Black, ONE SIZE').locator('td').nth(3)).toHaveText('50');
  await expect(viewRow(page, 'THE SYMBOL JACKET', 'M').locator('td').nth(3)).toHaveText('6');
  await page.getByText(/Recent changes/).click();
  await expect(page.locator('.admin-stock__history li').first()).toContainText('Delivery +');
  await expect(page.locator('.admin-stock__history')).toContainText('Delivery +20 · left to sell 30 → 50 · Aba workshop, invoice 12');

  // Going back asks first when something was typed, and then changes nothing.
  await page.getByRole('button', { name: 'RECEIVE A DELIVERY' }).click();
  await arrived('THE MARK CAP, Black, ONE SIZE').fill('5');
  page.once('dialog', d => d.dismiss());
  await page.getByRole('button', { name: '← BACK TO STOCK' }).click();
  await expect(arrived('THE MARK CAP, Black, ONE SIZE')).toHaveValue('5');     // stayed
  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '← BACK TO STOCK' }).click();
  await expect(viewRow(page, 'THE MARK CAP', 'Black, ONE SIZE').locator('td').nth(3)).toHaveText('50');

  // The save bar is on screen even at the top of a long list.
  await page.getByRole('button', { name: 'RECEIVE A DELIVERY' }).click();
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.getByRole('button', { name: /^ADD TO STOCK/ })).toBeInViewport();
});
