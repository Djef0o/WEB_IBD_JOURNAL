import type { DoseLog, DoseStatus } from './health';
import type { Medication, ReminderSchedule } from './profile';
import {
  atTime, dateOf, daysUntil, monthsUntil, plusDays, plusMonths, toEpochMillis,
  type LocalDate, type LocalDateTime,
} from './time';

/** True if the schedule has a dose on that day (months counted from the start, like reminders). */
export function occursOn(schedule: ReminderSchedule, date: LocalDate): boolean {
  const { startDate, repeatUnit } = schedule;
  if (date < startDate) return false;
  const every = Math.max(schedule.repeatEvery, 1);
  switch (repeatUnit) {
    case 'ONCE': return date === startDate;
    case 'DAY': return daysUntil(startDate, date) % every === 0;
    case 'WEEK': return daysUntil(startDate, date) % (7 * every) === 0;
    case 'MONTH': {
      // February 28 is only "0 months" after January 31: also test the following month.
      const months = monthsUntil(startDate, date);
      return [months, months + 1].some((m) => m % every === 0 && plusMonths(startDate, m) === date);
    }
  }
}

/** Scheduled occurrences between `from` and `to` inclusive, in order. */
export function occurrencesBetween(schedule: ReminderSchedule, from: LocalDate, to: LocalDate): LocalDateTime[] {
  const result: LocalDateTime[] = [];
  for (let day = from; day <= to; day = plusDays(day, 1)) {
    if (occursOn(schedule, day)) result.push(atTime(day, schedule.hour, schedule.minute));
  }
  return result;
}

/** Dose scheduled on a given day, with its confirmation if any. */
export interface DoseDue {
  medication: Medication;
  at: LocalDateTime;
  status: DoseStatus | null;
}

/** Key of the occurrence in `DoseLog.scheduledAt`. */
export function doseScheduledAt(due: DoseDue): number {
  return toEpochMillis(due.at);
}

/** Doses scheduled on `date` for all medications, by time. */
export function dosesOn(date: LocalDate, medications: Medication[], logs: DoseLog[]): DoseDue[] {
  const statuses = new Map(logs.map((log) => [`${log.medicationId}:${log.scheduledAt}`, log.status]));
  return medications
    .flatMap((medication) =>
      occurrencesBetween(medication.schedule, date, date).map((at): DoseDue => ({
        medication,
        at,
        status: statuses.get(`${medication.id}:${toEpochMillis(at)}`) ?? null,
      })))
    .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
}

/**
 * Adherence for a medication: doses scheduled from `from` through `until` inclusive, and among
 * them those confirmed taken or missed. Doses without an answer count for neither
 * one nor the other.
 */
export interface Adherence {
  expected: number;
  taken: number;
  missed: number;
}

/** Share of scheduled doses confirmed taken, or null with no scheduled dose. */
export function takenRate(a: Adherence): number | null {
  return a.expected === 0 ? null : a.taken / a.expected;
}

export function adherence(
  medication: Medication, logs: DoseLog[], from: LocalDate, until: LocalDateTime,
): Adherence {
  const due = new Set(
    occurrencesBetween(medication.schedule, from, dateOf(until))
      .filter((at) => at <= until)
      .map(toEpochMillis),
  );
  const answered = logs.filter((log) => log.medicationId === medication.id && due.has(log.scheduledAt));
  return {
    expected: due.size,
    taken: answered.filter((log) => log.status === 'TAKEN').length,
    missed: answered.filter((log) => log.status === 'MISSED').length,
  };
}
