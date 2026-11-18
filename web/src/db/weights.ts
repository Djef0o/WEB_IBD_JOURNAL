import { weightFromEntity, weightToEntity } from '../domain/entities';
import type { Weight } from '../domain/models';
import { stripAutoId, transaction } from './connection';

/** Every weight, in chronological order (one per day). */
export function getAllWeights(): Promise<Weight[]> {
  return transaction(['weights'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('weights').index('dateEpochDay').getAll();
    return entities.map(weightFromEntity);
  });
}

/**
 * Saves the weight of a day: an existing weight on the same date is replaced (one weight
 * per day, so the chart has one point per day). Returns the stored identifier.
 */
export function saveWeight(weight: Weight): Promise<number> {
  return transaction(['weights'], 'readwrite', async (tx) => {
    const store = tx.objectStore('weights');
    const entity = weightToEntity(weight);
    const sameDay = await store.index('dateEpochDay').getAllKeys(entity.dateEpochDay);
    const id = weight.id !== 0 ? weight.id : (sameDay[0] ?? 0);
    // Another row of the same day (an edit moved onto a taken date) is replaced too.
    await Promise.all(sameDay.filter((key) => key !== id).map((key) => store.delete(key)));
    return store.put(stripAutoId({ ...entity, id }));
  });
}

export function deleteWeight(id: number): Promise<void> {
  return transaction(['weights'], 'readwrite', (tx) => tx.objectStore('weights').delete(id));
}
