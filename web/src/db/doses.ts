import { doseLogFromEntity, doseLogToEntity, type DoseLogEntity } from '../domain/entities';
import type { DoseLog, DoseStatus } from '../domain/health';
import { stripAutoId, transaction, type ReadTx, type Tx } from './connection';

/** `ORDER BY scheduledAt` (ties: insertion order). */
function compareLogs(a: DoseLogEntity, b: DoseLogEntity): number {
  return a.scheduledAt - b.scheduledAt || a.id - b.id;
}

/** Every confirmed or missed dose, by scheduled time (`observeAll`). */
export function getAllDoseLogs(): Promise<DoseLog[]> {
  return transaction(['dose_logs'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('dose_logs').getAll();
    return entities.sort(compareLogs).map(doseLogFromEntity);
  });
}

/**
 * Saves the log and returns its identifier. It replaces any existing confirmation of the
 * same occurrence (unique `[medicationId, scheduledAt]` index): the old row is deleted, as
 * `OnConflictStrategy.REPLACE` does.
 */
export function upsertDoseLog(log: DoseLog): Promise<number> {
  return transaction(['dose_logs'], 'readwrite', async (tx) => {
    const store = tx.objectStore('dose_logs');
    const conflicting = await store.index('medicationId_scheduledAt').getKey([log.medicationId, log.scheduledAt]);
    if (conflicting !== undefined && conflicting !== log.id) await store.delete(conflicting);
    return store.put(stripAutoId(doseLogToEntity(log)));
  });
}

/** Deletes the confirmation of one occurrence. */
export function deleteDoseLog(medicationId: number, scheduledAt: number): Promise<void> {
  return transaction(['dose_logs'], 'readwrite', async (tx) => {
    const store = tx.objectStore('dose_logs');
    const key = await store.index('medicationId_scheduledAt').getKey([medicationId, scheduledAt]);
    if (key !== undefined) await store.delete(key);
  });
}

/**
 * Confirms a scheduled dose (`status` null: cancels the confirmation), as
 * `ProfileRepository.logDose`.
 */
export function logDose(medicationId: number, scheduledAt: number, status: DoseStatus | null): Promise<void> {
  if (status === null) return deleteDoseLog(medicationId, scheduledAt);
  return upsertDoseLog({ id: 0, medicationId, scheduledAt, status, loggedAt: Date.now() }).then(() => undefined);
}

/** Deletes all the logs of a treatment (`deleteForMedication`), in the caller's transaction. */
export async function deleteDoseLogsForMedication(tx: Tx, medicationId: number): Promise<void> {
  const store = tx.objectStore('dose_logs');
  const keys = await store
    .index('medicationId_scheduledAt')
    .getAllKeys(IDBKeyRange.bound([medicationId, -Infinity], [medicationId, Infinity]));
  await Promise.all(keys.map((key) => store.delete(key)));
}

// --- Backup access (caller-owned transaction over the `dose_logs` store) ---

/** All the stored logs, in key order (`getAll`). */
export function getAllDoseLogEntities(tx: ReadTx): Promise<DoseLogEntity[]> {
  return tx.objectStore('dose_logs').getAll();
}

export function deleteAllDoseLogs(tx: Tx): Promise<void> {
  return tx.objectStore('dose_logs').clear();
}

/**
 * Adds the logs with their own ids (`id` 0: new key); a duplicate id or occurrence is an
 * error (`insertAll`).
 */
export async function insertDoseLogEntities(tx: Tx, entities: readonly DoseLogEntity[]): Promise<void> {
  const store = tx.objectStore('dose_logs');
  await Promise.all(entities.map((entity) => store.add(stripAutoId(entity))));
}
