/* What every browser test starts from: a clean shop, and a watch on the
 * browser console. A test fails if the page throws, or if the Content
 * Security Policy blocks anything — a blocked script or photo is a broken
 * page even when the test's own clicks happen to work. */

import { test as base, expect } from '@playwright/test';

export const CONTROL = 'http://localhost:4175';
export const ADMIN_PASSWORD = 'e2e-admin-password';

export const test = base.extend({
  shop: [async ({}, use) => {
    const reset = async (opts = {}) => {
      const q = opts.delivery === false ? '?delivery=off' : '';
      const res = await fetch(`${CONTROL}/reset${q}`, { method: 'POST' });
      if (res.status !== 204) throw new Error(`reset failed: ${res.status}`);
    };
    await reset();
    await use({ reset });
  }, { auto: true }],

  page: async ({ page }, use) => {
    const problems = [];
    page.on('pageerror', e => problems.push(`page error: ${e.message}`));
    page.on('console', m => {
      const text = m.text();
      if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(text)) problems.push(`CSP: ${text}`);
    });
    await use(page);
    expect(problems, 'the page must not throw or break its security policy').toEqual([]);
  }
});

export { expect };

/** Sign the browser in as the shop owner (the cookie lands in this browser). */
export async function signIn(page) {
  const res = await page.request.post('/api/admin/login', { data: { password: ADMIN_PASSWORD } });
  expect(res.status()).toBe(200);
}

/** Change a product through the admin API, as the signed-in owner. */
export async function adminPatch(page, id, change) {
  const res = await page.request.patch(`/api/admin/products/${id}`, { data: change });
  expect(res.status(), await res.text()).toBe(200);
  return res.json();
}

export async function setStock(page, productId, size, stock) {
  const list = await (await page.request.get('/api/admin/products')).json();
  const v = list.find(p => p.id === productId).sizes.find(s => s.size === size);
  const res = await page.request.post(`/api/admin/stock/${v.variantId}`, { data: { stock } });
  expect(res.status()).toBe(200);
}

/** Fill the delivery step with a Lagos address. */
export async function fillDelivery(page, { state = 'Lagos' } = {}) {
  await page.fill('#d-email', 'ada@example.com');
  await page.fill('#d-name', 'Ada Obi');
  await page.fill('#d-phone', '0803 123 4567');
  await page.selectOption('#d-state', state);
  await page.fill('#d-city', 'Lekki');
  await page.fill('#d-line1', '12 Admiralty Way');
}

export const card = (page, name) => page.locator('.card', { hasText: name });
