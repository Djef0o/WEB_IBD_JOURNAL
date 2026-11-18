import { examFromEntity, examToEntity, type ExamEntity } from '../domain/entities';
import type { Exam } from '../domain/models';
import { stripAutoId, transaction, type ReadTx, type Tx } from './connection';

/** `ORDER BY at`: ISO local date-times sort like text (ties: insertion order). */
function compareExams(a: ExamEntity, b: ExamEntity): number {
  return (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || a.id - b.id;
}

/** Every exam, by date and time (`observeAll`). */
export function getAllExams(): Promise<Exam[]> {
  return transaction(['exams'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('exams').getAll();
    return entities.sort(compareExams).map(examFromEntity);
  });
}

export function getExam(id: number): Promise<Exam | null> {
  return transaction(['exams'], 'readonly', async (tx) => {
    const entity = await tx.objectStore('exams').get(id);
    return entity ? examFromEntity(entity) : null;
  });
}

/** Saves (or replaces) the exam and returns its identifier (`id` 0: new exam). */
export function saveExam(exam: Exam): Promise<number> {
  return transaction(['exams'], 'readwrite', (tx) => tx.objectStore('exams').put(stripAutoId(examToEntity(exam))));
}

export function deleteExam(id: number): Promise<void> {
  return transaction(['exams'], 'readwrite', (tx) => tx.objectStore('exams').delete(id));
}

// --- Backup access (caller-owned transaction over the `exams` store) ---

/** All the stored exams, in key order (`getAll`). */
export function getAllExamEntities(tx: ReadTx): Promise<ExamEntity[]> {
  return tx.objectStore('exams').getAll();
}

export function deleteAllExams(tx: Tx): Promise<void> {
  return tx.objectStore('exams').clear();
}

/** Adds the exams with their own ids (`id` 0: new key); an existing id is an error (`insertAll`). */
export async function insertExamEntities(tx: Tx, entities: readonly ExamEntity[]): Promise<void> {
  const store = tx.objectStore('exams');
  await Promise.all(entities.map((entity) => store.add(stripAutoId(entity))));
}
