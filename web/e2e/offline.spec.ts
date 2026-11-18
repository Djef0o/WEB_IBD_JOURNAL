import { completeOnboarding, expect, test } from './fixtures';

/*
 * Offline: after one online visit the service worker serves the app shell, a reload works with
 * the network cut, and writes (IndexedDB) keep working. Chromium and Firefox honour
 * `context.setOffline`; WebKit does not reliably, so it is skipped there.
 */
test.skip(({ browserName }) => browserName === 'webkit', 'setOffline is not reliable on WebKit');

test('after a first visit the app reloads offline and still records a stool', async ({ page, context }) => {
  await completeOnboarding(page);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  // Wait until the worker controls the page and the precache is complete.
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('workbox-precache')))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#main h1')).toBeVisible();

  // Deep link served by the navigation fallback.
  await page.goto('/history');
  await expect(page.locator('#main h1')).toHaveText('History');

  await page.goto('/');
  await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
  const sheet = page.getByRole('dialog', { name: 'New stool' });
  await sheet.locator('.bristol-option[data-bristol="3"]').click();
  await sheet.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Stool · Type 3')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Stool · Type 3')).toBeVisible();
  await context.setOffline(false);
});

test('the heavy PDF/barcode assets are not precached', async ({ page }) => {
  await completeOnboarding(page);
  await expect.poll(() => page.evaluate(async () => (await caches.keys()).some((k) => k.startsWith('workbox-precache')))).toBe(true);
  const precached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names.filter((n) => n.startsWith('workbox-precache'))) {
      urls.push(...(await (await caches.open(name)).keys()).map((r) => new URL(r.url).pathname));
    }
    return urls;
  });
  expect(precached.length).toBeGreaterThan(20);
  expect(precached.some((u) => /pdfText\.worker|zxing_reader|\.wasm$/.test(u))).toBe(false);
  expect(precached).toContain('/index.html');
});

/** One-page PDF with a text line, built by hand (valid xref): enough to wake the pdf.js worker. */
function tinyPdf(text: string): Buffer {
  const stream = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = objects.map((o, i) => { const at = body.length; body += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, 'latin1');
}

test('the PDF worker is cached on first use and then works offline', async ({ page, context }) => {
  await completeOnboarding(page);
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);
  const pdf = { name: 'bilan.pdf', mimeType: 'application/pdf', buffer: tinyPdf('Page without any tracked test') };
  const importPdf = async (): Promise<void> => {
    await page.goto('/care/labs');
    await page.locator('input[type=file]').setInputFiles(pdf);
    // Read by the worker: the review dialog says nothing was found (it is a worker round trip, not a failure).
    await expect(page.getByRole('dialog', { name: 'Check the results' })).toBeVisible();
    await expect(page.getByText('None of the tracked tests was found in these documents.')).toBeVisible();
    await page.getByRole('button', { name: 'Close', exact: true }).first().click();
  };

  await importPdf(); // online: the worker script is fetched, then kept by the runtime cache
  await expect.poll(() => page.evaluate(async () => {
    const cache = await caches.open('ibdj-heavy-assets');
    return (await cache.keys()).map((r) => new URL(r.url).pathname);
  })).toContainEqual(expect.stringMatching(/\/assets\/pdfText\.worker-.*\.js$/));

  await context.setOffline(true);
  await importPdf(); // same import with the network cut
  await context.setOffline(false);
});
