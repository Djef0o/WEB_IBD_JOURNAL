import { completeOnboarding, expect, test } from './fixtures';

test('logging a stool in two taps shows it on the home screen and survives a reload', async ({ page }) => {
  await completeOnboarding(page);
  const stats = page.getByText('stools', { exact: true }).first();
  await expect(stats).toBeVisible();

  await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
  const sheet = page.getByRole('dialog', { name: 'New stool' });
  await sheet.locator('.bristol-option[data-bristol="6"]').click();
  await sheet.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Type 6 stool logged!')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByText('Stool · Type 6')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Stool · Type 6')).toBeVisible();

  // The same stool is on today's page of the history.
  await page.getByRole('link', { name: 'History' }).first().click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(page.locator('#main h1')).toHaveText('History');
});

test('a false urge is not counted as a stool', async ({ page }) => {
  await completeOnboarding(page);
  await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
  const sheet = page.getByRole('dialog', { name: 'New stool' });
  await sheet.getByRole('button', { name: 'False urge' }).click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('False urge').first()).toBeVisible();
  await expect(page.getByText('Type 4 stool logged!')).toHaveCount(0);
});
