import { describe, expect, it } from 'vitest';
import { appointment, wellbeingDay } from '../src/domain/care';
import { nextAppointmentReminder } from '../src/domain/appointmentReminders';
import { stool } from '../src/domain/models';
import { localDateTime, plusDays } from '../src/domain/time';
import { wellbeingAverages, wellbeingLinks } from '../src/domain/wellbeing';

describe('WellbeingTest', () => {
  const start = '2026-10-01';
  const day = (i: number) => plusDays(start, i);
  const bad = (i: number) => stool({ date: day(i), bristolType: 7 });
  const good = (i: number) => stool({ date: day(i), bristolType: 4 });
  const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

  it('highStressDaysWithMoreBadDaysAreReportedAgainstTheOtherDays', () => {
    // Days 0-5: stress 5, 5 bad of 6. Days 6-15: stress 1, 1 bad of 10.
    const days = [...range(0, 5).map((i) => wellbeingDay({ date: day(i), stress: 5 })), ...range(6, 15).map((i) => wellbeingDay({ date: day(i), stress: 1 }))];
    const stools = [...range(0, 4).map(bad), good(5), ...range(6, 14).map(good), bad(15)];
    const links = wellbeingLinks(days, stools);
    expect(links).toHaveLength(1);
    const link = links[0]!;
    expect(link.factor).toBe('HIGH_STRESS');
    expect(link.days).toBe(6);
    expect(link.badRate).toBeCloseTo(5 / 6, 9);
    expect(link.baseline).toBeCloseTo(0.1, 9);
  });

  it('tooFewFlaggedDaysOrNoDifferenceGivesNothing', () => {
    const fewDays = [...range(0, 3).map((i) => wellbeingDay({ date: day(i), mood: 1 })), ...range(4, 12).map((i) => wellbeingDay({ date: day(i), mood: 5 }))];
    expect(wellbeingLinks(fewDays, range(0, 12).map(bad))).toEqual([]);
    const sameRate = [...range(0, 5).map((i) => wellbeingDay({ date: day(i), sleep: 1 })), ...range(6, 11).map((i) => wellbeingDay({ date: day(i), sleep: 5 }))];
    expect(wellbeingLinks(sameRate, range(0, 11).map(good))).toEqual([]);
  });

  it('daysWithoutStoolsOrWithoutTheValueAreLeftOut', () => {
    // Stress noted on days 0-5 but stools only logged on days 3-5: only 3 flagged days, below the minimum.
    const days = [...range(0, 5).map((i) => wellbeingDay({ date: day(i), stress: 5 })), ...range(6, 15).map((i) => wellbeingDay({ date: day(i), sleep: 3 }))];
    const stools = [...range(3, 5).map(bad), ...range(6, 15).map(good)];
    expect(wellbeingLinks(days, stools).some((l) => l.factor === 'HIGH_STRESS')).toBe(false);
  });

  it('periodDaysCompareAgainstOtherNotedDays', () => {
    const days = [...range(0, 5).map((i) => wellbeingDay({ date: day(i), period: true })), ...range(6, 15).map((i) => wellbeingDay({ date: day(i), mood: 4 }))];
    const stools = [...range(0, 5).map(bad), ...range(6, 15).map(good)];
    expect(wellbeingLinks(days, stools).map((l) => l.factor)).toEqual(['PERIOD']);
  });

  it('averagesCountOnlyNotedValuesInsideThePeriod', () => {
    const days = [
      wellbeingDay({ date: day(0), sleep: 2, stress: 4 }),
      wellbeingDay({ date: day(1), sleep: 4, mood: 3, period: true }),
      wellbeingDay({ date: day(20), sleep: 5 }),
    ];
    const averages = wellbeingAverages(days, day(0), day(10));
    expect(averages.sleep).toBe(3);
    expect(averages.stress).toBe(4);
    expect(averages.mood).toBe(3);
    expect(averages.periodDays).toBe(1);
    expect(averages.entries).toBe(2);
    expect(wellbeingAverages([], day(0), day(10)).sleep).toBeNull();
  });
});

describe('AppointmentReminderTest', () => {
  const visit = (at: string, enabled = true) => appointment({ kind: 'GASTROENTEROLOGIST', at, remindersEnabled: enabled });

  it('remindsTheEveningBeforeThenTwoHoursBefore', () => {
    const a = visit(localDateTime(2026, 12, 10, 14, 30));
    const first = nextAppointmentReminder(a, localDateTime(2026, 12, 1, 8, 0));
    expect(first).toBe(localDateTime(2026, 12, 9, 18, 0));
    const second = nextAppointmentReminder(a, first!);
    expect(second).toBe(localDateTime(2026, 12, 10, 12, 30));
    expect(nextAppointmentReminder(a, second!)).toBeNull();
  });

  it('anEarlyMorningAppointmentGetsItsSecondReminderTheNightBefore', () => {
    // Two hours before 01:30 is the previous day 23:30, after the 18:00 evening reminder.
    const a = visit(localDateTime(2026, 12, 10, 1, 30));
    const first = nextAppointmentReminder(a, localDateTime(2026, 12, 1, 8, 0));
    expect(first).toBe(localDateTime(2026, 12, 9, 18, 0));
    expect(nextAppointmentReminder(a, first!)).toBe(localDateTime(2026, 12, 9, 23, 30));
  });

  it('skipsPastRemindersAndStaysSilentWhenOff', () => {
    const a = visit(localDateTime(2026, 12, 10, 14, 30));
    expect(nextAppointmentReminder(a, localDateTime(2026, 12, 10, 8, 0))).toBe(localDateTime(2026, 12, 10, 12, 30));
    expect(nextAppointmentReminder(a, localDateTime(2026, 12, 10, 13, 0))).toBeNull();
    expect(nextAppointmentReminder(visit(localDateTime(2026, 12, 10, 14, 30), false), localDateTime(2026, 1, 1, 0, 0))).toBeNull();
  });
});
