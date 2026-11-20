import { beforeEach, describe, expect, it } from 'vitest';
import { transaction } from '../src/db/connection';
import { saveEmergencyInfo } from '../src/db/emergency';
import { getLockScreenEmergency, syncLockScreenEmergency } from '../src/db/emergencyLock';
import { saveMedication } from '../src/db/medications';
import { saveProfile } from '../src/db/profile';
import { emergencyInfo } from '../src/domain/care';
import {
  emergencyData, emergencyDataEmpty, emergencyInfoFilled, emergencyName, emergencyTreatments, lockScreenCopy, parseEmergencyData,
} from '../src/domain/emergencySheet';
import { medication, profile, reminderSchedule } from '../src/domain/profile';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

describe('emergency sheet data', () => {
  it('joins names and treatments, leaving blanks out', () => {
    expect(emergencyName(profile({ firstName: 'Ada', lastName: ' ' }))).toBe('Ada');
    expect(emergencyTreatments([{ name: 'Humira', dosage: '40 mg' }, { name: 'Imurel', dosage: '' }]))
      .toEqual(['Humira · 40 mg', 'Imurel']);
  });

  it('is empty only when nothing is filled in', () => {
    expect(emergencyDataEmpty(emergencyData())).toBe(true);
    expect(emergencyDataEmpty(emergencyData({ profile: profile({ diagnosis: 'CROHN' }) }))).toBe(false);
    expect(emergencyDataEmpty(emergencyData({ treatments: ['x'] }))).toBe(false);
    expect(emergencyInfoFilled(emergencyInfo({ notes: ' ' }))).toBe(false);
    expect(emergencyInfoFilled(emergencyInfo({ doctorPhone: '0102' }))).toBe(true);
  });

  it('round-trips the lock-screen copy and rejects garbage', () => {
    const data = emergencyData({
      profile: profile({ firstName: 'Ada', birthDate: '1990-02-03', diagnosis: 'OTHER', sex: 'FEMALE' }),
      info: emergencyInfo({ allergies: 'latex', showOnLockScreen: true }),
      treatments: ['Humira · 40 mg'],
    });
    const parsed = parseEmergencyData(JSON.parse(JSON.stringify(lockScreenCopy(data))));
    expect(parsed?.profile).toEqual(profile({ firstName: 'Ada', birthDate: '1990-02-03', diagnosis: 'OTHER' }));
    expect(parsed?.info.allergies).toBe('latex');
    expect(parsed?.treatments).toEqual(['Humira · 40 mg']);
    expect(parseEmergencyData(null)).toBeNull();
    expect(parseEmergencyData({ profile: {}, info: {}, treatments: [1] })).toBeNull();
  });
});

describe('lock-screen copy', () => {
  const stored = () => transaction(['prefs'], 'readonly', async (tx) => tx.objectStore('prefs').get('emergency_lockscreen'));

  it('exists only while the option is on, and follows the journal', async () => {
    await saveProfile(profile({ firstName: 'Ada', diagnosis: 'CROHN' }));
    await saveMedication(medication({ name: 'Humira', dosage: '40 mg', schedule: reminderSchedule({ startDate: '2026-01-01' }) }));
    await saveEmergencyInfo(emergencyInfo({ allergies: 'latex' }));
    await syncLockScreenEmergency();
    expect(await getLockScreenEmergency()).toBeNull();
    expect(await stored()).toBeUndefined();

    await saveEmergencyInfo(emergencyInfo({ allergies: 'latex', showOnLockScreen: true }));
    await syncLockScreenEmergency();
    const copy = await getLockScreenEmergency();
    expect(copy?.profile.firstName).toBe('Ada');
    expect(copy?.info.allergies).toBe('latex');
    expect(copy?.treatments).toEqual(['Humira · 40 mg']);

    await saveEmergencyInfo(emergencyInfo({ allergies: 'latex', showOnLockScreen: false }));
    await syncLockScreenEmergency();
    expect(await getLockScreenEmergency()).toBeNull();
  });
});
