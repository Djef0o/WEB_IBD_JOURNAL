import { signal } from '@preact/signals';
import { bumpStores } from '../db/changes';
import { closeDb, getDb } from '../db/connection';
import { DB_NAME, STORE_NAMES, type StoreName } from '../db/schema';
import { isEncryptedRecord, isEncryptedStore, isSensitivePrefKey, sealRecord } from '../db/secureStore';
import { toStoredPhoto } from '../db/photos';
import { encryptJson } from './recordCrypto';
import { enrollBiometric, getBiometricSecret } from './biometric';
import { currentDataKey, setDataKey, setVaultPresent } from './session';

/*
 * The vault: a random 256-bit data key encrypts the records (see `db/secureStore.ts`); that key
 * is itself stored wrapped, once by a key derived from the PIN (PBKDF2-HMAC-SHA256, 600 000
 * iterations) and optionally once by the biometric secret. The wrapped keys live in the `prefs`
 * store under `vault`; the data key only ever exists in memory, and a lock reloads the page.
 *
 * A PIN is a weak secret: someone who copies the browser profile can try every PIN offline, and
 * the iteration count only slows each try down. That is why the PIN has at least 6 digits.
 */

export const PIN_MIN = 6;
export const PIN_MAX = 12;
const PBKDF2_ITERATIONS = 600_000;
const VAULT_KEY = 'vault';
const AUTO_LOCK_MS = 5 * 60_000;
const FREE_ATTEMPTS = 5;

export type VaultStatus = 'loading' | 'none' | 'locked' | 'unlocked';
export const vaultStatus = signal<VaultStatus>('loading');
/** Whether biometric unlock is enrolled (known once the status is). */
export const biometricEnrolled = signal(false);
/** Set while existing data is being encrypted. */
export const encrypting = signal(false);

type Bytes = Uint8Array<ArrayBuffer>;
interface Wrapped { iv: Bytes; wrapped: Bytes }
interface VaultMeta {
  v: 1;
  salt: Bytes;
  iterations: number;
  pin: Wrapped;
  bio?: Wrapped & { credentialId: Bytes; prfSalt: Bytes };
  /** Every record and photo is encrypted (the migration of an existing install finished). */
  migrated: boolean;
  fails: number;
  lockedUntil: number;
}

export class WrongPinError extends Error {
  constructor() {
    super('Wrong PIN');
    this.name = 'WrongPinError';
  }
}

/** Too many wrong PINs: wait `seconds` before the next try. */
export class TooManyAttemptsError extends Error {
  constructor(readonly seconds: number) {
    super('Too many attempts');
    this.name = 'TooManyAttemptsError';
  }
}

export const isValidPin = (pin: string): boolean => new RegExp(`^\\d{${PIN_MIN},${PIN_MAX}}$`).test(pin);

const random = (length: number): Bytes => crypto.getRandomValues(new Uint8Array(length));
const encoder = new TextEncoder();

async function pinKey(pin: string, salt: Bytes, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function secretKey(secret: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', secret as Bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function wrap(key: CryptoKey, dataKey: Uint8Array, aad: string): Promise<Wrapped> {
  const iv = random(12);
  const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(aad) }, key, dataKey as Bytes);
  return { iv, wrapped: new Uint8Array(sealed) };
}

async function unwrap(key: CryptoKey, w: Wrapped, aad: string): Promise<Uint8Array> {
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: w.iv, additionalData: encoder.encode(aad) }, key, w.wrapped);
    return new Uint8Array(plain);
  } catch {
    throw new WrongPinError();
  }
}

async function readMeta(): Promise<VaultMeta | null> {
  const db = await getDb();
  const value = (await db.get('prefs', VAULT_KEY)) as VaultMeta | undefined;
  return value && value.v === 1 ? value : null;
}

async function writeMeta(meta: VaultMeta): Promise<void> {
  const db = await getDb();
  await db.put('prefs', meta, VAULT_KEY);
}

/** Reads the vault state; call it before the first screen so that the app knows if it is locked. */
export async function loadVault(): Promise<void> {
  const meta = await readMeta();
  setVaultPresent(meta !== null);
  biometricEnrolled.value = meta?.bio !== undefined;
  vaultStatus.value = meta === null ? 'none' : 'locked';
}

/** Encrypts what is still in clear text (an install that predates the PIN, or an interrupted run). Safe to repeat. */
async function encryptExistingData(key: Uint8Array): Promise<void> {
  const db = await getDb();
  const names = STORE_NAMES.filter(isEncryptedStore);
  const stores: StoreName[] = [...names, 'prefs'];
  const tx = db.transaction(stores, 'readwrite');
  for (const name of names) {
    const store = tx.objectStore(name);
    const values = await store.getAll();
    await Promise.all(values.map((value) => {
      if (isEncryptedRecord(value)) return undefined;
      return store.put(sealRecord(name, key, value) as never);
    }));
  }
  const prefs = tx.objectStore('prefs');
  const [prefKeys, prefValues] = await Promise.all([prefs.getAllKeys(), prefs.getAll()]);
  await Promise.all(prefValues.map((value, i) => {
    const prefKey = prefKeys[i];
    if (!isSensitivePrefKey(prefKey) || isEncryptedRecord(value)) return undefined;
    return prefs.put({ __enc: encryptJson(key, value, 'prefs') }, prefKey);
  }));
  await tx.done;

  // Photos: reading a Blob is asynchronous, so outside of any transaction.
  const paths = await db.getAllKeys('photos');
  for (const path of paths) {
    const stored = await db.get('photos', path);
    if (stored instanceof Blob) await db.put('photos', await toStoredPhoto(stored), path);
  }
}

async function finishUnlock(meta: VaultMeta, key: Uint8Array): Promise<void> {
  setDataKey(key);
  if (!meta.migrated) {
    encrypting.value = true;
    try {
      await encryptExistingData(key);
      await writeMeta({ ...meta, migrated: true, fails: 0, lockedUntil: 0 });
    } catch (error) {
      setDataKey(null);
      throw error;
    } finally {
      encrypting.value = false;
    }
  } else if (meta.fails !== 0 || meta.lockedUntil !== 0) {
    await writeMeta({ ...meta, fails: 0, lockedUntil: 0 });
  }
  bumpStores(STORE_NAMES);
  vaultStatus.value = 'unlocked';
  watchAutoLock();
}

/** Sets the first PIN and encrypts the data. Leaves the app unlocked. */
export async function setupVault(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new RangeError('Invalid PIN');
  const dataKey = random(32);
  const salt = random(16);
  const wrapped = await wrap(await pinKey(pin, salt, PBKDF2_ITERATIONS), dataKey, 'pin');
  const meta: VaultMeta = { v: 1, salt, iterations: PBKDF2_ITERATIONS, pin: wrapped, migrated: false, fails: 0, lockedUntil: 0 };
  await writeMeta(meta);
  setVaultPresent(true);
  await finishUnlock(meta, dataKey);
}

function throttle(meta: VaultMeta): void {
  const wait = Math.ceil((meta.lockedUntil - Date.now()) / 1000);
  if (wait > 0) throw new TooManyAttemptsError(wait);
}

/** Unlocks with the PIN. Throws `WrongPinError` or `TooManyAttemptsError`. */
export async function unlockWithPin(pin: string): Promise<void> {
  const meta = await readMeta();
  if (!meta) throw new Error('No vault');
  throttle(meta);
  let key: Uint8Array;
  try {
    key = await unwrap(await pinKey(pin, meta.salt, meta.iterations), meta.pin, 'pin');
  } catch (error) {
    if (error instanceof WrongPinError) {
      const fails = meta.fails + 1;
      const lockedUntil = fails >= FREE_ATTEMPTS ? Date.now() + Math.min(30_000 * 2 ** (fails - FREE_ATTEMPTS), 15 * 60_000) : 0;
      await writeMeta({ ...meta, fails, lockedUntil });
    }
    throw error;
  }
  await finishUnlock(meta, key);
}

/** Unlocks with the biometric secret (a user verification prompt). */
export async function unlockWithBiometric(): Promise<void> {
  const meta = await readMeta();
  if (!meta?.bio) throw new Error('Biometrics not enrolled');
  const secret = await getBiometricSecret(meta.bio.credentialId, meta.bio.prfSalt);
  const key = await unwrap(await secretKey(secret), meta.bio, 'bio');
  await finishUnlock(meta, key);
}

/** Enrolls biometrics; needs the unlocked app. Throws `BiometricUnsupportedError` if the device cannot do it. */
export async function enableBiometric(appName: string): Promise<void> {
  const meta = await readMeta();
  const dataKey = currentDataKey();
  if (!meta || !dataKey) throw new Error('The vault must be unlocked');
  const prfSalt = random(32);
  const { credentialId, secret } = await enrollBiometric(appName, prfSalt);
  const wrapped = await wrap(await secretKey(secret), dataKey, 'bio');
  await writeMeta({ ...meta, bio: { ...wrapped, credentialId, prfSalt } });
  biometricEnrolled.value = true;
}

export async function disableBiometric(): Promise<void> {
  const meta = await readMeta();
  if (!meta) return;
  const { bio: _removed, ...rest } = meta;
  await writeMeta(rest);
  biometricEnrolled.value = false;
}

/** Forgets the data key and reloads: no decrypted data stays in memory. */
export function lock(): void {
  setDataKey(null);
  location.reload();
}

let watching = false;
/** Locks after the page stayed in the background for a few minutes. */
function watchAutoLock(): void {
  if (watching || typeof document === 'undefined') return;
  watching = true;
  let hiddenAt: number | null = null;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
    } else if (hiddenAt !== null && Date.now() - hiddenAt >= AUTO_LOCK_MS && vaultStatus.value === 'unlocked') {
      lock();
    } else {
      hiddenAt = null;
    }
  });
}

/** Forgotten PIN: deletes every local datum (the encrypted data cannot be read without the PIN) and restarts. */
export async function eraseEverything(): Promise<void> {
  setDataKey(null);
  await closeDb();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
  location.replace('/');
}
