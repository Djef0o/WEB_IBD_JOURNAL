import type { DoseLog, LabResult } from './health';
import type { Checkup, Medication, Profile } from './profile';
import type { LocalDate, LocalDateTime } from './time';

/** Current timestamp in milliseconds. */
export function nowEpochMillis(): number {
  return Date.now();
}

/** The three meal times tracked each day. Labels: UI side. */
export const MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

/** Food product (from Open Food Facts or the local cache). */
export interface Product {
  barcode: string;
  name: string | null;
  brand: string | null;
  nutriscore: string | null;
  imageUrl: string | null;
  ingredients: string | null;
}

/** A meal recorded for a given day. Dates are serialized as ISO ("2026-11-15"). */
export interface Meal {
  id: number;
  date: LocalDate;
  type: MealType;
  description: string;
  photoUri: string | null;
  product: Product | null;
}

export function meal(init: Pick<Meal, 'date' | 'type' | 'description'> & Partial<Meal>): Meal {
  return { id: 0, photoUri: null, product: null, ...init };
}

/**
 * A stool of the day with medical details (Bristol scale, blood, etc.). `urgency`: urgent
 * need; `nocturnal`: stool that woke from sleep (criteria of activity scores).
 * `falseUrge`: false urge (tenesmus), trip to the toilet without stool, sometimes with blood
 * or mucus; recorded with `bristolType` 0, it is not counted as a stool.
 */
export interface Stool {
  id: number;
  date: LocalDate;
  bristolType: number; // 1 to 7
  bloodLevel: number; // 0 to 5
  mucusLevel: number; // 0 to 5
  painLevel: number; // 0 to 5
  fatigueLevel: number; // 0 to 5
  comment: string;
  createdAt: number;
  urgency: boolean;
  nocturnal: boolean;
  falseUrge: boolean;
}

export function stool(init: Pick<Stool, 'date'> & Partial<Stool>): Stool {
  return {
    id: 0,
    bristolType: 4,
    bloodLevel: 0,
    mucusLevel: 0,
    painLevel: 0,
    fatigueLevel: 0,
    comment: '',
    createdAt: nowEpochMillis(),
    urgency: false,
    nocturnal: false,
    falseUrge: false,
    ...init,
  };
}

/** Real stool: neither a stool-free day (type 0) nor a false urge. */
export function isRealStool(s: Stool): boolean {
  return s.bristolType > 0;
}

/** Endoscopic exams tracked in Care. */
export const EXAM_TYPES = ['COLONOSCOPY', 'RECTOSIGMOIDOSCOPY'] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

/**
 * Scheduled exam and its preparation: low-residue diet (`dietDays` days before, 0 = none),
 * doses of the drinkable preparation (`prepFirstAt`, `prepSecondAt` for a split dose)
 * and, for colonoscopy under anesthesia, the anesthesia consultation (`anesthesiaAt`, null
 * until it is set). `remindersEnabled`: reminders for each step.
 */
export interface Exam {
  id: number;
  type: ExamType;
  at: LocalDateTime;
  note: string;
  dietDays: number;
  prepFirstAt: LocalDateTime | null;
  prepSecondAt: LocalDateTime | null;
  anesthesiaAt: LocalDateTime | null;
  remindersEnabled: boolean;
}

export function exam(init: Pick<Exam, 'type' | 'at'> & Partial<Exam>): Exam {
  return {
    id: 0,
    note: '',
    dietDays: 0,
    prepFirstAt: null,
    prepSecondAt: null,
    anesthesiaAt: null,
    remindersEnabled: true,
    ...init,
  };
}

/**
 * Root object for JSON export/import. Sections missing (undefined) from earlier backups
 * leave the current data untouched on import.
 */
/** Body weight (kg) on a given day; at most one per day. */
export interface Weight {
  id: number;
  date: LocalDate;
  kg: number;
}

export interface BackupData {
  meals: Meal[];
  stools: Stool[];
  profile?: Profile | null;
  medications?: Medication[] | null;
  checkups?: Checkup[] | null;
  labResults?: LabResult[] | null;
  doseLogs?: DoseLog[] | null;
  exams?: Exam[] | null;
  /** Web addition: the Android app ignores this key. */
  weights?: Weight[] | null;
}

/** Result of a product lookup by barcode. */
export type ProductLookup =
  | { kind: 'found'; product: Product }
  | { kind: 'notFound'; barcode: string };
