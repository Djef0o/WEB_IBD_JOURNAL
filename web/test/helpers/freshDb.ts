import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { closeDb } from '../../src/db/connection';

/** Starts the test on an empty IndexedDB (new in-memory factory, connection closed). */
export async function freshDb(): Promise<void> {
  await closeDb();
  globalThis.indexedDB = new IDBFactory();
}
