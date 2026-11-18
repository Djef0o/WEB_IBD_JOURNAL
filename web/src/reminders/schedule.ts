import { calendarEventKey, EXAM_STEP_CALENDAR_KIND, type CalendarEventKind } from '../domain/calendarEvents';
import { examSteps, stepReminderAt, type ExamStepTime } from '../domain/examPlan';
import type { Exam } from '../domain/models';
import { nextOccurrence, nextRefillAlert, type Checkup, type Medication } from '../domain/profile';
import { plusMinutes, type LocalDate, type LocalDateTime } from '../domain/time';

/*
 * Reminder due dates, the platform-independent half of `TreatmentReminderScheduler.kt`: which
 * reminder falls when. The web has no background alarm; these dates feed the notifier
 * (app open), the "to do today" card and the `.ics` export.
 */

/** Everything that can remind the user of something. */
export interface ReminderData {
  medications: readonly Medication[];
  checkups: readonly Checkup[];
  exams: readonly Exam[];
}

/** One reminder to show at `at` (local time): dose, reorder alert, checkup or exam step. */
export type ReminderItem =
  | { kind: 'DOSE'; key: string; at: LocalDateTime; medication: Medication }
  | { kind: 'REFILL'; key: string; at: LocalDateTime; medication: Medication }
  | { kind: 'CHECKUP'; key: string; at: LocalDateTime; checkup: Checkup }
  | { kind: Exclude<CalendarEventKind, 'DOSE' | 'REFILL' | 'CHECKUP'>; key: string; at: LocalDateTime; exam: Exam; step: ExamStepTime };

/** Safety bound of a series walked inside one window (a window is a few minutes to a day). */
const MAX_PER_SERIES = 64;

/** Occurrences strictly after `after` and up to `until` inclusive, from a "next occurrence after" function. */
function seriesBetween(
  next: (after: LocalDateTime) => LocalDateTime | null,
  after: LocalDateTime,
  until: LocalDateTime,
): LocalDateTime[] {
  const result: LocalDateTime[] = [];
  let cursor = after;
  for (let i = 0; i < MAX_PER_SERIES; i++) {
    const at = next(cursor);
    if (at === null || at > until) break;
    result.push(at);
    cursor = at;
  }
  return result;
}

/**
 * Reminders falling strictly after `after` and up to `until` inclusive, in chronological
 * order. Same rules as Android: a dose or checkup only with its reminder enabled, a reorder
 * alert with `refillAlert`, an exam step only with the exam's reminders enabled (appointments
 * 2 h before, see `stepReminderAt`).
 */
export function remindersBetween(data: ReminderData, after: LocalDateTime, until: LocalDateTime): ReminderItem[] {
  const items: ReminderItem[] = [];
  for (const medication of data.medications) {
    if (medication.schedule.enabled) {
      for (const at of seriesBetween((a) => nextOccurrence(medication.schedule, a), after, until)) {
        items.push({ kind: 'DOSE', key: calendarEventKey('DOSE', medication.id), at, medication });
      }
    }
    for (const at of seriesBetween((a) => nextRefillAlert(medication, a), after, until)) {
      items.push({ kind: 'REFILL', key: calendarEventKey('REFILL', medication.id), at, medication });
    }
  }
  for (const checkup of data.checkups) {
    if (!checkup.schedule.enabled) continue;
    for (const at of seriesBetween((a) => nextOccurrence(checkup.schedule, a), after, until)) {
      items.push({ kind: 'CHECKUP', key: calendarEventKey('CHECKUP', checkup.id), at, checkup });
    }
  }
  for (const exam of data.exams) {
    if (!exam.remindersEnabled) continue;
    for (const step of examSteps(exam)) {
      const at = stepReminderAt(step);
      if (at > after && at <= until) {
        const kind = EXAM_STEP_CALENDAR_KIND[step.step];
        items.push({ kind, key: calendarEventKey(kind, exam.id), at, exam, step } as ReminderItem);
      }
    }
  }
  return items.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/** Last minute before the day starts: `after` of a "reminders of this day" window. */
export function dayStart(date: LocalDate): LocalDateTime {
  return plusMinutes(`${date}T00:00`, -1);
}

/** End of the day, inclusive. */
export function dayEnd(date: LocalDate): LocalDateTime {
  return `${date}T23:59:59`;
}

/** Reminders whose trigger falls on `date`. */
export function remindersOn(data: ReminderData, date: LocalDate): ReminderItem[] {
  return remindersBetween(data, dayStart(date), dayEnd(date));
}
