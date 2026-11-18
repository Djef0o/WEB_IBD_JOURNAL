import { describe, expect, it } from 'vitest';
import { doseLog, labResult } from '../src/domain/health';
import { stool } from '../src/domain/models';
import { checkup, medication, profile, reminderSchedule } from '../src/domain/profile';
import { atTime, localDate, toEpochMillis } from '../src/domain/time';
import { displayLabValue, displayReference } from '../src/report/labFormat';
import {
  REPORT_CHART_MAX_DAYS, daysFollowed, labPanels, labRowsByCategory, reportData, stoolsPerTrackedDay, trackedDays,
  yearsUntil, type ReportInput,
} from '../src/report/reportData';
import { barsBetween, historyBars, labelStep, maxTotal } from '../src/ui/charts/dailyStool';
import { meal } from '../src/domain/models';

const D = (m: number, d: number, y = 2026) => localDate(y, m, d);
const now = atTime(D(11, 18), 12, 0);

function input(over: Partial<ReportInput> = {}): ReportInput {
  return {
    period: 'LAST_30', now, profile: profile(), stools: [], meals: [], medications: [], doseLogs: [],
    labResults: [], checkups: [], ...over,
  };
}

describe('reportData', () => {
  it('period bounds and chart length', () => {
    const r = reportData(input());
    expect(r.to).toBe(D(11, 18));
    expect(r.from).toBe(D(10, 20));
    expect(r.chartFrom).toBe(D(10, 20));
    const all = reportData(input({ period: 'ALL', stools: [stool({ date: D(1, 1) })] }));
    expect(all.from).toBe(D(1, 1));
    expect(all.chartFrom).toBe(D(8, 21)); // 90 days ending 18 Nov
    expect(REPORT_CHART_MAX_DAYS).toBe(90);
    const ninety = reportData(input({ period: 'LAST_90' }));
    expect(ninety.from).toBe(D(8, 21));
  });

  it('summary counts match analysis (no stool and false urges excluded, days followed)', () => {
    const stools = [
      stool({ date: D(11, 10), bristolType: 6 }),
      stool({ date: D(11, 10), bristolType: 4 }),
      stool({ date: D(11, 11), bristolType: 0 }),
      stool({ date: D(11, 12), bristolType: 0, falseUrge: true }),
    ];
    const r = reportData(input({ stools, meals: [meal({ date: D(11, 13), type: 'LUNCH', description: 'x' })] }));
    expect(trackedDays(r.summary)).toBe(3);
    expect(daysFollowed(r.summary)).toBe(4);
    expect(stoolsPerTrackedDay(r.summary, 2)).toBeCloseTo(2 / 3);
    expect(stoolsPerTrackedDay(reportData(input()).summary, 0)).toBeNull();
    expect(r.summary.liquidPerDay).toBeCloseTo(1 / 3);
  });

  it('adherence uses the period start, or the first scheduled day for "All"', () => {
    const med = medication({ id: 1, name: 'A', schedule: reminderSchedule({ startDate: D(11, 10), repeatUnit: 'DAY' }) });
    const logs = [
      doseLog({ medicationId: 1, scheduledAt: toEpochMillis(atTime(D(11, 10), 8, 0)), status: 'TAKEN' }),
      doseLog({ medicationId: 1, scheduledAt: toEpochMillis(atTime(D(11, 11), 8, 0)), status: 'MISSED' }),
    ];
    const r = reportData(input({ medications: [med], doseLogs: logs }));
    expect(r.treatments[0]!.adherence).toEqual({ expected: 9, taken: 1, missed: 1 });
    const all = reportData(input({ period: 'ALL', medications: [med], doseLogs: logs }));
    expect(all.treatments[0]!.adherence.expected).toBe(9);
  });

  it('upcoming checkups sorted by next occurrence; finished series dropped', () => {
    const later = checkup({ id: 1, type: 'BLOOD_TEST', schedule: reminderSchedule({ startDate: D(12, 5), repeatUnit: 'ONCE' }) });
    const sooner = checkup({ id: 2, type: 'STOOL_TEST', schedule: reminderSchedule({ startDate: D(11, 20), repeatUnit: 'ONCE' }) });
    const past = checkup({ id: 3, type: 'STOOL_TEST', schedule: reminderSchedule({ startDate: D(10, 1), repeatUnit: 'ONCE' }) });
    const r = reportData(input({ checkups: [later, past, sooner] }));
    expect(r.upcomingCheckups.map((u) => u.checkup.id)).toEqual([2, 1]);
  });
});

describe('labPanels', () => {
  const res = (id: number, test: 'CRP' | 'FERRITIN' | 'HEMOGLOBIN', date: string, value: number, extra = {}) =>
    labResult({ id, test, value, date, ...extra });

  it('keeps the 4 latest dates, the last saved entry of a day, rows in test order', () => {
    const results = [
      res(1, 'FERRITIN', D(1, 1), 10),
      res(2, 'CRP', D(11, 1), 5),
      res(3, 'CRP', D(11, 1), 6),
      res(4, 'HEMOGLOBIN', D(10, 1), 13, { referenceLow: 12, referenceHigh: 16 }),
      res(5, 'CRP', D(9, 1), 2),
      res(6, 'CRP', D(8, 1), 1),
      res(7, 'CRP', D(7, 1), 1),
    ];
    const p = labPanels(results);
    expect(p.dates).toEqual([D(11, 1), D(10, 1), D(9, 1), D(8, 1)]);
    expect(p.rows.map((r) => r.test)).toEqual(['CRP', 'HEMOGLOBIN']); // FERRITIN out of the 4 dates
    expect(p.rows[0]!.cells[0]!.result.value).toBe(6);
    expect(p.rows[1]!.cells[0]).toBeNull();
    expect(p.rows[1]!.reference).toEqual({ low: 12, high: 16 });
  });

  it('flags status, notes in table order, ignores future results', () => {
    const results = [
      res(1, 'HEMOGLOBIN', D(11, 1), 10, { referenceLow: 12, referenceHigh: 16, note: ' low note ' }),
      res(2, 'CRP', D(11, 1), 3, { note: 'crp note' }),
      res(3, 'CRP', D(10, 1), 3),
    ];
    const r = reportData(input({ labResults: [...results, res(4, 'CRP', D(12, 25), 99)] }));
    const p = r.labPanels;
    expect(p.dates[0]).toBe(D(11, 1));
    expect(p.rows.find((x) => x.test === 'HEMOGLOBIN')!.cells[0]!.status).toBe('BELOW');
    expect(p.rows.find((x) => x.test === 'CRP')!.cells[0]!.status).toBeNull();
    expect(p.notes.map((n) => n.id)).toEqual([2, 1]);
    expect(labRowsByCategory(p.rows).map((g) => g.category)).toEqual(['INFLAMMATION', 'BLOOD_COUNT']);
  });
});

describe('labFormat', () => {
  it('qualifier prefix, unit, reference', () => {
    const r = labResult({ test: 'CRP', value: 1, date: D(11, 1), qualifier: 'BELOW' });
    expect(displayLabValue(r)).toBe('< 1 mg/L');
    expect(displayLabValue(r, false)).toBe('< 1');
    expect(displayReference({ low: 13.4, high: 16.7 })).toBe('13.4 – 16.7');
    expect(displayReference({ low: null, high: 5 })).toBe('< 5');
    expect(displayReference({ low: 30, high: null })).toBe('> 30');
  });
});

describe('yearsUntil', () => {
  it('whole years', () => {
    expect(yearsUntil(D(11, 19, 1990), D(11, 18))).toBe(35);
    expect(yearsUntil(D(11, 18, 1990), D(11, 18))).toBe(36);
  });
});

describe('daily stool bars', () => {
  it('categories, blood, types, false urges; type 0 not counted', () => {
    const bars = barsBetween([
      stool({ date: D(11, 17), bristolType: 1 }),
      stool({ date: D(11, 17), bristolType: 4, bloodLevel: 2 }),
      stool({ date: D(11, 17), bristolType: 7 }),
      stool({ date: D(11, 17), bristolType: 0, falseUrge: true }),
      stool({ date: D(11, 18), bristolType: 0 }),
    ], D(11, 16), D(11, 18));
    expect(bars.map((b) => b.date)).toEqual([D(11, 16), D(11, 17), D(11, 18)]);
    expect(bars[1]).toMatchObject({ counts: [1, 1, 1], total: 3, types: [1, 4, 7], falseUrges: 1, blood: true });
    expect(bars[2]).toMatchObject({ total: 0, types: [] });
    expect(maxTotal(bars)).toBe(3);
    expect(maxTotal([])).toBe(1);
  });

  it('history covers at least 14 days and starts at the oldest entry', () => {
    expect(historyBars([], D(11, 18))).toHaveLength(14);
    const long = historyBars([stool({ date: D(10, 1) })], D(11, 18));
    expect(long[0]!.date).toBe(D(10, 1));
    expect(long).toHaveLength(49);
  });

  it('label step keeps labels apart', () => {
    expect(labelStep(26, 14)).toBe(1);
    expect(labelStep(7, 14)).toBe(2);
    expect(labelStep(3, 14)).toBe(5);
  });
});
