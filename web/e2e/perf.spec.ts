import { gzipSync } from 'node:zlib';
import { expect, openSeeded, test } from './fixtures';

/*
 * Initial JavaScript budget: everything fetched to show the home screen of a returning user, in
 * a non-English language (English dictionary + the language's one), must stay under 120 KB
 * gzipped. pdf.js, the PDF worker and zxing-wasm must not be part of it.
 */
const BUDGET_GZIP = 120 * 1024;

test.use({ serviceWorkers: 'block' }); // measure the network, not the precache

test('initial JS of the home screen stays under the 120 KB gzip budget', async ({ page }) => {
  await openSeeded(page);
  await page.evaluate(() => localStorage.setItem('ibdj.lang', 'fr'));

  const loaded = new Map<string, number>();
  const pending: Promise<void>[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (!url.pathname.endsWith('.js')) return;
    pending.push(response.body().then((body) => { loaded.set(url.pathname, gzipSync(body, { level: 9 }).length); }));
  });
  await page.goto('/');
  await expect(page.locator('#main h1')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await Promise.all(pending);

  const total = [...loaded.values()].reduce((sum, n) => sum + n, 0);
  console.log(`initial JS (fr, home): ${loaded.size} files, ${(total / 1024).toFixed(1)} KB gzip`);
  expect(total).toBeLessThan(BUDGET_GZIP);
  for (const path of loaded.keys()) expect(path).not.toMatch(/pdfText\.worker|zxing|pdf/i);
});
