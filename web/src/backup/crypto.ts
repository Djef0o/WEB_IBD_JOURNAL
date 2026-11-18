/*
 * Password-based backup encryption, byte-for-byte compatible with `BackupCrypto.kt`.
 *
 * File format, in order:
 * - `IBDJENC1` (8 ASCII bytes): signature;
 * - PBKDF2 iteration count (32-bit big-endian int): read from the file;
 * - random salt (16 bytes);
 * - random IV (12 bytes);
 * - AES-256-GCM ciphertext followed by the authentication tag (128 bits).
 *
 * Key: PBKDF2-HMAC-SHA256(password as UTF-8, salt, iterations) → 256 bits.
 * The whole 40-byte header is the associated data (AAD): any modification is detected.
 */

export const ITERATIONS = 600_000;
/** Upper bound against a hostile header: avoids an endless key derivation. */
export const MAX_ITERATIONS = 10_000_000;

const MAGIC = new TextEncoder().encode('IBDJENC1');
const MAGIC_SIZE = MAGIC.length;
const ITERATIONS_OFFSET = MAGIC_SIZE;
const SALT_OFFSET = ITERATIONS_OFFSET + 4;
const SALT_BYTES = 16;
const IV_OFFSET = SALT_OFFSET + SALT_BYTES;
const IV_BYTES = 12;
const HEADER_SIZE = IV_OFFSET + IV_BYTES;
const TAG_BITS = 128;

/** Wrong password or tampered file: GCM cannot tell the two apart. */
export class WrongPasswordError extends Error {
  constructor() {
    super('Wrong password or damaged file');
    this.name = 'WrongPasswordError';
  }
}

/** Missing or inconsistent header: this is not a readable encrypted backup. */
export class InvalidBackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidBackupError';
  }
}

/** True if `prefix` starts with the signature of an encrypted backup. */
export function isEncryptedBackup(prefix: Uint8Array): boolean {
  return prefix.length >= MAGIC_SIZE && MAGIC.every((byte, i) => prefix[i] === byte);
}

function buildHeader(iterations: number, salt: Uint8Array, iv: Uint8Array): Uint8Array<ArrayBuffer> {
  const header = new Uint8Array(HEADER_SIZE);
  header.set(MAGIC, 0);
  new DataView(header.buffer).setInt32(ITERATIONS_OFFSET, iterations, false);
  header.set(salt, SALT_OFFSET);
  header.set(iv, IV_OFFSET);
  return header;
}

async function deriveKey(
  password: string, salt: Uint8Array<ArrayBuffer>, iterations: number, usage: 'encrypt' | 'decrypt',
): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const material = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    [usage],
  );
}

export interface EncryptOptions {
  iterations?: number;
  /** Fixed salt/IV: tests only. */
  salt?: Uint8Array<ArrayBuffer>;
  iv?: Uint8Array<ArrayBuffer>;
}

/** Encrypts `plain`: returns the complete file (header ‖ ciphertext ‖ tag). */
export async function encrypt(
  plain: Uint8Array<ArrayBuffer>, password: string, options: EncryptOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const iterations = options.iterations ?? ITERATIONS;
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_ITERATIONS) {
    throw new RangeError('Invalid iteration count');
  }
  const salt = options.salt ?? globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = options.iv ?? globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  if (salt.length !== SALT_BYTES || iv.length !== IV_BYTES) throw new RangeError('Invalid salt or IV size');
  const header = buildHeader(iterations, salt, iv);
  const key = await deriveKey(password, salt, iterations, 'encrypt');
  const body = new Uint8Array(await globalThis.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: header, tagLength: TAG_BITS }, key, plain,
  ));
  const file = new Uint8Array(HEADER_SIZE + body.length);
  file.set(header, 0);
  file.set(body, HEADER_SIZE);
  return file;
}

/**
 * Reads a complete encrypted backup and returns the plaintext, verified by GCM.
 * @throws WrongPasswordError wrong password or modified/truncated body
 * @throws InvalidBackupError missing or invalid header
 */
export async function decrypt(data: Uint8Array, password: string): Promise<Uint8Array<ArrayBuffer>> {
  if (!isEncryptedBackup(data)) {
    // Kotlin: a prefix shorter than the signature is a truncated header, anything else is not a backup.
    throw new InvalidBackupError(data.length < MAGIC_SIZE ? 'Truncated header' : 'Not an encrypted backup');
  }
  if (data.length < SALT_OFFSET) throw new InvalidBackupError('Truncated header');
  const iterations = new DataView(data.buffer, data.byteOffset, data.byteLength).getInt32(ITERATIONS_OFFSET, false);
  if (iterations < 1 || iterations > MAX_ITERATIONS) throw new InvalidBackupError('Invalid iteration count');
  if (data.length < HEADER_SIZE) throw new InvalidBackupError('Truncated header');
  const header = data.slice(0, HEADER_SIZE);
  const salt = header.slice(SALT_OFFSET, SALT_OFFSET + SALT_BYTES);
  const iv = header.slice(IV_OFFSET, IV_OFFSET + IV_BYTES);
  const key = await deriveKey(password, salt, iterations, 'decrypt');
  try {
    return new Uint8Array(await globalThis.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: header, tagLength: TAG_BITS }, key, data.slice(HEADER_SIZE),
    ));
  } catch {
    throw new WrongPasswordError();
  }
}
