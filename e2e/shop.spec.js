/* A customer's journeys, in a real browser against the real server. */

import { test, expect, signIn, adminPatch, setStock, fillDelivery, card } from './fixtures.js';

test('a customer buys a tee, pays, and the owner sees who to send it to', async ({ page }) => {
  await page.goto('/');

  // Pick a size from the grid.
  const tee = card(page, 'THE FACE TEE');
  await tee.hover();
  await tee.getByRole('button', { name: 'QUICK ADD' }).click();
  await tee.getByRole('button', { name: 'Add THE FACE TEE in Indigo, M', exact: true }).click();
  await expect(page.locator('.cart-count')).toHaveText('1');

  // Bag → delivery → pay.
  await page.locator('.cart-btn').click();
  await expect(page.locator('.drawer')).toContainText('THE FACE TEE');
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await fillDelivery(page);
  await expect(page.locator('.delivery__sum')).toContainText('₦2,500');
  await page.getByRole('button', { name: 'PAY ₦30,500' }).click();

  // Paystack's page (the stand-in) asks for the full amount, delivery included.
  await expect(page.locator('h1')).toHaveText('Pay ₦30,500');
  await page.click('#pay');

  // Back on the shop: paid, and the bag is empty.
  await expect(page).toHaveURL(/\/order\?/);
  await expect(page.locator('.status__title')).toHaveText('Payment received');
  await expect(page.locator('.status')).toContainText('Delivery to Lekki, Lagos');
  await expect(page.locator('.status__email')).toContainText('a•••a@example.com');
  const reference = new URL(page.url()).searchParams.get('reference');
  expect(reference).toMatch(/^masq-[0-9a-f]{24}$/);

  await page.goto('/');
  await expect(page.locator('.cart-count')).toHaveText('0');

  // The owner sees the order, the address and the phone, and marks it sent.
  await signIn(page);
  await page.goto('/admin');
  const row = page.locator('.admin-table tr', { hasText: reference });
  await expect(row).toContainText('Ada Obi');
  await expect(row).toContainText('0803 123 4567');
  await expect(row).toContainText('12 Admiralty Way');
  await expect(row).toContainText('₦30,500');
  await row.getByRole('button', { name: 'MARK SENT' }).click();
  await row.getByLabel('Courier').fill('GIG Logistics');
  await row.getByLabel('Tracking number').fill('GIG-48213');
  await row.getByRole('button', { name: 'MARK SENT' }).click();
  await expect(row.locator('.admin-status--sent')).toBeVisible();
  await expect(row).toContainText('GIG Logistics · GIG-48213');

  // The customer's order page now says it is on its way, and how to follow it.
  await page.goto(`/order?reference=${reference}`);
  await expect(page.locator('.status__title')).toHaveText('On its way');
  await expect(page.locator('.status__tracking')).toContainText('GIG-48213');
});

test('a customer who cancels on Paystack is told nothing was taken, and keeps their bag', async ({ page }) => {
  await page.goto('/');
  const scarf = card(page, 'THE PATTERN SCARF');
  await scarf.hover();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).click();

  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await fillDelivery(page, { state: 'Kano' });
  await expect(page.locator('.delivery__sum')).toContainText('₦5,000');   // rest of Nigeria
  await page.getByRole('button', { name: /^PAY/ }).click();
  await page.click('#cancel');

  await expect(page.locator('.status__title')).toHaveText('Payment not completed');
  await page.getByRole('link', { name: 'BACK TO YOUR BAG' }).click();
  await expect(page.locator('.drawer')).toContainText('THE PATTERN SCARF');
});

test('the carousel asks for a size instead of adding one that does not exist', async ({ page }) => {
  await page.goto('/');
  const hoodie = page.locator('.slide', { hasText: 'THE RITUAL HOODIE' });
  await hoodie.scrollIntoViewIfNeeded();
  await hoodie.hover();
  await hoodie.getByRole('button', { name: 'Choose a colour and size of THE RITUAL HOODIE' }).click();
  await hoodie.getByRole('radio', { name: 'Indigo' }).click();
  await hoodie.getByRole('button', { name: 'Add THE RITUAL HOODIE in Indigo, L', exact: true }).click();

  await page.locator('.cart-btn').click();
  await expect(page.locator('.line-item__variant')).toHaveText('INDIGO · SIZE L');
});

test('a sold-out piece cannot go in the bag', async ({ page }) => {
  await page.goto('/');
  const phoneCase = page.locator('.slide', { hasText: 'THE MASK CASE' });
  await phoneCase.scrollIntoViewIfNeeded();
  await expect(phoneCase.locator('.slide__price')).toHaveText('SOLD OUT');
  await phoneCase.hover();
  await phoneCase.locator('.slide__name').click();
  await expect(page.locator('.cart-count')).toHaveText('0');
});

test('a price change in the admin reaches the shop and the bag', async ({ page }) => {
  await page.goto('/');
  const scarf = card(page, 'THE PATTERN SCARF');
  await expect(scarf.locator('.card__price')).toHaveText('₦18,000');
  await scarf.hover();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).click();

  await signIn(page);
  await adminPatch(page, 'scarf', { priceNaira: 19000 });

  await page.reload();
  await expect(card(page, 'THE PATTERN SCARF').locator('.card__price')).toHaveText('₦19,000');
  await expect(page.locator('.toast').first()).toContainText('NOW ₦19,000');
  await page.locator('.cart-btn').click();
  await expect(page.locator('.line-item__price')).toHaveText('₦19,000');
});

test('a size set to zero in the admin is struck out on the shop, and leaves the bag', async ({ page }) => {
  await page.goto('/');
  const tee = card(page, 'THE FACE TEE');
  await tee.hover();
  await tee.getByRole('button', { name: 'QUICK ADD' }).click();
  await tee.getByRole('button', { name: 'Add THE FACE TEE in Indigo, S', exact: true }).click();

  await signIn(page);
  await setStock(page, 'tee', 'S', 0, 'Indigo');
  await page.reload();

  const again = card(page, 'THE FACE TEE');
  await again.hover();
  await again.getByRole('button', { name: 'QUICK ADD' }).click();
  await expect(again.getByRole('button', { name: 'Indigo, S sold out' })).toBeDisabled();
  // Only that colour: the black S is still there to buy.
  await again.getByRole('radio', { name: 'Black' }).click();
  await expect(again.getByRole('button', { name: 'Add THE FACE TEE in Black, S', exact: true })).toBeEnabled();
  await expect(page.locator('.cart-count')).toHaveText('0');
  await expect(page.locator('.toast').first()).toContainText('NO LONGER AVAILABLE');
});

test('the bag stops at what is left', async ({ page }) => {
  await signIn(page);
  await setStock(page, 'backpack', 'ONE SIZE', 2);
  await page.goto('/');
  const bag = card(page, 'THE CARRIER BACKPACK');
  await bag.hover();
  await bag.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  const plus = page.getByRole('button', { name: 'Increase quantity of THE CARRIER BACKPACK' });
  await plus.click();
  await plus.click();
  await expect(page.locator('.qty span')).toHaveText('2');
  await expect(page.locator('.toast').last()).toContainText('ONLY 2 LEFT');
});

test('checkout stays closed until delivery is priced', async ({ page, shop }) => {
  await shop.reset({ delivery: false });
  await page.goto('/');
  const scarf = card(page, 'THE PATTERN SCARF');
  await scarf.hover();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await expect(page.locator('.drawer')).toContainText('Checkout opens soon');
  await expect(page.getByRole('button', { name: 'CHECKOUT' })).toBeDisabled();
});

test('the delivery form says what is missing, beside the box that is missing it', async ({ page }) => {
  await page.goto('/');
  const scarf = card(page, 'THE PATTERN SCARF');
  await scarf.hover();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await page.getByRole('button', { name: /^PAY/ }).click();
  await expect(page.locator('#d-email-error')).toContainText('email');
  await expect(page.locator('#d-phone-error')).toContainText('phone');
  await expect(page.locator('#d-state-error')).toContainText('state');
  await expect(page).toHaveURL(/\/$/, { timeout: 1000 });   // still here, not at Paystack
});

test('saved pieces can be found again, and bought from the saved list', async ({ page }) => {
  await page.goto('/');
  await card(page, 'THE PATTERN SCARF').getByRole('button', { name: 'Save THE PATTERN SCARF' }).click();
  await page.getByRole('button', { name: /Saved pieces \(1\)/ }).click();
  const drawer = page.getByRole('dialog', { name: 'Saved' });
  await expect(drawer).toContainText('THE PATTERN SCARF');
  await drawer.getByRole('button', { name: 'Add THE PATTERN SCARF in ONE SIZE' }).click();
  await expect(page.locator('.cart-count')).toHaveText('1');
});

test('joining the list is real: the owner sees the address', async ({ page }) => {
  await page.goto('/');
  await page.fill('#email', 'drop02@example.com');
  await page.getByRole('button', { name: 'JOIN' }).click();
  await expect(page.locator('.newsletter .form-msg')).toContainText('YOU’RE IN');

  await signIn(page);
  await page.goto('/admin#list');
  await expect(page.locator('.admin-table')).toContainText('drop02@example.com');
});

test('"track an order" takes a reference to its order page', async ({ page }) => {
  await page.goto('/');
  await page.locator('.header').getByRole('button', { name: 'Track an order' }).click();
  await page.fill('#track-ref', 'not a reference!');
  await page.getByRole('button', { name: 'SEE MY ORDER' }).click();
  await expect(page.locator('.modal .form-msg')).toContainText('does not look like');
  await page.fill('#track-ref', 'masq-000000000000000000000000');
  await page.getByRole('button', { name: 'SEE MY ORDER' }).click();
  await expect(page).toHaveURL(/\/order\?reference=masq-0+/);
  await expect(page.locator('.status__title')).toHaveText('We could not find that order');
});

test('footer pages, links and the film come from the admin', async ({ page }) => {
  await signIn(page);
  const site = await (await page.request.get('/api/admin/settings')).json();
  await page.request.put('/api/admin/settings/pages', {
    data: { ...site.pages, CONTACT: 'hello@masq.ng\n+234 803 000 1111' }
  });
  await page.request.put('/api/admin/settings/social', {
    data: { instagram: 'https://instagram.com/masq', tiktok: '', x: '' }
  });

  await page.goto('/');
  await expect(page.locator('.footer__social a')).toHaveCount(1);
  await expect(page.locator('.footer__social a')).toHaveAttribute('href', 'https://instagram.com/masq');
  await expect(page.locator('.footer__base')).toContainText(String(new Date().getFullYear()));

  await page.getByRole('navigation', { name: 'Footer' }).getByRole('button', { name: 'Contact' }).click();
  await expect(page.locator('.modal__text--pre')).toHaveText('hello@masq.ng\n+234 803 000 1111');
  await page.keyboard.press('Escape');

  await expect(page.locator('.film__label')).toHaveText('FILM — COMING SOON');
});

test('the footer is grouped, and every link in it goes somewhere', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('navigation', { name: 'Footer' });
  await expect(footer.locator('.footer__head')).toHaveText(['Shop', 'Help', 'The small print']);

  await footer.getByRole('button', { name: 'Track an order' }).click();
  await expect(page.locator('#track-ref')).toBeVisible();
  await page.keyboard.press('Escape');

  await footer.getByRole('button', { name: 'Saved pieces' }).click();
  await expect(page.getByRole('dialog', { name: 'Saved' })).toBeVisible();
  await page.keyboard.press('Escape');

  for (const [label, title] of [['Size guide', 'Size guide'], ['Delivery', 'Delivery'], ['Returns', 'Returns'],
    ['FAQ', 'FAQ'], ['Terms of sale', 'Terms of sale'], ['Privacy', 'Privacy']]) {
    await footer.getByRole('button', { name: label }).click();
    await expect(page.locator('.modal h2')).toHaveText(title.toUpperCase());
    await page.keyboard.press('Escape');
    await expect(page.locator('.modal')).toHaveCount(0);
  }

  // From a product page, a shop link brings the shopper back to that part of the home page.
  await page.goto('/product/tee');
  await footer.getByRole('link', { name: 'The Essentials' }).click();
  await expect(page).toHaveURL(/\/#essentials$/);
  await expect(page.locator('#essentials')).toBeInViewport();
});
