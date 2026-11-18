import { stoolFromEntity, stoolToEntity, type StoolEntity } from '../domain/entities';
import type { Stool } from '../domain/models';
import type { LocalDate } from '../domain/time';
import { stripAutoId, transaction, type ReadTx, type Tx } from './connection';
import { dayRange, monthBounds } from './range';

/** `ORDER BY dateEpochDay, createdAt` (ties: insertion order). */
function compareStools(a: StoolEntity, b: StoolEntity): number {
  return a.dateEpochDay - b.dateEpochDay || a.createdAt - b.createdAt || a.id - b.id;
}

/**
 * Stools between two days (both included), in chronological order: the UI displays them in
 * this order, without sorting again (`observeBetween`). Includes false urges and stool-free
 * days: filter with `isRealStool`.
 */
export async function getStoolsBetween(from: LocalDate, to: LocalDate): Promise<Stool[]> {
  const range = dayRange(from, to);
  if (range === null) return [];
  return transaction(['stools'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('stools').index('dateEpochDay').getAll(range);
    return entities.sort(compareStools).map(stoolFromEntity);
  });
}

/** Stools of a month (`month`: 1 to 12). */
export function getStoolsInMonth(year: number, month: number): Promise<Stool[]> {
  const { from, to } = monthBounds(year, month);
  return getStoolsBetween(from, to);
}

/** Every stool, in chronological order (`observeAll`). */
export function getAllStools(): Promise<Stool[]> {
  return transaction(['stools'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('stools').getAll();
    return entities.sort(compareStools).map(stoolFromEntity);
  });
}

/** Saves (or replaces) the stool and returns its identifier (`id` 0: new stool). */
export function saveStool(stool: Stool): Promise<number> {
  return transaction(['stools'], 'readwrite', (tx) =>
    tx.objectStore('stools').put(stripAutoId(stoolToEntity(stool))),
  );
}

export function getStool(id: number): Promise<Stool | null> {
  return transaction(['stools'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('stools').get(id);
    return entity ? stoolFromEntity(entity) : null;
  });
}

export function deleteStool(id: number): Promise<void> {
  return transaction(['stools'], 'readwrite', (tx) => tx.objectStore('stools').delete(id));
}

// --- Backup access (caller-owned transaction over the `stools` store) ---

/** All the stored stools, in key order (`getAll`). */
export function getAllStoolEntities(tx: ReadTx): Promise<StoolEntity[]> {
  return tx.objectStore('stools').getAll();
}

export function deleteAllStools(tx: Tx): Promise<void> {
  return tx.objectStore('stools').clear();
}

/** Adds the stools with their own ids (`id` 0: new key); an existing id is an error (`insertAll`). */
export async function insertStoolEntities(tx: Tx, entities: readonly StoolEntity[]): Promise<void> {
  const store = tx.objectStore('stools');
  await Promise.all(entities.map((entity) => store.add(stripAutoId(entity))));
}
