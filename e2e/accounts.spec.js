/* Customer accounts, end to end: sign up, prove the email with the code,
 * the profile, signing out and in again, two-step verification with an
 * authenticator, and a forgotten password. */
import { createHmac } from 'node:crypto';
import { test, expect, outbox } from './fixtures.js';

const EMAIL = 'kb@example.com';
const PASS = 'Rituals-2026';

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function totp(secret, at = Date.now()) {
  let bits = 0, v = 0; const bytes = [];
  for (const ch of secret.replace(/\s/g, '')) { v = (v << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { bytes.push((v >>> (bits - 8)) & 255); bits -= 8; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(at / 30_000)));
  const h = createHmac('sha1', Buffer.from(bytes)).update(msg).digest();
  const o = h[19] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
const lastMail = async (kind) => (await outbox()).filter(m => m.kind === kind).at(-1);

async function signUp(page) {
  await page.goto('/account/sign-up');
  await page.fill('#su-name', 'Kehinde Balogun');
  await page.fill('#su-email', EMAIL);
  await page.fill('#su-password', PASS);
  await page.locator('.check', { hasText: 'I agree to the' }).locator('input').check();
  await page.getByRole('button', { name: /CREATE ACCOUNT/ }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const code = (await lastMail('verify')).big;
  await page.locator('.code-input input').first().fill(code);    // a pasted code fills all six
  await expect(page.getByRole('heading', { name: 'Hello, Kehinde' })).toBeVisible();
}

test('a customer signs up, proves the email with the code, and lands on their account', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Create an account' }).click();
  // Nothing goes until the boxes are right and the terms are agreed.
  await page.getByRole('button', { name: /CREATE ACCOUNT/ }).click();
  await expect(page.getByText('Please enter your full name.')).toBeVisible();
  await expect(page.getByText('You must accept the Terms of Sale to continue.')).toBeVisible();
  await signUp(page);
  await expect(page.getByRole('link', { name: 'Your account (Kehinde Balogun)' })).toBeVisible();
  await expect(page.getByText('No recent orders.')).toBeVisible();
});

test('the profile saves, and refuses a birthday under 16', async ({ page }) => {
  await signUp(page);
  await page.getByRole('link', { name: 'Profile' }).click();
  await page.fill('#p-phone', '0801 234 5678');
  await page.fill('#p-dob', '2016-05-01');
  await expect(page.getByText('You must be 16 or older.')).toBeVisible();
  await page.fill('#p-dob', '1990-05-01');
  await page.getByRole('button', { name: 'SAVE CHANGES' }).click();
  await expect(page.locator('.toast', { hasText: 'Profile updated' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#p-phone')).toHaveValue('801 234 5678');
});

test('signing out asks first; signing in with the wrong password says so, the right one works', async ({ page }) => {
  await signUp(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  const ask = page.getByRole('dialog', { name: 'Sign out?' });
  await ask.getByRole('button', { name: 'SIGN OUT' }).click();
  await expect(page.locator('.toast', { hasText: 'Signed out' })).toBeVisible();

  await page.goto('/account');
  await expect(page).toHaveURL(/\/account\/sign-in/);
  await page.fill('#si-email', EMAIL);
  await page.fill('#si-password', 'not-the-one-1');
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  await expect(page.getByText('That email and password don’t match.')).toBeVisible();
  await page.fill('#si-password', PASS);
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Kehinde' })).toBeVisible();
});

test('two-step verification: turned on with the app, then asked for at sign-in', async ({ page }) => {
  await signUp(page);
  await page.goto('/account/security');
  await page.getByRole('button', { name: 'Enable' }).click();
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  const secret = (await page.locator('.tfa-secret code').innerText()).replace(/\s/g, '');
  await page.locator('.code-input input').first().fill(totp(secret));
  await expect(page.locator('.toast', { hasText: 'Two-step verification is on' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sign out?' }).getByRole('button', { name: 'SIGN OUT' }).click();
  await page.goto('/account/sign-in');
  await page.fill('#si-email', EMAIL);
  await page.fill('#si-password', PASS);
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  await expect(page.getByRole('heading', { name: 'Two-step verification' })).toBeVisible();
  // The code that switched it on cannot be used again: the next one can.
  await page.locator('.code-input input').first().fill(totp(secret, Date.now() + 30_000));
  await expect(page.getByRole('heading', { name: 'Hello, Kehinde' })).toBeVisible();
});

test('a forgotten password: the link from the email sets a new one', async ({ page }) => {
  await signUp(page);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await page.getByRole('dialog', { name: 'Sign out?' }).getByRole('button', { name: 'SIGN OUT' }).click();
  await page.goto('/account/sign-in');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await page.fill('#fp-email', EMAIL);
  await page.getByRole('button', { name: /SEND RESET LINK/ }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const link = new URL((await lastMail('reset')).button.href);
  await page.goto(link.pathname + link.search);
  await page.fill('#rp-password', 'Brand-new-pass-9');
  await page.getByRole('button', { name: /RESET PASSWORD/ }).click();
  await expect(page.getByRole('heading', { name: 'Password reset successful' })).toBeVisible();
  await page.getByRole('link', { name: /SIGN IN/ }).click();
  await page.fill('#si-password', 'Brand-new-pass-9');
  await page.getByRole('button', { name: /SIGN IN/ }).click();
  await expect(page.getByRole('heading', { name: 'Hello, Kehinde' })).toBeVisible();
});

test('a signed-in customer finds their email and name already in checkout', async ({ page }) => {
  await signUp(page);
  await page.goto('/');
  const scarf = page.locator('.card', { hasText: 'THE PATTERN SCARF' });
  await scarf.hover();
  await scarf.getByRole('button', { name: 'ADD TO BAG' }).click();
  await page.locator('.cart-btn').click();
  await page.getByRole('button', { name: 'CHECKOUT' }).click();
  await expect(page.locator('#d-email')).toHaveValue(EMAIL);
  await expect(page.locator('#d-name')).toHaveValue('Kehinde Balogun');
});
