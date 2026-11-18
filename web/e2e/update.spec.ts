import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test as base, expect } from '@playwright/test';
import { completeOnboarding, unlockIfLocked } from './fixtures';

/*
 * Service worker update: a new version is announced by a toast ("New version available." +
 * "Update"); nothing reloads or closes by itself, so a form being filled in survives, and the
 * page only reloads when the user presses "Update". A proxy in front of the test server serves
 * a different /sw.js on demand, which is all a new deploy is from the browser's point of view.
 */
const test = base;
test.skip(({ browserName }) => browserName === 'webkit', 'service worker lifecycle is not reliable under WebKit automation');

let proxy: Server;
let origin: string;
let version = 1;

test.beforeAll(async () => {
  proxy = createServer((req, res) => {
    void (async () => {
      const upstream = await fetch(`http://127.0.0.1:4173${req.url}`);
      let body: Buffer = Buffer.from(await upstream.arrayBuffer());
      if (req.url === '/sw.js') body = Buffer.concat([body, Buffer.from(`\n// build ${version}\n`)]);
      const headers = Object.fromEntries([...upstream.headers].filter(([k]) => !/^content-(length|encoding)$/.test(k)));
      res.writeHead(upstream.status, headers).end(body);
    })();
  });
  await new Promise<void>((ok) => proxy.listen(0, '127.0.0.1', ok));
  origin = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`;
});
test.afterAll(() => new Promise<void>((ok) => proxy.close(() => ok())));

test('an update is offered in a toast, keeps the open form, and reloads only on request', async ({ browser }) => {
  version = 1;
  const context = await browser.newContext({ baseURL: origin, locale: 'en-US', timezoneId: 'Europe/Paris' });
  const page = await context.newPage();
  try {
    await completeOnboarding(page);
    await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

    // A form in progress, and a marker that a reload would erase.
    await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
    await page.getByRole('dialog', { name: 'New stool' }).getByRole('button', { name: 'More details' }).click();
    const comment = page.getByLabel('Comment…');
    await comment.fill('draft in progress');
    await page.evaluate(() => { (window as unknown as { __marker: number }).__marker = 1; });

    // "Deploy" a new version and let the browser look for it.
    version = 2;
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(true);

    // Nothing happened to the form: still open, still filled, same document, and no toast over a modal.
    await expect(comment).toHaveValue('draft in progress');
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);
    await expect(page.getByText('New version available.')).toHaveCount(0);

    // Once the sheet is closed the prompt appears, still without reloading.
    await page.keyboard.press('Escape');
    await expect(page.getByText('New version available.')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBe(1);

    // "Update": the waiting worker takes over and this tab reloads.
    const reloaded = page.waitForEvent('load');
    await page.getByRole('button', { name: 'Update' }).click();
    await reloaded;
    await unlockIfLocked(page);
    expect(await page.evaluate(() => (window as unknown as { __marker?: number }).__marker)).toBeUndefined();
    await expect(page.locator('#main h1')).toBeVisible();
    await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)).toBe(false);
  } finally {
    await context.close();
  }
});
