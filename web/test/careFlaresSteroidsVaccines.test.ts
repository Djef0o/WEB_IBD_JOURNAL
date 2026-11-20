import { describe, expect, it } from 'vitest';
import { flare, steroidCourse, vaccination } from '../src/domain/care';
import { isVaccineOverdue, vaccineGroups } from '../src/domain/vaccinations';
import { historyBars } from '../src/ui/charts/dailyStool';
import {
  flareActiveOn, flareCovers, flareDayNumberOn, flareDaysAmong, flareLengthDays, flareOngoingOn, sortFlaresForList,
} from '../src/domain/flares';
import {
  parseDays, parseDose, partitionSteroidCourses, steroidActiveOn, steroidCumulativeMgThrough, steroidDoseOn, steroidEnd,
  steroidTotalDays, steroidTotalMg,
} from '../src/domain/steroids';
import { localDate, localDateTime, minusDays, plusDays } from '../src/domain/time';
import { nextVaccineReminder, vaccineReminderDates } from '../src/domain/vaccineReminders';

describe('SteroidCourseTest', () => {
  const start = localDate(2026, 11, 1);
  const course = steroidCourse({
    drug: 'Prednisone',
    start,
    steps: [{ doseMg: 40, days: 3 }, { doseMg: 30, days: 2 }, { doseMg: 20, days: 1 }],
  });

  it('doseFollowsTheStepsAndEndsAfterTheLastDay', () => {
    expect(steroidDoseOn(course, minusDays(start, 1))).toBeNull();
    expect(steroidDoseOn(course, start)).toBe(40);
    expect(steroidDoseOn(course, plusDays(start, 2))).toBe(40);
    expect(steroidDoseOn(course, plusDays(start, 3))).toBe(30);
    expect(steroidDoseOn(course, plusDays(start, 5))).toBe(20);
    expect(steroidDoseOn(course, plusDays(start, 6))).toBeNull();
    expect(steroidEnd(course)).toBe(plusDays(start, 5));
  });

  it('cumulativeDoseCountsDaysTakenSoFarIncludingToday', () => {
    expect(steroidCumulativeMgThrough(course, minusDays(start, 1))).toBe(0);
    expect(steroidCumulativeMgThrough(course, start)).toBe(40);
    expect(steroidCumulativeMgThrough(course, plusDays(start, 3))).toBe(120 + 30);
    expect(steroidCumulativeMgThrough(course, plusDays(start, 30))).toBe(120 + 60 + 20);
  });

  it('totalsAndActivity', () => {
    expect(steroidTotalDays(course)).toBe(6);
    expect(steroidTotalMg(course)).toBe(200);
    expect(steroidActiveOn(course, start)).toBe(true);
    expect(steroidActiveOn(course, plusDays(start, 6))).toBe(false);
    expect(steroidActiveOn(course, minusDays(start, 1))).toBe(false);
  });

  it('anEmptyCourseEndsOnItsStartAndIsNeverActive', () => {
    const empty = steroidCourse({ drug: 'X', start, steps: [] });
    expect(steroidEnd(empty)).toBe(start);
    expect(steroidTotalMg(empty)).toBe(0);
    expect(steroidActiveOn(empty, start)).toBe(false);
    expect(steroidCumulativeMgThrough(empty, start)).toBe(0);
  });

  it('negativeDaysCountAsZero', () => {
    const odd = steroidCourse({ drug: 'X', start, steps: [{ doseMg: 10, days: -3 }, { doseMg: 5, days: 2 }] });
    expect(steroidTotalDays(odd)).toBe(2);
    expect(steroidDoseOn(odd, start)).toBe(5);
    expect(steroidTotalMg(odd)).toBe(10);
  });

  it('partitionsTheCourseUnderWayFirst', () => {
    const past = steroidCourse({ id: 1, drug: 'A', start: localDate(2026, 1, 1), steps: [{ doseMg: 5, days: 3 }] });
    const current = steroidCourse({ id: 2, drug: 'B', start, steps: [{ doseMg: 5, days: 30 }] });
    const future = steroidCourse({ id: 3, drug: 'C', start: localDate(2027, 1, 1), steps: [{ doseMg: 5, days: 3 }] });
    const { active, others } = partitionSteroidCourses([past, current, future], plusDays(start, 2));
    expect(active.map((c) => c.id)).toEqual([2]);
    expect(others.map((c) => c.id)).toEqual([3, 1]);
  });

  it('parsesDosesAndDaysLikeTheAndroidEditor', () => {
    expect(parseDose('2,5')).toBe(2.5);
    expect(parseDose(' 40 ')).toBe(40);
    expect(parseDose('2000')).toBe(2000);
    expect(parseDose('2000.5')).toBeNull();
    expect(parseDose('0')).toBeNull();
    expect(parseDose('-1')).toBeNull();
    expect(parseDose('')).toBeNull();
    expect(parseDose('abc')).toBeNull();
    expect(parseDose('0x10')).toBeNull();
    expect(parseDays('365')).toBe(365);
    expect(parseDays('366')).toBeNull();
    expect(parseDays('0')).toBeNull();
    expect(parseDays('1.5')).toBeNull();
    expect(parseDays('')).toBeNull();
  });
});

describe('VaccineReminderTest', () => {
  const due = localDate(2026, 12, 20);
  const vaccine = (enabled = true, nextDue: string | null = due) =>
    vaccination({ type: 'INFLUENZA', date: localDate(2025, 12, 20), nextDue, reminderEnabled: enabled });

  it('remindsAWeekBeforeThenOnTheDay', () => {
    const first = nextVaccineReminder(vaccine(), localDateTime(2026, 11, 19, 12, 0));
    expect(first).toBe(localDateTime(2026, 12, 13, 9, 0));
    expect(nextVaccineReminder(vaccine(), first!)).toBe(localDateTime(2026, 12, 20, 9, 0));
    expect(nextVaccineReminder(vaccine(), localDateTime(2026, 12, 20, 9, 0))).toBeNull();
  });

  it('skipsThePastLeadWhenTheDueDateIsClose', () => {
    expect(nextVaccineReminder(vaccine(), localDateTime(2026, 12, 15, 8, 0))).toBe(localDateTime(2026, 12, 20, 9, 0));
  });

  it('staysSilentWhenOffOrWithoutDueDate', () => {
    expect(nextVaccineReminder(vaccine(false), localDateTime(2026, 1, 1, 0, 0))).toBeNull();
    expect(nextVaccineReminder(vaccine(true, null), localDateTime(2026, 1, 1, 0, 0))).toBeNull();
    expect(vaccineReminderDates(vaccine(false))).toEqual([]);
  });

  it('listsBothReminderTimes', () => {
    expect(vaccineReminderDates(vaccine())).toEqual([localDateTime(2026, 12, 13, 9, 0), localDateTime(2026, 12, 20, 9, 0)]);
  });
});

describe('FlareCoverageTest', () => {
  const today = localDate(2026, 11, 19);

  it('anOngoingFlareStopsAtToday', () => {
    const ongoing = flare({ start: localDate(2026, 11, 10) });
    expect(flareCovers(ongoing, localDate(2026, 11, 9), today)).toBe(false);
    expect(flareCovers(ongoing, localDate(2026, 11, 10), today)).toBe(true);
    expect(flareCovers(ongoing, today, today)).toBe(true);
    expect(flareCovers(ongoing, localDate(2026, 11, 20), today)).toBe(false);
  });

  it('anEndedFlareCoversItsLastDay', () => {
    const ended = flare({ start: localDate(2026, 11, 1), end: localDate(2026, 11, 5) });
    expect(flareCovers(ended, localDate(2026, 11, 5), today)).toBe(true);
    expect(flareCovers(ended, localDate(2026, 11, 6), today)).toBe(false);
  });

  it('activeOnPicksTheMostRecentlyStartedAndFirstOnATie', () => {
    const older = flare({ id: 1, start: localDate(2026, 11, 1) });
    const newer = flare({ id: 2, start: localDate(2026, 11, 8), end: localDate(2026, 11, 15) });
    const twin = flare({ id: 3, start: localDate(2026, 11, 8), end: localDate(2026, 11, 15) });
    expect(flareActiveOn([older, newer, twin], localDate(2026, 11, 10), today)?.id).toBe(2);
    expect(flareActiveOn([older, newer], localDate(2026, 11, 16), today)?.id).toBe(1);
    expect(flareActiveOn([newer], localDate(2026, 11, 20), today)).toBeNull();
  });

  it('dayNumberCountsFromOne', () => {
    const f = flare({ start: localDate(2026, 11, 10) });
    expect(flareDayNumberOn(f, localDate(2026, 11, 9))).toBeNull();
    expect(flareDayNumberOn(f, localDate(2026, 11, 10))).toBe(1);
    expect(flareDayNumberOn(f, today)).toBe(10);
  });

  it('ongoingOnIgnoresEndedAndFutureFlares', () => {
    const ended = flare({ id: 1, start: localDate(2026, 11, 1), end: localDate(2026, 11, 5) });
    const future = flare({ id: 2, start: localDate(2026, 11, 25) });
    const ongoing = flare({ id: 3, start: localDate(2026, 11, 10) });
    expect(flareOngoingOn([ended, future], today)).toBeNull();
    expect(flareOngoingOn([ended, future, ongoing], today)?.id).toBe(3);
  });

  it('daysAmongKeepsTheCoveredDays', () => {
    const f = flare({ start: localDate(2026, 11, 2), end: localDate(2026, 11, 3) });
    const days = [localDate(2026, 11, 1), localDate(2026, 11, 2), localDate(2026, 11, 3), localDate(2026, 11, 4)];
    expect([...flareDaysAmong([f], days, today)]).toEqual([localDate(2026, 11, 2), localDate(2026, 11, 3)]);
    expect(flareDaysAmong([], days, today).size).toBe(0);
  });

  it('lengthAndListOrder', () => {
    expect(flareLengthDays(localDate(2026, 3, 12), localDate(2026, 3, 20))).toBe(9);
    const a = flare({ id: 1, start: localDate(2026, 1, 1), end: localDate(2026, 1, 3) });
    const b = flare({ id: 2, start: localDate(2026, 5, 1), end: localDate(2026, 5, 3) });
    const c = flare({ id: 3, start: localDate(2026, 2, 1) });
    expect(sortFlaresForList([a, b, c]).map((f) => f.id)).toEqual([3, 2, 1]);
  });
});

describe('vaccineGroups', () => {
  it('groupsByVaccineNewestDoseFirst', () => {
    const flu1 = vaccination({ id: 1, type: 'INFLUENZA', date: localDate(2025, 10, 1) });
    const flu2 = vaccination({ id: 2, type: 'INFLUENZA', date: localDate(2026, 10, 1) });
    const flu3 = vaccination({ id: 3, type: 'INFLUENZA', date: localDate(2026, 10, 1) });
    const tetanus = vaccination({ id: 4, type: 'TETANUS', date: localDate(2026, 11, 1) });
    const groups = vaccineGroups([flu1, flu2, flu3, tetanus]);
    expect(groups.map((g) => g.map((v) => v.id))).toEqual([[4], [3, 2, 1]]);
  });

  it('flagsAnOverdueNextDose', () => {
    const today = localDate(2026, 11, 19);
    expect(isVaccineOverdue(vaccination({ type: 'HPV', date: localDate(2025, 1, 1), nextDue: localDate(2026, 11, 18) }), today)).toBe(true);
    expect(isVaccineOverdue(vaccination({ type: 'HPV', date: localDate(2025, 1, 1), nextDue: today }), today)).toBe(false);
    expect(isVaccineOverdue(vaccination({ type: 'HPV', date: localDate(2025, 1, 1) }), today)).toBe(false);
  });
});

describe('daily stool bars and flares', () => {
  it('flagsTheDaysCoveredByAFlareUpToToday', () => {
    const today = localDate(2026, 11, 19);
    const ended = flare({ start: localDate(2026, 11, 8), end: localDate(2026, 11, 9) });
    const ongoing = flare({ start: localDate(2026, 11, 18) });
    const bars = historyBars([], today, [ended, ongoing]);
    const flagged = bars.filter((b) => b.flare).map((b) => b.date);
    expect(flagged).toEqual([localDate(2026, 11, 8), localDate(2026, 11, 9), localDate(2026, 11, 18), localDate(2026, 11, 19)]);
    expect(historyBars([], today).some((b) => b.flare)).toBe(false);
  });
});
