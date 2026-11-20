import { useLiveQuery } from '../../db';
import { getEmergencyInfo } from '../../db/emergency';
import { getAllMedications } from '../../db/medications';
import { getProfile } from '../../db/profile';
import { emergencyInfo } from '../../domain/care';
import { emergencyData, emergencyTreatments, type EmergencyData } from '../../domain/emergencySheet';
import { profile as emptyProfile } from '../../domain/profile';

/** Data of the emergency sheet from the unlocked journal, kept up to date; undefined while loading (`EmergencyViewModel.data`). */
export function useEmergencyData(): EmergencyData | undefined {
  return useLiveQuery(['profile', 'emergency_info', 'medications'], async () => {
    const [profile, info, medications] = await Promise.all([getProfile(), getEmergencyInfo(), getAllMedications()]);
    return emergencyData({
      profile: profile ?? emptyProfile(),
      info: info ?? emergencyInfo(),
      treatments: emergencyTreatments(medications),
    });
  });
}
