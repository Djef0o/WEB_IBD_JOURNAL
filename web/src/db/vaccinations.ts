import { vaccinationFromEntity, vaccinationToEntity } from '../domain/entities';
import type { Vaccination } from '../domain/care';
import { stripAutoId, transaction } from './connection';

/** Every vaccination, by date then insertion order (`ORDER BY dateEpochDay, id`). */
export function getAllVaccinations(): Promise<Vaccination[]> {
  return transaction(['vaccinations'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('vaccinations').getAll();
    return entities
      .sort((a, b) => a.dateEpochDay - b.dateEpochDay || a.id - b.id)
      .map(vaccinationFromEntity);
  });
}

/** Saves (or replaces) the vaccination and returns its identifier (`id` 0: new vaccination). */
export function saveVaccination(vaccination: Vaccination): Promise<number> {
  return transaction(['vaccinations'], 'readwrite', (tx) =>
    tx.objectStore('vaccinations').put(stripAutoId(vaccinationToEntity(vaccination))));
}

export function deleteVaccination(id: number): Promise<void> {
  return transaction(['vaccinations'], 'readwrite', (tx) => tx.objectStore('vaccinations').delete(id));
}
