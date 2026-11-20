import { flareFromEntity, flareToEntity } from '../domain/entities';
import type { Flare } from '../domain/care';
import { stripAutoId, transaction } from './connection';

/** Every flare, by start date then insertion order (`ORDER BY startEpochDay, id`). */
export function getAllFlares(): Promise<Flare[]> {
  return transaction(['flares'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('flares').getAll();
    return entities
      .sort((a, b) => a.startEpochDay - b.startEpochDay || a.id - b.id)
      .map(flareFromEntity);
  });
}

/** Saves (or replaces) the flare and returns its identifier (`id` 0: new flare). */
export function saveFlare(flare: Flare): Promise<number> {
  return transaction(['flares'], 'readwrite', (tx) => tx.objectStore('flares').put(stripAutoId(flareToEntity(flare))));
}

export function deleteFlare(id: number): Promise<void> {
  return transaction(['flares'], 'readwrite', (tx) => tx.objectStore('flares').delete(id));
}
