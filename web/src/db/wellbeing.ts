import { wellbeingFromEntity, wellbeingToEntity } from '../domain/entities';
import { isWellbeingEmpty, type WellbeingDay } from '../domain/care';
import { toEpochDays, type LocalDate } from '../domain/time';
import { stripAutoId, transaction } from './connection';

/** Every noted day, in chronological order. */
export function getAllWellbeing(): Promise<WellbeingDay[]> {
  return transaction(['wellbeing'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('wellbeing').index('dateEpochDay').getAll();
    return entities.map(wellbeingFromEntity);
  });
}

export function getWellbeing(date: LocalDate): Promise<WellbeingDay | null> {
  return transaction(['wellbeing'], 'readonly', async (tx) => {
    const [entity] = await tx.objectStore('wellbeing').index('dateEpochDay').getAll(toEpochDays(date));
    return entity ? wellbeingFromEntity(entity) : null;
  });
}

/** Sets the well-being of a day; a day with nothing noted removes the day's entry. */
export function saveWellbeing(day: WellbeingDay): Promise<void> {
  return transaction(['wellbeing'], 'readwrite', async (tx) => {
    const store = tx.objectStore('wellbeing');
    const sameDay = await store.index('dateEpochDay').getAllKeys(toEpochDays(day.date));
    const [first, ...others] = sameDay;
    await Promise.all(others.map((key) => store.delete(key)));
    if (isWellbeingEmpty(day)) {
      if (first !== undefined) await store.delete(first);
      return;
    }
    await store.put(stripAutoId(wellbeingToEntity(day, first ?? 0)));
  });
}
