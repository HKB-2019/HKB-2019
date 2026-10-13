/* Discount codes, refunds, "tell me when it's back", drop times, the sales
 * page and the price-guide rates — clicked through as the customer and the
 * owner would. */

import { test, expect, signIn, adminPatch, fillDelivery, card } from './fixtures.js';

async function makeCode(page, body) {
  const res = await page.request.post('/api/admin/discounts', { data: { kind: 'percent', amount: 10, ...body } });
  expect(res.status(), await res.text()).toBe(201);
}

test('the owner makes a code in the admin, and a customer pays less with it', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#sales');
  await page.getByRole('button', { name: '+ NEW CODE' }).click();
  await page.locator('.admin-code-form .admin-field', { hasText: 'Code' }).locator('input').fill('launch10');
  await page.locator('.admin-code-form .admin-field', { hasText: 'Per cent off' }).locator('input').fill('10');
  await page.getByRole('button', { name: 'CREATE' }).click();
  await expect(page.locator('.admin-table tr', { hasText: 'LAUNCH10' })).toContainText('10% off');

  await page.goto('/product/tee');
  await page.getByRole('button', { name: 'M', exact: true }).click();
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await fillDelivery(page);

  // A wrong code says why; the right one shows what it takes off.
  await page.getByRole('button', { name: 'HAVE A CODE?' }).click();
  await page.getByLabel('Discount code').fill('nope');
  await page.getByRole('button', { name: 'APPLY' }).click();
  await expect(page.locator('#d-code-error')).toContainText('not a code we recognise');
  await page.getByLabel('Discount code').fill('launch10');
  await page.getByRole('button', { name: 'APPLY' }).click();
  await expect(page.locator('.drawer__row--discount')).toContainText('−₦2,800');
  await page.getByRole('button', { name: 'PAY ₦27,700' }).click();

  // The payment page asks for the discounted total, and the order page says so.
  await expect(page.locator('h1')).toHaveText('Pay ₦27,700');
  await page.click('#pay');
  await expect(page.locator('.status__title')).toHaveText('Payment received');
  await expect(page.locator('.status__line--discount')).toContainText('LAUNCH10');

  await page.goto('/admin#sales');
  await expect(page.locator('.admin-table tr', { hasText: 'LAUNCH10' }).locator('td.num')).toHaveText('1');
  await expect(page.locator('.admin-tile', { hasText: 'Given in discounts' })).toContainText('₦2,800');
  await expect(page.locator('.admin-mini-table').first()).toContainText('THE FACE TEE');
});

test('a refund is recorded from the orders list, and puts the stock back', async ({ page }) => {
  await page.goto('/product/cap');
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await fillDelivery(page);
  await page.getByRole('button', { name: /^PAY/ }).click();
  await page.click('#pay');
  await expect(page.locator('.status__title')).toHaveText('Payment received');
  const reference = new URL(page.url()).searchParams.get('reference');

  await signIn(page);
  await page.goto('/admin');
  const row = page.locator('.admin-table tr', { hasText: reference });
  await row.getByRole('button', { name: 'refunded?' }).click();
  await expect(row).toContainText('Refund the customer in your Paystack dashboard first');
  await expect(row.getByLabel('Put the pieces back in stock')).toBeChecked();
  await row.getByRole('button', { name: 'MARK REFUNDED' }).click();
  await expect(row.locator('.admin-status--refunded')).toBeVisible();

  const stock = await (await page.request.get('/api/admin/stock')).json();
  expect(stock.find(s => s.productId === 'cap').stock).toBe(30);

  await page.goto(`/order?reference=${reference}`);
  await expect(page.locator('.status__title')).toHaveText('Refunded');
});

test('a customer asks to hear when a sold-out size is back, and the owner sees it', async ({ page }) => {
  await page.goto('/product/phone');
  await page.getByRole('button', { name: 'TELL ME WHEN IT’S BACK' }).click();
  await page.getByLabel('Email').fill('ada@example.com');
  await page.getByRole('button', { name: 'NOTIFY ME' }).click();
  await expect(page.getByRole('status')).toContainText('WE’LL LET YOU KNOW');

  await signIn(page);
  await page.request.post(`/api/admin/stock/${(await (await page.request.get('/api/admin/stock')).json()).find(s => s.productId === 'phone').variantId}`, { data: { stock: 4 } });
  await page.goto('/admin');
  await expect(page.locator('.admin-alert--info')).toContainText('1 person is waiting');
  await page.getByRole('button', { name: 'See who →' }).click();
  const group = page.locator('.admin-waiting__group', { hasText: 'THE MASK CASE' });
  await expect(group).toContainText('ada@example.com');
  await expect(group).toContainText('back in stock — 4');
  await group.getByRole('button', { name: 'told them — clear' }).click();
  await group.getByRole('button', { name: 'CLEAR 1' }).click();
  await expect(page.getByText('Nobody is waiting.')).toBeVisible();
});

test('a piece with a drop time stays hidden, the home page counts down, and it appears on time', async ({ page }) => {
  await signIn(page);
  await adminPatch(page, 'tee', { availableAt: new Date(Date.now() + 6000).toISOString() });

  await page.goto('/');
  await expect(page.locator('.countdown')).toBeVisible();
  await expect(page.locator('.countdown')).toContainText('The next drop');
  await expect(card(page, 'THE FACE TEE')).toHaveCount(0);

  // When the clock runs out the page fetches the catalogue again by itself.
  await expect(card(page, 'THE FACE TEE')).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator('.countdown')).toHaveCount(0);
});

test('the price-guide rates set in Settings change the prices shown in dollars', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#settings');
  await page.getByLabel('Naira for one US dollar').fill('2000');
  await page.getByRole('button', { name: 'SAVE RATES' }).click();
  await expect(page.locator('.admin-card', { hasText: 'Price guide' }).locator('.admin-note--ok')).toBeVisible();

  await page.goto('/');
  await page.locator('.currency__btn').click();
  await page.getByRole('option', { name: /USD/ }).click();
  await expect(card(page, 'THE FACE TEE').locator('.card__price')).toHaveText('$14.00');
});

test('the footer has a terms of sale page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Footer' }).getByRole('button', { name: 'TERMS' }).click();
  await expect(page.getByRole('dialog')).toContainText('TERMS OF SALE');
});
