import { completeOnboarding, expect, openFresh, test } from './fixtures';

test('first visit redirects to the onboarding, which ends on the home screen', async ({ page }) => {
  await openFresh(page);
  await expect(page.getByText('Step 1 of 9')).toBeVisible();
  await completeOnboarding(page, 'Camille');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();

  // The profile typed during the onboarding is kept in Settings; a reload no longer shows the onboarding.
  await page.goto('/settings');
  await expect(page.getByText('Camille', { exact: true })).toBeVisible();
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
});

test('onboarding is keyboard-operable and moves focus to each step title', async ({ page }) => {
  await openFresh(page);
  await page.getByRole('button', { name: 'Next' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByText('Step 1 of 9')).toBeVisible();
});
