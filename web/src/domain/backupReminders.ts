import { atTime, plusDays, type LocalDate, type LocalDateTime } from './time';

/*
 * Port of BackupReminders.kt: when the encrypted backup is due. Pure functions, for the
 * settings status and for the reminder phase.
 */

/** Days after the last backup (or after the reminder was set up) before the first reminder. */
export const BACKUP_INTERVAL_DAYS = 30;

/** Days between two reminders while no backup has been made. */
export const BACKUP_REPEAT_DAYS = 7;

/** Hour of the reminders. */
export const BACKUP_REMINDER_HOUR = 10;

/** True if the last backup is missing or `BACKUP_INTERVAL_DAYS` days old or more. */
export function isBackupOverdue(lastBackup: LocalDate | null, today: LocalDate): boolean {
  return lastBackup === null || plusDays(lastBackup, BACKUP_INTERVAL_DAYS) <= today;
}

/**
 * Next backup reminder strictly after `after`: `BACKUP_INTERVAL_DAYS` days after `lastBackup`
 * (or after `since`, the day reminders were set up, when no backup was ever made), at
 * `BACKUP_REMINDER_HOUR`; then every `BACKUP_REPEAT_DAYS` days until a backup resets it.
 */
export function nextBackupReminder(lastBackup: LocalDate | null, since: LocalDate, after: LocalDateTime): LocalDateTime {
  let due = atTime(plusDays(lastBackup ?? since, BACKUP_INTERVAL_DAYS), BACKUP_REMINDER_HOUR, 0);
  while (due <= after) due = atTime(plusDays(due.slice(0, 10), BACKUP_REPEAT_DAYS), BACKUP_REMINDER_HOUR, 0);
  return due;
}
