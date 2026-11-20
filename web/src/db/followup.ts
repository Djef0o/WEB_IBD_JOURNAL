import {
  appointmentFromEntity, appointmentToEntity, doctorQuestionFromEntity, doctorQuestionToEntity,
  extraSymptomsFromEntity, extraSymptomsToEntity,
} from '../domain/entities';
import {
  EXTRA_SYMPTOMS, type Appointment, type DoctorQuestion, type ExtraSymptom, type ExtraSymptomsDay,
} from '../domain/care';
import { toEpochDays, type LocalDate } from '../domain/time';
import { stripAutoId, transaction } from './connection';

/** Canonical form of a day's symptoms: known names only, in enum order, without duplicates. */
export function normalizeExtraSymptoms(symptoms: Iterable<ExtraSymptom>): ExtraSymptom[] {
  const set = new Set(symptoms);
  return EXTRA_SYMPTOMS.filter((symptom) => set.has(symptom));
}

// --- Extra symptoms: one row per day ---

/** Every day with extra symptoms, in chronological order. */
export function getAllExtraSymptoms(): Promise<ExtraSymptomsDay[]> {
  return transaction(['extra_symptoms'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('extra_symptoms').index('dateEpochDay').getAll();
    return entities.map(extraSymptomsFromEntity);
  });
}

export function getExtraSymptoms(date: LocalDate): Promise<ExtraSymptomsDay | null> {
  return transaction(['extra_symptoms'], 'readonly', async (tx) => {
    const [entity] = await tx.objectStore('extra_symptoms').index('dateEpochDay').getAll(toEpochDays(date));
    return entity ? extraSymptomsFromEntity(entity) : null;
  });
}

/** Sets the symptoms of a day; none at all removes the day's entry. */
export function saveExtraSymptoms(date: LocalDate, symptoms: Iterable<ExtraSymptom>): Promise<void> {
  return transaction(['extra_symptoms'], 'readwrite', async (tx) => {
    const store = tx.objectStore('extra_symptoms');
    const sameDay = await store.index('dateEpochDay').getAllKeys(toEpochDays(date));
    const kept = normalizeExtraSymptoms(symptoms);
    const [first, ...others] = sameDay;
    await Promise.all(others.map((key) => store.delete(key)));
    if (kept.length === 0) {
      if (first !== undefined) await store.delete(first);
      return;
    }
    await store.put(stripAutoId(extraSymptomsToEntity({ date, symptoms: kept }, first ?? 0)));
  });
}

// --- Questions for the doctor ---

/** Pending questions first, then by creation time (`ORDER BY done, createdAt, id`). */
export function getAllDoctorQuestions(): Promise<DoctorQuestion[]> {
  return transaction(['doctor_questions'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('doctor_questions').getAll();
    return entities
      .sort((a, b) => Number(a.done) - Number(b.done) || a.createdAt - b.createdAt || a.id - b.id)
      .map(doctorQuestionFromEntity);
  });
}

/** Saves (or replaces) the question and returns its identifier (`id` 0: new question). */
export function saveDoctorQuestion(question: DoctorQuestion): Promise<number> {
  return transaction(['doctor_questions'], 'readwrite', (tx) =>
    tx.objectStore('doctor_questions').put(stripAutoId(doctorQuestionToEntity(question))));
}

export function deleteDoctorQuestion(id: number): Promise<void> {
  return transaction(['doctor_questions'], 'readwrite', (tx) => tx.objectStore('doctor_questions').delete(id));
}

// --- Appointments ---

/** Every appointment, by date and time then insertion order (`ORDER BY at, id`). */
export function getAllAppointments(): Promise<Appointment[]> {
  return transaction(['appointments'], 'readonly', async (tx) => {
    const entities = await tx.objectStore('appointments').getAll();
    return entities
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || a.id - b.id)
      .map(appointmentFromEntity);
  });
}

/** Saves (or replaces) the appointment and returns its identifier (`id` 0: new appointment). */
export function saveAppointment(appointment: Appointment): Promise<number> {
  return transaction(['appointments'], 'readwrite', (tx) =>
    tx.objectStore('appointments').put(stripAutoId(appointmentToEntity(appointment))));
}

export function deleteAppointment(id: number): Promise<void> {
  return transaction(['appointments'], 'readwrite', (tx) => tx.objectStore('appointments').delete(id));
}
