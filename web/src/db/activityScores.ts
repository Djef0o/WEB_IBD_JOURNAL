import { activityScoreFromEntity, activityScoreToEntity } from '../domain/entities';
import type { ActivityScore } from '../domain/care';
import { stripAutoId, transaction } from './connection';

/** Every score entry, by date then insertion order (`ORDER BY dateEpochDay, id`). */
export function getAllActivityScores(): Promise<ActivityScore[]> {
  return transaction(['activity_scores'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('activity_scores').getAll();
    return entities
      .sort((a, b) => a.dateEpochDay - b.dateEpochDay || a.id - b.id)
      .map(activityScoreFromEntity);
  });
}

/** Saves (or replaces) the score entry and returns its identifier (`id` 0: new entry). */
export function saveActivityScore(score: ActivityScore): Promise<number> {
  return transaction(['activity_scores'], 'readwrite', (tx) =>
    tx.objectStore('activity_scores').put(stripAutoId(activityScoreToEntity(score))));
}

export function deleteActivityScore(id: number): Promise<void> {
  return transaction(['activity_scores'], 'readwrite', (tx) => tx.objectStore('activity_scores').delete(id));
}
