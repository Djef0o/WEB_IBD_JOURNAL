import { checkupFromEntity, checkupToEntity, type CheckupEntity } from '../domain/entities';
import type { Checkup } from '../domain/profile';
import { stripAutoId, transaction, type ReadTx, type Tx } from './connection';

/** `ORDER BY startDateEpochDay, hour, minute` (ties: insertion order). */
function compareCheckups(a: CheckupEntity, b: CheckupEntity): number {
  return a.startDateEpochDay - b.startDateEpochDay || a.hour - b.hour || a.minute - b.minute || a.id - b.id;
}

/** Every check-up, by start date then time (`observeAll`). */
export function getAllCheckups(): Promise<Checkup[]> {
  return transaction(['checkups'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('checkups').getAll();
    return entities.sort(compareCheckups).map(checkupFromEntity);
  });
}

export function getCheckup(id: number): Promise<Checkup | null> {
  return transaction(['checkups'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('checkups').get(id);
    return entity ? checkupFromEntity(entity) : null;
  });
}

/** Saves (or replaces) the check-up and returns its identifier (`id` 0: new check-up). */
export function saveCheckup(checkup: Checkup): Promise<number> {
  return transaction(['checkups'], 'readwrite', async (tx) => {
    const store = tx.objectStore('checkups');
    const existing = checkup.id === 0 ? undefined : await store.get(checkup.id);
    return store.put(stripAutoId(checkupToEntity(checkup, existing?.createdAt)));
  });
}

export function deleteCheckup(id: number): Promise<void> {
  return transaction(['checkups'], 'readwrite', (tx) => tx.objectStore('checkups').delete(id));
}

// --- Backup access (caller-owned transaction over the `checkups` store) ---

/** All the stored check-ups, in key order (`getAll`). */
export function getAllCheckupEntities(tx: ReadTx): Promise<CheckupEntity[]> {
  return tx.objectStore('checkups').getAll();
}

export function deleteAllCheckups(tx: Tx): Promise<void> {
  return tx.objectStore('checkups').clear();
}

/** Adds the check-ups with their own ids (`id` 0: new key); an existing id is an error (`insertAll`). */
export async function insertCheckupEntities(tx: Tx, entities: readonly CheckupEntity[]): Promise<void> {
  const store = tx.objectStore('checkups');
  await Promise.all(entities.map((entity) => store.add(stripAutoId(entity))));
}
