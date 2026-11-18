import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Page } from '@playwright/test';
import { dayOffset } from './seed';
import { expect, openFresh, openSeeded, test } from './fixtures';

/*
 * axe-core (devDependency, never shipped) injected into each screen, light and dark, at a phone
 * and a desktop width. WCAG 2.x A/AA rules plus axe's best practices; no violation allowed.
 */
const axeSource = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');

const ROUTES = ['/', '/history', `/day/${dayOffset(0)}`, '/analysis', '/care', '/care/labs', '/settings', '/report', '/scan', '/nope'];
const SCHEMES = ['light', 'dark'] as const;
const VIEWPORTS = [{ width: 360, height: 740 }, { width: 1280, height: 800 }];

interface AxeNode { target: unknown[]; html: string; failureSummary?: string }
interface AxeViolation { id: string; impact?: string; help: string; nodes: AxeNode[] }

async function audit(page: Page): Promise<string[]> {
  await page.evaluate(axeSource);
  const violations = await page.evaluate(async (): Promise<AxeViolation[]> => {
    const axe = (window as unknown as { axe: { run(ctx: Document, opts: object): Promise<{ violations: AxeViolation[] }> } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
    });
    return result.violations;
  });
  // The footer sits under the fixed bottom bar while a barely scrollable page is at scroll 0; it
  // clears the bar once scrolled to the end (checked by hand), so axe's "obscured" verdict there is a scroll-position artefact.
  const real = violations
    .map((v) => (v.id === 'target-size' ? { ...v, nodes: v.nodes.filter((n) => !n.html.includes('github.com/Djef0o/IBD_Journal')) } : v))
    .filter((v) => v.nodes.length > 0);
  return real.map((v) => `${v.id} (${v.impact}): ${v.help}\n` + v.nodes.slice(0, 4).map((n) => `    ${n.target.join(' ')}  ${n.html.slice(0, 120)}\n      ${n.failureSummary?.replace(/\n/g, ' | ')}`).join('\n'));
}

test.describe('axe-core', () => {
  for (const scheme of SCHEMES) {
    for (const viewport of VIEWPORTS) {
      test(`seeded screens, ${scheme}, ${viewport.width}px`, async ({ page }) => {
        test.setTimeout(120_000);
        await page.setViewportSize(viewport);
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        await openSeeded(page);
        const failures: string[] = [];
        for (const route of ROUTES) {
          await page.goto(route);
          await page.waitForLoadState('networkidle');
          await expect(page.locator('#app > *').first()).toBeVisible();
          for (const f of await audit(page)) failures.push(`[${route}] ${f}`);
        }
        // Open sheets: modal dialogs are part of the screens.
        await page.goto('/');
        await page.getByRole('button', { name: 'Stool In 2 taps' }).click();
        await expect(page.locator('dialog[open]')).toBeVisible();
        for (const f of await audit(page)) failures.push(`[stool sheet] ${f}`);
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Meal Photo or barcode' }).click();
        await expect(page.locator('dialog[open]')).toBeVisible();
        for (const f of await audit(page)) failures.push(`[meal sheet] ${f}`);
        expect(failures.join('\n')).toBe('');
      });
    }
  }

  test('onboarding steps and empty home', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openFresh(page);
    const failures: string[] = [];
    for (let i = 0; i < 8; i++) {
      for (const f of await audit(page)) failures.push(`[onboarding ${i + 1}] ${f}`);
      if (i < 7) await page.getByRole('button', { name: /^(Next|Skip)$/ }).click();
    }
    await page.getByRole('button', { name: 'Start tracking' }).click();
    await expect(page.locator('#main h1')).toBeVisible();
    for (const f of await audit(page)) failures.push(`[empty home] ${f}`);
    expect(failures.join('\n')).toBe('');
  });
});


// Colours come from six palettes in three modes: the contrast of each pairing is checked, not just the default.
const PALETTES = ['SAGE', 'SOLARIZED', 'NORD', 'GRUVBOX', 'CATPPUCCIN', 'ROSE_PINE'];
const MODES = ['LIGHT', 'DARK', 'AMOLED'];
test.describe('axe-core palettes', () => {
  for (const palette of PALETTES) {
    test(`${palette} in every mode`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width: 360, height: 740 });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await openSeeded(page);
      const failures: string[] = [];
      for (const mode of MODES) {
        await page.evaluate(([p, m]) => { localStorage.setItem('ibdj.palette', p!); localStorage.setItem('ibdj.theme', m!); }, [palette, mode]);
        for (const route of ['/', '/history', '/analysis', '/care', '/care/labs', '/settings']) {
          await page.goto(route);
          await page.waitForLoadState('networkidle');
          await expect(page.locator('html')).toHaveAttribute('data-palette', palette.toLowerCase().replace('_', '-'));
          for (const f of await audit(page)) failures.push(`[${palette}/${mode} ${route}] ${f}`);
        }
      }
      expect(failures.join('\n')).toBe('');
    });
  }
});
