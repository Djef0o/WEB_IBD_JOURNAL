import type { ReadonlySignal } from '@preact/signals';
import { PROFILE_SINGLE_ID, profileFromEntity, profileToEntity, type ProfileEntity } from '../domain/entities';
import type { Profile } from '../domain/profile';
import { transaction, type ReadTx, type Tx } from './connection';
import { liveSignal } from './live';

/** The profile, or `null` while none has been saved (onboarding not done). */
export function getProfile(): Promise<Profile | null> {
  return transaction(['profile'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('profile').get(PROFILE_SINGLE_ID);
    return entity ? profileFromEntity(entity) : null;
  });
}

/** Saves the profile (a single row: the app handles one profile). */
export function saveProfile(profile: Profile): Promise<void> {
  return transaction(['profile'], 'readwrite', async (tx) => {
    await tx.objectStore('profile').put(profileToEntity(profile));
  });
}

/**
 * The profile, kept up to date while a component or an effect reads it: `undefined` until
 * the first read of the database ends, then the profile or `null` if none was saved.
 */
export const profileSignal: ReadonlySignal<Profile | null | undefined> = liveSignal(['profile'], getProfile);

// --- Backup access (caller-owned transaction over the `profile` store) ---

export function getProfileEntity(tx: ReadTx): Promise<ProfileEntity | undefined> {
  return tx.objectStore('profile').get(PROFILE_SINGLE_ID);
}

/** Inserts or replaces the profile row (`upsert`). */
export async function putProfileEntity(tx: Tx, entity: ProfileEntity): Promise<void> {
  await tx.objectStore('profile').put(entity);
}
