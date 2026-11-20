import { describe, expect, it } from 'vitest';
import { isBackupOverdue, nextBackupReminder } from '../src/domain/backupReminders';
import { isoDayOfWeek, nextWeighIn } from '../src/domain/weighIn';

describe('backup reminders', () => {
  it('is overdue after thirty days or without any backup', () => {
    const today = '2026-12-20';
    expect(isBackupOverdue(null, today)).toBe(true);
    expect(isBackupOverdue('2026-11-20', today)).toBe(true);
    expect(isBackupOverdue('2026-11-21', today)).toBe(false);
  });

  it('first reminder is thirty days after the last backup at ten o clock', () => {
    expect(nextBackupReminder('2026-11-20', '2026-01-01', '2026-11-25T08:00')).toBe('2026-12-20T10:00');
  });

  it('without backup the count starts when reminders were set up', () => {
    expect(nextBackupReminder(null, '2026-11-01', '2026-11-10T08:00')).toBe('2026-12-01T10:00');
  });

  it('repeats every seven days while no backup is made', () => {
    const last = '2026-10-01';
    // Due on Oct 31 at 10:00; asked on Nov 2 and Nov 8: next weekly slots.
    expect(nextBackupReminder(last, last, '2026-11-02T09:00')).toBe('2026-11-07T10:00');
    expect(nextBackupReminder(last, last, '2026-11-08T09:00')).toBe('2026-11-14T10:00');
    // Exactly at the slot: strictly after, so the following week.
    expect(nextBackupReminder(last, last, '2026-11-07T10:00')).toBe('2026-11-14T10:00');
  });
});

describe('weigh-in', () => {
  const SUNDAY = 7;
  const FRIDAY = 5;
  const MONDAY = 1;

  it('knows the weekday', () => {
    expect(isoDayOfWeek('2026-11-20')).toBe(FRIDAY);
    expect(isoDayOfWeek('1970-01-01')).toBe(4);
    expect(isoDayOfWeek('1969-12-28')).toBe(SUNDAY);
  });

  it('is the next chosen weekday at nine', () => {
    // Friday Nov 20, 2026
    expect(nextWeighIn(SUNDAY, '2026-11-20T12:00')).toBe('2026-11-22T09:00');
    // Same day before 9: today; at 9 or later: next week.
    expect(nextWeighIn(FRIDAY, '2026-11-20T08:00')).toBe('2026-11-20T09:00');
    expect(nextWeighIn(FRIDAY, '2026-11-20T09:00')).toBe('2026-11-27T09:00');
    // Earlier weekday: wraps to next week.
    expect(nextWeighIn(MONDAY, '2026-11-20T12:00')).toBe('2026-11-23T09:00');
  });
});
