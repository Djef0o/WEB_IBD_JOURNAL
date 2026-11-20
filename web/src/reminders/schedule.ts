import { nextAppointmentReminder } from '../domain/appointmentReminders';
import { nextBackupReminder } from '../domain/backupReminders';
import { calendarEventKey, EXAM_STEP_CALENDAR_KIND, type ExamCalendarKind } from '../domain/calendarEvents';
import type { Appointment, Vaccination } from '../domain/care';
import { examSteps, stepReminderAt, type ExamStepTime } from '../domain/examPlan';
import type { Exam } from '../domain/models';
import { nextOccurrence, nextRefillAlert, type Checkup, type Medication } from '../domain/profile';
import { plusMinutes, type LocalDate, type LocalDateTime } from '../domain/time';
import { vaccineReminderDates } from '../domain/vaccineReminders';
import { nextWeighIn } from '../domain/weighIn';

/*
 * Reminder due dates, the platform-independent half of `TreatmentReminderScheduler.kt`: which
 * reminder falls when. The web has no background alarm; these dates feed the notifier
 * (app open), the "to do today" card and the `.ics` export.
 */

/** Encrypted-backup status and reminder switch (`BackupSettings`); dates are local days. */
export interface BackupReminderState {
  reminderEnabled: boolean;
  lastBackup: LocalDate | null;
  /** Start of the countdown while there is no backup. */
  since: LocalDate | null;
}

/** Weekly weigh-in reminder (`WeighInSettings`); `day`: ISO weekday, 1 = Monday. */
export interface WeighInState {
  enabled: boolean;
  day: number;
}

/** Everything that can remind the user of something. */
export interface ReminderData {
  medications: readonly Medication[];
  checkups: readonly Checkup[];
  exams: readonly Exam[];
  vaccinations: readonly Vaccination[];
  appointments: readonly Appointment[];
  backup: BackupReminderState;
  weighIn: WeighInState;
}

/**
 * One reminder to show at `at` (local time): dose, reorder alert, checkup, exam step, vaccine
 * (`due`: the planned date), appointment, backup or weigh-in.
 */
export type ReminderItem =
  | { kind: 'DOSE'; key: string; at: LocalDateTime; medication: Medication }
  | { kind: 'REFILL'; key: string; at: LocalDateTime; medication: Medication }
  | { kind: 'CHECKUP'; key: string; at: LocalDateTime; checkup: Checkup }
  | { kind: 'VACCINE'; key: string; at: LocalDateTime; vaccination: Vaccination; due: LocalDate }
  | { kind: 'APPOINTMENT'; key: string; at: LocalDateTime; appointment: Appointment }
  | { kind: 'BACKUP'; key: string; at: LocalDateTime; lastBackup: LocalDate | null }
  | { kind: 'WEIGH_IN'; key: string; at: LocalDateTime }
  | { kind: ExamCalendarKind; key: string; at: LocalDateTime; exam: Exam; step: ExamStepTime };

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
  for (const vaccination of data.vaccinations) {
    if (vaccination.nextDue === null) continue;
    for (const at of vaccineReminderDates(vaccination)) {
      if (at > after && at <= until) {
        items.push({ kind: 'VACCINE', key: calendarEventKey('VACCINE', vaccination.id), at, vaccination, due: vaccination.nextDue });
      }
    }
  }
  for (const appointment of data.appointments) {
    for (const at of seriesBetween((a) => nextAppointmentReminder(appointment, a), after, until)) {
      items.push({ kind: 'APPOINTMENT', key: calendarEventKey('APPOINTMENT', appointment.id), at, appointment });
    }
  }
  const { backup, weighIn } = data;
  // Monthly, then weekly until a backup is exported; the countdown needs a start (`since`) or a backup.
  if (backup.reminderEnabled && (backup.lastBackup !== null || backup.since !== null)) {
    const since = backup.since ?? backup.lastBackup!;
    for (const at of seriesBetween((a) => nextBackupReminder(backup.lastBackup, since, a), after, until)) {
      items.push({ kind: 'BACKUP', key: 'backup:0', at, lastBackup: backup.lastBackup });
    }
  }
  if (weighIn.enabled) {
    for (const at of seriesBetween((a) => nextWeighIn(weighIn.day, a), after, until)) {
      items.push({ kind: 'WEIGH_IN', key: 'weigh_in:0', at });
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
