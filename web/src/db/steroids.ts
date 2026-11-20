import { steroidCourseFromEntity, steroidCourseToEntity } from '../domain/entities';
import type { SteroidCourse } from '../domain/care';
import { stripAutoId, transaction } from './connection';

/** Every steroid course, by start date then insertion order (`ORDER BY startEpochDay, id`). */
export function getAllSteroidCourses(): Promise<SteroidCourse[]> {
  return transaction(['steroid_courses'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('steroid_courses').getAll();
    return entities
      .sort((a, b) => a.startEpochDay - b.startEpochDay || a.id - b.id)
      .map(steroidCourseFromEntity);
  });
}

/** Saves (or replaces) the course and returns its identifier (`id` 0: new course). */
export function saveSteroidCourse(course: SteroidCourse): Promise<number> {
  return transaction(['steroid_courses'], 'readwrite', (tx) =>
    tx.objectStore('steroid_courses').put(stripAutoId(steroidCourseToEntity(course))));
}

export function deleteSteroidCourse(id: number): Promise<void> {
  return transaction(['steroid_courses'], 'readwrite', (tx) => tx.objectStore('steroid_courses').delete(id));
}
