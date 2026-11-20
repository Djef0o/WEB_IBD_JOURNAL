import { emergencyInfo } from '../domain/care';
import {
  emergencyData, emergencyTreatments, lockScreenCopy, parseEmergencyData, type EmergencyData,
} from '../domain/emergencySheet';
import { profile as emptyProfile } from '../domain/profile';
import { transaction } from './connection';
import { getEmergencyInfo } from './emergency';
import { watchQuery } from './live';
import { getAllMedications } from './medications';
import { getProfile } from './profile';

/*
 * Emergency sheet on the lock screen. Records are encrypted while the journal is locked, so the
 * sheet needs a copy that can be read without the PIN. That copy (name, birth date, diagnosis,
 * treatments and the emergency fields) lives in the `prefs` store, in clear text, and exists only
 * while the user keeps "Show on the lock screen" on: it is written whenever the sheet, the profile
 * or the treatments change, and removed as soon as the option is turned off (`ReminderData`'s
 * sealed copy on Android). It is not part of the backup.
 */

const KEY = 'emergency_lockscreen';

/** The copy readable while locked; null unless the user allowed the sheet on the lock screen. */
export function getLockScreenEmergency(): Promise<EmergencyData | null> {
  return transaction(['prefs'], 'readonly', async (tx) => parseEmergencyData(await tx.objectStore('prefs').get(KEY)));
}

/** Current sheet data from the unlocked journal. */
async function readEmergencyData(): Promise<EmergencyData> {
  const [profile, info, medications] = await Promise.all([getProfile(), getEmergencyInfo(), getAllMedications()]);
  return emergencyData({
    profile: profile ?? emptyProfile(),
    info: info ?? emergencyInfo(),
    treatments: emergencyTreatments(medications),
  });
}

/** Rewrites (option on) or removes (option off) the lock-screen copy from the unlocked journal. */
export async function syncLockScreenEmergency(): Promise<void> {
  await writeLockScreenCopy(await readEmergencyData());
}

function writeLockScreenCopy(data: EmergencyData): Promise<void> {
  return transaction(['prefs'], 'readwrite', async (tx) => {
    const store = tx.objectStore('prefs');
    if (data.info.showOnLockScreen) await store.put(lockScreenCopy(data), KEY);
    else await store.delete(KEY);
  });
}

/** Keeps the copy up to date while the journal is unlocked. Returns the function that stops it. */
export function startLockScreenEmergencySync(): () => void {
  return watchQuery(
    ['emergency_info', 'profile', 'medications'],
    readEmergencyData,
    (data) => { void writeLockScreenCopy(data).catch((error: unknown) => console.error(error)); },
    (error) => console.error(error),
  );
}
