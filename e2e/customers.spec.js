/* CUSTOMERS: a buyer who ticked "email me" at checkout shows up as one
 * person, with their order; the owner tags them, writes a note, finds them
 * again, and can forget them once nothing is left to send. */

import { test, expect, signIn, fillDelivery } from './fixtures.js';

test('a buyer becomes a customer record the owner can tag, note, find and forget', async ({ page }) => {
  // A customer buys the cap and asks to hear about new drops.
  await page.goto('/product/cap');
  await page.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.getByRole('button', { name: 'VIEW BAG' }).click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await fillDelivery(page);
  await page.getByLabel('Email me about new drops and restocks. Leave any time.').check();
  await page.getByRole('button', { name: /^PAY/ }).click();
  await page.click('#pay');
  await expect(page.locator('.status__title')).toHaveText('Payment received');

  await signIn(page);
  await page.goto('/admin#customers');
  const ada = page.getByRole('button', { name: /Ada Obi/ });
  await expect(ada).toBeVisible();
  const row = page.locator('tr', { has: ada });
  await expect(row).toContainText('Lekki, Lagos');
  await expect(row).toContainText('₦16,500');
  await expect(row.locator('td').nth(5)).toHaveText('yes');          // on the mailing list

  // Open the record: the order is there.
  await ada.click();
  await expect(ada).toHaveAttribute('aria-expanded', 'true');
  const record = page.locator('.admin-crm__card');
  await expect(record).toContainText('1× THE MARK CAP (Black, ONE SIZE)');
  await expect(record).toContainText('On the mailing list since');

  // A tag and a note.
  await page.getByLabel('New tag').fill('VIP');
  await page.getByRole('button', { name: 'ADD', exact: true }).click();
  await expect(record.getByRole('status')).toHaveText('Tagged VIP.');
  await expect(row).toContainText('VIP');
  await record.getByRole('textbox', { name: /Notes/ }).fill('Stylist in Ikoyi. Wants the hoodie in XL.');
  await page.getByRole('button', { name: 'SAVE NOTES' }).click();
  await expect(record.getByRole('status')).toHaveText('Notes saved.');

  // Found again by the note, and by the tag.
  await page.reload();
  await page.getByLabel('Search customers').fill('ikoyi');
  await expect(page.getByRole('status')).toHaveText('1 person shown');
  await page.getByLabel('Search customers').fill('');
  await page.getByLabel('Show').selectOption('tag:VIP');
  await expect(page.getByRole('button', { name: /Ada Obi/ })).toBeVisible();

  // Forgetting waits until the order is sent.
  await page.getByRole('button', { name: /Ada Obi/ }).click();
  await page.getByRole('button', { name: 'they asked to be forgotten…' }).click();
  await page.getByRole('button', { name: 'FORGET THIS PERSON' }).click();
  await expect(page.locator('.admin-crm__card').getByRole('alert')).toContainText('waiting to be sent');

  await page.goto('/admin#orders');
  await page.getByRole('button', { name: 'MARK SENT' }).click();          // opens the courier form
  await page.getByRole('button', { name: 'MARK SENT' }).click();          // sends
  await expect(page.locator('.admin-status--sent').first()).toBeVisible();

  await page.goto('/admin#customers');
  await page.getByRole('button', { name: /Ada Obi/ }).click();
  await page.getByRole('button', { name: 'they asked to be forgotten…' }).click();
  await page.getByRole('button', { name: 'FORGET THIS PERSON' }).click();
  await expect(page.getByRole('button', { name: /Ada Obi/ })).toHaveCount(0);
});

test('on a phone each person is a card, with nothing to scroll sideways', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto('/');
  await page.request.post('/api/subscribe', { data: { email: 'nneka@example.com' } });
  await signIn(page);
  await page.goto('/admin#customers');
  await page.getByRole('button', { name: /nneka@example.com/ }).click();
  await expect(page.getByLabel('New tag')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
