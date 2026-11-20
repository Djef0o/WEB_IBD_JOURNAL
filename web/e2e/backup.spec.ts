import { readFile } from 'node:fs/promises';
import { BACKUP_PASSWORD, seedBackupFile } from './seed';
import { completeOnboarding, expect, restoreFromWelcome, setPin, test, unlockIfLocked } from './fixtures';

test('encrypted backup: export from one browser profile, import into a fresh one', async ({ page, browser }) => {
  await completeOnboarding(page, 'Camille');
  await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
  await page.getByRole('dialog', { name: 'New stool' }).locator('.bristol-option[data-bristol="5"]').click();
  await page.getByRole('dialog', { name: 'New stool' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Stool · Type 5')).toBeVisible();

  // Export.
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Export now' }).click();
  const dialog = page.getByRole('dialog', { name: 'Protect the backup' });
  await dialog.getByLabel('Password', { exact: true }).fill(BACKUP_PASSWORD);
  await dialog.getByLabel('Confirm password', { exact: true }).fill(BACKUP_PASSWORD);
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Export data' }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^ibd-journal-backup-\d{4}-\d{2}-\d{2}\.ibdj$/);
  const bytes = await readFile(await file.path());
  expect(bytes.subarray(0, 8).toString('latin1')).toBe('IBDJENC1'); // same container as the Android app
  expect(bytes.includes(Buffer.from('Camille'))).toBe(false); // ciphertext only

  // Import into a brand-new profile (new context = empty IndexedDB), wrong password first.
  const context = await browser.newContext({ locale: 'en-US', timezoneId: 'Europe/Paris' });
  const other = await context.newPage();
  try {
    await other.goto('/');
    await other.locator('input[type=file]').setInputFiles({ name: 'backup.ibdj', mimeType: 'application/octet-stream', buffer: bytes });
    const importDialog = other.getByRole('dialog', { name: 'Encrypted backup' });
    await importDialog.getByLabel('Password', { exact: true }).fill('not the password');
    await importDialog.getByRole('checkbox').check();
    await importDialog.getByRole('button', { name: 'Import', exact: true }).click();
    await expect(importDialog.getByText('Wrong password, or the file is damaged.')).toBeVisible();
    await importDialog.getByLabel('Password', { exact: true }).fill(BACKUP_PASSWORD);
    await importDialog.getByRole('button', { name: 'Import', exact: true }).click();
    await setPin(other); // an imported journal gets a PIN before the app opens
    await expect(other).toHaveURL(/\/$/);
    await expect(other.getByText('Stool · Type 5')).toBeVisible();
    await other.goto('/settings');
    await unlockIfLocked(other);
    await expect(other.getByText('Camille', { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test('a file that is not a backup is refused without touching the data', async ({ page }) => {
  await page.goto('/');
  await page.locator('input[type=file]').setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('not a backup at all') });
  await expect(page.getByText('This file is not an IBD Journal backup. Nothing was imported.')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('restoring the seed journal shows today\'s data on the home screen', async ({ page }) => {
  await restoreFromWelcome(page, await seedBackupFile());
  await expect(page.getByText('Stool · Type 4')).toBeVisible();
});
