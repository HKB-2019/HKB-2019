/* The Journal: its front page, a topic page, a story, and the owner writing
 * a story in the admin that then appears in the shop. */
import { test, expect, signIn } from './fixtures.js';

test('the Journal: from the menu to a topic, a story, and back', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: /journal/i }).click();
  await expect(page).toHaveURL(/\/journal$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Identity.');
  await page.getByRole('navigation', { name: 'Journal topics' }).getByRole('link', { name: 'BEHIND THE DESIGN' }).click();
  await expect(page).toHaveURL(/\/journal\/behind-the-design$/);
  await expect(page.getByRole('heading', { name: 'THE DESIGN PROCESS' })).toBeVisible();
  await page.getByRole('link', { name: /The Story Behind the MASQ\. Mark/ }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'The Story Behind the MASQ. Mark' })).toBeVisible();
  await expect(page.getByText('By MASQ. Editorial Team')).toBeVisible();
  await page.getByRole('link', { name: /Back to Behind the Design/ }).click();
  await expect(page).toHaveURL(/\/journal\/behind-the-design$/);
});

test('a story that is not there says so, with a way back', async ({ page }) => {
  await page.goto('/journal/story/no-such-story');
  await expect(page.getByRole('heading', { name: 'That story isn’t here.' })).toBeVisible();
  await page.getByRole('link', { name: 'BACK TO THE JOURNAL' }).click();
  await expect(page).toHaveURL(/\/journal$/);
});

test('the owner writes a story; it shows in the shop once switched on', async ({ page }) => {
  await signIn(page);
  await page.goto('/admin#journal');
  await page.getByRole('button', { name: 'NEW STORY' }).click();
  await page.getByLabel('Title', { exact: true }).fill('A Night in Yaba');
  await page.locator('.admin-story select').selectOption('lifestyle-community');
  await page.getByLabel(/Summary/).fill('Where the city goes after dark.');
  await page.getByLabel(/^Story/).fill('First paragraph about the night.\n\n## Later\n\nSecond paragraph.');
  await page.getByRole('button', { name: 'CREATE STORY' }).click();
  await expect(page.getByRole('row', { name: /A Night in Yaba/ })).toContainText('HIDDEN');

  await page.goto('/journal/story/a-night-in-yaba');
  await expect(page.getByRole('heading', { name: 'That story isn’t here.' })).toBeVisible();

  await page.goto('/admin#journal');
  await page.getByRole('row', { name: /A Night in Yaba/ }).getByRole('button', { name: 'EDIT' }).click();
  await page.locator('.admin-story').getByText('Show in the shop').click();
  await page.getByRole('button', { name: 'SAVE STORY' }).click();
  await expect(page.getByRole('row', { name: /A Night in Yaba/ })).toContainText('LIVE');

  await page.goto('/journal/story/a-night-in-yaba');
  await expect(page.getByRole('heading', { level: 1, name: 'A Night in Yaba' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Later' })).toBeVisible();
});
