import { expect, openSeeded, test } from './fixtures';

const ROUTES = ['/', '/history', '/analysis', '/care', '/care/labs', '/settings', '/report', '/scan', '/nope'];

test('production headers: CSP, Trusted Types, caching of the service worker and manifest', async ({ request }) => {
  const home = await request.get('/');
  const csp = home.headers()['content-security-policy'] ?? '';
  for (const directive of [
    "default-src 'self'", "script-src 'self' 'wasm-unsafe-eval'", "worker-src 'self' blob:", "manifest-src 'self'",
    "object-src 'none'", "frame-ancestors 'none'", "require-trusted-types-for 'script'",
  ]) expect(csp).toContain(directive);
  expect(home.headers()['x-content-type-options']).toBe('nosniff');
  expect(home.headers()['referrer-policy']).toBe('no-referrer');

  const sw = await request.get('/sw.js');
  expect(sw.headers()['cache-control']).toBe('no-cache');
  expect(sw.headers()['content-type']).toContain('javascript');
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.headers()['cache-control']).toBe('no-cache');
  expect(manifest.headers()['content-type']).toContain('manifest+json');
  const body = await manifest.json();
  expect(body).toMatchObject({ display: 'standalone', start_url: '/', id: '/', short_name: expect.any(String) });
  for (const icon of body.icons) expect((await request.get(icon.src)).ok(), icon.src).toBe(true);

  const index = await request.get('/index.html');
  expect(index.headers()['cache-control'] ?? '').not.toContain('immutable');
});

test('every screen and sheet runs under the enforced CSP with no violation or console error', async ({ page }) => {
  await openSeeded(page); // the fixture fails the test on any violation
  for (const route of ROUTES) {
    await page.goto(route);
    await expect(page.locator('#app > *').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
  }

  // Sheets and dialogs (native <dialog>, forms, focus management).
  await page.goto('/');
  await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
  await page.getByRole('dialog', { name: 'New stool' }).getByRole('button', { name: 'More details' }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);

  await page.getByRole('button', { name: 'Meal Photo or barcode' }).click();
  await expect(page.locator('dialog[open]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog[open]')).toHaveCount(0);

  // Language switch loads another dictionary chunk, still under the CSP.
  await page.goto('/settings');
  await page.getByLabel('Language').selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
});
