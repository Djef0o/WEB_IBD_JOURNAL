import type { DBSchema, IDBPDatabase } from 'idb';
import type {
  ActivityScoreEntity, AppointmentEntity, CheckupEntity, DoctorQuestionEntity, DoseLogEntity, EmergencyEntity,
  ExamEntity, ExtraSymptomEntity, FlareEntity, LabResultEntity, MealEntity, MedicationEntity, ProductEntity,
  ProfileEntity, SteroidCourseEntity, StoolEntity, VaccinationEntity, WeightEntity, WellbeingEntity,
} from '../domain/entities';
import type { LabTest } from '../domain/health';

/*
 * IndexedDB schema of the journal: one object store per Room table of the Android app
 * (`AppDatabase.kt`, same names, same columns, same indexes), plus `prefs` (equivalent of
 * the DataStore of `AppPrefs.kt`) and `photos` (the meal photos, which Android keeps as
 * files in the app's internal storage), and `weights` (web addition, schema version 2).
 * Version 3 adds the tables of the later Android versions: flares, activity scores,
 * vaccinations, steroid courses, emergency sheet, extra symptoms, doctor questions,
 * appointments and well-being.
 * `prefs` and `photos` are not part of the backup.
 *
 * Room auto-generated keys (`autoGenerate = true`) are `autoIncrement` key paths here:
 * a row saved with `id = 0` gets a new key, like in Room (see `stripAutoId`).
 */

export const DB_NAME = 'ibd-journal';
export const DB_VERSION = 3;

export const STORE_NAMES = [
  'meals', 'stools', 'products', 'lab_results', 'dose_logs', 'profile',
  'medications', 'checkups', 'exams', 'prefs', 'photos', 'weights',
  'flares', 'activity_scores', 'vaccinations', 'steroid_courses', 'emergency_info',
  'extra_symptoms', 'doctor_questions', 'appointments', 'wellbeing',
] as const;
export type StoreName = (typeof STORE_NAMES)[number];

export interface IbdSchema extends DBSchema {
  meals: { key: number; value: MealEntity; indexes: { dateEpochDay: number } };
  stools: { key: number; value: StoolEntity; indexes: { dateEpochDay: number } };
  products: { key: string; value: ProductEntity };
  lab_results: {
    key: number;
    value: LabResultEntity;
    indexes: { test_dateEpochDay: [LabTest, number] };
  };
  dose_logs: {
    key: number;
    value: DoseLogEntity;
    /** Unique: a single confirmation per treatment and per occurrence. */
    indexes: { medicationId_scheduledAt: [number, number] };
  };
  profile: { key: number; value: ProfileEntity };
  medications: { key: number; value: MedicationEntity };
  checkups: { key: number; value: CheckupEntity };
  exams: { key: number; value: ExamEntity };
  /** Web addition (version 2): one weight per day, in kilograms. */
  weights: { key: number; value: WeightEntity; indexes: { dateEpochDay: number } };
  flares: { key: number; value: FlareEntity };
  activity_scores: { key: number; value: ActivityScoreEntity };
  vaccinations: { key: number; value: VaccinationEntity };
  steroid_courses: { key: number; value: SteroidCourseEntity };
  emergency_info: { key: number; value: EmergencyEntity };
  extra_symptoms: { key: number; value: ExtraSymptomEntity; indexes: { dateEpochDay: number } };
  doctor_questions: { key: number; value: DoctorQuestionEntity };
  appointments: { key: number; value: AppointmentEntity };
  wellbeing: { key: number; value: WellbeingEntity; indexes: { dateEpochDay: number } };
  /** Out-of-line keys: the preference name (see `prefs.ts`). */
  prefs: { key: string; value: unknown };
  /** Out-of-line keys: the relative path stored in `MealEntity.photoPath`. */
  photos: { key: string; value: Blob | EncryptedPhoto };
}

/** A photo sealed with the data key (see `photos.ts`). */
export interface EncryptedPhoto {
  mime: string;
  enc: Uint8Array;
}

export type IbdDb = IDBPDatabase<IbdSchema>;

/** Creates or migrates the schema: one `if (oldVersion < N)` step per version. */
export function upgradeDb(db: IbdDb, oldVersion: number): void {
  if (oldVersion < 1) {
    const auto = { keyPath: 'id', autoIncrement: true } as const;

    db.createObjectStore('meals', auto).createIndex('dateEpochDay', 'dateEpochDay');
    db.createObjectStore('stools', auto).createIndex('dateEpochDay', 'dateEpochDay');
    db.createObjectStore('products', { keyPath: 'barcode' });
    db.createObjectStore('lab_results', auto)
      .createIndex('test_dateEpochDay', ['test', 'dateEpochDay']);
    db.createObjectStore('dose_logs', auto)
      .createIndex('medicationId_scheduledAt', ['medicationId', 'scheduledAt'], { unique: true });
    db.createObjectStore('profile', { keyPath: 'id' });
    db.createObjectStore('medications', auto);
    db.createObjectStore('checkups', auto);
    db.createObjectStore('exams', auto);
    db.createObjectStore('prefs');
    db.createObjectStore('photos');
  }
  if (oldVersion < 2) {
    db.createObjectStore('weights', { keyPath: 'id', autoIncrement: true }).createIndex('dateEpochDay', 'dateEpochDay');
  }
  if (oldVersion < 3) {
    const auto = { keyPath: 'id', autoIncrement: true } as const;
    db.createObjectStore('flares', auto);
    db.createObjectStore('activity_scores', auto);
    db.createObjectStore('vaccinations', auto);
    db.createObjectStore('steroid_courses', auto);
    db.createObjectStore('emergency_info', { keyPath: 'id' });
    db.createObjectStore('extra_symptoms', auto).createIndex('dateEpochDay', 'dateEpochDay');
    db.createObjectStore('doctor_questions', auto);
    db.createObjectStore('appointments', auto);
    db.createObjectStore('wellbeing', auto).createIndex('dateEpochDay', 'dateEpochDay');
  }
}
