/*
 * In-memory state of the lock, shared by the storage layer and the vault. No imports: the
 * storage layer (`db/secureStore.ts`) reads it, the vault (`security/vault.ts`) writes it.
 */

let dataKey: Uint8Array | null = null;
let vaultPresent = false;

/** The 256-bit key that encrypts the records; `null` while the app is locked or has no vault. */
export function currentDataKey(): Uint8Array | null {
  return dataKey;
}

export function setDataKey(key: Uint8Array | null): void {
  dataKey = key;
}

/** True if a PIN has been set up (the data is encrypted, or being encrypted). */
export function isVaultPresent(): boolean {
  return vaultPresent;
}

export function setVaultPresent(value: boolean): void {
  vaultPresent = value;
}

/** Thrown when encrypted data is read or written while the app is locked. */
export class LockedError extends Error {
  constructor() {
    super('The data is locked');
    this.name = 'LockedError';
  }
}
