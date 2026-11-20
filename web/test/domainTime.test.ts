import { describe, expect, it } from 'vitest';
import { decodeBackupData } from '../src/domain/backupData';
import { medicationFromEntity, medicationToEntity, stoolFromEntity, stoolToEntity } from '../src/domain/entities';
import { LAB_TEST_INFO } from '../src/domain/health';
import { medication, reminderSchedule } from '../src/domain/profile';
import { stool } from '../src/domain/models';
import {
  fromEpochDays, monthsUntil, plusMinutes, plusMonths, toEpochDays, toEpochMillis, localDateTimeAt,
} from '../src/domain/time';

describe('time arithmetic', () => {
  it('epoch days match known values', () => {
    expect(toEpochDays('1970-01-01')).toBe(0);
    expect(toEpochDays('2026-11-15')).toBe(20772);
    expect(fromEpochDays(20772)).toBe('2026-11-15');
    expect(fromEpochDays(toEpochDays('2024-02-29'))).toBe('2024-02-29');
  });

  it('months clamp and truncate like kotlinx-datetime', () => {
    expect(plusMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(plusMonths('2026-01-31', 13)).toBe('2027-02-28');
    expect(plusMonths('2026-03-15', -4)).toBe('2025-11-15');
    expect(monthsUntil('2026-01-31', '2026-02-28')).toBe(0);
    expect(monthsUntil('2026-01-31', '2026-03-31')).toBe(2);
  });

  it('wall-clock minutes cross days', () => {
    expect(plusMinutes('2026-12-04T01:00', -120)).toBe('2026-12-03T23:00');
  });

  it('epoch millis round-trip in the device zone', () => {
    expect(localDateTimeAt(toEpochMillis('2026-11-15T08:30'))).toBe('2026-11-15T08:30');
  });
});

describe('stored shapes and backup', () => {
  it('lab tests keep their unit and category', () => {
    expect(LAB_TEST_INFO.EGFR).toEqual({ name: 'EGFR', unit: 'mL/min/1,73 m²', category: 'KIDNEY' });
  });

  it('entities round-trip with dateEpochDay', () => {
    const s = stool({ date: '2026-11-15', createdAt: 1 });
    expect(stoolToEntity(s).dateEpochDay).toBe(20772);
    expect(stoolFromEntity(stoolToEntity(s))).toEqual(s);
    const m = medication({
      id: 3, name: 'X', schedule: reminderSchedule({ startDate: '2026-11-02', repeatUnit: 'WEEK' }),
      refillAlert: true, stockEndDate: '2026-12-01',
    });
    expect(medicationFromEntity(medicationToEntity(m))).toEqual(m);
  });

  it('decodes a full Android backup and rejects bad enums', () => {
    const json = JSON.stringify({
      meals: [], stools: [],
      profile: { firstName: 'A', sex: 'FEMALE', birthDate: '1990-01-02' },
      medications: [{ id: 1, name: 'M', schedule: { startDate: '2026-11-01', unknownKey: 1 } }],
      labResults: [{ test: 'CRP', value: 1, date: '2026-11-01', qualifier: 'BELOW' }],
      exams: [{ type: 'COLONOSCOPY', at: '2026-12-04T09:30' }],
    });
    const backup = decodeBackupData(json);
    expect(backup.profile).toEqual({ firstName: 'A', lastName: '', birthDate: '1990-01-02', sex: 'FEMALE', diagnosis: null });
    expect(backup.medications![0]!.schedule).toMatchObject({ enabled: true, hour: 8, repeatUnit: 'DAY' });
    expect(backup.checkups).toBeNull();
    expect(backup.exams![0]!.remindersEnabled).toBe(true);
    expect(() => decodeBackupData('{"meals":[],"stools":[],"labResults":[{"test":"NOPE","value":1,"date":"2026-01-01"}]}')).toThrow();
  });
});
