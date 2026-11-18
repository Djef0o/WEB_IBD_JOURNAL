import { expect, test as base, type Page } from '@playwright/test';
import { BACKUP_PASSWORD, seedBackupFile } from './seed';

/**
 * `page` that fails its test on any CSP / Trusted Types violation, uncaught error or console
 * error: the pages are served with the production headers (see serve.mjs).
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    const problems: string[] = [];
    await page.exposeFunction('__reportViolation', (text: string) => problems.push(`CSP: ${text}`));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) => {
        (window as unknown as { __reportViolation(t: string): void }).__reportViolation(
          `${e.violatedDirective} blocked ${e.blockedURI} at ${e.sourceFile}:${e.lineNumber} ${e.sample}`,
        );
      });
    });
    page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') problems.push(`console.error: ${msg.text()}`);
    });
    await use(page);
    expect(problems, 'CSP violations / console errors').toEqual([]);
  },
});

export { expect };

/** Fresh browser profile → welcome screen. */
export async function openFresh(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Welcome to your tracking journal' })).toBeVisible();
}

/** Goes through every onboarding step (all skippable) down to the home screen. */
export async function completeOnboarding(page: Page, firstName = ''): Promise<void> {
  await openFresh(page);
  await page.getByRole('button', { name: 'Next' }).click(); // welcome → profile
  if (firstName) await page.getByLabel('First name').fill(firstName);
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /^(Next|Skip)$/ }).click();
  await page.getByRole('button', { name: 'Start tracking' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#main h1')).toBeVisible();
}

/** Restores an encrypted backup file through the UI from the welcome screen (fresh profile). */
export async function restoreFromWelcome(page: Page, file: Buffer | { name: string; mimeType: string; buffer: Buffer }, password = BACKUP_PASSWORD): Promise<void> {
  await openFresh(page);
  await page.locator('input[type=file]').setInputFiles(
    Buffer.isBuffer(file) ? { name: 'backup.ibdj', mimeType: 'application/octet-stream', buffer: file } : file,
  );
  const dialog = page.getByRole('dialog', { name: 'Encrypted backup' });
  await dialog.getByLabel('Password', { exact: true }).fill(password);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Import', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('#main h1')).toBeVisible();
}

/** Onboarding bypass for tests that need data: restores the fictional seed journal. */
export async function openSeeded(page: Page): Promise<void> {
  await restoreFromWelcome(page, await seedBackupFile());
}
