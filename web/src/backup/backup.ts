import { stripAutoId, transaction } from '../db/connection';
import type { StoreName } from '../db/schema';
import {
  checkupFromEntity, checkupToEntity, doseLogFromEntity, doseLogToEntity, examFromEntity, examToEntity,
  labResultFromEntity, labResultToEntity, mealFromEntity, mealToEntity, medicationFromEntity,
  medicationToEntity, profileFromEntity, profileToEntity, stoolFromEntity, stoolToEntity, weightFromEntity, weightToEntity,
} from '../domain/entities';
import type { BackupData } from '../domain/models';

/*
 * Snapshot and restore of the journal, with the semantics of `Backup.kt`.
 * The photos, the product cache and the preferences are not part of a backup.
 */

/** The stores that make up a backup. */
const BACKUP_STORES = [
  'meals', 'stools', 'profile', 'medications', 'checkups', 'lab_results', 'dose_logs', 'exams', 'weights',
] as const satisfies readonly StoreName[];

/** Consistent snapshot of all the data to back up (one read-only transaction). */
export async function snapshot(): Promise<BackupData> {
  return transaction(BACKUP_STORES, 'readonly', async (tx) => {
    const [meals, stools, profile, medications, checkups, labResults, doseLogs, exams, weights] = await Promise.all([
      tx.objectStore('meals').getAll(),
      tx.objectStore('stools').getAll(),
      tx.objectStore('profile').getAll(),
      tx.objectStore('medications').getAll(),
      tx.objectStore('checkups').getAll(),
      tx.objectStore('lab_results').getAll(),
      tx.objectStore('dose_logs').getAll(),
      tx.objectStore('exams').getAll(),
      tx.objectStore('weights').getAll(),
    ]);
    const profileRow = profile[0];
    return {
      meals: meals.map((entity) => mealFromEntity(entity)),
      stools: stools.map(stoolFromEntity),
      profile: profileRow === undefined ? null : profileFromEntity(profileRow),
      medications: medications.map(medicationFromEntity),
      checkups: checkups.map(checkupFromEntity),
      labResults: labResults.map(labResultFromEntity),
      doseLogs: doseLogs.map(doseLogFromEntity),
      exams: exams.map(examFromEntity),
      weights: weights.map((entity) => weightFromEntity(entity)),
    };
  });
}

/**
 * Replaces the journal with `backup`, in one transaction: on any error nothing is modified.
 * Meals and stools are always replaced; the other sections that are missing (null or absent,
 * earlier backups) are kept. Ids are kept (confirmed doses stay linked to their treatment).
 */
export async function restore(backup: BackupData): Promise<void> {
  await transaction(BACKUP_STORES, 'readwrite', async (tx) => {
    // `add`, like Room's plain `@Insert`: a duplicate key aborts the whole transaction.
    // Requests are queued without awaiting each one: the transaction stays active.
    const pending: Promise<unknown>[] = [];
    const meals = tx.objectStore('meals');
    const stools = tx.objectStore('stools');
    pending.push(meals.clear(), stools.clear());
    for (const meal of backup.meals) pending.push(meals.add(stripAutoId(mealToEntity(meal))));
    for (const stool of backup.stools) pending.push(stools.add(stripAutoId(stoolToEntity(stool))));
    if (backup.profile) pending.push(tx.objectStore('profile').put(profileToEntity(backup.profile)));

    if (backup.medications) {
      const store = tx.objectStore('medications');
      pending.push(store.clear());
      for (const row of backup.medications) pending.push(store.add(stripAutoId(medicationToEntity(row))));
    }
    if (backup.checkups) {
      const store = tx.objectStore('checkups');
      pending.push(store.clear());
      for (const row of backup.checkups) pending.push(store.add(stripAutoId(checkupToEntity(row))));
    }
    if (backup.labResults) {
      const store = tx.objectStore('lab_results');
      pending.push(store.clear());
      for (const row of backup.labResults) pending.push(store.add(stripAutoId(labResultToEntity(row))));
    }
    if (backup.doseLogs) {
      const store = tx.objectStore('dose_logs');
      pending.push(store.clear());
      for (const row of backup.doseLogs) pending.push(store.add(stripAutoId(doseLogToEntity(row))));
    }
    if (backup.exams) {
      const store = tx.objectStore('exams');
      pending.push(store.clear());
      for (const row of backup.exams) pending.push(store.add(stripAutoId(examToEntity(row))));
    }
    if (backup.weights) {
      const store = tx.objectStore('weights');
      pending.push(store.clear());
      for (const row of backup.weights) pending.push(store.add(stripAutoId(weightToEntity(row))));
    }
    await Promise.all(pending);
  });
}
