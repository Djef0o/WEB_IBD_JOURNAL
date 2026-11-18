import { describe, expect, it } from 'vitest';
import { labResult, type LabResult } from '../src/domain/health';
import { labStatus } from '../src/domain/labReference';
import {
  buildChart, groupTests, labHistories, newestFirst, panelTable, parseLabBound, parseLabValue,
  resultsByPeriod, sparkline, timeFraction,
} from '../src/ui/labs/labValues';

const r = (init: Partial<LabResult> & Pick<LabResult, 'test' | 'value' | 'date'>) => labResult(init);

describe('number entry', () => {
  it('accepts the comma and the dot, positive numbers only', () => {
    expect(parseLabValue('12,5')).toBe(12.5);
    expect(parseLabValue(' 0.5 ')).toBe(0.5);
    expect(parseLabValue('0')).toBeNull();
    expect(parseLabValue('-1')).toBeNull();
    expect(parseLabValue('')).toBeNull();
    expect(parseLabValue('abc')).toBeNull();
    expect(parseLabValue('1,2,3')).toBeNull();
    expect(parseLabValue('Infinity')).toBeNull();
  });
  it('accepts zero as a lab bound', () => {
    expect(parseLabBound('0')).toBe(0);
    expect(parseLabBound('5,5')).toBe(5.5);
    expect(parseLabBound('-0,1')).toBeNull();
    expect(parseLabBound('')).toBeNull();
  });
});

describe('histories', () => {
  const results = [
    r({ id: 1, test: 'HEMOGLOBIN', value: 13, date: '2026-01-10' }),
    r({ id: 2, test: 'CRP', value: 3, date: '2026-01-10' }),
    r({ id: 3, test: 'CRP', value: 4, date: '2026-03-01' }),
    r({ id: 4, test: 'CRP', value: 5, date: '2026-03-01' }),
  ];
  it('orders tests like the catalog and results from most recent, last entered first', () => {
    const histories = labHistories(results);
    expect([...histories.keys()]).toEqual(['CRP', 'HEMOGLOBIN']);
    expect(histories.get('CRP')!.map((x) => x.id)).toEqual([4, 3, 2]);
    expect(results.slice().sort(newestFirst)[0]!.id).toBe(4);
  });

  it('puts tests outside the lab values first, then groups by category', () => {
    const histories = labHistories([
      r({ test: 'CRP', value: 12, date: '2026-01-10', referenceHigh: 5 }),
      r({ test: 'FERRITIN', value: 80, date: '2026-01-10' }),
      r({ test: 'HEMOGLOBIN', value: 13, date: '2026-01-10' }),
      r({ test: 'MCV', value: 90, date: '2026-01-10' }),
    ]);
    const groups = groupTests(histories, labStatus);
    expect(groups.map((g) => g.category)).toEqual([null, 'BLOOD_COUNT', 'IRON']);
    expect(groups[0]!.entries.map((e) => e.test)).toEqual(['CRP']);
    expect(groups[1]!.entries.map((e) => e.test)).toEqual(['HEMOGLOBIN', 'MCV']);
  });

  it('builds the panel table: dates most recent first, one result per test and date', () => {
    const histories = labHistories([
      r({ id: 1, test: 'CRP', value: 3, date: '2026-01-10' }),
      r({ id: 2, test: 'CRP', value: 9, date: '2026-01-10' }),
      r({ id: 3, test: 'HEMOGLOBIN', value: 13, date: '2025-12-01' }),
    ]);
    const table = panelTable(histories);
    expect(table.dates).toEqual(['2026-01-10', '2025-12-01']);
    expect(table.groups.map((g) => g.category)).toEqual(['INFLAMMATION', 'BLOOD_COUNT']);
    expect(table.cell('CRP', '2026-01-10')!.value).toBe(9);
    expect(table.cell('CRP', '2025-12-01')).toBeUndefined();
  });
});

describe('time positions and periods', () => {
  const points = [
    r({ test: 'CRP', value: 1, date: '2026-01-01' }),
    r({ test: 'CRP', value: 2, date: '2026-01-11' }),
    r({ test: 'CRP', value: 3, date: '2026-01-21' }),
  ];
  it('spreads points proportionally to elapsed time', () => {
    expect([0, 1, 2].map((i) => timeFraction(points, i))).toEqual([0, 0.5, 1]);
    expect(timeFraction([points[0]!], 0)).toBe(0.5);
    const sameDay = [points[0]!, { ...points[1]!, date: '2026-01-01' }];
    expect(timeFraction(sameDay, 1)).toBe(1);
  });

  it('cuts the history by window', () => {
    const history = [
      r({ test: 'CRP', value: 3, date: '2026-11-01' }),
      r({ test: 'CRP', value: 2, date: '2026-04-01' }),
      r({ test: 'CRP', value: 1, date: '2025-10-01' }),
    ];
    const windows = resultsByPeriod(history, '2026-11-18');
    expect(windows['6m'].map((x) => x.value)).toEqual([3]);
    expect(windows['1y'].map((x) => x.value)).toEqual([2, 3]);
    expect(windows.all.map((x) => x.value)).toEqual([1, 2, 3]);
  });
});

describe('chart model', () => {
  const box = { left: 0, right: 100, top: 0, bottom: 100 };
  const points = [
    r({ test: 'CRP', value: 2, date: '2026-01-01' }),
    r({ test: 'CRP', value: 8, date: '2026-01-11', qualifier: 'BELOW' }),
  ];
  it('starts at zero without a lower bound and spans the upper bound', () => {
    const model = buildChart(points, { low: null, high: 10 }, box, () => false);
    expect(model.min).toBe(0);
    expect(model.max).toBe(10);
    expect(model.band).toEqual({ top: 0, bottom: 100 });
    expect(model.points[0]!.y).toBeCloseTo(80);
    expect(model.points[1]!.hollow).toBe(true);
    expect(model.path).toMatch(/^M0 80 L100 20$/);
  });
  it('spans values and both bounds, and draws no band without reference values', () => {
    const withBand = buildChart(points, { low: 1, high: 4 }, box, () => false);
    expect(withBand.min).toBe(1);
    expect(withBand.max).toBe(8);
    expect(withBand.band!.top).toBeCloseTo(100 * (8 - 4) / 7);
    expect(withBand.band!.bottom).toBe(100);
    const plain = buildChart(points, null, box, () => false);
    expect(plain.band).toBeNull();
    expect([plain.min, plain.max]).toEqual([2, 8]);
  });
  it('centers a flat series', () => {
    const flat = buildChart([points[0]!], null, box, () => false);
    expect(flat.points[0]).toMatchObject({ x: 50, y: 50 });
    expect(flat.path).toBe('');
  });
  it('builds a sparkline with its last point', () => {
    const spark = sparkline(points, 80, 28, 2.5)!;
    expect(spark.last.x).toBeCloseTo(77.5);
    expect(spark.path.startsWith('M')).toBe(true);
    expect(sparkline([], 80, 28, 2.5)).toBeNull();
  });
});
