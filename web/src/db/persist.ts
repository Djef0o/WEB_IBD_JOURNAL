/**
 * Asks the browser not to evict the journal when storage runs low (`navigator.storage.persist()`).
 * Call it once at startup. Returns whether the storage is persistent; `false` when the
 * browser refuses or does not support it (the user can still clear the data of the site by hand).
 */
export async function requestPersistentStorage(): Promise<boolean> {
  const storage = globalThis.navigator?.storage;
  if (!storage || typeof storage.persist !== 'function') return false;
  if (typeof storage.persisted === 'function' && (await storage.persisted())) return true;
  return storage.persist();
}
