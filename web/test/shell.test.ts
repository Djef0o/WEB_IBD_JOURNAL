import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { resolveRoute } from '../src/router';
import { paletteAttr, THEME_PALETTES } from '../src/ui/theme';
import { PALETTE_SWATCHES } from '../src/ui/screens/settings/paletteSwatches';

describe('router: resolveRoute', () => {
  it('résout les routes de la table', async () => {
    expect(await resolveRoute('/')).toMatchObject({ name: 'home', tab: 'home', path: '/' });
    expect(await resolveRoute('/history')).toMatchObject({ name: 'history', tab: 'history' });
    expect(await resolveRoute('/analysis')).toMatchObject({ name: 'analysis', tab: 'analysis' });
    expect(await resolveRoute('/care')).toMatchObject({ name: 'care', tab: 'care' });
    expect(await resolveRoute('/care/labs')).toMatchObject({ name: 'labs', tab: 'care' });
    expect(await resolveRoute('/report')).toMatchObject({ name: 'report' });
    expect(await resolveRoute('/scan')).toMatchObject({ name: 'scan' });
  });

  it('extrait la date de /day/:date et la valide', async () => {
    expect(await resolveRoute('/day/2026-11-18')).toMatchObject({ name: 'day', tab: 'history', params: { date: '2026-11-18' } });
    expect((await resolveRoute('/day/2026-02-30')).name).toBe('notFound');
    expect((await resolveRoute('/day/18-11-2026')).name).toBe('notFound');
    expect((await resolveRoute('/day')).name).toBe('notFound');
  });

  it('ignore le slash final et les doublons de slash', async () => {
    expect((await resolveRoute('/history/')).name).toBe('history');
    expect((await resolveRoute('//care//labs')).name).toBe('labs');
  });

  it('route inconnue : page introuvable, sans onglet actif', async () => {
    expect(await resolveRoute('/nope')).toMatchObject({ name: 'notFound', tab: null });
    expect((await resolveRoute('/history/extra')).name).toBe('notFound');
  });
});

describe('pastilles de palettes', () => {
  const css = readFileSync(new URL('../src/styles/palettes.css', import.meta.url), 'utf8');

  function block(palette: string): string {
    const start = css.search(new RegExp(`^:root(,\\s*:root)?\\[data-palette="${palette}"\\]`, 'm'));
    expect(start, palette).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf('}', start));
  }
  const pair = (text: string, name: string): [string, string] => {
    const m = new RegExp(`--c-${name}: light-dark\\((#\\w+), (#\\w+)\\)`).exec(text);
    expect(m, name).not.toBeNull();
    return [m![1]!, m![2]!];
  };

  it.each(THEME_PALETTES)('%s reprend les couleurs de palettes.css', (palette) => {
    const text = block(paletteAttr(palette));
    const swatch = PALETTE_SWATCHES[palette];
    expect(swatch.background).toEqual(pair(text, 'background'));
    expect(swatch.primary).toEqual(pair(text, 'primary'));
    expect(swatch.tertiary).toEqual(pair(text, 'tertiary'));
    expect(swatch.onPrimary).toEqual(pair(text, 'on-primary'));
  });
});
