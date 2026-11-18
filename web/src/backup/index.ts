import { decodeBackupData, encodeBackupData } from '../domain/backupData';
import { restore, snapshot } from './backup';
import { decrypt, encrypt, InvalidBackupError } from './crypto';

export { InvalidBackupError, isEncryptedBackup, WrongPasswordError } from './crypto';
export { restore, snapshot } from './backup';

/** Suggested file name of a backup: `ibd-journal-YYYY-MM-DD.ibdj` (local date). */
export function backupFileName(date: Date = new Date()): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `ibd-journal-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.ibdj`;
}

/** Encrypted backup of the whole journal, ready to download (the file is read by the Android app too). */
export async function exportBackup(password: string): Promise<Blob> {
  const plain = new TextEncoder().encode(encodeBackupData(await snapshot()));
  try {
    const file = await encrypt(plain, password);
    return new Blob([file], { type: 'application/octet-stream' });
  } finally {
    plain.fill(0);
  }
}

/**
 * Decrypts and decodes the whole file before touching the database: on error, nothing is modified.
 * @throws WrongPasswordError wrong password or tampered file
 * @throws InvalidBackupError not an encrypted backup, or unreadable content
 */
export async function importBackup(data: ArrayBuffer | Uint8Array, password: string): Promise<void> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const plain = await decrypt(bytes, password);
  let backup;
  try {
    backup = decodeBackupData(new TextDecoder('utf-8', { fatal: true }).decode(plain));
  } catch (error) {
    throw new InvalidBackupError(error instanceof Error ? error.message : 'Unreadable backup content');
  } finally {
    plain.fill(0);
  }
  await restore(backup);
}
