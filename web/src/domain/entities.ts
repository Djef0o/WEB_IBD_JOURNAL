import type {
  ActivityScore, Appointment, AppointmentKind, Diagnosis, DoctorQuestion, EmergencyInfo, ExtraSymptom,
  ExtraSymptomsDay, Flare, ScoreKind, SteroidCourse, SteroidStep, Vaccination, VaccineType, WellbeingDay,
} from './care';
import type { DoseLog, DoseStatus, LabQualifier, LabResult, LabTest } from './health';
import {
  nowEpochMillis, type Exam, type ExamType, type Meal, type MealType, type Product, type Stool, type Weight,
} from './models';
import {
  DEFAULT_LOW_STOCK_DOSES,
  type Checkup, type CheckupType, type Medication, type Profile, type ReminderSchedule, type RepeatUnit, type Sex,
} from './profile';
import { fromEpochDays, toEpochDays } from './time';

/*
 * Stored (persisted) shapes: same columns as the Room entities of the Android app
 * (`Entities.kt`, `ExamStore.kt`). Dates are `dateEpochDay` numbers, enums are names;
 * these shapes are the contract of the IndexedDB stores.
 */

export interface MealEntity {
  id: number;
  dateEpochDay: number;
  mealType: MealType;
  description: string;
  photoPath: string | null;
  productBarcode: string | null;
  productName: string | null;
  createdAt: number;
}

export interface StoolEntity {
  id: number;
  dateEpochDay: number;
  bristolType: number;
  bloodLevel: number;
  mucusLevel: number;
  painLevel: number;
  fatigueLevel: number;
  comment: string;
  createdAt: number;
  urgency: boolean;
  nocturnal: boolean;
  falseUrge: boolean;
}

/** Body weight of one day (web addition). */
export interface WeightEntity {
  id: number;
  dateEpochDay: number;
  kg: number;
  createdAt: number;
}

/** Open Food Facts product cache, by barcode. */
export interface ProductEntity {
  barcode: string;
  name: string | null;
  brand: string | null;
  nutriscore: string | null;
  imageUrl: string | null;
  ingredients: string | null;
  fetchedAt: number;
}

/** Lab results: `qualifier` null = EXACT (only thresholds are stored). */
export interface LabResultEntity {
  id: number;
  test: LabTest;
  value: number;
  dateEpochDay: number;
  note: string;
  qualifier: LabQualifier | null;
  referenceLow: number | null;
  referenceHigh: number | null;
}

export interface DoseLogEntity {
  id: number;
  medicationId: number;
  scheduledAt: number;
  status: DoseStatus;
  loggedAt: number;
}

/** A single row (id = {@link PROFILE_SINGLE_ID}): the app only handles one profile. */
export interface ProfileEntity {
  id: number;
  firstName: string;
  lastName: string;
  birthDateEpochDay: number | null;
  sex: Sex | null;
  /** Added with the flares (Android database version 10); absent from older rows. */
  diagnosis?: Diagnosis | null;
}

export const PROFILE_SINGLE_ID = 1;

/** Scheduling columns shared by treatments and checkups (Room `@Embedded`: flattened columns). */
export interface ScheduleColumns {
  reminderEnabled: boolean;
  startDateEpochDay: number;
  hour: number;
  minute: number;
  repeatEvery: number;
  repeatUnit: RepeatUnit;
}

export interface MedicationEntity extends ScheduleColumns {
  id: number;
  name: string;
  dosage: string;
  createdAt: number;
  refillAlert: boolean;
  stockEndEpochDay: number | null;
  /** Added with the stock count (Android database version 14); absent from older rows. */
  stockDoses?: number | null;
  lowStockDoses?: number;
}

export interface CheckupEntity extends ScheduleColumns {
  id: number;
  type: CheckupType;
  note: string;
  createdAt: number;
}

/**
 * Exams. Local dates and times in ISO format ("2026-12-04T09:30"): they stay those of the
 * appointment even if the time zone changes, and sort like text.
 */
export interface ExamEntity {
  id: number;
  type: ExamType;
  at: string;
  note: string;
  dietDays: number;
  prepFirstAt: string | null;
  prepSecondAt: string | null;
  anesthesiaAt: string | null;
  remindersEnabled: boolean;
}

// --- Mappers entity <-> domain model ---

export function mealFromEntity(entity: MealEntity, product: ProductEntity | null = null): Meal {
  return {
    id: entity.id,
    date: fromEpochDays(entity.dateEpochDay),
    type: entity.mealType,
    description: entity.description,
    photoUri: entity.photoPath,
    // The meal only stores barcode and name; the rest comes from the `products` cache.
    product: product
      ? productFromEntity(product)
      : entity.productBarcode === null
        ? null
        : { barcode: entity.productBarcode, name: entity.productName, brand: null, nutriscore: null, imageUrl: null, ingredients: null },
  };
}

export function mealToEntity(meal: Meal, createdAt: number = nowEpochMillis()): MealEntity {
  return {
    id: meal.id,
    dateEpochDay: toEpochDays(meal.date),
    mealType: meal.type,
    description: meal.description,
    photoPath: meal.photoUri,
    productBarcode: meal.product?.barcode ?? null,
    productName: meal.product?.name ?? null,
    createdAt,
  };
}

export function stoolFromEntity(entity: StoolEntity): Stool {
  const { dateEpochDay, ...rest } = entity;
  return { ...rest, date: fromEpochDays(dateEpochDay) };
}

export function stoolToEntity(stool: Stool): StoolEntity {
  const { date, ...rest } = stool;
  return { ...rest, dateEpochDay: toEpochDays(date) };
}

export function labResultFromEntity(entity: LabResultEntity): LabResult {
  return {
    id: entity.id,
    test: entity.test,
    value: entity.value,
    date: fromEpochDays(entity.dateEpochDay),
    note: entity.note,
    qualifier: entity.qualifier ?? 'EXACT',
    referenceLow: entity.referenceLow,
    referenceHigh: entity.referenceHigh,
  };
}

export function labResultToEntity(result: LabResult): LabResultEntity {
  return {
    id: result.id,
    test: result.test,
    value: result.value,
    dateEpochDay: toEpochDays(result.date),
    note: result.note,
    qualifier: result.qualifier === 'EXACT' ? null : result.qualifier,
    referenceLow: result.referenceLow,
    referenceHigh: result.referenceHigh,
  };
}

export function doseLogFromEntity(entity: DoseLogEntity): DoseLog {
  return { ...entity };
}

export function doseLogToEntity(log: DoseLog): DoseLogEntity {
  return { ...log };
}

export function productFromEntity(entity: ProductEntity): Product {
  const { fetchedAt: _fetchedAt, ...product } = entity;
  return product;
}

export function productToEntity(product: Product, fetchedAt: number = nowEpochMillis()): ProductEntity {
  return { ...product, fetchedAt };
}

export function profileFromEntity(entity: ProfileEntity): Profile {
  return {
    firstName: entity.firstName,
    lastName: entity.lastName,
    birthDate: entity.birthDateEpochDay === null ? null : fromEpochDays(entity.birthDateEpochDay),
    sex: entity.sex,
    diagnosis: entity.diagnosis ?? null,
  };
}

export function profileToEntity(profile: Profile): ProfileEntity {
  return {
    id: PROFILE_SINGLE_ID,
    firstName: profile.firstName,
    lastName: profile.lastName,
    birthDateEpochDay: profile.birthDate === null ? null : toEpochDays(profile.birthDate),
    sex: profile.sex,
    diagnosis: profile.diagnosis,
  };
}

export function scheduleFromColumns(columns: ScheduleColumns): ReminderSchedule {
  return {
    enabled: columns.reminderEnabled,
    startDate: fromEpochDays(columns.startDateEpochDay),
    hour: columns.hour,
    minute: columns.minute,
    repeatEvery: columns.repeatEvery,
    repeatUnit: columns.repeatUnit,
  };
}

export function scheduleToColumns(schedule: ReminderSchedule): ScheduleColumns {
  return {
    reminderEnabled: schedule.enabled,
    startDateEpochDay: toEpochDays(schedule.startDate),
    hour: schedule.hour,
    minute: schedule.minute,
    repeatEvery: schedule.repeatEvery,
    repeatUnit: schedule.repeatUnit,
  };
}

export function medicationFromEntity(entity: MedicationEntity): Medication {
  return {
    id: entity.id,
    name: entity.name,
    dosage: entity.dosage,
    schedule: scheduleFromColumns(entity),
    refillAlert: entity.refillAlert,
    stockDoses: entity.stockDoses ?? null,
    lowStockDoses: entity.lowStockDoses ?? DEFAULT_LOW_STOCK_DOSES,
    stockEndDate: entity.stockEndEpochDay === null ? null : fromEpochDays(entity.stockEndEpochDay),
  };
}

export function medicationToEntity(med: Medication, createdAt: number = nowEpochMillis()): MedicationEntity {
  return {
    id: med.id,
    name: med.name,
    dosage: med.dosage,
    ...scheduleToColumns(med.schedule),
    createdAt,
    refillAlert: med.refillAlert,
    stockEndEpochDay: med.stockEndDate === null ? null : toEpochDays(med.stockEndDate),
    stockDoses: med.stockDoses,
    lowStockDoses: med.lowStockDoses,
  };
}

export function checkupFromEntity(entity: CheckupEntity): Checkup {
  return { id: entity.id, type: entity.type, note: entity.note, schedule: scheduleFromColumns(entity) };
}

export function checkupToEntity(checkup: Checkup, createdAt: number = nowEpochMillis()): CheckupEntity {
  return {
    id: checkup.id,
    type: checkup.type,
    note: checkup.note,
    ...scheduleToColumns(checkup.schedule),
    createdAt,
  };
}

export function examFromEntity(entity: ExamEntity): Exam {
  return { ...entity };
}

export function examToEntity(exam: Exam): ExamEntity {
  return { ...exam };
}

export function weightFromEntity(entity: WeightEntity): Weight {
  return { id: entity.id, date: fromEpochDays(entity.dateEpochDay), kg: entity.kg };
}

export function weightToEntity(weight: Weight, createdAt: number = nowEpochMillis()): WeightEntity {
  return { id: weight.id, dateEpochDay: toEpochDays(weight.date), kg: weight.kg, createdAt };
}

// --- Care records (flares, scores, vaccinations, steroids, emergency, follow-up, well-being) ---
//
// Same columns as the Room entities, except that the lists the Room entities flatten into text
// (`answers`, `steps`, `symptoms`) are stored as arrays.

export interface FlareEntity {
  id: number;
  startEpochDay: number;
  endEpochDay: number | null;
  treatment: string;
  hospitalized: boolean;
  note: string;
}

export interface ActivityScoreEntity {
  id: number;
  dateEpochDay: number;
  kind: ScoreKind;
  answers: number[];
}

export interface VaccinationEntity {
  id: number;
  type: VaccineType;
  dateEpochDay: number;
  nextDueEpochDay: number | null;
  note: string;
  reminderEnabled: boolean;
}

export interface SteroidCourseEntity {
  id: number;
  drug: string;
  startEpochDay: number;
  steps: SteroidStep[];
  note: string;
}

/** A single row (id = {@link EMERGENCY_SINGLE_ID}). */
export interface EmergencyEntity extends EmergencyInfo {
  id: number;
}

export const EMERGENCY_SINGLE_ID = 1;

/** One row per day (the repository replaces the row of the same day: the date is not a key, so that it stays encrypted). */
export interface ExtraSymptomEntity {
  id: number;
  dateEpochDay: number;
  symptoms: ExtraSymptom[];
}

export interface DoctorQuestionEntity {
  id: number;
  text: string;
  done: boolean;
  createdAt: number;
}

export interface AppointmentEntity {
  id: number;
  kind: AppointmentKind;
  at: string;
  place: string;
  note: string;
  remindersEnabled: boolean;
}

/** One row per day (see {@link ExtraSymptomEntity}). */
export interface WellbeingEntity {
  id: number;
  dateEpochDay: number;
  sleep: number | null;
  stress: number | null;
  mood: number | null;
  period: boolean;
}

export function flareFromEntity(entity: FlareEntity): Flare {
  return {
    id: entity.id,
    start: fromEpochDays(entity.startEpochDay),
    end: entity.endEpochDay === null ? null : fromEpochDays(entity.endEpochDay),
    treatment: entity.treatment,
    hospitalized: entity.hospitalized,
    note: entity.note,
  };
}

export function flareToEntity(flare: Flare): FlareEntity {
  return {
    id: flare.id,
    startEpochDay: toEpochDays(flare.start),
    endEpochDay: flare.end === null ? null : toEpochDays(flare.end),
    treatment: flare.treatment,
    hospitalized: flare.hospitalized,
    note: flare.note,
  };
}

export function activityScoreFromEntity(entity: ActivityScoreEntity): ActivityScore {
  return { id: entity.id, date: fromEpochDays(entity.dateEpochDay), kind: entity.kind, answers: [...entity.answers] };
}

export function activityScoreToEntity(score: ActivityScore): ActivityScoreEntity {
  return { id: score.id, dateEpochDay: toEpochDays(score.date), kind: score.kind, answers: [...score.answers] };
}

export function vaccinationFromEntity(entity: VaccinationEntity): Vaccination {
  return {
    id: entity.id,
    type: entity.type,
    date: fromEpochDays(entity.dateEpochDay),
    nextDue: entity.nextDueEpochDay === null ? null : fromEpochDays(entity.nextDueEpochDay),
    note: entity.note,
    reminderEnabled: entity.reminderEnabled,
  };
}

export function vaccinationToEntity(vaccination: Vaccination): VaccinationEntity {
  return {
    id: vaccination.id,
    type: vaccination.type,
    dateEpochDay: toEpochDays(vaccination.date),
    nextDueEpochDay: vaccination.nextDue === null ? null : toEpochDays(vaccination.nextDue),
    note: vaccination.note,
    reminderEnabled: vaccination.reminderEnabled,
  };
}

export function steroidCourseFromEntity(entity: SteroidCourseEntity): SteroidCourse {
  return {
    id: entity.id,
    drug: entity.drug,
    start: fromEpochDays(entity.startEpochDay),
    steps: entity.steps.map((step) => ({ ...step })),
    note: entity.note,
  };
}

export function steroidCourseToEntity(course: SteroidCourse): SteroidCourseEntity {
  return {
    id: course.id,
    drug: course.drug,
    startEpochDay: toEpochDays(course.start),
    steps: course.steps.map((step) => ({ ...step })),
    note: course.note,
  };
}

export function emergencyInfoFromEntity(entity: EmergencyEntity): EmergencyInfo {
  const { id: _id, ...info } = entity;
  return info;
}

export function emergencyInfoToEntity(info: EmergencyInfo): EmergencyEntity {
  return { id: EMERGENCY_SINGLE_ID, ...info };
}

export function extraSymptomsFromEntity(entity: ExtraSymptomEntity): ExtraSymptomsDay {
  return { date: fromEpochDays(entity.dateEpochDay), symptoms: [...entity.symptoms] };
}

export function extraSymptomsToEntity(day: ExtraSymptomsDay, id = 0): ExtraSymptomEntity {
  return { id, dateEpochDay: toEpochDays(day.date), symptoms: [...day.symptoms] };
}

export function doctorQuestionFromEntity(entity: DoctorQuestionEntity): DoctorQuestion {
  return { ...entity };
}

export function doctorQuestionToEntity(question: DoctorQuestion): DoctorQuestionEntity {
  return { ...question };
}

export function appointmentFromEntity(entity: AppointmentEntity): Appointment {
  return { ...entity };
}

export function appointmentToEntity(appointment: Appointment): AppointmentEntity {
  return { ...appointment };
}

export function wellbeingFromEntity(entity: WellbeingEntity): WellbeingDay {
  const { id: _id, dateEpochDay, ...rest } = entity;
  return { date: fromEpochDays(dateEpochDay), ...rest };
}

export function wellbeingToEntity(day: WellbeingDay, id = 0): WellbeingEntity {
  const { date, ...rest } = day;
  return { id, dateEpochDay: toEpochDays(date), ...rest };
}
