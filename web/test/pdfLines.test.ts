import { describe, expect, it } from 'vitest';
import { parseLabReport } from '../src/domain/labReportParser';
import { pageLines, type PdfTextItem } from '../src/labimport/pdfLines';

/** 10-point font; `width` is 5 points per character. */
const run = (str: string, x: number, baseline: number, fontSize = 10): PdfTextItem => ({
  str, x, baseline, width: str.length * 5, fontSize,
});

describe('pageLines', () => {
  it('splits a row into column chunks at gaps wider than two character widths', () => {
    const lines = pageLines([
      run('Hématocrite', 53, 506),
      run('49,4', 247, 506),
      run('%', 307, 506),
      run('39,0 - 49,0', 357, 506),
    ], 0);
    expect(lines.map((l) => l.text)).toEqual(['Hématocrite', '49,4', '%', '39,0 - 49,0']);
    expect(lines.every((l) => l.page === 0)).toBe(true);
    expect(lines.map((l) => l.left)).toEqual([53, 247, 307, 357]);
  });

  it('joins runs of one chunk, with a space only where the gap marks a word', () => {
    const [line, ...rest] = pageLines([
      run('Poly.', 53, 614),
      run('neutrophiles', 82, 614), // gap 4 points: > 0.3 × 5 → a space
      run('(', 142.5, 614), // gap 0.5 point: glued
    ], 0);
    expect(rest).toEqual([]);
    expect(line!.text).toBe('Poly. neutrophiles(');
  });

  it('groups baselines less than two points apart into one row, ordered left to right', () => {
    const lines = pageLines([run('droite', 300, 101.5), run('gauche', 50, 100)], 0);
    expect(lines.map((l) => l.text)).toEqual(['gauche', 'droite']);
    const farther = pageLines([run('b', 50, 100), run('c', 50, 103)], 0);
    expect(farther.map((l) => l.text)).toEqual(['b', 'c']);
  });

  it('orders rows from the top of the page and numbers pages from zero', () => {
    const lines = pageLines([run('bas', 50, 700), run('haut', 50, 40)], 2);
    expect(lines.map((l) => l.text)).toEqual(['haut', 'bas']);
    expect(lines.every((l) => l.page === 2)).toBe(true);
  });

  it('collapses blanks, drops empty runs and measures edges without the spaces', () => {
    const lines = pageLines([run('  ', 10, 50), run(' mg/L  ', 100, 50), run('ng', 300, 50)], 0);
    expect(lines.map((l) => l.text)).toEqual(['mg/L', 'ng']);
    expect(lines[0]!.left).toBeGreaterThan(100);
    expect(lines[0]!.right).toBeLessThan(135);
  });

  it('turns the Greek mu of pdf.js into the micro sign of the unit table', () => {
    const [line] = pageLines([run('μg/dL', 300, 50)], 0);
    expect(line!.text).toBe('\u00B5g/dL');
  });

  it('boxes a line from its tallest glyph to the lowest baseline', () => {
    const [line] = pageLines([run('a', 10, 100, 10), run('b', 16, 101, 20)], 0);
    expect(line!.bottom).toBe(101);
    expect(line!.top).toBeCloseTo(101 - 0.72 * 20);
    expect(line!.right).toBe(21);
  });

  it('feeds parseLabReport: label, result, unit and reference of one analysis row', () => {
    const items = [
      run('Prélevé le 08.04.2026 à 07:26', 31, 146),
      run('Hématocrite', 53, 506),
      run('49,4', 247, 506),
      run('%', 307, 506),
      run('39,0 - 49,0', 357, 506),
      run('V.G.M', 53, 518),
      run('91', 247, 518),
      run('fL', 307, 518),
      run('78 - 97', 357, 518),
    ];
    const scan = parseLabReport(pageLines(items, 0));
    expect(scan.sampleDate).toBe('2026-04-08');
    const byTest = Object.fromEntries(scan.values.map((v) => [v.test, v]));
    expect(byTest.HEMATOCRIT).toMatchObject({ value: 49.4, referenceLow: 39, referenceHigh: 49 });
    expect(byTest.MCV).toMatchObject({ value: 91, referenceLow: 78, referenceHigh: 97 });
  });
});
