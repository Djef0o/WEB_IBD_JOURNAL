import { LockedError, currentDataKey, isVaultPresent } from '../security/session';
import { decryptBytes, encryptBytes } from '../security/recordCrypto';
import { transaction } from './connection';
import type { EncryptedPhoto } from './schema';

/*
 * Meal photos. Android copies each photo into the app's private files and stores its
 * relative path in `MealEntity.photoPath` (`DiaryRepository.importPhoto`); here the (already
 * resized) image Blob is stored in the `photos` store under such a path. Photos are not part
 * of the backup, as on Android. With a PIN, the bytes are sealed with the data key before
 * being stored (done outside the transaction: reading a Blob is asynchronous).
 */

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
};

/** Seals the photo if the app has a PIN, else stores the Blob as is. */
export async function toStoredPhoto(photo: Blob): Promise<Blob | EncryptedPhoto> {
  const key = currentDataKey();
  if (key === null) {
    if (isVaultPresent()) throw new LockedError();
    return photo;
  }
  return { mime: photo.type, enc: encryptBytes(key, new Uint8Array(await photo.arrayBuffer()), 'photos') };
}

/** Stores the photo and returns the path to keep in `Meal.photoUri`. */
export async function importPhoto(photo: Blob): Promise<string> {
  const path = `photos/${crypto.randomUUID()}.${EXTENSIONS[photo.type] ?? 'img'}`;
  const stored = await toStoredPhoto(photo);
  await transaction(['photos'], 'readwrite', async (tx) => {
    await tx.objectStore('photos').put(stored, path);
  });
  return path;
}

/** The stored photo, or `null` if the path is unknown. Display it through an object URL. */
export async function getPhoto(path: string): Promise<Blob | null> {
  const stored = await transaction(['photos'], 'readonly', (tx) => tx.objectStore('photos').get(path));
  if (stored === undefined) return null;
  if (stored instanceof Blob) return stored;
  const key = currentDataKey();
  if (key === null) throw new LockedError();
  return new Blob([decryptBytes(key, stored.enc, 'photos')], { type: stored.mime });
}

/** Deletes a photo (`deletePhoto`); an unknown path is ignored. */
export function deletePhoto(path: string): Promise<void> {
  return transaction(['photos'], 'readwrite', (tx) => tx.objectStore('photos').delete(path));
}
