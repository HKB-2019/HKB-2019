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
  // The owner's panel says so first, once, with the same way back.
  const told = page.getByRole('dialog', { name: 'Payment not completed' });
  await expect(told).toContainText('No amount was charged');
  await told.getByRole('button', { name: 'TRY AGAIN' }).click();
  await expect(page.locator('.drawer')).toContainText('THE PATTERN SCARF');

  // Back on the order page, the panel is not said again; the page's own button works.
  await page.goBack();
  await expect(page.locator('.status__title')).toHaveText('Payment not completed');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('link', { name: 'TRY AGAIN' }).click();
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
  // The owner's "Out of stock" panel, with the two ways on.
  const panel = page.getByRole('dialog', { name: 'Out of stock' });
  await expect(panel).toContainText('THE MASK CASE');
  await expect(panel.getByRole('button', { name: 'NOTIFY ME WHEN AVAILABLE' })).toBeVisible();
  await panel.getByRole('button', { name: 'NOTIFY ME WHEN AVAILABLE' }).click();
  // …which opens the piece's page with the back-in-stock form ready.
  await expect(page.locator('#restock-email')).toBeFocused();
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
  await expect(page.locator('.toast').first()).toContainText('is now ₦19,000');
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
  await expect(page.locator('.toast').first()).toContainText('is no longer available');
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
  await expect(page.locator('.toast').first()).toContainText('Only 2 left');
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
  await expect(page.locator('#d-email')).toBeFocused();       // the first box to fix is ready to type in
  await expect(page).toHaveURL(/\/$/, { timeout: 1000 });   // still here, not at Paystack
});

test('adding from a product page says ADDED for a moment, and the button keeps its name', async ({ page }) => {
  await page.goto('/product/scarf');
  const add = page.getByRole('button', { name: 'ADD TO BAG' });
  await add.click();
  await expect(add).toContainText('ADDED');
  await expect(page.locator('.cart-count')).toHaveText('1');
  await expect(add).toContainText('ADD TO BAG', { timeout: 3000 });
});

test('the country list shows only once the owner delivers abroad; then a customer abroad picks theirs', async ({ page }) => {
  const toCheckout = async () => {
    await page.goto('/product/scarf');
    await page.getByRole('button', { name: 'ADD TO BAG' }).click();
    await page.getByRole('button', { name: 'VIEW BAG' }).click();
    await page.getByRole('button', { name: 'CHECKOUT' }).click();
  };
  // Nigeria only: no country to choose, just the states.
  await toCheckout();
  await expect(page.locator('#d-country')).toHaveCount(0);
  await expect(page.locator('select#d-state')).toBeVisible();
  await expect(page.locator('#d-postcode')).toHaveCount(0);
  await expect(page.locator('.drawer__row--total')).toContainText('₦18,000');     // no delivery fee before a state
  await page.selectOption('#d-state', 'Lagos');
  await expect(page.locator('.drawer__row--total')).toContainText('₦20,500');     // + ₦2,500 Lagos

  // The owner switches on delivery abroad: the address and its fee follow.
  await signIn(page);
  const res = await page.request.put('/api/admin/settings/delivery', { data: {
    lagos: { enabled: true, feeKobo: 250_000 }, abuja: { enabled: true, feeKobo: 350_000 },
    nigeria: { enabled: true, feeKobo: 500_000 }, international: { enabled: true, feeKobo: 4_000_000 }
  } });
  expect(res.ok()).toBe(true);
  await toCheckout();
  await expect(page.locator('#d-country')).toHaveValue('Nigeria');
  await page.selectOption('#d-country', 'Ghana');
  await expect(page.getByLabel('STATE OR REGION')).toBeVisible();
  await expect(page.locator('.delivery__sum')).toContainText('₦40,000');
  await page.selectOption('#d-country', 'Nigeria');
  await expect(page.locator('select#d-state')).toBeVisible();                 // Nigeria's states, as a list again
  await expect(page.locator('#d-postcode')).toHaveCount(0);                   // no postcode asked for at home

  // An order to London, with its postcode, reaches the owner ready for the courier.
  await page.selectOption('#d-country', 'United Kingdom');
  await page.fill('#d-email', 'tolu@example.com');
  await page.fill('#d-name', 'Tolu Ade');
  await page.fill('#d-phone', '+44 20 7946 0000');
  await page.fill('#d-state', 'Greater London');
  await page.fill('#d-city', 'London');
  await page.fill('#d-line1', '10 Long Acre');
  await page.fill('#d-postcode', 'wc2e 9la!');
  await page.getByRole('button', { name: /^PAY/ }).click();
  await expect(page.locator('#d-postcode-error')).toContainText('Letters, numbers');
  await page.fill('#d-postcode', 'wc2e 9la');
  await page.getByRole('button', { name: /^PAY/ }).click();
  await page.click('#pay');
  await expect(page.locator('.status__title')).toHaveText('Payment received');
  await page.goto('/admin#orders');
  await expect(page.locator('.admin-who__addr').first()).toContainText('London, Greater London WC2E 9LA, United Kingdom');

  // Switched off again: the country list goes with it.
  await page.request.put('/api/admin/settings/delivery', { data: {
    lagos: { enabled: true, feeKobo: 250_000 }, abuja: { enabled: true, feeKobo: 350_000 },
    nigeria: { enabled: true, feeKobo: 500_000 }, international: { enabled: false, feeKobo: 4_000_000 }
  } });
  await toCheckout();
  await expect(page.locator('#d-country')).toHaveCount(0);
  await expect(page.locator('select#d-state')).toBeVisible();
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
  await page.locator('.newsletter').getByRole('button', { name: 'JOIN' }).click();
  await expect(page.locator('.newsletter .form-msg')).toContainText('You’re in');

  await signIn(page);
  await page.goto('/admin#list');
  await expect(page.locator('.admin-table')).toContainText('drop02@example.com');
});

test('"track an order" takes a reference to its order page', async ({ page }) => {
  await page.goto('/');
  // With accounts open, the header's person icon is Sign in; tracking is in the footer.
  await page.locator('.footer').getByRole('button', { name: 'Track an order' }).click();
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

  // With no film of the owner's set, the brand film made for the shop plays.
  await expect(page.locator('.film__label')).toHaveText('PLAY BRAND FILM');
  await page.locator('.film__play').click();
  await expect(page.locator('.film-frame video')).toHaveAttribute('src', '/assets/video/brand-film.mp4');
  await page.keyboard.press('Escape');

  // The promises above the sign-up keep to the Delivery and Returns pages.
  await expect(page.locator('.perks')).toContainText('Lagos & Abuja in 1–3 working days');
  await expect(page.locator('.perks')).toContainText('within 14 days');
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
