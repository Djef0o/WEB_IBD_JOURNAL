import { dosesOn, occursOn, type DoseDue } from '../domain/adherence';
import { BACKUP_INTERVAL_DAYS, BACKUP_REMINDER_HOUR, isBackupOverdue } from '../domain/backupReminders';
import type { Appointment, Vaccination } from '../domain/care';
import { examSteps, type ExamStepTime } from '../domain/examPlan';
import type { DoseLog } from '../domain/health';
import type { Exam, Weight } from '../domain/models';
import { isLowStock, nextRefillAlert, type Checkup, type Medication } from '../domain/profile';
import { atTime, dateOf, plusDays, type LocalDate, type LocalDateTime } from '../domain/time';
import { vaccineReminderDates } from '../domain/vaccineReminders';
import { isoDayOfWeek, WEIGH_IN_HOUR } from '../domain/weighIn';
import { dayEnd, dayStart, type ReminderData } from './schedule';

/** What the "to do today" card lists, in chronological order. */
export type TodayTask =
  | { type: 'dose'; at: LocalDateTime; due: DoseDue }
  | { type: 'refill'; at: LocalDateTime; medication: Medication }
  | { type: 'checkup'; at: LocalDateTime; checkup: Checkup }
  | { type: 'exam'; at: LocalDateTime; exam: Exam; step: ExamStepTime }
  | { type: 'vaccine'; at: LocalDateTime; vaccination: Vaccination; due: LocalDate }
  | { type: 'appointment'; at: LocalDateTime; appointment: Appointment }
  | { type: 'backup'; at: LocalDateTime; lastBackup: LocalDate | null }
  | { type: 'weighIn'; at: LocalDateTime }
  | { type: 'lowStock'; at: LocalDateTime; medication: Medication };

export interface TodayInput extends ReminderData {
  date: LocalDate;
  doseLogs: readonly DoseLog[];
  weights: readonly Weight[];
}

/** Order inside the same minute: doses first, then the rest. */
const RANK: Record<TodayTask['type'], number> = {
  dose: 0, checkup: 1, exam: 2, appointment: 3, vaccine: 4, weighIn: 5, refill: 6, lowStock: 7, backup: 8,
};

/**
 * Doses of the day (with their answer), checkups and reorder alerts falling today, exam
 * steps and appointments dated today, vaccine reminders falling today, the weigh-in on the
 * chosen weekday until a weight is recorded, treatments at or under their low-stock threshold,
 * and the backup while it is overdue. Reminder switches do not matter for doses, checkups,
 * exams and appointments: `enabled` only controls notifications, the date stays useful (same
 * rule as the doses card of the Android home screen). Vaccine reminders, the backup and the
 * weigh-in are shown only with their reminder on: they have no date of their own.
 */
export function todayTasks(input: TodayInput): TodayTask[] {
  const { date } = input;
  const tasks: TodayTask[] = [];

  for (const due of dosesOn(date, [...input.medications], [...input.doseLogs])) {
    tasks.push({ type: 'dose', at: due.at, due });
  }
  for (const checkup of input.checkups) {
    if (occursOn(checkup.schedule, date)) {
      tasks.push({ type: 'checkup', at: atTime(date, checkup.schedule.hour, checkup.schedule.minute), checkup });
    }
  }
  for (const medication of input.medications) {
    const alert = nextRefillAlert(medication, dayStart(date));
    if (alert !== null && alert <= dayEnd(date)) tasks.push({ type: 'refill', at: alert, medication });
    if (isLowStock(medication)) tasks.push({ type: 'lowStock', at: atTime(date, 0, 0), medication });
  }
  for (const exam of input.exams) {
    for (const step of examSteps(exam)) {
      if (dateOf(step.at) === date) tasks.push({ type: 'exam', at: step.at, exam, step });
    }
  }
  for (const vaccination of input.vaccinations) {
    const due = vaccination.nextDue;
    if (due === null) continue;
    // Reminders (a week before, the day itself) falling on this date; none when they are off.
    const at = vaccineReminderDates(vaccination).find((reminder) => dateOf(reminder) === date);
    if (at !== undefined) tasks.push({ type: 'vaccine', at, vaccination, due });
  }
  for (const appointment of input.appointments) {
    if (dateOf(appointment.at) === date) tasks.push({ type: 'appointment', at: appointment.at, appointment });
  }
  const { backup, weighIn } = input;
  // Like the notification: a month after the last backup (or after the reminder was set up), not on day one.
  const backupBase = backup.lastBackup ?? backup.since;
  if (
    backup.reminderEnabled && backupBase !== null && plusDays(backupBase, BACKUP_INTERVAL_DAYS) <= date
    && isBackupOverdue(backup.lastBackup, date)
  ) {
    tasks.push({ type: 'backup', at: atTime(date, BACKUP_REMINDER_HOUR, 0), lastBackup: backup.lastBackup });
  }
  if (weighIn.enabled && isoDayOfWeek(date) === weighIn.day && !input.weights.some((weight) => weight.date === date)) {
    tasks.push({ type: 'weighIn', at: atTime(date, WEIGH_IN_HOUR, 0) });
  }

  return tasks.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : RANK[a.type] - RANK[b.type]));
}
