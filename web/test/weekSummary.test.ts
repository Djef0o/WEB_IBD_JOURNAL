import { describe, expect, it } from 'vitest';
import { stool, type Stool } from '../src/domain/models';
import { nextWeighIn, parseWeightKg } from '../src/domain/weighIn';
import { averageBristol, isCalmDay, realStoolCount, weekStart } from '../src/ui/screens/home/homeLogic';

/** Port of `WeekSummaryTest.kt`: the home "this week" card covers the 7 days ending today. */
const today = '2026-11-20';
const inWeek = (stools: Stool[]) => stools.filter((s) => s.date >= weekStart(today) && s.date <= today);

describe('week summary', () => {
  it('false urges are not counted but they are still entries of the day', () => {
    const day = [
      stool({ date: today, bristolType: 6 }),
      stool({ date: today, bristolType: 4 }),
      stool({ date: today, bristolType: 0, bloodLevel: 2 }),
    ];
    expect(realStoolCount(day)).toBe(2);
    expect(averageBristol(day)).toBe(5);
    expect(isCalmDay(day)).toBe(false); // blood on the type-0 entry
  });

  it('covers seven days ending today, the day before the window excluded', () => {
    expect(weekStart(today)).toBe('2026-11-14');
    const week = inWeek([
      stool({ date: '2026-11-14', bristolType: 7 }),
      stool({ date: '2026-11-13', bristolType: 1 }),
      stool({ date: today, bristolType: 5, bloodLevel: 1 }),
    ]);
    expect(realStoolCount(week)).toBe(2);
    expect(averageBristol(week)).toBe(6);
  });

  it('no stool means no average', () => {
    expect(averageBristol([])).toBeNull();
  });
});

describe('weigh-in', () => {
  it('is the next chosen weekday at nine', () => {
    // Friday 2026-11-20; ISO days: Monday 1 … Sunday 7.
    expect(nextWeighIn(7, '2026-11-20T12:00')).toBe('2026-11-22T09:00');
    expect(nextWeighIn(5, '2026-11-20T08:00')).toBe('2026-11-20T09:00');
    expect(nextWeighIn(5, '2026-11-20T09:00')).toBe('2026-11-27T09:00');
    expect(nextWeighIn(1, '2026-11-20T12:00')).toBe('2026-11-23T09:00');
  });

  it('weight typed accepts comma, unit and rejects nonsense', () => {
    expect(parseWeightKg('71,8')).toBe(71.8);
    expect(parseWeightKg(' 72 kg ')).toBe(72);
    expect(parseWeightKg('71.84')).toBe(71.8);
    expect(parseWeightKg('abc')).toBeNull();
    expect(parseWeightKg('7')).toBeNull();
    expect(parseWeightKg('718')).toBeNull();
  });
});
