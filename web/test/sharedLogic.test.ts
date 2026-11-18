import { describe, expect, it } from 'vitest';
import { adherence, dosesOn, occurrencesBetween, takenRate } from '../src/domain/adherence';
import { analyze, type AnalysisPeriod } from '../src/domain/analysis';
import { decodeBackupData } from '../src/domain/backupData';
import { doseEvent, refillEvent } from '../src/domain/calendarEvents';
import { doseLog, type DoseStatus } from '../src/domain/health';
import { stool } from '../src/domain/models';
import {
  medication, nextOccurrence, nextRefillAlert, refillBasis, reminderSchedule,
  type ReminderSchedule, type RepeatUnit,
} from '../src/domain/profile';
import { atTime, localDate, parseLocalDate, parseLocalDateTime, toEpochMillis } from '../src/domain/time';

describe('ReminderScheduleTest', () => {
  const schedule = (start: string, every: number, unit: RepeatUnit, hour = 8) =>
    reminderSchedule({ startDate: parseLocalDate(start), hour, minute: 0, repeatEvery: every, repeatUnit: unit });

  const next = (s: ReminderSchedule, after: string) => nextOccurrence(s, parseLocalDateTime(after));

  it('firstOccurrenceInTheFutureIsTheStartDate', () => {
    expect(next(schedule('2026-11-20', 1, 'DAY'), '2026-11-15T10:00')).toBe('2026-11-20T08:00');
  });

  it('occurrenceAtExactlyNowIsSkipped', () => {
    // An alarm that just rang must not reschedule itself.
    expect(next(schedule('2026-11-01', 1, 'DAY'), '2026-11-15T08:00')).toBe('2026-11-16T08:00');
  });

  it('everyThreeDaysStaysOnTheStartGrid', () => {
    expect(next(schedule('2026-11-01', 3, 'DAY'), '2026-11-15T09:00')).toBe('2026-11-16T08:00');
  });

  it('everyTwoWeeks', () => {
    expect(next(schedule('2026-11-02', 2, 'WEEK', 20), '2026-11-15T21:00')).toBe('2026-11-16T20:00');
  });

  it('monthlyOnThe31stClampsThenReturnsToThe31st', () => {
    const monthly = schedule('2026-01-31', 1, 'MONTH', 9);
    expect(next(monthly, '2026-02-01T00:00')).toBe('2026-02-28T09:00');
    expect(next(monthly, '2026-02-28T10:00')).toBe('2026-03-31T09:00');
  });

  it('onceIsOverAfterItsDate', () => {
    expect(next(schedule('2026-11-01', 1, 'ONCE'), '2026-11-15T10:00')).toBeNull();
  });

  it('spacedInjectionAlertsSevenDaysBeforeEachDose', () => {
    // Adalimumab every 2 weeks since November 2: doses on the 16th, the 30th…
    const injection = medication({
      name: 'Adalimumab',
      schedule: schedule('2026-11-02', 2, 'WEEK'),
      refillAlert: true,
    });
    expect(refillBasis(injection)).toBe('BEFORE_DOSE');
    expect(nextRefillAlert(injection, parseLocalDateTime('2026-11-15T10:00'))).toBe('2026-11-23T08:00');
  });

  it('dailyTreatmentAlertsSevenDaysBeforeStockEnd', () => {
    const daily = medication({
      name: 'Mesalazine',
      schedule: schedule('2026-11-01', 1, 'DAY'),
      refillAlert: true,
      stockEndDate: parseLocalDate('2026-12-01'),
    });
    expect(refillBasis(daily)).toBe('STOCK_END');
    expect(nextRefillAlert(daily, parseLocalDateTime('2026-11-15T10:00'))).toBe('2026-11-24T08:00');
    // Alert in the past: nothing more until the end date is renewed.
    expect(nextRefillAlert(daily, parseLocalDateTime('2026-11-24T08:00'))).toBeNull();
  });

  it('calendarEventsMirrorTheReminders', () => {
    const injection = medication({
      id: 4,
      name: 'Adalimumab',
      schedule: schedule('2026-11-02', 2, 'WEEK'),
      refillAlert: true,
    });
    const dose = doseEvent(injection)!;
    const refill = refillEvent(injection)!;

    expect(dose.key).toBe('dose:4');
    expect(dose.start).toBe('2026-11-02T08:00');
    // Refill series: same rhythm, 7 days before each dose.
    expect(refill.start).toBe('2026-10-26T08:00');
    expect(refill.repeatUnit).toBe('WEEK');
    expect(refill.repeatEvery).toBe(2);

    const daily = medication({
      id: 5,
      name: 'Mesalazine',
      schedule: { ...schedule('2026-11-01', 1, 'DAY'), enabled: false },
      refillAlert: true,
      stockEndDate: parseLocalDate('2026-12-01'),
    });
    expect(doseEvent(daily)).toBeNull();
    expect(refillEvent(daily)!.start).toBe('2026-11-24T08:00');
    expect(refillEvent(daily)!.repeatUnit).toBe('ONCE');
  });
});

describe('AnalyzeTest', () => {
  const today = parseLocalDate('2026-11-15');

  const stoolOn = (date: string, type = 4, blood = 0) =>
    stool({ date: parseLocalDate(date), bristolType: type, bloodLevel: blood, createdAt: 0 });

  it('countsDaysWithBloodAndComparesWithThePreviousPeriod', () => {
    const history = [
      stoolOn('2026-11-15', 4, 2),
      stoolOn('2026-11-15', 4, 1), // same day: counted once
      stoolOn('2026-11-01', 4, 1),
      stoolOn('2026-10-10', 4, 3), // previous period (Sept 16 – Oct 16)
      stoolOn('2026-10-20'),
    ];

    const summary = analyze(history, [], today, 'LAST_30');
    const blood = summary.symptomDays.filter((it) => it.symptom === 'BLOOD');

    expect(summary.periodDays).toBe(30);
    expect(summary.stools.length).toBe(4);
    expect(blood.length).toBe(1);
    expect(blood[0]!.days).toBe(2);
    expect(blood[0]!.previousDays).toBe(1);
  });

  it('liquidStoolsAreAveragedOverTrackedDays', () => {
    const history = [stoolOn('2026-11-14', 6), stoolOn('2026-11-14', 7), stoolOn('2026-11-15', 4)];

    const summary = analyze(history, [], today, 'LAST_30');

    expect(summary.liquidPerDay).toBe(1.0);
  });

  it('allHistoryStartsAtFirstEntryWithoutComparison', () => {
    const history = [stoolOn('2026-11-06', 4, 1), stoolOn('2026-11-15')];
    const period: AnalysisPeriod = 'ALL';

    const summary = analyze(history, [], today, period);

    expect(summary.periodDays).toBe(10);
    expect(summary.symptomDays.find((it) => it.symptom === 'BLOOD')!.previousDays).toBeNull();
  });
});

describe('BackupFormatTest', () => {
  /** Backup produced before the shared module (java.time dates in ISO, no profile). */
  const legacyBackup = `
    {"meals":[{"id":3,"date":"2026-11-14","type":"LUNCH","description":"Riz"}],
     "stools":[{"id":7,"date":"2026-11-15","bristolType":6,"bloodLevel":1,"createdAt":1794733200000}]}
  `.trim();

  it('legacyBackupStillDecodes', () => {
    const backup = decodeBackupData(legacyBackup);

    expect(backup.meals).toHaveLength(1);
    expect(backup.meals[0]!.date).toBe(localDate(2026, 11, 14));
    expect(backup.stools).toHaveLength(1);
    expect(backup.stools[0]!.date).toBe(localDate(2026, 11, 15));
    expect(backup.profile).toBeNull();
    expect(backup.medications).toBeNull();
  });
});

describe('AdherenceTest', () => {
  const schedule = (start: string, every: number, unit: RepeatUnit) =>
    reminderSchedule({ startDate: parseLocalDate(start), hour: 8, minute: 0, repeatEvery: every, repeatUnit: unit });

  it('occurrencesFollowTheSameGridAsReminders', () => {
    const monthly = schedule('2026-01-31', 1, 'MONTH');
    expect(occurrencesBetween(monthly, parseLocalDate('2026-01-01'), parseLocalDate('2026-03-31'))).toEqual([
      '2026-01-31T08:00', '2026-02-28T08:00', '2026-03-31T08:00',
    ]);
    const everyTwoWeeks = schedule('2026-11-02', 2, 'WEEK');
    expect(occurrencesBetween(everyTwoWeeks, parseLocalDate('2026-11-01'), parseLocalDate('2026-11-20'))).toEqual([
      '2026-11-02T08:00', '2026-11-16T08:00',
    ]);
  });

  it('adherenceCountsOnlyDosesDueSoFar', () => {
    const med = medication({ id: 1, name: 'Azathioprine', schedule: schedule('2026-11-10', 1, 'DAY') });
    const due = occurrencesBetween(med.schedule, parseLocalDate('2026-11-10'), parseLocalDate('2026-11-15'));
    const logs = [
      doseLog({ medicationId: 1, scheduledAt: toEpochMillis(due[0]!), status: 'TAKEN' }),
      doseLog({ medicationId: 1, scheduledAt: toEpochMillis(due[1]!), status: 'MISSED' }),
      doseLog({ medicationId: 2, scheduledAt: toEpochMillis(due[2]!), status: 'TAKEN' }),
    ];

    // On the 15th at 07:00, the 08:00 dose is not yet due: 10 → 14 = 5 doses.
    const result = adherence(med, logs, parseLocalDate('2026-11-01'), parseLocalDateTime('2026-11-15T07:00'));

    expect(result).toEqual({ expected: 5, taken: 1, missed: 1 });
    expect(takenRate(result)).toBe(0.2);
  });

  it('dosesOfTheDayCarryTheirConfirmation', () => {
    const daily = medication({ id: 1, name: 'Mesalazine', schedule: schedule('2026-11-01', 1, 'DAY') });
    const weekly = medication({ id: 2, name: 'Methotrexate', schedule: schedule('2026-11-06', 1, 'WEEK') });
    const today = parseLocalDate('2026-11-13');
    const logs = [doseLog({ medicationId: 1, scheduledAt: toEpochMillis(atTime(today, 8, 0)), status: 'TAKEN' })];

    const doses = dosesOn(today, [daily, weekly], logs);

    const expected: Array<[number, DoseStatus | null]> = [[1, 'TAKEN'], [2, null]];
    expect(doses.map((d) => [d.medication.id, d.status])).toEqual(expected);
  });
});
