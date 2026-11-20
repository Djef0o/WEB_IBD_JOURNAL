import type { Appointment } from './care';
import { APPOINTMENT_REMINDER_LEAD_MINUTES } from './examPlan';
import { atTime, dateOf, plusDays, plusMinutes, type LocalDateTime } from './time';

/** Hour of the reminder the evening before. */
export const APPOINTMENT_EVENING_HOUR = 18;

/** Time between the last reminder and the appointment, in minutes (same lead as exam appointments). */
export const APPOINTMENT_LEAD_MINUTES = APPOINTMENT_REMINDER_LEAD_MINUTES;

/**
 * Next reminder strictly after `after` and before the appointment: the evening before at
 * `APPOINTMENT_EVENING_HOUR`, then `APPOINTMENT_LEAD_MINUTES` minutes before. Null when
 * reminders are off or both have passed. A reminder that would fall after the appointment is
 * skipped (`AppointmentReminders.kt`).
 */
export function nextAppointmentReminder(appointment: Appointment, after: LocalDateTime): LocalDateTime | null {
  if (!appointment.remindersEnabled) return null;
  const { at } = appointment;
  const evening = atTime(plusDays(dateOf(at), -1), APPOINTMENT_EVENING_HOUR, 0);
  // Wall-clock subtraction: local time, independent of daylight saving jumps.
  const shortlyBefore = plusMinutes(at, -APPOINTMENT_LEAD_MINUTES);
  return [evening, shortlyBefore].filter((r) => r < at).sort().find((r) => r > after) ?? null;
}
