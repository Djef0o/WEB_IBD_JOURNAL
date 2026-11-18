import { openDB } from 'idb';
import { bumpStores } from './changes';
import { secureStore, type SecureStore } from './secureStore';
import { DB_NAME, DB_VERSION, upgradeDb, type IbdDb, type IbdSchema, type StoreName } from './schema';

let dbPromise: Promise<IbdDb> | null = null;

/** The `ibd-journal` database (opened on first use, then shared). */
export function getDb(): Promise<IbdDb> {
  if (dbPromise) return dbPromise;
  const opening = openDB<IbdSchema>(DB_NAME, DB_VERSION, {
    upgrade: (db, oldVersion) => upgradeDb(db, oldVersion),
    // Another tab upgrades the schema: release our connection so that it is not blocked.
    blocking: () => {
      void closeDb();
    },
    // The browser closed the connection (storage cleared by the user, for example).
    terminated: () => {
      if (dbPromise === opening) dbPromise = null;
    },
  });
  dbPromise = opening;
  opening.catch(() => {
    if (dbPromise === opening) dbPromise = null; // a failed opening can be retried
  });
  return opening;
}

/** Closes the shared connection; the next `getDb()` opens it again. */
export async function closeDb(): Promise<void> {
  const opening = dbPromise;
  dbPromise = null;
  if (opening) (await opening).close();
}

/**
 * Transaction handle given to `transaction()` callbacks and to the `tx`-taking repository
 * functions: the stores it opens encrypt and decrypt the records when the app has a PIN
 * (see `secureStore.ts`).
 */
export interface Tx {
  objectStore<N extends StoreName>(name: N): SecureStore<N>;
}

/** A transaction of any mode, for the functions that only read. */
export type ReadTx = Tx;

/**
 * Runs `fn` in one IndexedDB transaction over `stores`.
 *
 * - The callback must only await IndexedDB requests (any other `await` commits the
 *   transaction early).
 * - If it throws, nothing is written (the transaction is aborted) and the error is rethrown.
 * - After a committed `readwrite` transaction, the stores in `changed` (default: all `stores`)
 *   are announced to the live queries.
 */
export async function transaction<Mode extends 'readonly' | 'readwrite', R>(
  stores: readonly StoreName[],
  mode: Mode,
  fn: (tx: Tx) => Promise<R>,
  changed: readonly StoreName[] = stores,
): Promise<R> {
  const db = await getDb();
  const tx = db.transaction(stores, mode);
  const secure: Tx = {
    objectStore: (name) => secureStore(name, tx.objectStore(name)),
  };
  let result: R;
  try {
    result = await fn(secure);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* already finished or aborted by the failed request */
    }
    await tx.done.catch(() => undefined);
    throw error;
  }
  await tx.done;
  if (mode === 'readwrite') bumpStores(changed);
  return result;
}

/**
 * Entity to store with an auto-generated key: `id = 0` means "new row" (Room
 * `autoGenerate`), so the `id` property is removed and IndexedDB assigns the next key.
 */
export function stripAutoId<T extends { id: number }>(entity: T): T {
  if (entity.id !== 0) return entity;
  const copy: Partial<T> = { ...entity };
  delete copy.id;
  return copy as T;
}
