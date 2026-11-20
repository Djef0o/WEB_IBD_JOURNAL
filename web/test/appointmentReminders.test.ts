import { describe, expect, it } from 'vitest';
import { nextAppointmentReminder } from '../src/domain/appointmentReminders';
import { appointment } from '../src/domain/care';

/** Port of `AppointmentReminderTest` (CareLogicTest.kt). */
describe('AppointmentReminderTest', () => {
  const visit = (at: string, remindersEnabled = true) =>
    appointment({ kind: 'GASTROENTEROLOGIST', at, remindersEnabled });

  it('remindsTheEveningBeforeThenTwoHoursBefore', () => {
    const v = visit('2026-12-10T14:30');
    const first = nextAppointmentReminder(v, '2026-12-01T08:00');
    expect(first).toBe('2026-12-09T18:00');
    const second = nextAppointmentReminder(v, first!);
    expect(second).toBe('2026-12-10T12:30');
    expect(nextAppointmentReminder(v, second!)).toBeNull();
  });

  it('anEarlyMorningAppointmentGetsItsSecondReminderTheNightBefore', () => {
    // Two hours before 01:30 is the previous day 23:30, after the 18:00 evening reminder.
    const v = visit('2026-12-10T01:30');
    const first = nextAppointmentReminder(v, '2026-12-01T08:00');
    expect(first).toBe('2026-12-09T18:00');
    expect(nextAppointmentReminder(v, first!)).toBe('2026-12-09T23:30');
  });

  it('skipsPastRemindersAndStaysSilentWhenOff', () => {
    const v = visit('2026-12-10T14:30');
    expect(nextAppointmentReminder(v, '2026-12-10T08:00')).toBe('2026-12-10T12:30');
    expect(nextAppointmentReminder(v, '2026-12-10T13:00')).toBeNull();
    expect(nextAppointmentReminder(visit('2026-12-10T14:30', false), '2026-01-01T00:00')).toBeNull();
  });
});
