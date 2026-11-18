import { completeOnboarding, expect, PIN, setPin, test } from './fixtures';

test('the journal is encrypted on disk and locked after a reload', async ({ page }) => {
  await completeOnboarding(page, 'Camille');
  await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
  await page.getByRole('dialog', { name: 'New stool' }).locator('.bristol-option[data-bristol="5"]').click();
  await page.getByRole('dialog', { name: 'New stool' }).getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Stool · Type 5')).toBeVisible();

  // What is on disk: no first name, no stool fields.
  const dump = await page.evaluate(() => new Promise<string>((resolve, reject) => {
    const open = indexedDB.open('ibd-journal');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const names = ['profile', 'stools'];
      const tx = db.transaction(names, 'readonly');
      const all = names.map((n) => tx.objectStore(n).getAll());
      tx.oncomplete = () => resolve(JSON.stringify(all.map((r) => r.result)));
    };
  }));
  expect(dump).not.toContain('Camille');
  expect(dump).not.toContain('bristolType');
  expect(dump).toContain('__enc');

  // A plain reload (not the fixture's auto-unlock) shows the lock screen, and the data stays hidden.
  await page.evaluate(() => location.reload());
  await expect(page.getByRole('heading', { level: 1, name: 'Journal locked' })).toBeVisible();
  await expect(page.getByText('Stool · Type 5')).toHaveCount(0);

  await page.getByLabel('PIN', { exact: true }).fill('000000');
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('Wrong PIN.')).toBeVisible();

  await page.getByLabel('PIN', { exact: true }).fill(PIN);
  await page.getByRole('button', { name: 'Unlock', exact: true }).click();
  await expect(page.getByText('Stool · Type 5')).toBeVisible();
});

test('an install that predates the PIN is asked for one, then its data is encrypted', async ({ page }) => {
  // Build the database an older version left behind: version 1, onboarding done, one clear-text stool.
  await page.goto('/robots.txt');
  await page.evaluate(() => new Promise<void>((resolve, reject) => {
    const open = indexedDB.open('ibd-journal', 1);
    open.onerror = () => reject(open.error);
    open.onupgradeneeded = () => {
      const db = open.result;
      const auto = { keyPath: 'id', autoIncrement: true };
      db.createObjectStore('meals', auto).createIndex('dateEpochDay', 'dateEpochDay');
      db.createObjectStore('stools', auto).createIndex('dateEpochDay', 'dateEpochDay');
      db.createObjectStore('products', { keyPath: 'barcode' });
      db.createObjectStore('lab_results', auto).createIndex('test_dateEpochDay', ['test', 'dateEpochDay']);
      db.createObjectStore('dose_logs', auto).createIndex('medicationId_scheduledAt', ['medicationId', 'scheduledAt'], { unique: true });
      db.createObjectStore('profile', { keyPath: 'id' });
      db.createObjectStore('medications', auto);
      db.createObjectStore('checkups', auto);
      db.createObjectStore('exams', auto);
      db.createObjectStore('prefs');
      db.createObjectStore('photos');
    };
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(['prefs', 'stools'], 'readwrite');
      tx.objectStore('prefs').put(true, 'onboarding_done');
      tx.objectStore('stools').put({
        dateEpochDay: Math.floor(Date.now() / 86_400_000), bristolType: 2, bloodLevel: 0, mucusLevel: 0, painLevel: 0,
        fatigueLevel: 0, comment: 'OLD-DATA', createdAt: Date.now(), urgency: false, nocturnal: false, falseUrge: false,
      });
      tx.oncomplete = () => { db.close(); resolve(); };
    };
  }));

  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Protect your data' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await setPin(page);
  await expect(page.locator('#main h1')).toBeVisible();
  await expect(page.getByText('Stool · Type 2')).toBeVisible();

  const raw = await page.evaluate(() => new Promise<string>((resolve) => {
    const open = indexedDB.open('ibd-journal');
    open.onsuccess = () => {
      const tx = open.result.transaction('stools', 'readonly');
      const all = tx.objectStore('stools').getAll();
      tx.oncomplete = () => resolve(JSON.stringify(all.result));
    };
  }));
  expect(raw).not.toContain('OLD-DATA');
  expect(raw).toContain('__enc');
});

test('the PIN can be changed from the settings', async ({ page }) => {
  await completeOnboarding(page);
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Change PIN' }).click();
  const dialog = page.getByRole('dialog', { name: 'Change PIN' });
  await dialog.getByLabel('Current PIN', { exact: true }).fill('000000');
  await dialog.getByLabel('New PIN', { exact: true }).fill('135790');
  await dialog.getByLabel('Confirm the PIN', { exact: true }).fill('135790');
  await dialog.getByRole('button', { name: 'Change PIN' }).click();
  await expect(dialog.getByText('Wrong PIN.')).toBeVisible();
  await dialog.getByLabel('Current PIN', { exact: true }).fill(PIN);
  await dialog.getByRole('button', { name: 'Change PIN' }).click();
  await expect(page.getByText('PIN changed.')).toBeVisible();

  await page.evaluate(() => location.reload());
  await page.locator('#lock-title').waitFor();
  await page.locator('.lock-screen input').fill(PIN);
  await page.locator('.lock-screen button[type=submit]').click();
  await expect(page.getByText('Wrong PIN.')).toBeVisible();
  await page.locator('.lock-screen input').fill('135790');
  await page.locator('.lock-screen button[type=submit]').click();
  await expect(page.locator('#main h1')).toBeVisible();
});
