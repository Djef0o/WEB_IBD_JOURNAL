import {
  labResultFromEntity, labResultToEntity, type LabResultEntity,
} from '../domain/entities';
import type { LabResult, LabTest } from '../domain/health';
import { stripAutoId, transaction, type ReadTx, type Tx } from './connection';

/** `ORDER BY dateEpochDay, id` */
function compareResults(a: LabResultEntity, b: LabResultEntity): number {
  return a.dateEpochDay - b.dateEpochDay || a.id - b.id;
}

/** Every lab result, by date then id (`observeAll`). */
export function getAllLabResults(): Promise<LabResult[]> {
  return transaction(['lab_results'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('lab_results').getAll();
    return entities.sort(compareResults).map(labResultFromEntity);
  });
}

/** Results of one test, by date then id (uses the `[test, dateEpochDay]` index). */
export function getLabResultsForTest(test: LabTest): Promise<LabResult[]> {
  return transaction(['lab_results'], 'readonly', async (tx) => {
    const range = IDBKeyRange.bound([test, -Infinity], [test, Infinity]);
    const entities = await tx.objectStore('lab_results').index('test_dateEpochDay').getAll(range);
    return entities.map(labResultFromEntity);
  });
}

/** Saves (or replaces) the result and returns its identifier (`id` 0: new result). */
export function saveLabResult(result: LabResult): Promise<number> {
  return transaction(['lab_results'], 'readwrite', (tx) =>
    tx.objectStore('lab_results').put(stripAutoId(labResultToEntity(result))),
  );
}

export function deleteLabResult(id: number): Promise<void> {
  return transaction(['lab_results'], 'readwrite', (tx) => tx.objectStore('lab_results').delete(id));
}

// --- Backup access (caller-owned transaction over the `lab_results` store) ---

/** All the stored results, in key order (`getAll`). */
export function getAllLabResultEntities(tx: ReadTx): Promise<LabResultEntity[]> {
  return tx.objectStore('lab_results').getAll();
}

export function deleteAllLabResults(tx: Tx): Promise<void> {
  return tx.objectStore('lab_results').clear();
}

/** Adds the results with their own ids (`id` 0: new key); an existing id is an error (`insertAll`). */
export async function insertLabResultEntities(tx: Tx, entities: readonly LabResultEntity[]): Promise<void> {
  const store = tx.objectStore('lab_results');
  await Promise.all(entities.map((entity) => store.add(stripAutoId(entity))));
}
