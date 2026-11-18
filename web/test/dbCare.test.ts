import { beforeEach, describe, expect, it } from 'vitest';
import { transaction } from '../src/db/connection';
import {
  deleteAllCheckups, deleteCheckup, getAllCheckupEntities, getAllCheckups, getCheckup, insertCheckupEntities, saveCheckup,
} from '../src/db/checkups';
import {
  deleteAllDoseLogs, deleteDoseLog, deleteDoseLogsForMedication, getAllDoseLogEntities, getAllDoseLogs,
  insertDoseLogEntities, logDose, upsertDoseLog,
} from '../src/db/doses';
import {
  deleteAllExams, deleteExam, getAllExamEntities, getAllExams, getExam, insertExamEntities, saveExam,
} from '../src/db/exams';
import {
  deleteAllLabResults, deleteLabResult, getAllLabResultEntities, getAllLabResults, getLabResultsForTest,
  insertLabResultEntities, saveLabResult,
} from '../src/db/labs';
import {
  deleteAllMedications, deleteMedication, getAllMedicationEntities, getAllMedications, getMedication,
  insertMedicationEntities, saveMedication,
} from '../src/db/medications';
import { getProfile, getProfileEntity, putProfileEntity, saveProfile } from '../src/db/profile';
import { checkupToEntity, doseLogToEntity, examToEntity, labResultToEntity, medicationToEntity, profileToEntity } from '../src/domain/entities';
import { doseLog, labResult } from '../src/domain/health';
import { exam } from '../src/domain/models';
import { checkup, medication, profile, reminderSchedule } from '../src/domain/profile';
import { toEpochDays } from '../src/domain/time';
import { freshDb } from './helpers/freshDb';

beforeEach(freshDb);

const ids = (list: { id: number }[]) => list.map((item) => item.id);
const schedule = (startDate: string, hour = 8, minute = 0) => reminderSchedule({ startDate, hour, minute });

describe('lab results', () => {
  it('saves, edits and deletes; EXACT is stored as a null qualifier', async () => {
    const id = await saveLabResult(labResult({ test: 'CRP', value: 4.2, date: '2026-11-10', note: 'n', referenceHigh: 5 }));
    await saveLabResult(labResult({ test: 'CRP', value: 1, date: '2026-11-11', qualifier: 'BELOW' }));
    const raw = await transaction(['lab_results'], 'readonly', (tx) => getAllLabResultEntities(tx));
    expect(raw.map((e) => e.qualifier)).toEqual([null, 'BELOW']);

    const [first] = await getAllLabResults();
    expect(first).toEqual({
      id, test: 'CRP', value: 4.2, date: '2026-11-10', note: 'n', qualifier: 'EXACT', referenceLow: null, referenceHigh: 5,
    });
    await saveLabResult({ ...first!, value: 6 });
    expect((await getAllLabResults()).map((r) => r.value)).toEqual([6, 1]);

    await deleteLabResult(id);
    expect(ids(await getAllLabResults())).toEqual([2]);
  });

  it('orders by date then id', async () => {
    const a = await saveLabResult(labResult({ test: 'CRP', value: 1, date: '2026-11-12' }));
    const b = await saveLabResult(labResult({ test: 'HEMOGLOBIN', value: 1, date: '2026-11-10' }));
    const c = await saveLabResult(labResult({ test: 'CRP', value: 1, date: '2026-11-10' }));
    expect(ids(await getAllLabResults())).toEqual([b, c, a]);
  });

  it('reads the history of one test through the [test, date] index', async () => {
    const late = await saveLabResult(labResult({ test: 'CRP', value: 3, date: '2026-12-01' }));
    await saveLabResult(labResult({ test: 'HEMOGLOBIN', value: 13, date: '2026-11-15' }));
    const early = await saveLabResult(labResult({ test: 'CRP', value: 2, date: '2026-11-01' }));
    const sameDay = await saveLabResult(labResult({ test: 'CRP', value: 2, date: '2026-11-01' }));
    expect(ids(await getLabResultsForTest('CRP'))).toEqual([early, sameDay, late]);
    expect(await getLabResultsForTest('FERRITIN')).toEqual([]);
  });

  it('supports bulk replace in one transaction (backup access)', async () => {
    await saveLabResult(labResult({ test: 'CRP', value: 1, date: '2026-11-10' }));
    await transaction(['lab_results'], 'readwrite', async (tx) => {
      await deleteAllLabResults(tx);
      await insertLabResultEntities(tx, [labResultToEntity(labResult({ id: 8, test: 'CRP', value: 2, date: '2026-01-01' }))]);
    });
    expect(ids(await getAllLabResults())).toEqual([8]);
  });
});

describe('dose logs', () => {
  it('orders by scheduled time', async () => {
    const late = await upsertDoseLog(doseLog({ medicationId: 1, scheduledAt: 2000, status: 'TAKEN' }));
    const early = await upsertDoseLog(doseLog({ medicationId: 2, scheduledAt: 1000, status: 'MISSED' }));
    expect(ids(await getAllDoseLogs())).toEqual([early, late]);
  });

  it('keeps one confirmation per treatment and occurrence (unique index): upsert replaces', async () => {
    const first = await upsertDoseLog(doseLog({ medicationId: 1, scheduledAt: 1000, status: 'MISSED', loggedAt: 1 }));
    const second = await upsertDoseLog(doseLog({ medicationId: 1, scheduledAt: 1000, status: 'TAKEN', loggedAt: 2 }));
    await upsertDoseLog(doseLog({ medicationId: 2, scheduledAt: 1000, status: 'MISSED' })); // same time, other treatment
    expect(second).not.toBe(first);
    const logs = await getAllDoseLogs();
    expect(logs).toHaveLength(2);
    expect(logs.find((l) => l.medicationId === 1)).toMatchObject({ id: second, status: 'TAKEN', loggedAt: 2 });
  });

  it('replaces the conflicting row when an explicit id is saved on an occupied occurrence', async () => {
    const occupied = await upsertDoseLog(doseLog({ medicationId: 1, scheduledAt: 1000, status: 'MISSED' }));
    const other = await upsertDoseLog(doseLog({ medicationId: 1, scheduledAt: 2000, status: 'MISSED' }));
    await upsertDoseLog(doseLog({ id: other, medicationId: 1, scheduledAt: 1000, status: 'TAKEN' }));
    const logs = await getAllDoseLogs();
    expect(ids(logs)).toEqual([other]);
    expect(logs[0]).toMatchObject({ scheduledAt: 1000, status: 'TAKEN' });
    expect(logs.some((l) => l.id === occupied)).toBe(false);
  });

  it('logDose confirms, changes and cancels an occurrence', async () => {
    await logDose(1, 5000, 'TAKEN');
    expect(await getAllDoseLogs()).toMatchObject([{ medicationId: 1, scheduledAt: 5000, status: 'TAKEN' }]);
    await logDose(1, 5000, 'MISSED');
    expect(await getAllDoseLogs()).toMatchObject([{ status: 'MISSED' }]);
    await logDose(1, 6000, null); // nothing to cancel
    expect(await getAllDoseLogs()).toHaveLength(1);
    await logDose(1, 5000, null);
    expect(await getAllDoseLogs()).toEqual([]);
  });

  it('deleteDoseLog only removes that occurrence', async () => {
    await upsertDoseLog(doseLog({ medicationId: 1, scheduledAt: 1000, status: 'TAKEN' }));
    await upsertDoseLog(doseLog({ medicationId: 1, scheduledAt: 2000, status: 'TAKEN' }));
    await deleteDoseLog(1, 1000);
    expect((await getAllDoseLogs()).map((l) => l.scheduledAt)).toEqual([2000]);
  });

  it('deletes all the logs of one treatment only', async () => {
    for (const [medicationId, scheduledAt] of [[1, 1], [1, 2], [2, 1], [11, 3]] as const) {
      await upsertDoseLog(doseLog({ medicationId, scheduledAt, status: 'TAKEN' }));
    }
    await transaction(['dose_logs'], 'readwrite', (tx) => deleteDoseLogsForMedication(tx, 1));
    expect((await getAllDoseLogs()).map((l) => [l.medicationId, l.scheduledAt])).toEqual([[2, 1], [11, 3]]);
  });

  it('bulk insert rejects a duplicated occurrence and rolls back', async () => {
    await expect(
      transaction(['dose_logs'], 'readwrite', async (tx) => {
        await deleteAllDoseLogs(tx);
        await insertDoseLogEntities(tx, [
          doseLogToEntity(doseLog({ id: 1, medicationId: 1, scheduledAt: 1, status: 'TAKEN' })),
          doseLogToEntity(doseLog({ id: 2, medicationId: 1, scheduledAt: 1, status: 'MISSED' })),
        ]);
      }),
    ).rejects.toMatchObject({ name: 'ConstraintError' });
    expect(await transaction(['dose_logs'], 'readonly', (tx) => getAllDoseLogEntities(tx))).toEqual([]);
  });
});

describe('medications', () => {
  it('saves, edits and reads a treatment with its schedule', async () => {
    const id = await saveMedication(medication({
      name: 'Azathioprine', dosage: '50 mg', schedule: schedule('2026-11-10', 20, 30), refillAlert: true, stockEndDate: '2027-01-15',
    }));
    expect(await getMedication(id)).toEqual({
      id, name: 'Azathioprine', dosage: '50 mg', schedule: schedule('2026-11-10', 20, 30), refillAlert: true, stockEndDate: '2027-01-15',
    });
    await saveMedication({ ...(await getMedication(id))!, dosage: '100 mg' });
    expect((await getMedication(id))?.dosage).toBe('100 mg');
    expect(await getAllMedications()).toHaveLength(1);
    expect(await getMedication(99)).toBeNull();
  });

  it('orders by name ignoring ASCII case only, then creation time', async () => {
    const save = (name: string) => saveMedication(medication({ name, schedule: schedule('2026-11-10') }));
    const b = await save('b');
    const aLower = await save('a');
    const zUpper = await save('Z');
    const aUpper = await save('A');
    const eAcute = await save('é'); // not folded: after every ASCII letter
    const eUpper = await save('E');
    // Same-name treatments are ordered by creation time: force it.
    await transaction(['medications'], 'readwrite', async (tx) => {
      const store = tx.objectStore('medications');
      await store.put({ ...(await store.get(aUpper))!, createdAt: 1 });
      await store.put({ ...(await store.get(aLower))!, createdAt: 2 });
    });
    expect(ids(await getAllMedications())).toEqual([aUpper, aLower, b, eUpper, zUpper, eAcute]);
  });

  it('keeps the creation time when a treatment is edited', async () => {
    const id = await saveMedication(medication({ name: 'x', schedule: schedule('2026-11-10') }));
    await transaction(['medications'], 'readwrite', async (tx) => {
      const store = tx.objectStore('medications');
      await store.put({ ...(await store.get(id))!, createdAt: 77 });
    });
    await saveMedication({ ...(await getMedication(id))!, name: 'y' });
    const raw = await transaction(['medications'], 'readonly', (tx) => getAllMedicationEntities(tx));
    expect(raw).toMatchObject([{ id, name: 'y', createdAt: 77 }]);
  });

  it('deleting a treatment deletes its confirmed doses, and only those', async () => {
    const keep = await saveMedication(medication({ name: 'keep', schedule: schedule('2026-11-10') }));
    const drop = await saveMedication(medication({ name: 'drop', schedule: schedule('2026-11-10') }));
    await logDose(drop, 1000, 'TAKEN');
    await logDose(drop, 2000, 'MISSED');
    await logDose(keep, 1000, 'TAKEN');

    await deleteMedication(drop);
    expect(await getMedication(drop)).toBeNull();
    expect(ids(await getAllMedications())).toEqual([keep]);
    expect(await getAllDoseLogs()).toMatchObject([{ medicationId: keep, scheduledAt: 1000 }]);
  });

  it('supports bulk replace keeping the treatment ids (backup access)', async () => {
    await saveMedication(medication({ name: 'old', schedule: schedule('2026-11-10') }));
    await transaction(['medications'], 'readwrite', async (tx) => {
      await deleteAllMedications(tx);
      await insertMedicationEntities(tx, [medicationToEntity(medication({ id: 12, name: 'restored', schedule: schedule('2026-11-10') }), 5)]);
    });
    expect(await getAllMedications()).toMatchObject([{ id: 12, name: 'restored' }]);
  });
});

describe('checkups', () => {
  it('orders by start date, hour, minute', async () => {
    const save = (startDate: string, hour: number, minute: number) =>
      saveCheckup(checkup({ type: 'BLOOD_TEST', schedule: schedule(startDate, hour, minute) }));
    const d = await save('2026-12-01', 8, 0);
    const b = await save('2026-11-10', 9, 30);
    const a = await save('2026-11-10', 9, 0);
    const c = await save('2026-11-10', 14, 0);
    const e = await save('2026-11-10', 9, 30);
    expect(ids(await getAllCheckups())).toEqual([a, b, e, c, d]);
  });

  it('saves, edits, reads and deletes', async () => {
    const id = await saveCheckup(checkup({ type: 'STOOL_TEST', note: 'calprotectin', schedule: schedule('2026-11-10') }));
    expect(await getCheckup(id)).toEqual({ id, type: 'STOOL_TEST', note: 'calprotectin', schedule: schedule('2026-11-10') });
    await saveCheckup({ ...(await getCheckup(id))!, note: 'changed' });
    expect((await getCheckup(id))?.note).toBe('changed');
    await deleteCheckup(id);
    expect(await getCheckup(id)).toBeNull();
  });

  it('supports bulk replace (backup access)', async () => {
    await saveCheckup(checkup({ type: 'STOOL_TEST', schedule: schedule('2026-11-10') }));
    await transaction(['checkups'], 'readwrite', async (tx) => {
      await deleteAllCheckups(tx);
      await insertCheckupEntities(tx, [checkupToEntity(checkup({ id: 3, type: 'BLOOD_TEST', schedule: schedule('2026-11-10') }), 1)]);
    });
    expect(ids(await getAllCheckups())).toEqual([3]);
    expect(await transaction(['checkups'], 'readonly', (tx) => getAllCheckupEntities(tx))).toHaveLength(1);
  });
});

describe('exams', () => {
  it('orders by date and time as text', async () => {
    const at = (value: string) => saveExam(exam({ type: 'COLONOSCOPY', at: value }));
    const c = await at('2027-01-05T08:00');
    const b = await at('2026-12-04T09:30:15');
    const a = await at('2026-12-04T09:30');
    const d = await at('2026-12-04T10:00');
    expect(ids(await getAllExams())).toEqual([a, b, d, c]);
  });

  it('saves, edits, reads and deletes with every optional step', async () => {
    const full = exam({
      type: 'RECTOSIGMOIDOSCOPY', at: '2026-12-04T09:30', note: 'n', dietDays: 3,
      prepFirstAt: '2026-12-03T18:00', prepSecondAt: '2026-12-04T05:00', anesthesiaAt: '2026-11-20T14:15', remindersEnabled: false,
    });
    const id = await saveExam(full);
    expect(await getExam(id)).toEqual({ ...full, id });
    await saveExam({ ...full, id, dietDays: 0, prepSecondAt: null });
    expect(await getExam(id)).toMatchObject({ dietDays: 0, prepSecondAt: null });
    expect(await getAllExams()).toHaveLength(1);
    await deleteExam(id);
    expect(await getExam(id)).toBeNull();
  });

  it('supports bulk replace (backup access)', async () => {
    await saveExam(exam({ type: 'COLONOSCOPY', at: '2026-12-04T09:30' }));
    await transaction(['exams'], 'readwrite', async (tx) => {
      await deleteAllExams(tx);
      await insertExamEntities(tx, [examToEntity(exam({ id: 4, type: 'COLONOSCOPY', at: '2026-12-05T09:30' }))]);
    });
    expect(ids(await getAllExams())).toEqual([4]);
    expect(await transaction(['exams'], 'readonly', (tx) => getAllExamEntities(tx))).toHaveLength(1);
  });
});

describe('profile', () => {
  it('is null until saved, then a single replaced row', async () => {
    expect(await getProfile()).toBeNull();
    await saveProfile(profile({ firstName: 'Ada', lastName: 'L', birthDate: '1990-05-17', sex: 'FEMALE' }));
    expect(await getProfile()).toEqual({ firstName: 'Ada', lastName: 'L', birthDate: '1990-05-17', sex: 'FEMALE' });
    await saveProfile(profile({ firstName: 'Bob' }));
    expect(await getProfile()).toEqual({ firstName: 'Bob', lastName: '', birthDate: null, sex: null });
    expect(await transaction(['profile'], 'readonly', (tx) => tx.objectStore('profile').count())).toBe(1);
  });

  it('exposes the stored row for backup', async () => {
    const entity = profileToEntity(profile({ firstName: 'Ada', birthDate: '1990-05-17' }));
    await transaction(['profile'], 'readwrite', (tx) => putProfileEntity(tx, entity));
    expect(await transaction(['profile'], 'readonly', (tx) => getProfileEntity(tx))).toEqual({
      ...entity, birthDateEpochDay: toEpochDays('1990-05-17'),
    });
  });
});
