import { nowEpochMillis } from './models';
import type { LocalDate, LocalDateTime } from './time';

/*
 * Care records added to the Android app after the first web port: flares, activity scores,
 * vaccinations, steroid courses, emergency sheet, extra symptoms, doctor questions,
 * appointments and daily well-being (`CareModels.kt`, `FollowupModels.kt`, `Wellbeing.kt`).
 * The JSON shapes are those of the backup of the Android app.
 */

/** Inflammatory bowel disease type, chosen in the profile; null = not provided. */
export const DIAGNOSES = ['CROHN', 'ULCERATIVE_COLITIS', 'OTHER'] as const;
export type Diagnosis = (typeof DIAGNOSES)[number];

/** Flare period. `end` null = still ongoing. `treatment`: free text (e.g. "prednisone 40 mg"). */
export interface Flare {
  id: number;
  start: LocalDate;
  end: LocalDate | null;
  treatment: string;
  hospitalized: boolean;
  note: string;
}

export function flare(init: Pick<Flare, 'start'> & Partial<Flare>): Flare {
  return { id: 0, end: null, treatment: '', hospitalized: false, note: '', ...init };
}

/**
 * Self-assessed activity score. HBI: Harvey-Bradshaw index (Crohn's disease).
 * SCCAI: Simple Clinical Colitis Activity Index (ulcerative colitis).
 */
export const SCORE_KINDS = ['HBI', 'SCCAI'] as const;
export type ScoreKind = (typeof SCORE_KINDS)[number];

/** Answers of one score entry, in the order of the questionnaire. The total is computed, never stored. */
export interface ActivityScore {
  id: number;
  date: LocalDate;
  kind: ScoreKind;
  answers: number[];
}

export const VACCINE_TYPES = [
  'INFLUENZA', 'PNEUMOCOCCAL', 'COVID19', 'HEPATITIS_B', 'HPV', 'ZOSTER', 'TETANUS', 'OTHER',
] as const;
export type VaccineType = (typeof VACCINE_TYPES)[number];

/**
 * Vaccine given on `date`; `nextDue`: date of the next dose or booster, if planned.
 * `reminderEnabled`: notify a week before `nextDue` and on that day.
 */
export interface Vaccination {
  id: number;
  type: VaccineType;
  date: LocalDate;
  nextDue: LocalDate | null;
  note: string;
  reminderEnabled: boolean;
}

export function vaccination(init: Pick<Vaccination, 'type' | 'date'> & Partial<Vaccination>): Vaccination {
  return { id: 0, nextDue: null, note: '', reminderEnabled: false, ...init };
}

/** `doseMg` per day, during `days` consecutive days. */
export interface SteroidStep {
  doseMg: number;
  days: number;
}

/** Corticosteroid course: a daily dose that decreases by steps from `start`. */
export interface SteroidCourse {
  id: number;
  drug: string;
  start: LocalDate;
  steps: SteroidStep[];
  note: string;
}

export function steroidCourse(init: Pick<SteroidCourse, 'drug' | 'start' | 'steps'> & Partial<SteroidCourse>): SteroidCourse {
  return { id: 0, note: '', ...init };
}

/**
 * Emergency sheet. The diagnosis, name and birth date come from the profile, the treatments
 * from the treatments list. `showOnLockScreen`: readable without the PIN.
 */
export interface EmergencyInfo {
  allergies: string;
  doctorName: string;
  doctorPhone: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  showOnLockScreen: boolean;
}

export function emergencyInfo(init: Partial<EmergencyInfo> = {}): EmergencyInfo {
  return {
    allergies: '', doctorName: '', doctorPhone: '', contactName: '', contactPhone: '', notes: '',
    showOnLockScreen: false, ...init,
  };
}

/** Extra-intestinal manifestations and fever, noted per day. */
export const EXTRA_SYMPTOMS = ['JOINTS', 'SKIN', 'EYES', 'MOUTH_ULCERS', 'FEVER'] as const;
export type ExtraSymptom = (typeof EXTRA_SYMPTOMS)[number];

/** Manifestations noted on `date`; a day without any has no entry. Sorted, without duplicates. */
export interface ExtraSymptomsDay {
  date: LocalDate;
  symptoms: ExtraSymptom[];
}

/** Note to raise at the next appointment; `done` once asked. */
export interface DoctorQuestion {
  id: number;
  text: string;
  done: boolean;
  createdAt: number;
}

export function doctorQuestion(init: Pick<DoctorQuestion, 'text'> & Partial<DoctorQuestion>): DoctorQuestion {
  return { id: 0, done: false, createdAt: nowEpochMillis(), ...init };
}

export const APPOINTMENT_KINDS = [
  'GASTROENTEROLOGIST', 'DERMATOLOGIST', 'OPHTHALMOLOGIST', 'RHEUMATOLOGIST', 'DIETITIAN',
  'GENERAL_PRACTITIONER', 'OTHER',
] as const;
export type AppointmentKind = (typeof APPOINTMENT_KINDS)[number];

/**
 * Medical appointment. `at`: local date and time, unchanged if the time zone changes.
 * `place`: doctor or address; `remindersEnabled`: reminders the evening before and shortly before.
 */
export interface Appointment {
  id: number;
  kind: AppointmentKind;
  at: LocalDateTime;
  place: string;
  note: string;
  remindersEnabled: boolean;
}

export function appointment(init: Pick<Appointment, 'kind' | 'at'> & Partial<Appointment>): Appointment {
  return { id: 0, place: '', note: '', remindersEnabled: true, ...init };
}

/**
 * How a day went, beyond the gut: `sleep` (1 = very poor, 5 = very good), `stress` (1 = calm,
 * 5 = very stressed) and `mood` (1 = very low, 5 = very good); null = not noted. `period`:
 * menstrual period that day (only offered when the profile says female).
 */
export interface WellbeingDay {
  date: LocalDate;
  sleep: number | null;
  stress: number | null;
  mood: number | null;
  period: boolean;
}

export function wellbeingDay(init: Pick<WellbeingDay, 'date'> & Partial<WellbeingDay>): WellbeingDay {
  return { sleep: null, stress: null, mood: null, period: false, ...init };
}

/** Nothing noted: such a day has no entry. */
export function isWellbeingEmpty(day: WellbeingDay): boolean {
  return day.sleep === null && day.stress === null && day.mood === null && !day.period;
}

/** Bounds of the 1 to 5 scales. */
export const WELLBEING_MIN = 1;
export const WELLBEING_MAX = 5;
