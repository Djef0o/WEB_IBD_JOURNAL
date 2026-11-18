import type { IndexKey, IndexNames, StoreKey, StoreValue } from 'idb';
import { LockedError, currentDataKey, isVaultPresent } from '../security/session';
import { decryptJson, encryptJson } from '../security/recordCrypto';
import type { IbdSchema, StoreName } from './schema';

/*
 * Transparent encryption of the records. The repositories keep using
 * `tx.objectStore(name).get/getAll/put/add/delete/clear/index(...)`; when the app has a PIN,
 * each record is stored as `{ <keyPath>, __enc }` where `__enc` is the AES-GCM sealed JSON of
 * the rest of the record. What stays readable on disk: the record ids, the number of records,
 * the preference names, the product barcodes and the photo paths. Dates, values, notes,
 * names, test types... are all inside `__enc`.
 *
 * Because encrypted records no longer carry their indexed fields, the IndexedDB indexes are
 * useless for them: `index(...)` queries are answered here, by decrypting the store and
 * filtering, with the same ordering as IndexedDB. A personal journal holds a few thousand rows
 * at most.
 *
 * Without PIN (before the setup, tests) everything is passed through unchanged. A record that
 * is still in clear text (data not yet encrypted) is always readable.
 */

const ENC = '__enc';

/** Stores whose records are encrypted, with their inline key path. `photos` has its own code (blobs). */
const KEY_PATHS = {
  meals: 'id', stools: 'id', products: 'barcode', lab_results: 'id', dose_logs: 'id', profile: 'id',
  medications: 'id', checkups: 'id', exams: 'id', weights: 'id',
} as const;

type EncryptedStore = keyof typeof KEY_PATHS;

/** Index key paths, to evaluate an index on a decrypted record. */
const INDEXES: Readonly<Record<string, Readonly<Record<string, string | readonly string[]>>>> = {
  meals: { dateEpochDay: 'dateEpochDay' },
  stools: { dateEpochDay: 'dateEpochDay' },
  weights: { dateEpochDay: 'dateEpochDay' },
  lab_results: { test_dateEpochDay: ['test', 'dateEpochDay'] },
  dose_logs: { medicationId_scheduledAt: ['medicationId', 'scheduledAt'] },
};

/** Preferences holding health data (the evening check-in answers); the others are needed before unlocking. */
const isSensitivePref = (key: unknown): boolean => typeof key === 'string' && key.startsWith('checkin_');

export function isEncryptedRecord(value: unknown): value is { [ENC]: Uint8Array } {
  return typeof value === 'object' && value !== null && ENC in value;
}

export function isEncryptedStore(name: StoreName): name is EncryptedStore {
  return name in KEY_PATHS;
}

export function isSensitivePrefKey(key: unknown): boolean {
  return isSensitivePref(key);
}

export function sealRecord(name: EncryptedStore, key: Uint8Array, value: unknown): unknown {
  const keyPath = KEY_PATHS[name];
  const { [keyPath]: id, ...rest } = value as Record<string, unknown>;
  return { ...(id === undefined ? {} : { [keyPath]: id }), [ENC]: encryptJson(key, rest, name) };
}

export function openRecord(name: EncryptedStore, key: Uint8Array | null, stored: unknown): unknown {
  if (!isEncryptedRecord(stored)) return stored;
  if (key === null) throw new LockedError();
  const keyPath = KEY_PATHS[name];
  const id = (stored as Record<string, unknown>)[keyPath];
  return { ...(decryptJson(key, stored[ENC], name) as object), [keyPath]: id };
}

function sealPref(key: Uint8Array, value: unknown): unknown {
  return { [ENC]: encryptJson(key, value, 'prefs') };
}

/** A sensitive preference while locked reads as missing (the lock screen needs the others). */
function openPref(key: Uint8Array | null, stored: unknown): unknown {
  if (!isEncryptedRecord(stored)) return stored;
  if (key === null) return undefined;
  return decryptJson(key, stored[ENC], 'prefs');
}

/** The raw object store (the idb API, loosely typed: this module owns the typing). */
interface RawIndex {
  getAll(query?: unknown): Promise<unknown[]>;
  getAllKeys(query?: unknown): Promise<unknown[]>;
  getKey(query: unknown): Promise<unknown>;
}
interface RawStore {
  get(key: unknown): Promise<unknown>;
  getAll(query?: unknown): Promise<unknown[]>;
  getAllKeys(query?: unknown): Promise<unknown[]>;
  put(value: unknown, key?: unknown): Promise<unknown>;
  add(value: unknown, key?: unknown): Promise<unknown>;
  delete(key: unknown): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
  index(name: string): RawIndex;
}

export interface SecureIndex<N extends StoreName, I extends IndexNames<IbdSchema, N>> {
  getAll(query?: IDBKeyRange | IndexKey<IbdSchema, N, I> | null): Promise<StoreValue<IbdSchema, N>[]>;
  getAllKeys(query?: IDBKeyRange | IndexKey<IbdSchema, N, I> | null): Promise<StoreKey<IbdSchema, N>[]>;
  getKey(query: IDBKeyRange | IndexKey<IbdSchema, N, I>): Promise<StoreKey<IbdSchema, N> | undefined>;
}

export interface SecureStore<N extends StoreName> {
  get(key: StoreKey<IbdSchema, N>): Promise<StoreValue<IbdSchema, N> | undefined>;
  getAll(): Promise<StoreValue<IbdSchema, N>[]>;
  getAllKeys(): Promise<StoreKey<IbdSchema, N>[]>;
  put(value: StoreValue<IbdSchema, N>, key?: StoreKey<IbdSchema, N>): Promise<StoreKey<IbdSchema, N>>;
  add(value: StoreValue<IbdSchema, N>, key?: StoreKey<IbdSchema, N>): Promise<StoreKey<IbdSchema, N>>;
  delete(key: StoreKey<IbdSchema, N> | IDBKeyRange): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
  index<I extends IndexNames<IbdSchema, N>>(name: I): SecureIndex<N, I>;
}

/** Value of an index path on a record (`undefined`: the record is not in the index, like IndexedDB). */
function indexKey(record: Record<string, unknown>, path: string | readonly string[]): unknown {
  if (typeof path === 'string') return record[path];
  const parts = path.map((p) => record[p]);
  return parts.some((p) => p === undefined) ? undefined : parts;
}

function matches(query: unknown, key: unknown): boolean {
  if (query === undefined || query === null) return true;
  if (query instanceof IDBKeyRange) return query.includes(key);
  return indexedDB.cmp(query as IDBValidKey, key as IDBValidKey) === 0;
}

class StoreImpl {
  constructor(private readonly name: StoreName, private readonly raw: RawStore) {}

  private open(stored: unknown): unknown {
    return isEncryptedStore(this.name) ? openRecord(this.name, currentDataKey(), stored) : stored;
  }

  private seal(value: unknown, key?: unknown): unknown {
    const dataKey = currentDataKey();
    if (this.name === 'prefs') {
      if (!isSensitivePref(key)) return value;
      if (dataKey) return sealPref(dataKey, value);
      if (isVaultPresent()) throw new LockedError();
      return value;
    }
    if (!isEncryptedStore(this.name)) return value;
    if (dataKey) return sealRecord(this.name, dataKey, value);
    if (isVaultPresent()) throw new LockedError();
    return value;
  }

  private openValue(stored: unknown): unknown {
    return this.name === 'prefs' ? openPref(currentDataKey(), stored) : this.open(stored);
  }

  async get(key: unknown): Promise<unknown> {
    const stored = await this.raw.get(key);
    return stored === undefined ? undefined : this.openValue(stored);
  }

  async getAll(): Promise<unknown[]> {
    return (await this.raw.getAll()).map((stored) => this.openValue(stored));
  }

  getAllKeys(): Promise<unknown[]> {
    return this.raw.getAllKeys();
  }

  put(value: unknown, key?: unknown): Promise<unknown> {
    return this.raw.put(this.seal(value, key), key);
  }

  add(value: unknown, key?: unknown): Promise<unknown> {
    return this.raw.add(this.seal(value, key), key);
  }

  delete(key: unknown): Promise<void> {
    return this.raw.delete(key);
  }

  clear(): Promise<void> {
    return this.raw.clear();
  }

  count(): Promise<number> {
    return this.raw.count();
  }

  index(indexName: string): RawIndex {
    const path = INDEXES[this.name]?.[indexName];
    const entries = async (query: unknown): Promise<{ id: unknown; sortKey: unknown; record: unknown }[]> => {
      if (path === undefined) throw new Error(`Unknown index ${this.name}.${indexName}`);
      const [keys, values] = await Promise.all([this.raw.getAllKeys(), this.raw.getAll()]);
      const found: { id: unknown; sortKey: unknown; record: unknown }[] = [];
      values.forEach((stored, i) => {
        const record = this.open(stored);
        const sortKey = indexKey(record as Record<string, unknown>, path);
        if (sortKey !== undefined && matches(query, sortKey)) found.push({ id: keys[i], sortKey, record });
      });
      // IndexedDB order: index key, then primary key.
      return found.sort(
        (a, b) => indexedDB.cmp(a.sortKey as IDBValidKey, b.sortKey as IDBValidKey) || indexedDB.cmp(a.id as IDBValidKey, b.id as IDBValidKey),
      );
    };
    // Clear-text stores (no PIN yet) keep using the real indexes.
    const plain = !currentDataKey() && !isVaultPresent();
    if (plain) return this.raw.index(indexName);
    return {
      getAll: async (query) => (await entries(query)).map((e) => e.record),
      getAllKeys: async (query) => (await entries(query)).map((e) => e.id),
      getKey: async (query) => (await entries(query))[0]?.id,
    };
  }
}

/** Wraps one raw object store; the public type is `SecureStore<N>`. */
export function secureStore<N extends StoreName>(name: N, raw: unknown): SecureStore<N> {
  return new StoreImpl(name, raw as RawStore) as unknown as SecureStore<N>;
}
