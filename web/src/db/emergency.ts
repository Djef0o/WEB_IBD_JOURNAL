import type { ReadonlySignal } from '@preact/signals';
import {
  EMERGENCY_SINGLE_ID, emergencyInfoFromEntity, emergencyInfoToEntity,
} from '../domain/entities';
import type { EmergencyInfo } from '../domain/care';
import { transaction } from './connection';
import { liveSignal } from './live';

/** The emergency sheet, or `null` while none has been saved. */
export function getEmergencyInfo(): Promise<EmergencyInfo | null> {
  return transaction(['emergency_info'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('emergency_info').get(EMERGENCY_SINGLE_ID);
    return entity ? emergencyInfoFromEntity(entity) : null;
  });
}

/** Saves the emergency sheet (a single row). */
export function saveEmergencyInfo(info: EmergencyInfo): Promise<void> {
  return transaction(['emergency_info'], 'readwrite', async (tx) => {
    await tx.objectStore('emergency_info').put(emergencyInfoToEntity(info));
  });
}

/** The emergency sheet kept up to date: `undefined` until the first read, then the sheet or `null`. */
export const emergencySignal: ReadonlySignal<EmergencyInfo | null | undefined> =
  liveSignal(['emergency_info'], getEmergencyInfo);
