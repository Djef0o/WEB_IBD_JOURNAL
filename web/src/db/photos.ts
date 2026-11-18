import { transaction } from './connection';

/*
 * Meal photos. Android copies each photo into the app's private files and stores its
 * relative path in `MealEntity.photoPath` (`DiaryRepository.importPhoto`); here the (already
 * resized) image Blob is stored in the `photos` store under such a path. Photos are not part
 * of the backup, as on Android.
 */

const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/avif': 'avif',
};

/** Stores the photo and returns the path to keep in `Meal.photoUri`. */
export async function importPhoto(photo: Blob): Promise<string> {
  const path = `photos/${crypto.randomUUID()}.${EXTENSIONS[photo.type] ?? 'img'}`;
  await transaction(['photos'], 'readwrite', async (tx) => {
    await tx.objectStore('photos').put(photo, path);
  });
  return path;
}

/** The stored photo, or `null` if the path is unknown. Display it through an object URL. */
export function getPhoto(path: string): Promise<Blob | null> {
  return transaction(['photos'], 'readonly', async (tx) => (await tx.objectStore('photos').get(path)) ?? null);
}

/** Deletes a photo (`deletePhoto`); an unknown path is ignored. */
export function deletePhoto(path: string): Promise<void> {
  return transaction(['photos'], 'readwrite', (tx) => tx.objectStore('photos').delete(path));
}
