import type { Vaccination } from './care';
import { atTime, minusDays, type LocalDateTime } from './time';

/** Vaccine reminders (`VaccineReminders.kt`). */

/** Days before the due date of the first vaccine reminder (time to book an appointment). */
export const VACCINE_REMINDER_LEAD_DAYS = 7;

/** Hour of the reminders. */
export const VACCINE_REMINDER_HOUR = 9;

/**
 * Reminder times of a vaccination, chronological: a week before `nextDue`, then on that day,
 * both at `VACCINE_REMINDER_HOUR`. Empty when reminders are off or nothing is planned.
 */
export function vaccineReminderDates(vaccination: Vaccination): LocalDateTime[] {
  if (!vaccination.reminderEnabled || vaccination.nextDue === null) return [];
  const due = vaccination.nextDue;
  return [minusDays(due, VACCINE_REMINDER_LEAD_DAYS), due].map((date) => atTime(date, VACCINE_REMINDER_HOUR, 0));
}

/**
 * Next reminder strictly after `after`; null when reminders are off, nothing is planned or
 * both have passed (`Vaccination.nextReminder`).
 */
export function nextVaccineReminder(vaccination: Vaccination, after: LocalDateTime): LocalDateTime | null {
  return vaccineReminderDates(vaccination).find((at) => at > after) ?? null;
}
