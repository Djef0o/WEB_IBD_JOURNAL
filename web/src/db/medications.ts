import { medicationFromEntity, medicationToEntity, type MedicationEntity } from '../domain/entities';
import type { Medication } from '../domain/profile';
import { stripAutoId, transaction, type ReadTx, type Tx } from './connection';
import { deleteDoseLogsForMedication } from './doses';

/**
 * `COLLATE NOCASE` of SQLite: only the ASCII letters are case-folded; the rest compares as
 * UTF-8 bytes, i.e. by code point.
 */
function compareNoCase(a: string, b: string): number {
  const foldAscii = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());
  const left = Array.from(foldAscii(a));
  const right = Array.from(foldAscii(b));
  const common = Math.min(left.length, right.length);
  for (let i = 0; i < common; i++) {
    const diff = left[i]!.codePointAt(0)! - right[i]!.codePointAt(0)!;
    if (diff !== 0) return diff;
  }
  return left.length - right.length;
}

/** `ORDER BY name COLLATE NOCASE, createdAt` (ties: insertion order). */
function compareMedications(a: MedicationEntity, b: MedicationEntity): number {
  return compareNoCase(a.name, b.name) || a.createdAt - b.createdAt || a.id - b.id;
}

/** Every treatment, by name (case-insensitive) then creation time (`observeAll`). */
export function getAllMedications(): Promise<Medication[]> {
  return transaction(['medications'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('medications').getAll();
    return entities.sort(compareMedications).map(medicationFromEntity);
  });
}

export function getMedication(id: number): Promise<Medication | null> {
  return transaction(['medications'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('medications').get(id);
    return entity ? medicationFromEntity(entity) : null;
  });
}

/** Saves (or replaces) the treatment and returns its identifier (`id` 0: new treatment). */
export function saveMedication(medication: Medication): Promise<number> {
  return transaction(['medications'], 'readwrite', async (tx) => {
    const store = tx.objectStore('medications');
    const existing = medication.id === 0 ? undefined : await store.get(medication.id);
    return store.put(stripAutoId(medicationToEntity(medication, existing?.createdAt)));
  });
}

/** Deletes the treatment and, in the same transaction, its confirmed doses. */
export function deleteMedication(id: number): Promise<void> {
  return transaction(['medications', 'dose_logs'], 'readwrite', async (tx) => {
    await tx.objectStore('medications').delete(id);
    await deleteDoseLogsForMedication(tx, id);
  });
}

// --- Backup access (caller-owned transaction over the `medications` store) ---

/** All the stored treatments, in key order (`getAll`). */
export function getAllMedicationEntities(tx: ReadTx): Promise<MedicationEntity[]> {
  return tx.objectStore('medications').getAll();
}

export function deleteAllMedications(tx: Tx): Promise<void> {
  return tx.objectStore('medications').clear();
}

/** Adds the treatments with their own ids (`id` 0: new key); an existing id is an error (`insertAll`). */
export async function insertMedicationEntities(tx: Tx, entities: readonly MedicationEntity[]): Promise<void> {
  const store = tx.objectStore('medications');
  await Promise.all(entities.map((entity) => store.add(stripAutoId(entity))));
}
