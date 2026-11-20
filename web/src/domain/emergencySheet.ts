import { emergencyInfo, type EmergencyInfo } from './care';
import { profile as emptyProfile, type Medication, type Profile } from './profile';

/**
 * What the emergency sheet displays: profile identity and diagnosis, emergency fields,
 * treatments (one line each, "name · dosage") (`EmergencyData`).
 */
export interface EmergencyData {
  profile: Profile;
  info: EmergencyInfo;
  treatments: string[];
}

export function emergencyData(init: Partial<EmergencyData> = {}): EmergencyData {
  return { profile: emptyProfile(), info: emergencyInfo(), treatments: [], ...init };
}

/** One line per treatment: name and dosage, blanks left out. */
export function emergencyTreatments(medications: readonly Pick<Medication, 'name' | 'dosage'>[]): string[] {
  return medications.map((m) => [m.name, m.dosage].filter((s) => s.trim() !== '').join(' · '));
}

/** "First Last", blanks left out. */
export function emergencyName(profile: Pick<Profile, 'firstName' | 'lastName'>): string {
  return [profile.firstName, profile.lastName].filter((s) => s.trim() !== '').join(' ');
}

/** Whether the emergency fields of the settings screen hold anything (not the profile or treatments). */
export function emergencyInfoFilled(info: EmergencyInfo): boolean {
  return [info.allergies, info.doctorName, info.doctorPhone, info.contactName, info.contactPhone, info.notes]
    .some((s) => s.trim() !== '');
}

/** Nothing at all to show on the sheet. */
export function emergencyDataEmpty(data: EmergencyData): boolean {
  const { profile, info } = data;
  return emergencyName(profile) === '' && profile.birthDate === null && profile.diagnosis === null &&
    !emergencyInfoFilled(info) && data.treatments.length === 0;
}

const isString = (v: unknown): v is string => typeof v === 'string';

/** Validates the lock-screen copy read from the preferences (anything unexpected: null). */
export function parseEmergencyData(value: unknown): EmergencyData | null {
  if (typeof value !== 'object' || value === null) return null;
  const { profile, info, treatments } = value as Record<string, unknown>;
  if (typeof profile !== 'object' || profile === null || typeof info !== 'object' || info === null) return null;
  if (!Array.isArray(treatments) || !treatments.every(isString)) return null;
  const p = profile as Record<string, unknown>;
  const i = info as Record<string, unknown>;
  const diagnosis = p.diagnosis === 'CROHN' || p.diagnosis === 'ULCERATIVE_COLITIS' || p.diagnosis === 'OTHER' ? p.diagnosis : null;
  const text = (v: unknown): string => (isString(v) ? v : '');
  return {
    profile: emptyProfile({
      firstName: text(p.firstName),
      lastName: text(p.lastName),
      birthDate: isString(p.birthDate) && /^\d{4}-\d{2}-\d{2}$/.test(p.birthDate) ? p.birthDate : null,
      diagnosis,
    }),
    info: emergencyInfo({
      allergies: text(i.allergies), doctorName: text(i.doctorName), doctorPhone: text(i.doctorPhone),
      contactName: text(i.contactName), contactPhone: text(i.contactPhone), notes: text(i.notes),
      showOnLockScreen: true,
    }),
    treatments,
  };
}

/** The minimal copy kept readable on the lock screen: sex and anything else is left out. */
export function lockScreenCopy(data: EmergencyData): unknown {
  const { firstName, lastName, birthDate, diagnosis } = data.profile;
  return { profile: { firstName, lastName, birthDate, diagnosis }, info: data.info, treatments: data.treatments };
}
