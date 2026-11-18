import { expect, openSeeded, test } from './fixtures';

test('report page prints without the app chrome and calls window.print()', async ({ page, browserName }) => {
  await openSeeded(page);
  await page.goto('/report');
  await expect(page.getByRole('heading', { level: 1, name: 'Follow-up report' })).toBeVisible();
  await expect(page.getByText('Camille Martin', { exact: false }).first()).toBeVisible();

  // The button hands over to the browser's print dialog (stubbed: a headless browser has none).
  await page.evaluate(() => {
    (window as unknown as { __printed: number }).__printed = 0;
    window.print = () => { (window as unknown as { __printed: number }).__printed++; };
  });
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  expect(await page.evaluate(() => (window as unknown as { __printed: number }).__printed)).toBe(1);

  // Print stylesheet: navigation, footer and the print button disappear, the report stays.
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Print / Save as PDF' })).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Follow-up report' })).toBeVisible();

  // Real paginated output (Chromium only): a short report, A4-sized, 1 to 3 pages.
  if (browserName === 'chromium') {
    const pdf = await page.pdf({ preferCSSPageSize: true });
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const pages = pdf.toString('latin1').match(/\/Type\s*\/Page\b(?!s)/g)?.length ?? 0;
    expect(pages).toBeGreaterThanOrEqual(1);
    expect(pages).toBeLessThanOrEqual(3);
  }
});
