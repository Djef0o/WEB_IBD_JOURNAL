import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/*
 * WCAG AA guard for the palettes: every colour used for text keeps at least 4.5:1 on the surfaces
 * it is drawn on, in light, dark and AMOLED, for the six palettes (palettes.css + contrast.css).
 */
const read = (name: string): string => readFileSync(new URL(`../src/styles/${name}`, import.meta.url), 'utf8');

type Tokens = Record<string, string>;
interface Palette { light: Tokens; dark: Tokens; amoled: Tokens }

/** Applies every rule of `css` in order (later rules win, as in the cascade for equal specificity). */
function parse(files: readonly string[]): Record<string, Palette> {
  const palettes: Record<string, Palette> = {};
  for (const css of files) {
    for (const [, selector, body] of css.matchAll(/(:root[^{]*)\{([^}]*)\}/g)) {
      const name = /data-palette="([^"]+)"/.exec(selector!)?.[1] ?? 'sage';
      const palette = (palettes[name] ??= { light: {}, dark: {}, amoled: {} });
      const amoled = selector!.includes('amoled');
      for (const [, token, value] of body!.matchAll(/--c-([\w-]+):\s*([^;]+);/g)) {
        const pair = /light-dark\((#\w+),\s*(#\w+)\)/.exec(value!);
        if (amoled) palette.amoled[token!] = value!.trim();
        else if (pair) { palette.light[token!] = pair[1]!; palette.dark[token!] = pair[2]!; }
        else { palette.light[token!] = value!.trim(); palette.dark[token!] = value!.trim(); }
      }
    }
  }
  return palettes;
}

const channel = (hex: string, i: number): number => {
  const v = parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16) / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex: string): number => 0.2126 * channel(hex, 0) + 0.7152 * channel(hex, 1) + 0.0722 * channel(hex, 2);
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const SURFACES = [
  'background', 'surface', 'surface-dim', 'surface-bright', 'surface-variant', 'surface-container-lowest',
  'surface-container-low', 'surface-container', 'surface-container-high', 'surface-container-highest',
];
/** Text colours drawn over any surface (muted text, links, accents, error text). */
const TEXT_ON_SURFACES = ['on-surface', 'on-surface-variant', 'primary', 'secondary', 'tertiary', 'error'];
/** `on-X` text over its own fill `X`. */
const ON_FILL: ReadonlyArray<[string, string]> = [
  ['on-primary', 'primary'], ['on-secondary', 'secondary'], ['on-tertiary', 'tertiary'], ['on-error', 'error'],
  ['on-primary-container', 'primary-container'], ['on-secondary-container', 'secondary-container'],
  ['on-tertiary-container', 'tertiary-container'], ['on-error-container', 'error-container'],
  ['inverse-on-surface', 'inverse-surface'],
];

const palettes = parse([read('palettes.css'), read('contrast.css')]);

describe('palette contrast (WCAG AA, 4.5:1)', () => {
  it('knows the six palettes', () => {
    expect(Object.keys(palettes).sort()).toEqual(['catppuccin', 'gruvbox', 'nord', 'rose-pine', 'sage', 'solarized']);
  });

  for (const [name, palette] of Object.entries(palettes)) {
    for (const mode of ['light', 'dark', 'amoled'] as const) {
      it(`${name} / ${mode}`, () => {
        const tokens: Tokens = mode === 'amoled' ? { ...palette.dark, ...palette.amoled } : palette[mode];
        const failures: string[] = [];
        for (const fg of TEXT_ON_SURFACES) {
          for (const bg of SURFACES) {
            const ratio = contrast(tokens[fg]!, tokens[bg]!);
            if (ratio < 4.5) failures.push(`${fg} ${tokens[fg]} on ${bg} ${tokens[bg]}: ${ratio.toFixed(2)}`);
          }
        }
        for (const [fg, bg] of ON_FILL) {
          const ratio = contrast(tokens[fg]!, tokens[bg]!);
          if (ratio < 4.5) failures.push(`${fg} ${tokens[fg]} on ${bg} ${tokens[bg]}: ${ratio.toFixed(2)}`);
        }
        expect(failures).toEqual([]);
      });
    }
  }
});
