import { describe, expect, it } from 'vitest';
import { stool } from '../src/domain/models';
import {
  averageBristol, groupByDate, lastStool, lastWeek, monthCells, moveFocus, recentDays, shiftMonth, weekdayIndex,
} from '../src/ui/screens/history/calendar';
import { canSaveMeal, planPhoto } from '../src/ui/meal/mealDraft';
import { encodeFirstSupported, fitWithin } from '../src/ui/meal/imageResize';

describe('calendar grid', () => {
  it('weekdayIndex: Monday first', () => {
    expect(weekdayIndex('2026-11-16')).toBe(0); // lundi
    expect(weekdayIndex('2026-11-15')).toBe(6); // dimanche
    expect(weekdayIndex('1970-01-01')).toBe(3);
  });
  it('month cells: November 2026 starts on a Sunday', () => {
    const rows = monthCells({ year: 2026, month: 11 });
    expect(rows).toHaveLength(6);
    expect(rows[0]!.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(rows[0]![6]).toBe('2026-11-01');
    expect(rows[5]![0]).toBe('2026-11-30');
    expect(rows.flat().filter(Boolean)).toHaveLength(30);
  });
  it('February 2027 fits four rows', () => {
    expect(monthCells({ year: 2027, month: 2 })).toHaveLength(4);
  });
  it('shifts months across years', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });
  it('keyboard moves', () => {
    expect(moveFocus('2026-11-01', 'ArrowLeft')).toBe('2026-10-31');
    expect(moveFocus('2026-11-18', 'ArrowDown')).toBe('2026-11-25');
    expect(moveFocus('2026-11-18', 'Home')).toBe('2026-11-16');
    expect(moveFocus('2026-11-18', 'End')).toBe('2026-11-22');
    expect(moveFocus('2026-03-31', 'PageUp')).toBe('2026-02-28');
    expect(moveFocus('2026-11-18', 'a')).toBeNull();
  });
});

describe('history statistics', () => {
  const s = (date: string, bristolType: number, createdAt: number, falseUrge = false) =>
    stool({ date, bristolType, createdAt, falseUrge });
  it('colors a day by its latest entry, average counts real stools only', () => {
    const list = [s('2026-11-10', 4, 100), s('2026-11-10', 6, 200), s('2026-11-10', 0, 300, true)];
    expect(lastStool(list)!.bristolType).toBe(0);
    expect(averageBristol(list)).toBe(5);
    expect(averageBristol([s('2026-11-10', 0, 1)])).toBeNull();
  });
  it('last week bars follow Android sizing', () => {
    const byDay = groupByDate([s('2026-11-18', 4, 1), s('2026-11-18', 5, 2), s('2026-11-17', 3, 3)]);
    const week = lastWeek('2026-11-18', byDay);
    expect(week).toHaveLength(7);
    expect(week[0]!.date).toBe('2026-11-12');
    expect(week[0]).toMatchObject({ count: 0, type: null, barPx: 3 });
    expect(week[6]).toMatchObject({ count: 2, type: 5, barPx: 40 });
    expect(week[5]).toMatchObject({ count: 1, barPx: 24 });
  });
  it('recent days: five latest non-empty', () => {
    const byDay = groupByDate([1, 2, 3, 4, 5, 6, 7].map((d) => s(`2026-11-0${d}`, 4, d)));
    expect(recentDays(byDay).map((d) => d.date)).toEqual(['2026-11-07', '2026-11-06', '2026-11-05', '2026-11-04', '2026-11-03']);
  });
});

describe('meal draft', () => {
  const base = { description: '', existingPhoto: null, hasNewPhoto: false, removePhoto: false, product: null };
  it('needs content to save', () => {
    expect(canSaveMeal(base)).toBe(false);
    expect(canSaveMeal({ ...base, description: '  ' })).toBe(false);
    expect(canSaveMeal({ ...base, description: 'riz' })).toBe(true);
    expect(canSaveMeal({ ...base, existingPhoto: 'photos/a.webp' })).toBe(true);
    expect(canSaveMeal({ ...base, existingPhoto: 'photos/a.webp', removePhoto: true })).toBe(false);
  });
  it('photo plan', () => {
    expect(planPhoto({ existingPhoto: 'p', hasNewPhoto: false, removePhoto: false })).toEqual({ importNew: false, keepPath: 'p', deletePath: null });
    expect(planPhoto({ existingPhoto: 'p', hasNewPhoto: true, removePhoto: false })).toEqual({ importNew: true, keepPath: null, deletePath: 'p' });
    expect(planPhoto({ existingPhoto: 'p', hasNewPhoto: false, removePhoto: true })).toEqual({ importNew: false, keepPath: null, deletePath: 'p' });
    expect(planPhoto({ existingPhoto: null, hasNewPhoto: true, removePhoto: false })).toEqual({ importNew: true, keepPath: null, deletePath: null });
  });
});

describe('image resize', () => {
  it('fits the longest side within 1280 without upscaling', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 960, height: 1280 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(10000, 1)).toEqual({ width: 1280, height: 1 });
    expect(() => fitWithin(0, 5)).toThrow();
  });
  it('falls back to JPEG when WebP is not encoded', async () => {
    const calls: string[] = [];
    const blob = await encodeFirstSupported(async (type) => {
      calls.push(type);
      return new Blob(['x'], { type: type === 'image/webp' ? 'image/png' : type });
    });
    expect(calls).toEqual(['image/webp', 'image/jpeg']);
    expect(blob.type).toBe('image/jpeg');
    const webp = await encodeFirstSupported(async (type) => new Blob(['x'], { type }));
    expect(webp.type).toBe('image/webp');
  });
});
