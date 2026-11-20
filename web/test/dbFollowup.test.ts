import { beforeEach, describe, expect, it } from 'vitest';
import { deleteAppointment, getAllAppointments, getAllDoctorQuestions, getAllExtraSymptoms, getExtraSymptoms, saveAppointment, saveDoctorQuestion, saveExtraSymptoms } from '../src/db/followup';
import { getAllFlares, saveFlare } from '../src/db/flares';
import { getEmergencyInfo, saveEmergencyInfo } from '../src/db/emergency';
import { getAllWellbeing, getWellbeing, saveWellbeing } from '../src/db/wellbeing';
import { appointment, doctorQuestion, emergencyInfo, flare, wellbeingDay } from '../src/domain/care';
import { transaction } from '../src/db/connection';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

describe('flares', () => {
  it('lists flares by start date and keeps an ongoing flare open', async () => {
    await saveFlare(flare({ start: '2026-03-02' }));
    const id = await saveFlare(flare({ start: '2026-01-10', end: '2026-01-20', hospitalized: true }));
    expect((await getAllFlares()).map((f) => [f.start, f.end, f.hospitalized])).toEqual([
      ['2026-01-10', '2026-01-20', true],
      ['2026-03-02', null, false],
    ]);
    await saveFlare({ ...(await getAllFlares())[0]!, id, end: null });
    expect((await getAllFlares())[0]!.end).toBeNull();
  });
});

describe('extra symptoms', () => {
  it('keeps one canonical row per day and removes the row when no symptom is left', async () => {
    await saveExtraSymptoms('2026-03-01', ['FEVER', 'JOINTS', 'FEVER']);
    await saveExtraSymptoms('2026-03-01', ['SKIN', 'JOINTS']);
    await saveExtraSymptoms('2026-03-02', ['EYES']);
    expect(await getAllExtraSymptoms()).toEqual([
      { date: '2026-03-01', symptoms: ['JOINTS', 'SKIN'] },
      { date: '2026-03-02', symptoms: ['EYES'] },
    ]);
    await saveExtraSymptoms('2026-03-01', []);
    expect(await getExtraSymptoms('2026-03-01')).toBeNull();
    expect(await transaction(['extra_symptoms'], 'readonly', (tx) => tx.objectStore('extra_symptoms').count())).toBe(1);
  });
});

describe('well-being', () => {
  it('replaces the entry of a day and deletes a day with nothing noted', async () => {
    await saveWellbeing(wellbeingDay({ date: '2026-03-01', sleep: 2 }));
    await saveWellbeing(wellbeingDay({ date: '2026-03-01', sleep: 4, period: true }));
    await saveWellbeing(wellbeingDay({ date: '2026-02-28', mood: 5 }));
    expect((await getAllWellbeing()).map((d) => d.date)).toEqual(['2026-02-28', '2026-03-01']);
    expect(await getWellbeing('2026-03-01')).toEqual({ date: '2026-03-01', sleep: 4, stress: null, mood: null, period: true });
    await saveWellbeing(wellbeingDay({ date: '2026-03-01' }));
    expect(await getWellbeing('2026-03-01')).toBeNull();
  });
});

describe('doctor questions and appointments', () => {
  it('lists pending questions before answered ones, then by creation time', async () => {
    await saveDoctorQuestion(doctorQuestion({ text: 'late done', done: true, createdAt: 1 }));
    await saveDoctorQuestion(doctorQuestion({ text: 'second', createdAt: 20 }));
    await saveDoctorQuestion(doctorQuestion({ text: 'first', createdAt: 10 }));
    expect((await getAllDoctorQuestions()).map((q) => q.text)).toEqual(['first', 'second', 'late done']);
  });

  it('sorts appointments by date and time and deletes one', async () => {
    const late = await saveAppointment(appointment({ kind: 'DIETITIAN', at: '2026-05-01T09:00' }));
    await saveAppointment(appointment({ kind: 'GASTROENTEROLOGIST', at: '2026-04-02T10:15', place: 'CHU' }));
    expect((await getAllAppointments()).map((a) => a.kind)).toEqual(['GASTROENTEROLOGIST', 'DIETITIAN']);
    await deleteAppointment(late);
    expect(await getAllAppointments()).toHaveLength(1);
  });
});

describe('emergency sheet', () => {
  it('is null until saved, then a single replaced row', async () => {
    expect(await getEmergencyInfo()).toBeNull();
    await saveEmergencyInfo(emergencyInfo({ allergies: 'Pénicilline' }));
    await saveEmergencyInfo(emergencyInfo({ doctorName: 'Dr Durand', showOnLockScreen: true }));
    expect(await getEmergencyInfo()).toEqual(emergencyInfo({ doctorName: 'Dr Durand', showOnLockScreen: true }));
    expect(await transaction(['emergency_info'], 'readonly', (tx) => tx.objectStore('emergency_info').count())).toBe(1);
  });
});
