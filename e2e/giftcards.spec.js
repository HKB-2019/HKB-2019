/* Gift cards: bought on their own page and paid on Paystack; the code shows
 * once paid; spent at checkout, all at once or over two orders; the owner
 * sees where it went and can make one. */

import { test, expect, signIn, fillDelivery } from './fixtures.js';

const toCheckout = async (page, product) => {
  await page.goto(`/product/${product}`);
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
};
const applyGift = async (page, code) => {
  await page.getByRole('button', { name: 'HAVE A GIFT CARD?' }).click();
  await page.getByLabel('Gift card code').fill(code);
  await page.getByRole('button', { name: 'APPLY' }).last().click();
};

test('a gift card is bought, paid for, and spent over two orders', async ({ page }) => {
  // Buying: from the footer, any amount; Paystack is asked for exactly that.
  await page.goto('/');
  await page.getByRole('link', { name: 'Gift cards' }).click();
  await expect(page.getByRole('heading', { name: 'Give MASQ.' })).toBeVisible();
  await page.getByRole('radio', { name: 'Other amount' }).check();
  await page.getByLabel(/AMOUNT IN NAIRA/).fill('4000');
  await page.getByLabel(/YOUR EMAIL/).fill('tolu@example.com');
  await page.getByRole('button', { name: 'PAY' }).click();
  await expect(page.locator('#g-amount-error')).toContainText('₦5,000 to ₦500,000');
  await page.getByRole('radio', { name: '₦25,000' }).check();
  await page.getByLabel(/THEIR NAME/).fill('Kemi');
  await page.getByLabel(/A MESSAGE/).fill('Happy birthday.');
  await page.getByRole('button', { name: 'PAY ₦25,000' }).click();
  await expect(page.locator('h1')).toHaveText('Pay ₦25,000');
  await page.click('#pay');

  // Back from Paystack: the card, its code, a way to send it.
  await expect(page.getByRole('heading', { name: 'Your gift card is ready' })).toBeVisible();
  const code = (await page.locator('#gift-code').innerText()).trim();
  expect(code).toMatch(/^MASQ-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  await expect(page.getByRole('link', { name: 'SEND ON WHATSAPP' })).toHaveAttribute('href', new RegExp(`wa\\.me.*${code}`));
  await expect(page.locator('.gift__message')).toHaveText('Happy birthday.');

  // First order: the scarf, ₦18,000 + ₦2,500 Lagos. The card covers it all.
  await toCheckout(page, 'scarf');
  await fillDelivery(page);
  await applyGift(page, code.toLowerCase());
  await expect(page.locator('.discount--on').last()).toContainText('₦4,500 left on it after this');
  await expect(page.locator('.drawer__row--total')).toContainText('₦0');
  await page.getByRole('button', { name: 'PLACE ORDER' }).click();
  await expect(page.locator('.status__title')).toHaveText('Payment received');
  await expect(page.locator('.status__line--discount').last()).toContainText('−₦20,500');

  // Second order: the cap, ₦16,500. The ₦4,500 left pays part; Paystack the rest.
  await toCheckout(page, 'cap');
  await fillDelivery(page);
  await applyGift(page, code);
  await expect(page.locator('.drawer__row--total')).toContainText('₦12,000');
  await page.getByRole('button', { name: 'PAY ₦12,000' }).click();
  await expect(page.locator('h1')).toHaveText('Pay ₦12,000');
  await page.click('#pay');
  await expect(page.locator('.status__title')).toHaveText('Payment received');

  // Spent: it says so.
  await toCheckout(page, 'cap');
  await applyGift(page, code);
  await expect(page.locator('#d-gift-error')).toContainText('has been spent');

  // The owner: where it went, and a card of their own.
  await signIn(page);
  await page.goto('/admin#sales');
  const row = page.locator('tr', { has: page.getByRole('button', { name: code }) });
  await expect(row).toContainText('bought by tolu@example.com');
  await expect(row).toContainText('spent');
  await row.getByRole('button', { name: code }).click();
  await expect(page.locator('.admin-gift__more li')).toHaveCount(2);
  await page.getByRole('button', { name: '+ MAKE A CARD' }).click();
  await page.getByLabel(/Amount \(₦\)/).fill('20000');
  await page.getByLabel(/^For/).fill('Giveaway winner');
  await page.getByRole('button', { name: 'MAKE CARD' }).click();
  await expect(page.locator('.admin-gift tr.is-changed')).toContainText('Giveaway winner');
  await expect(page.locator('.admin-gift tr.is-changed')).toContainText('made here');
});
